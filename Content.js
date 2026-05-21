// NEXUS — Content Script

const AD_SELECTORS = [
  '[class*="ad-"]','[class*="-ad"]','[id*="google_ads"]',
  '[id*="ad-container"]','[class*="advertisement"]','[class*="banner-ad"]',
  '[data-ad]','[data-ad-slot]','ins.adsbygoogle','.adsbygoogle',
  '[class*="sponsored"]','[class*="promo-ad"]','.dfp-ad','[id*="dfp"]',
  'iframe[src*="doubleclick"]','iframe[src*="googlesyndication"]',
  '[class*="outbrain"]','[class*="taboola"]','[id*="taboola"]'
];

let settings = { adBlocker: true, themeActive: false, customCSS: '' };
let blockedElements = JSON.parse(localStorage.getItem('nexus_blocked') || '[]');
let pickingElement = false;

// Get settings
chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
  if (res) { settings = res.settings; applyAll(); }
});

// Listen for updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SETTINGS_UPDATED') {
    settings = { ...settings, ...msg.settings };
    applyAll();
  }
  if (msg.type === 'SHOW_AI_POPUP') showAIFloater(msg.text);
  if (msg.type === 'PICK_ELEMENT_TO_BLOCK') startElementPicker();
  if (msg.type === 'APPLY_THEME') applyTheme(msg.theme);
  if (msg.type === 'INJECT_CSS') injectCustomCSS(msg.css);
});

function applyAll() {
  if (settings.adBlocker) blockAds();
  if (settings.themeActive && settings.customCSS) injectCustomCSS(settings.customCSS);
  applyBlockedElements();
}

function blockAds() {
  const observer = new MutationObserver(() => removeAds());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  removeAds();
}

function removeAds() {
  let count = 0;
  AD_SELECTORS.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!el.dataset.nexusBlocked) {
        el.dataset.nexusBlocked = '1';
        el.style.cssText = 'display:none!important;visibility:hidden!important;';
        count++;
      }
    });
  });
  if (count > 0) {
    chrome.runtime.sendMessage({ type: 'AD_BLOCKED' });
  }
}

function applyBlockedElements() {
  blockedElements.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      el.style.cssText = 'display:none!important;';
    });
  });
}

function injectCustomCSS(css) {
  let style = document.getElementById('nexus-custom-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'nexus-custom-style';
    document.head.appendChild(style);
  }
  style.textContent = css;
}

function startElementPicker() {
  pickingElement = true;
  document.body.style.cursor = 'crosshair';
  let highlighted = null;
  const over = (e) => {
    if (highlighted) highlighted.style.outline = '';
    highlighted = e.target;
    highlighted.style.outline = '2px solid #9B5CFF';
    e.stopPropagation();
  };
  const click = (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = e.target;
    const selector = generateSelector(el);
    blockedElements.push(selector);
    localStorage.setItem('nexus_blocked', JSON.stringify(blockedElements));
    el.style.cssText = 'display:none!important;';
    cleanup();
  };
  const cleanup = () => {
    pickingElement = false;
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', over, true);
    document.removeEventListener('click', click, true);
  };
  document.addEventListener('mouseover', over, true);
  document.addEventListener('click', click, true);
}

function generateSelector(el) {
  if (el.id) return '#' + el.id;
  let path = el.tagName.toLowerCase();
  if (el.className) path += '.' + [...el.classList].slice(0, 2).join('.');
  return path;
}

function showAIFloater(text) {
  const existing = document.getElementById('nexus-ai-floater');
  if (existing) existing.remove();
  const floater = document.createElement('div');
  floater.id = 'nexus-ai-floater';
  floater.innerHTML = `
    <div style="
      position:fixed;bottom:24px;right:24px;z-index:2147483647;
      background:#0D0D1A;border:1px solid #7C3AED;border-radius:16px;
      width:340px;max-height:420px;display:flex;flex-direction:column;
      font-family:'Segoe UI',system-ui,sans-serif;box-shadow:0 0 40px rgba(124,58,237,0.3);
    ">
      <div style="padding:14px 16px;border-bottom:1px solid #1E1E3A;display:flex;align-items:center;gap:10px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#7C3AED;box-shadow:0 0 8px #7C3AED;"></div>
        <span style="color:#C4B5FD;font-size:13px;font-weight:600;letter-spacing:0.05em;">NEXUS IA</span>
        <button id="nexus-close" style="margin-left:auto;background:none;border:none;color:#6B6B9A;cursor:pointer;font-size:18px;padding:0;">×</button>
      </div>
      <div style="padding:12px 16px;flex:1;overflow-y:auto;">
        <div style="background:#13132A;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#9090B0;border-left:2px solid #7C3AED;">
          "${text ? text.slice(0, 100) + (text.length > 100 ? '...' : '') : 'Faça uma pergunta...'}"
        </div>
        <div id="nexus-ai-response" style="color:#E0E0FF;font-size:13px;line-height:1.6;min-height:60px;">
          <span style="color:#7C3AED;">Aguardando...</span>
        </div>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #1E1E3A;display:flex;gap:8px;">
        <input id="nexus-ai-input" placeholder="Pergunte algo..." style="
          flex:1;background:#13132A;border:1px solid #2D2D5A;border-radius:8px;
          padding:8px 12px;color:#E0E0FF;font-size:13px;outline:none;
        " value="${text || ''}"/>
        <button id="nexus-ask" style="
          background:#7C3AED;border:none;border-radius:8px;padding:8px 14px;
          color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;
        ">Enviar</button>
      </div>
    </div>
  `;
  document.body.appendChild(floater);
  document.getElementById('nexus-close').onclick = () => floater.remove();
  const askBtn = document.getElementById('nexus-ask');
  const input = document.getElementById('nexus-ai-input');
  const ask = () => {
    const prompt = input.value.trim();
    if (!prompt) return;
    const responseEl = document.getElementById('nexus-ai-response');
    responseEl.innerHTML = '<span style="color:#7C3AED;">Pensando...</span>';
    chrome.runtime.sendMessage({ type: 'AI_QUERY', prompt }, (res) => {
      if (res.error) {
        responseEl.innerHTML = `<span style="color:#F87171;">${res.error}</span>`;
      } else {
        responseEl.textContent = res.response;
      }
    });
  };
  askBtn.onclick = ask;
  input.onkeydown = (e) => { if (e.key === 'Enter') ask(); };
  if (text) ask();
}