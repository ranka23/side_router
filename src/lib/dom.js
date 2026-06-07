// src/lib/dom.js - DOM element caching
const $ = (id) => document.getElementById(id);

function cacheDom(app) {
  app.dom = {
    messages: $("main-content"),
    input: $("msg-input"),
    sendBtn: $("btn-send"),
    attachBtn: $("btn-attach"),
    fileInput: $("file-input"),
    modelSelect: $("model-select-inline"),
    defaultModelSelect: $("default-model-select"),
    settings: $("settings-modal"),
    apiKey: $("api-key"),
    keyStatus: $("key-status"),
    theme: $("theme-toggle"),
    saveHistory: $("save-history-toggle"),
    autoApprove: $("auto-approve-toggle"),
    aiName: $("ai-name"),
    proNotice: $("pro-notice"),
    toast: $("toast-container"),
    attachments: $("input-attachments"),
    usageBadge: $("usage-badge"),
    welcome: $("welcome-screen"),
    welcomeApiKey: $("welcome-api-key"),
    welcomeConnectBtn: $("welcome-connect-btn"),
    modalClose: $("modal-close"),
    scrollBtn: $("scroll-to-bottom"),
    historyPopup: $("history-popup"),
    historyList: $("history-list"),
    historyActions: $("history-actions"),
    historyClearAllBtn: $("history-clear-all-btn"),
    confirmDialog: $("confirm-dialog"),
    confirmMessage: $("confirm-message"),
    confirmCloseBtn: $("confirm-close-btn"),
    confirmNoBtn: $("confirm-no-btn"),
    confirmYesBtn: $("confirm-yes-btn"),
    contextPopup: $("context-popup"),
    contextChips: $("context-chips"),
    contextPagePreview: $("context-page-preview"),
    contextTabsList: $("context-tabs-list"),
    contextFilePreview: $("context-file-preview"),
    contextFileInput: $("context-file-input"),
    permissionScreen: $("permission-screen"),
    permActionType: $("perm-action-type"),
    permActionDetails: $("perm-action-details"),
    permAiName: $("perm-ai-name"),
    permRememberType: $("perm-remember-type"),
  };
}

window.DomModule = { $, cacheDom };
window.cacheDom = cacheDom;
window.$ = $;
