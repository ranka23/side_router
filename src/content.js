// content.js — SideRouter Content Script
// Enables AI to interact with the active web page

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
