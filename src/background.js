// background.js — SideRouter v4 (Complete)

const defaults = {
  apiKey: null,
  selectedModel: null,
  isDarkTheme: null, // null = auto-detect
  saveHistory: true,
  autoApprove: false,
};

let settings = { ...defaults };
let modelsCache = null;
let modelsCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

// ── Storage ──────────────────────────────────────────────────
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(Object.keys(defaults));
    for (const k of Object.keys(defaults)) {
      if (data[k] !== undefined) settings[k] = data[k];
    }
  } catch (e) { console.error('loadSettings:', e); }
}

async function saveSettings(updates) {
  try {
    Object.assign(settings, updates);
    await chrome.storage.local.set(updates);
  } catch (e) { console.error('saveSettings:', e); }
}

// ── Models (always from API, never hardcoded) ────────────────
async function fetchModels() {
  if (modelsCache && Date.now() - modelsCacheTime < CACHE_TTL) return modelsCache;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const all = (data.data || []).map(m => {
      const p = m.pricing || {};
      const isFree = m.id.endsWith(':free') || (String(p.prompt) === '0' && String(p.completion) === '0');
      return {
        id: m.id,
        name: m.name || m.id.split('/').pop().replace(/-/g, ' '),
        isFree,
        contextLength: m.context_length || 4096,
        pricing: typeof p === 'object' ? p : {},
      };
    });
    const free = all.filter(m => m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    const paid = all.filter(m => !m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    modelsCache = [...free, ...paid];
    modelsCacheTime = Date.now();

    // Auto-select first free model if none selected
    if (!settings.selectedModel && free.length > 0) {
      settings.selectedModel = free[0].id;
      await saveSettings({ selectedModel: settings.selectedModel });
    }
    return modelsCache;
  } catch (e) {
    console.error('fetchModels:', e);
    return [];
  }
}

// ── API Key Validation ───────────────────────────────────────
async function validateApiKey(key) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      let usage = null;
      try {
        const uRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
        });
        if (uRes.ok) usage = await uRes.json();
      } catch (_) {}
      return { valid: true, usage };
    }
    if (res.status === 401) return { valid: false, error: 'Invalid API key. Get one at openrouter.ai/keys' };
    if (res.status === 403) return { valid: false, error: 'Forbidden — key may be expired or revoked.' };
    return { valid: false, error: `HTTP ${res.status}: ${res.statusText || 'Unknown error'}` };
  } catch (e) {
    if (e.name === 'TimeoutError') return { valid: false, error: 'Request timed out. Check your connection.' };
    return { valid: false, error: e.message };
  }
}

// ── Message Handler ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.action) {
      case 'getSettings':
        sendResponse({ success: true, settings });
        break;
      case 'saveSettings':
        await saveSettings(msg.settings);
        sendResponse({ success: true });
        break;
      case 'getModels':
        sendResponse({ success: true, models: await fetchModels() });
        break;
      case 'validateKey': {
        const result = await validateApiKey(msg.key);
        if (result.valid) {
          settings.apiKey = msg.key;
          await saveSettings({ apiKey: msg.key });
        }
        sendResponse(result);
        break;
      }
      case 'getActiveTabContent': {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) { sendResponse({ success: false, error: 'No active tab' }); break; }
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
              title: document.title,
              url: location.href,
              text: document.body?.innerText?.slice(0, 8000) || '',
              forms: Array.from(document.forms).map(f => ({
                id: f.id, action: f.action,
                inputs: Array.from(f.elements).map(e => ({
                  tag: e.tagName, type: e.type, name: e.name, id: e.id,
                  placeholder: e.placeholder, value: e.value,
                })),
              })),
            }),
          });
          sendResponse({ success: true, content: results[0]?.result });
        } catch (e) { sendResponse({ success: false, error: e.message }); }
        break;
      }
      case 'executeOnTab': {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) { sendResponse({ success: false, error: 'No active tab' }); break; }
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [msg.code],
            func: (code) => {
              try { return { ok: true, result: eval(code) }; }
              catch (e) { return { ok: false, error: e.message }; }
            },
          });
          sendResponse({ success: true, result: results[0]?.result });
        } catch (e) { sendResponse({ success: false, error: e.message }); }
        break;
      }
      case 'openFloatingWindow': {
        try {
          const url = chrome.runtime.getURL('main.html?mode=floating');
          const win = await chrome.windows.create({
            url, type: 'popup', width: 440, height: 720, focused: true,
          });
          sendResponse({ success: true, windowId: win.id });
        } catch (e) { sendResponse({ success: false, error: e.message }); }
        break;
      }
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  return true;
});

// ── Side Panel Open ───────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  try { await chrome.sidePanel.open({ windowId: tab.windowId }); }
  catch (e) { console.error('open side panel:', e); }
});

chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  chrome.sidePanel.setOptions({ path: 'main.html', enabled: true }).catch(() => {});
  fetchModels();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
  fetchModels();
});

console.log('SideRouter — background ready');
