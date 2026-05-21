// NEXUS — Background Service Worker

let blockedCount = 0;
let settings = {
  adBlocker: true,
  aiEnabled: true,
  themeActive: false,
  automationsActive: false,
  apiKey: ''
};

// Load settings on startup
chrome.storage.sync.get(['settings', 'blockedCount'], (data) => {
  if (data.settings) settings = { ...settings, ...data.settings };
  if (data.blockedCount) blockedCount = data.blockedCount;
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATS') {
    sendResponse({ blockedCount, settings });
    return true;
  }
  if (msg.type === 'UPDATE_SETTINGS') {
    settings = { ...settings, ...msg.settings };
    chrome.storage.sync.set({ settings });
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings }).catch(() => {});
      });
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'AD_BLOCKED') {
    blockedCount++;
    chrome.storage.sync.set({ blockedCount });
    sendResponse({ blockedCount });
    return true;
  }
  if (msg.type === 'AI_QUERY') {
    handleAIQuery(msg.prompt, msg.apiKey).then(response => {
      sendResponse({ response });
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
  if (msg.type === 'RUN_AUTOMATION') {
    runAutomation(msg.automation, sender.tab).then(result => {
      sendResponse({ result });
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
});

async function handleAIQuery(prompt, apiKey) {
  if (!apiKey) throw new Error('API Key não configurada');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) throw new Error('Erro na API: ' + response.status);
  const data = await response.json();
  return data.content[0].text;
}

async function runAutomation(automation, tab) {
  switch (automation.type) {
    case 'scroll_to_bottom':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      });
      return 'Rolagem executada';
    case 'click_element':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (selector) => {
          const el = document.querySelector(selector);
          if (el) el.click();
        },
        args: [automation.selector]
      });
      return 'Clique executado';
    case 'fill_forms':
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (data) => {
          Object.entries(data).forEach(([selector, value]) => {
            const el = document.querySelector(selector);
            if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }
          });
        },
        args: [automation.formData]
      });
      return 'Formulário preenchido';
    case 'screenshot':
      return new Promise((resolve) => {
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (url) => {
          resolve(url || 'Screenshot capturado');
        });
      });
    default:
      return 'Automação desconhecida';
  }
}

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'nexus-ai',
    title: '🤖 NEXUS — Perguntar à IA',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'nexus-block',
    title: '🚫 NEXUS — Bloquear elemento',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'nexus-ai') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_AI_POPUP',
      text: info.selectionText
    }).catch(() => {});
  }
  if (info.menuItemId === 'nexus-block') {
    chrome.tabs.sendMessage(tab.id, { type: 'PICK_ELEMENT_TO_BLOCK' }).catch(() => {});
  }
});