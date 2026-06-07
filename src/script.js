// src/script.js - Main SideRouter orchestrator
class SideRouter {
  constructor() {
    this.settings = { apiKey: null, selectedModel: null, isDarkTheme: null, saveHistory: true, autoApprove: false, aiName: "ASSISTANT", rememberedPermissions: [] };
    this.messages = [];
    this.attachments = [];
    this.contextItems = [];
    this.typingEl = null;
    this.usage = null;
    this.tabContent = null;
    this.isRunning = false;
    this.taskQueue = [];
    this.abortController = null;
    this.stopped = false;
    this.rememberedPermissions = new Set();
    this.tabId = null;
    this.chatHistories = [];
    this.currentChatId = null;
    this.isFloating = new URLSearchParams(location.search).get("mode") === "floating";
    this._pendingAnnotations = null;
    this._pendingPermission = null;
    this._previousFocus = null;
    this._contextSelectedTabs = null;

    cacheDom(this);

    // Mix in module methods
    Object.assign(this, UIModule(this));
    Object.assign(this, ChatModule(this));
    Object.assign(this, HistoryModule(this));
    Object.assign(this, ContextModule(this));
    Object.assign(this, SettingsModule(this));

    var self = this;

    this._focusTrapHandler = function (e) { self._trapFocus(e); };
    this._escKeyHandler = function (e) {
      if (e.key === "Escape") {
        if (self.dom.confirmDialog && !self.dom.confirmDialog.classList.contains("hidden")) self.closeConfirmDialog();
        else if (!self.dom.settings.classList.contains("hidden")) self.closeSettings();
        else if (self.dom.historyPopup && !self.dom.historyPopup.classList.contains("hidden")) self.closeHistoryPopup();
        else if (self.dom.contextPopup && !self.dom.contextPopup.classList.contains("hidden")) self.closeContextPopup();
        else if (self.dom.permissionScreen && !self.dom.permissionScreen.classList.contains("hidden")) self.denyPermission();
      }
    };

    // Event bindings
    this.dom.sendBtn.onclick = function () { try { self.send(); } catch (e) { console.error("send onclick:", e); self.setRunning(false); self.updateSendIcon(); } };
    this.dom.scrollBtn.onclick = function () { self.scrollToBottom(); };
    this.dom.scrollBtn.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.scrollToBottom(); } };
    this.dom.input.oninput = function () { self.resize(); };
    this.dom.input.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); try { self.send(); } catch (e) { console.error("send onkeydown:", e); self.setRunning(false); self.updateSendIcon(); } }
    };
    if (this.dom.welcomeApiKey) {
      this.dom.welcomeApiKey.addEventListener("keydown", function (e) { if (e.key === "Enter") self.connectFromWelcome(); });
    }
    if (this.dom.welcomeConnectBtn) {
      this.dom.welcomeConnectBtn.addEventListener("click", function () { self.connectFromWelcome(); });
    }
    this.dom.messages.onwheel = function () { self.checkScrollPosition(); };
    this.dom.messages.onscroll = function () { self.checkScrollPosition(); };
    this.dom.attachBtn.onclick = function () { self.dom.fileInput.click(); };
    this.dom.attachBtn.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.dom.fileInput.click(); } };
    this.dom.fileInput.onchange = function (e) { self.handleFiles(e.target.files); e.target.value = ""; };
    this.dom.modelSelect.onchange = function () {
      self.settings.selectedModel = self.dom.modelSelect.value;
      var selected = self.dom.modelSelect.selectedOptions[0];
      self.updateContextPercent(selected ? selected.dataset.context : null);
      self.save();
      self.checkPaidModel();
    };
    $("btn-settings").onclick = function () { self.openSettings(); };
    $("btn-settings").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.openSettings(); } };
    $("btn-new-chat").onclick = function () { self.newChat(); };
    $("btn-new-chat").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.newChat(); } };
    $("btn-history").onclick = function () { self.openHistoryPopup(); };
    $("btn-history").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.openHistoryPopup(); } };
    $("btn-float").onclick = function () { self.openFloating(); };
    $("btn-float").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.openFloating(); } };
    $("btn-context").onclick = function () { self.openContextPopup(); };
    $("btn-context").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.openContextPopup(); } };
    $("history-close-btn").onclick = function () { self.closeHistoryPopup(); };
    $("history-close-btn").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.closeHistoryPopup(); } };
    this.dom.historyPopup.onclick = function (e) { if (e.target === self.dom.historyPopup) self.closeHistoryPopup(); };
    if (this.dom.historyClearAllBtn) {
      this.dom.historyClearAllBtn.addEventListener("click", function () { self.showClearAllConfirm(); });
    }
    if (this.dom.confirmCloseBtn) {
      this.dom.confirmCloseBtn.addEventListener("click", function () { self.closeConfirmDialog(); });
    }
    if (this.dom.confirmNoBtn) {
      this.dom.confirmNoBtn.addEventListener("click", function () { self.closeConfirmDialog(); });
    }
    if (this.dom.confirmYesBtn) {
      this.dom.confirmYesBtn.addEventListener("click", function () { self.confirmClearAll(); });
    }
    if (this.dom.confirmDialog) {
      this.dom.confirmDialog.addEventListener("click", function (e) { if (e.target === self.dom.confirmDialog) self.closeConfirmDialog(); });
    }
    $("context-close-btn").onclick = function () { self.closeContextPopup(); };
    $("context-close-btn").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.closeContextPopup(); } };
    this.dom.contextPopup.onclick = function (e) { if (e.target === self.dom.contextPopup) self.closeContextPopup(); };
    this.dom.modalClose.onclick = function () { self.closeSettings(); };
    this.dom.modalClose.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.closeSettings(); } };
    this.dom.settings.onclick = function (e) { if (e.target === self.dom.settings) self.closeSettings(); };
    $("btn-validate-key").onclick = function () { self.validateKey(); };
    this.dom.apiKey.onkeydown = function (e) { if (e.key === "Enter") self.validateKey(); };
    this.dom.theme.onchange = function () { self.settings.isDarkTheme = self.dom.theme.checked; self.applyTheme(); self.save(); self.settings._userOverrodeTheme = true; };
    this.dom.saveHistory.onchange = function () { self.settings.saveHistory = self.dom.saveHistory.checked; self.save(); self.loadChatHistories(); };
    this.dom.autoApprove.onchange = function () { self.settings.autoApprove = self.dom.autoApprove.checked; self.save(); };
    this.dom.aiName.onchange = function () { self.settings.aiName = self.dom.aiName.value.trim() || "ASSISTANT"; self.save(); };
    if (this.dom.defaultModelSelect) {
      this.dom.defaultModelSelect.onchange = function () {
        self.settings.defaultModel = self.dom.defaultModelSelect.value || null;
        self.save();
        self.toast("Default model updated", "success");
      };
    }
    this.dom.usageBadge.onclick = function () { window.open("https://openrouter.ai/settings/billing", "_blank"); };
    $("perm-deny").onclick = function () { self.denyPermission(); };
    $("perm-deny").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.denyPermission(); } };
    $("perm-approve").onclick = function () { self.approvePermission(); };
    $("perm-approve").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.approvePermission(); } };
    if (this.dom.contextFileInput) {
      this.dom.contextFileInput.addEventListener("change", function (e) { self.handleContextFile(e.target.files); e.target.value = ""; });
    }
    var addPageBtn = $("context-add-page");
    if (addPageBtn) {
      addPageBtn.addEventListener("click", function () { self.attachPageContext(); });
    }

    document.querySelectorAll(".context-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { self.switchContextTab(tab.dataset.tab); });
    });

    this.bootstrap();
  }

  _trapFocus(e) {
    if (e.key !== "Tab") return;
    var modal = null;
    if (!this.dom.settings.classList.contains("hidden")) modal = this.dom.settings;
    else if (this.dom.historyPopup && !this.dom.historyPopup.classList.contains("hidden")) modal = this.dom.historyPopup;
    else if (this.dom.contextPopup && !this.dom.contextPopup.classList.contains("hidden")) modal = this.dom.contextPopup;
    else if (this.dom.permissionScreen && !this.dom.permissionScreen.classList.contains("hidden")) modal = this.dom.permissionScreen;
    else if (this.dom.confirmDialog && !this.dom.confirmDialog.classList.contains("hidden")) modal = this.dom.confirmDialog;
    if (!modal) return;
    var focusable = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  async bootstrap() {
    var self = this;
    try {
      await this.getTabId();
      await this.load();
      if (this.settings.rememberedPermissions) {
        this.rememberedPermissions = new Set(this.settings.rememberedPermissions);
      }
      this.settings.isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.applyTheme();
      this.dom.theme.checked = !!this.settings.isDarkTheme;
      this.dom.saveHistory.checked = this.settings.saveHistory !== false;
      this.dom.autoApprove.checked = !!this.settings.autoApprove;
      this.dom.aiName.value = this.settings.aiName || "ASSISTANT";
      await this.loadModels();
      this.dom.apiKey.value = this.settings.apiKey || "";
      if (!this.settings.apiKey) {
        this.showWelcome();
      } else {
        this.setLocked(false);
        this.updateStatus();
        this.fetchUsage();
        bgWithRetry("validateKey", { key: this.settings.apiKey })
          .then(function (v) {
            if (!v.valid) {
              self.settings.apiKey = null;
              self.save();
              self.showWelcome();
              self.toast("API key expired \u2014 enter a new one", "error");
            }
          })
          .catch(function () {});
        if (this.settings.saveHistory) {
          await this.loadHistory();
          await this.loadChatHistories();
        }
      }
      window.addEventListener("beforeunload", function () {
        self.persistHistory();
        self.archiveCurrentChat();
      });
      // On tab switch: persist current chat and reload it (don't clear messages)
      if (chrome.tabs && chrome.tabs.onActivated) {
        chrome.tabs.onActivated.addListener(async function (activeInfo) {
          var oldTabId = self.tabId;
          self.tabId = activeInfo.tabId;
          if (self.tabId !== oldTabId) {
            // Persist current state before any reload
            await self.persistHistory();
            // Keep the same messages — don't clear them
            // Just ensure chat histories are fresh for the history popup
            if (self.settings.saveHistory) {
              await self.loadChatHistories();
            }
          }
        });
      }
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
        if (!self.settings._userOverrodeTheme) {
          self.settings.isDarkTheme = e.matches;
          self.applyTheme();
          self.dom.theme.checked = e.matches;
        }
      });
    } catch (e) {
      console.error("bootstrap:", e);
      this.toast("Init error \u2014 check console", "error");
    }
  }

  getTabContent() {
    return this._getTabContent();
  }

  async _getTabContent() {
    try {
      var r = await bg("getActiveTabContent");
      if (r && r.success) { this.tabContent = r.content; return this.tabContent; }
    } catch (e) {}
    return null;
  }

  async executeOnTab(code) {
    try {
      var r = await bg("executeOnTab", { code: code });
      return (r && r.success) ? r.result : null;
    } catch (e) { return null; }
  }

  async openFloating() {
    try {
      await bg("openFloatingWindow");
      this.toast("Window opened", "info");
    } catch (e) {
      this.toast("Could not open: " + e.message, "error");
    }
  }

  md(text) {
    return window.md ? window.md(text) : "";
  }

  sanitizeHtml(str) {
    return this.escapeHtml(str);
  }

  getHistory() {
    return this.messages.filter(function (m) { return m.role === "user" || m.role === "assistant"; }).map(function (m) { return { role: m.role, content: m.content }; });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  window.app = new SideRouter();
});