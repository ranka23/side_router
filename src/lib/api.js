// src/lib/api.js - Background API communication with retry logic
// Provides helpers for communicating with the Chrome background service worker
// and OpenRouter APIs. Includes retry logic for transient failures.

/**
 * Send a message to the Chrome background service worker.
 * @param {string} action - The action identifier
 * @param {Object} data - Additional data to send with the message
 * @returns {Promise<Object>} The response from the background worker
 */
const bg = (action, data = {}) =>
  new Promise((ok, fail) => {
    chrome.runtime.sendMessage({ action, ...data }, (r) => {
      if (chrome.runtime.lastError) fail(new Error(chrome.runtime.lastError.message));
      else ok(r);
    });
  });

/**
 * Send a message with automatic retry on failure.
 * @param {string} action - The action identifier
 * @param {Object} data - Additional data to send
 * @param {number} retries - Number of retry attempts (default: 2)
 * @returns {Promise<Object>} The response from the background worker
 */
const bgWithRetry = async (action, data = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try { return await bg(action, data); }
    catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
};

/**
 * Direct fetch to the OpenRouter API.
 * @param {string} endpoint - The API endpoint (e.g., 'models')
 * @param {Object} opts - Fetch options
 * @returns {Promise<{ok: boolean, status: number}>} Response status
 */
const apiFetch = async (endpoint, opts = {}) => {
  try {
    const res = await fetch(`https://openrouter.ai/api/v1/${endpoint}`, opts);
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, status: 0 }; }
};

window.api = { bg, bgWithRetry, apiFetch };
window.bg = bg;
window.bgWithRetry = bgWithRetry;