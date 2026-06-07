// src/lib/api.js - Background API communication with retry logic
const bg = (action, data = {}) =>
  new Promise((ok, fail) => {
    chrome.runtime.sendMessage({ action, ...data }, (r) => {
      if (chrome.runtime.lastError) fail(new Error(chrome.runtime.lastError.message));
      else ok(r);
    });
  });

const bgWithRetry = async (action, data = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try { return await bg(action, data); }
    catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
};

const apiFetch = async (endpoint, opts = {}) => {
  try {
    const res = await fetch(`https://openrouter.ai/api/v1/${endpoint}`, opts);
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, status: 0 }; }
};

window.api = { bg, bgWithRetry, apiFetch };
window.bg = bg;
window.bgWithRetry = bgWithRetry;
