// NEXUS Extension - Popup Logic

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// ── STATE ──────────────────────────────────────────────────
let state = {
  apiKey: '',
  adBlockEnabled: true,
  trackingEnabled: true,
  scriptBlock: false,
  cosmeticFilter: true,
  darkMode: false,
  focusMode: false,
  typoEnhance: false,
  customCss: '',
  theme: 'nexus',
  blockedCount: 0,
  language: 'pt-BR',
  personality: 'assistant',
  chatHistory: []
};

let pageContent = '';

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  initTabs();
  initAdBlocker();
  initAI();
  initTheme();
  initSettings();
  await loadCurrentTab();
  updateUI();
});

async function loadState() {
  const stored = await chrome.storage.local.get(null);
  state = { ...state, ...stored };
}

async function saveState() {
  await chrome.storage.local.set(state);
}

// ── TABS ───────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });
}

// ── CURRENT TAB ────────────────────────────────────────────
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      document.getElementById('currentDomain').textContent = url.hostname;

      // Get page content for AI context
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.body?.innerText?.slice(0, 3000) || ''
        });
        if (results?.[0]?.result) pageContent = results[0].result;
      } catch (e) {
        pageContent = '';
      }
    }
  } catch (e) {
    document.getElementById('currentDomain').textContent = 'N/A';
  }
}

// ── UPDATE UI ──────────────────────────────────────────────
function updateUI() {
  // Ad blocker toggles
  document.getElementById('adBlockToggle').checked = state.adBlockEnabled;
  document.getElementById('trackingToggle').checked = state.trackingEnabled;
  document.getElementById('scriptToggle').checked = state.scriptBlock;
  document.getElementById('cosmeticToggle').checked = state.cosmeticFilter;

  // Stats
  document.getElementById('blockedCount').textContent = state.blockedCount || 0;
  document.getElementById('savedTime').textContent = `${Math.floor((state.blockedCount || 0) * 0.15)}s`;

  // Theme toggles
  document.getElementById('darkModeToggle').checked = state.darkMode;
  document.getElementById('focusModeToggle').checked = state.focusMode;
  document.getElementById('typoToggle').checked = state.typoEnhance;
  document.getElementById('customCss').value = state.customCss || '';

  // Active theme
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.theme === state.theme);
  });

  // API Key section
  const hasApiKey = !!state.apiKey;
  const apiSection = document.getElementById('apiKeySection');
  if (apiSection) apiSection.classList.toggle('hidden', hasApiKey);

  if (state.apiKey) {
    document.getElementById('apiKeyInput').value = state.apiKey;
  }

  document.getElementById('langSelect').value = state.language || 'pt-BR';
  document.getElementById('personalitySelect').value = state.personality || 'assistant';
}

// ── AD BLOCKER ─────────────────────────────────────────────
function initAdBlocker() {
  document.getElementById('adBlockToggle').addEventListener('change', async (e) => {
    state.adBlockEnabled = e.target.checked;
    await saveState();
    sendToBackground('TOGGLE_ADBLOCK', { enabled: e.target.checked });
    showToast(e.target.checked ? 'Bloqueador ativado' : 'Bloqueador desativado');
  });

  document.getElementById('trackingToggle').addEventListener('change', async (e) => {
    state.trackingEnabled = e.target.checked;
    await saveState();
    sendToBackground('TOGGLE_TRACKING', { enabled: e.target.checked });
  });

  document.getElementById('scriptToggle').addEventListener('change', async (e) => {
    state.scriptBlock = e.target.checked;
    await saveState();
    sendToBackground('TOGGLE_SCRIPTS', { enabled: e.target.checked });
  });

  document.getElementById('cosmeticToggle').addEventListener('change', async (e) => {
    state.cosmeticFilter = e.target.checked;
    await saveState();
    sendContentScript('TOGGLE_COSMETIC', { enabled: e.target.checked });
  });

  document.getElementById('whitelistBtn').addEventListener('click', async () => {
    const domain = document.getElementById('currentDomain').textContent;
    if (domain && domain !== '—' && domain !== 'N/A') {
      const whitelist = state.whitelist || [];
      const idx = whitelist.indexOf(domain);
      if (idx === -1) {
        whitelist.push(domain);
        document.getElementById('whitelistBtn').textContent = 'Remover';
        showToast(`${domain} permitido`);
      } else {
        whitelist.splice(idx, 1);
        document.getElementById('whitelistBtn').textContent = 'Permitir';
        showToast(`${domain} bloqueado`);
      }
      state.whitelist = whitelist;
      await saveState();
    }
  });
}

// ── AI CHAT ────────────────────────────────────────────────
function initAI() {
  const sendBtn = document.getElementById('sendBtn');
  const chatInput = document.getElementById('chatInput');

  sendBtn.addEventListener('click', () => sendMessage());

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('clearChat').addEventListener('click', () => {
    state.chatHistory = [];
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    appendMessage('assistant', 'Conversa limpa! Como posso ajudar?');
  });

  document.getElementById('openApiSettings').addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="settings"]').classList.add('active');
    document.getElementById('tab-settings').classList.add('active');
  });

  // Quick action buttons
  document.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'summarize') {
        sendMessage('Resuma o conteúdo desta página de forma clara e concisa.');
      } else if (action === 'translate') {
        sendMessage('Traduza o conteúdo principal desta página para português brasileiro.');
      } else if (action === 'explain') {
        sendMessage('Explique o tópico principal desta página de forma simples.');
      }
    });
  });
}

