// background.js — OpenRouter AI Chat Extension

const SETTINGS_KEYS = ['apiKey', 'selectedModel', 'isDarkTheme', 'saveHistory', 'autoScroll'];

let settings = {
  apiKey: null,
  selectedModel: 'meta-llama/llama-3.3-70b-instruct:free',
  isDarkTheme: false,
  saveHistory: true,
  autoScroll: true,
};

// ── Load / Save ──────────────────────────────────────────────
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEYS);
    for (const key of SETTINGS_KEYS) {
      if (data[key] !== undefined) settings[key] = data[key];
    }
  } catch (e) { console.error('loadSettings:', e); }
}

async function saveSettings(updates) {
  try {
    Object.assign(settings, updates);
    await chrome.storage.local.set(updates);
  } catch (e) { console.error('saveSettings:', e); }
}

// ── Models ───────────────────────────────────────────────────
const FALLBACK_MODELS = [
  // Verified free models on OpenRouter (2025)
  { id: 'meta-llama/llama-3.3-70b-instruct:free',       name: 'Llama 3.3 70B' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free',        name: 'Llama 3.2 3B' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free',    name: 'Hermes 3 405B' },
  { id: 'moonshotai/kimi-k2.6:free',                    name: 'Kimi K2.6' },
  { id: 'openai/gpt-oss-120b:free',                     name: 'GPT-OSS 120B' },
  { id: 'openai/gpt-oss-20b:free',                      name: 'GPT-OSS 20B' },
  { id: 'z-ai/glm-4.5-air:free',                        name: 'GLM 4.5 Air' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free',        name: 'Qwen3 Next 80B' },
  { id: 'qwen/qwen3-coder:free',                        name: 'Qwen3 Coder' },
  { id: 'google/gemma-4-31b-it:free',                   name: 'Gemma 4 31B' },
  { id: 'google/gemma-4-26b-a4b-it:free',               name: 'Gemma 4 26B' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',       name: 'Nemotron Super 120B' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron Nano 30B' },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free',          name: 'Nemotron Nano 30B' },
  { id: 'nvidia/nemotron-nano-9b-v2:free',              name: 'Nemotron Nano 9B' },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free',          name: 'Nemotron Nano 12B VL' },
  { id: 'liquid/lfm-2.5-1.2b-instruct:free',            name: 'LFM 2.5 1.2B' },
  { id: 'liquid/lfm-2.5-1.2b-thinking:free',            name: 'LFM 2.5 Thinking' },
  { id: 'poolside/laguna-m.1:free',                      name: 'Laguna M.1' },
  { id: 'poolside/laguna-xs.2:free',                     name: 'Laguna XS.2' },
  { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', name: 'Dolphin Mistral 24B' },
];

let modelsCache = null;
let modelsCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

async function fetchModels() {
  if (modelsCache && Date.now() - modelsCacheTime < CACHE_TTL) return modelsCache;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    modelsCache = data.data
      .filter(m => m.id.endsWith(':free'))
      .map(m => ({ id: m.id, name: m.name || m.id.split('/').pop() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    modelsCacheTime = Date.now();
    return modelsCache;
  } catch (e) {
    console.error('fetchModels:', e);
    return FALLBACK_MODELS;
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
        const models = await fetchModels();
        sendResponse({ success: true, models });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  })();
  return true; // keep channel open for async
});

// ── Side Panel ───────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (e) {
    console.error('open side panel:', e);
  }
});

// ── Init ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await loadSettings();
  await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
});

chrome.runtime.onStartup.addListener(async () => {
  await loadSettings();
});

console.log('OpenRouter AI Chat — background ready');