async function sendMessage(text) {
  const input = document.getElementById('chatInput');
  const msg = text || input.value.trim();
  if (!msg) return;

  if (!state.apiKey) {
    showToast('Configure sua API key primeiro!');
    return;
  }

  if (!text) input.value = '';

  appendMessage('user', msg);
  const loadingEl = appendMessage('assistant', '', true);

  state.chatHistory.push({ role: 'user', content: msg });

  try {
    const systemPrompt = buildSystemPrompt();
    const messages = state.chatHistory.slice(-10); // keep context limited

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `API Error ${response.status}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sem resposta.';

    loadingEl.classList.remove('loading');
    loadingEl.querySelector('.msg-bubble').textContent = reply;
    state.chatHistory.push({ role: 'assistant', content: reply });

  } catch (err) {
    loadingEl.classList.remove('loading');
    loadingEl.querySelector('.msg-bubble').textContent = `Erro: ${err.message}`;
    loadingEl.querySelector('.msg-bubble').style.color = '#f87171';
  }
}

function buildSystemPrompt() {
  const personalities = {
    assistant: 'Você é um assistente útil e amigável.',
    concise: 'Você é conciso. Responda em poucas palavras, direto ao ponto.',
    detailed: 'Você fornece respostas detalhadas e completas com exemplos.',
    creative: 'Você é criativo e usa analogias e metáforas em suas respostas.'
  };

  const lang = state.language === 'pt-BR' ? 'em português brasileiro' : 
               state.language === 'es' ? 'em espanhol' : 'in English';

  let prompt = `${personalities[state.personality || 'assistant']} Responda sempre ${lang}.`;

  if (pageContent) {
    prompt += `\n\nContexto da página atual:\n${pageContent.slice(0, 1500)}`;
  }

  return prompt;
}

function appendMessage(role, text, loading = false) {
  const chatBox = document.getElementById('chatBox');
  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role}${loading ? ' loading' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'assistant' ? 'N' : 'U';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = text;

  if (role === 'user') {
    msgEl.appendChild(bubble);
    msgEl.appendChild(avatar);
  } else {
    msgEl.appendChild(avatar);
    msgEl.appendChild(bubble);
  }

  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msgEl;
}

// ── THEME ──────────────────────────────────────────────────
function initTheme() {
  // Theme cards
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', async () => {
      state.theme = card.dataset.theme;
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      await saveState();
      showToast(`Tema ${card.dataset.theme} aplicado`);
    });
  });

  // Dark mode
  document.getElementById('darkModeToggle').addEventListener('change', async (e) => {
    state.darkMode = e.target.checked;
    await saveState();
    sendContentScript('TOGGLE_DARK_MODE', { enabled: e.target.checked });
    showToast(e.target.checked ? 'Modo escuro ativado' : 'Modo escuro desativado');
  });

  // Focus mode
  document.getElementById('focusModeToggle').addEventListener('change', async (e) => {
    state.focusMode = e.target.checked;
    await saveState();
    sendContentScript('TOGGLE_FOCUS_MODE', { enabled: e.target.checked });
    showToast(e.target.checked ? 'Modo foco ativado' : 'Modo foco desativado');
  });

  // Typography
  document.getElementById('typoToggle').addEventListener('change', async (e) => {
    state.typoEnhance = e.target.checked;
    await saveState();
    sendContentScript('TOGGLE_TYPOGRAPHY', { enabled: e.target.checked });
  });

  // Custom CSS
  document.getElementById('applyCss').addEventListener('click', async () => {
    const css = document.getElementById('customCss').value;
    state.customCss = css;
    await saveState();
    sendContentScript('APPLY_CUSTOM_CSS', { css });
    showToast('CSS aplicado!');
  });
}

// ── SETTINGS ───────────────────────────────────────────────
function initSettings() {
  // Toggle API key visibility
  document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Save API key
  document.getElementById('saveApiKey').addEventListener('click', async () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
      showToast('Insira uma chave válida');
      return;
    }
    state.apiKey = key;
    await saveState();
    document.getElementById('apiKeySection')?.classList.add('hidden');
    showToast('Chave API salva!');
  });

  document.getElementById('langSelect').addEventListener('change', async (e) => {
    state.language = e.target.value;
    await saveState();
  });

  document.getElementById('personalitySelect').addEventListener('change', async (e) => {
    state.personality = e.target.value;
    await saveState();
  });

  document.getElementById('resetStats').addEventListener('click', async () => {
    state.blockedCount = 0;
    await saveState();
    updateUI();
    showToast('Estatísticas resetadas');
  });

  document.getElementById('resetAll').addEventListener('click', async () => {
    if (confirm('Resetar todas as configurações?')) {
      await chrome.storage.local.clear();
      showToast('Tudo resetado!');
      setTimeout(() => location.reload(), 800);
    }
  });
}

// ── MESSAGING ──────────────────────────────────────────────
function sendToBackground(action, data = {}) {
  chrome.runtime.sendMessage({ action, ...data }).catch(() => {});
}

async function sendContentScript(action, data = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action, ...data }).catch(() => {});
    }
  } catch (e) {}
}

// ── TOAST ──────────────────────────────────────────────────
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}