// src/script.js - Main SideRouter orchestrator
// Initializes the application, binds all UI events, manages the message flow,
// and coordinates between modules (settings, chat, history, context, UI).

/** @class SideRouter Main application controller */
class SideRouter {
  constructor() {
    // ── Application State ──────────────────────────────────────
    /** @type {Object} Current settings (merged from storage) */
    this.settings = {
      apiKey: null, selectedModel: null, isDarkTheme: null,
      saveHistory: true, autoApprove: false, aiName: "ASSISTANT",
      rememberedPermissions: [], defaultModel: null, zoomLevel: 100,
      cavemanCompression: true
    };
    /** @type {Array} Current chat messages */
    this.messages = [];
    /** @type {Array} File attachments pending send */
    this.attachments = [];
    /** @type {Array} Context items (page, tab, file) */
    this.contextItems = [];
    /** @type {HTMLElement|null} Current typing indicator element */
    this.typingEl = null;
    /** @type {Object|null} API usage data */
    this.usage = null;
    /** @type {Object|null} Active tab content cache */
    this.tabContent = null;
    /** @type {boolean} Whether a request is currently in flight */
    this.isRunning = false;
    /** @type {Array} Queue of pending messages */
    this.taskQueue = [];
    /** @type {AbortController|null} For cancelling in-flight requests */
    this.abortController = null;
    /** @type {boolean} Whether user has stopped the current task */
    this.stopped = false;
    /** @type {Set} Set of remembered permission types */
    this.rememberedPermissions = new Set();
    /** @type {number|null} Current Chrome tab ID */
    this.tabId = null;
    /** @type {Array} Archived chat histories */
    this.chatHistories = [];
    /** @type {string|null} Current chat ID */
    this.currentChatId = null;
    /** @type {boolean} Whether running in floating window mode */
    this.isFloating = new URLSearchParams(location.search).get("mode") === "floating";
    /** @type {Array|null} Pending annotations from AI response */
    this._pendingAnnotations = null;
    /** @type {Object|null} Pending permission request */
    this._pendingPermission = null;
    /** @type {HTMLElement|null} Previous focused element for focus restoration */
    this._previousFocus = null;
    /** @type {Set|null} Selected tab IDs in context picker */
    this._contextSelectedTabs = null;

    // Cache all DOM references
    cacheDom(this);

    // Mix in module methods from separate files
    Object.assign(this, UIModule(this));
    Object.assign(this, ChatModule(this));
    Object.assign(this, HistoryModule(this));
    Object.assign(this, ContextModule(this));
    Object.assign(this, SettingsModule(this));

    var self = this;

    // ── Focus Trap Handler ─────────────────────────────────────
    this._focusTrapHandler = function (e) { self._trapFocus(e); };

    // ── Escape Key Handler ─────────────────────────────────────
    this._escKeyHandler = function (e) {
      if (e.key === "Escape") {
        if (self.dom.confirmDialog && !self.dom.confirmDialog.classList.contains("hidden")) self.closeConfirmDialog();
        else if (self.dom.donateModal && !self.dom.donateModal.classList.contains("hidden")) self.closeDonateModal();
        else if (!self.dom.settings.classList.contains("hidden")) self.closeSettings();
        else if (self.dom.historyPopup && !self.dom.historyPopup.classList.contains("hidden")) self.closeHistoryPopup();
        else if (self.dom.contextPopup && !self.dom.contextPopup.classList.contains("hidden")) self.closeContextPopup();
        else if (self.dom.permissionScreen && !self.dom.permissionScreen.classList.contains("hidden")) self.denyPermission();
      }
    };

    // ── Core Event Bindings ────────────────────────────────────
    this.dom.sendBtn.onclick = function () { try { self.send(); } catch (e) { console.error("send onclick:", e); self.setRunning(false); self.updateSendIcon(); } };
    this.dom.scrollBtn.onclick = function () { self.scrollToBottom(); };
    this.dom.scrollBtn.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.scrollToBottom(); } };
    this.dom.input.oninput = function () { self.resize(); };
    this.dom.input.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); try { self.send(); } catch (e) { console.error("send onkeydown:", e); self.setRunning(false); self.updateSendIcon(); } }
    };

    // Welcome screen API key input
    if (this.dom.welcomeApiKey) {
      this.dom.welcomeApiKey.addEventListener("keydown", function (e) { if (e.key === "Enter") self.connectFromWelcome(); });
    }
    if (this.dom.welcomeConnectBtn) {
      this.dom.welcomeConnectBtn.addEventListener("click", function () { self.connectFromWelcome(); });
    }

    // ── Scroll Management ──────────────────────────────────────
    this.dom.messages.onwheel = function () { self.checkScrollPosition(); };
    this.dom.messages.onscroll = function () { self.checkScrollPosition(); };

    // ── File Input (used by context file picker) ───────────────
    this.dom.fileInput.onchange = function (e) { self.handleFiles(e.target.files); e.target.value = ""; };

    // ── Model Selection ────────────────────────────────────────
    this.dom.modelSelect.onchange = function () {
      self.settings.selectedModel = self.dom.modelSelect.value;
      var selected = self.dom.modelSelect.selectedOptions[0];
      self.updateContextPercent(selected ? selected.dataset.context : null);
      self.save();
      self.checkPaidModel();
    };

    // ── Header Button Bindings ─────────────────────────────────
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

    // ── History Popup Bindings ─────────────────────────────────
    $("history-close-btn").onclick = function () { self.closeHistoryPopup(); };
    $("history-close-btn").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.closeHistoryPopup(); } };
    this.dom.historyPopup.onclick = function (e) { if (e.target === self.dom.historyPopup) self.closeHistoryPopup(); };
    if (this.dom.historyClearAllBtn) {
      this.dom.historyClearAllBtn.addEventListener("click", function () { self.showClearAllConfirm(); });
    }

    // ── Confirm Dialog Bindings ────────────────────────────────
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

    // ── Context Popup Bindings ─────────────────────────────────
    $("context-close-btn").onclick = function () { self.closeContextPopup(); };
    $("context-close-btn").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.closeContextPopup(); } };
    this.dom.contextPopup.onclick = function (e) { if (e.target === self.dom.contextPopup) self.closeContextPopup(); };

    // ── Settings Modal Bindings ────────────────────────────────
    this.dom.modalClose.onclick = function () { self.closeSettings(); };
    this.dom.modalClose.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.closeSettings(); } };
    this.dom.settings.onclick = function (e) { if (e.target === self.dom.settings) self.closeSettings(); };
    $("btn-validate-key").onclick = function () { self.validateKey(); };
    this.dom.apiKey.onkeydown = function (e) { if (e.key === "Enter") self.validateKey(); };
    this.dom.theme.onchange = function () { self.settings.isDarkTheme = self.dom.theme.checked; self.applyTheme(); self.save(); self.settings._userOverrodeTheme = true; };
    this.dom.saveHistory.onchange = function () { self.settings.saveHistory = self.dom.saveHistory.checked; self.save(); self.loadChatHistories(); };
    this.dom.autoApprove.onchange = function () { self.settings.autoApprove = self.dom.autoApprove.checked; self.save(); };
    this.dom.aiName.onchange = function () { self.settings.aiName = self.dom.aiName.value.trim() || "ASSISTANT"; self.save(); };
    this.dom.caveman.onchange = function () { self.settings.cavemanCompression = self.dom.caveman.checked; self.save(); };

    // ── Zoom Control Bindings ──────────────────────────────────
    if (this.dom.zoomIn) {
      this.dom.zoomIn.addEventListener("click", function () { self.zoomIn(); });
    }
    if (this.dom.zoomOut) {
      this.dom.zoomOut.addEventListener("click", function () { self.zoomOut(); });
    }
    if (this.dom.zoomReset) {
      this.dom.zoomReset.addEventListener("click", function () { self.zoomReset(); });
    }

    // ── Donate Modal Bindings ──────────────────────────────────
    if (this.dom.btnOpenDonate) {
      this.dom.btnOpenDonate.addEventListener("click", function (e) {
        e.preventDefault();
        self.openDonateModal();
      });
    }
    if (this.dom.donateCloseBtn) {
      this.dom.donateCloseBtn.addEventListener("click", function () { self.closeDonateModal(); });
    }
    if (this.dom.donateModal) {
      this.dom.donateModal.onclick = function (e) { if (e.target === self.dom.donateModal) self.closeDonateModal(); };
    }
    // Bind copy buttons for each wallet address
    document.querySelectorAll(".donate-copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var coin = btn.dataset.wallet;
        if (coin) self.copyDonateAddress(coin);
      });
    });

    // ── Default Model Select ───────────────────────────────────
    if (this.dom.defaultModelSelect) {
      this.dom.defaultModelSelect.onchange = function () {
        var val = self.dom.defaultModelSelect.value;
        self.settings.defaultModel = val || null;
        if (val) {
          self.settings.selectedModel = val;
          if (self.dom.modelSelect) {
            self.dom.modelSelect.value = val;
          }
          var selected = self.dom.modelSelect.selectedOptions[0];
          if (selected && selected.dataset.context) {
            self.updateContextPercent(selected.dataset.context);
          }
          self.checkPaidModel();
        }
        self.save();
        self.toast("Default model updated", "success");
      };
    }

    // ── Usage Badge ────────────────────────────────────────────
    this.dom.usageBadge.onclick = function () { window.open("https://openrouter.ai/settings/billing", "_blank"); };

    // ── Permission Button Bindings ─────────────────────────────
    $("perm-deny").onclick = function () { self.denyPermission(); };
    $("perm-deny").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.denyPermission(); } };
    $("perm-approve").onclick = function () { self.approvePermission(); };
    $("perm-approve").onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.approvePermission(); } };

    // ── Context File Picker ────────────────────────────────────
    if (this.dom.contextFileInput) {
      this.dom.contextFileInput.addEventListener("change", function (e) { self.handleContextFile(e.target.files); e.target.value = ""; });
    }
    var addPageBtn = $("context-add-page");
    if (addPageBtn) {
      addPageBtn.addEventListener("click", function () { self.attachPageContext(); });
    }

    // ── Context Tab Switching ──────────────────────────────────
    document.querySelectorAll(".context-tab").forEach(function (tab) {
      tab.addEventListener("click", function () { self.switchContextTab(tab.dataset.tab); });
    });

    // ── Bootstrap the Application ──────────────────────────────
    this.bootstrap();
  }

  /**
   * Trap focus within the currently open modal (accessibility).
   * @param {KeyboardEvent} e - The keyboard event
   */
  _trapFocus(e) {
    if (e.key !== "Tab") return;
    var modal = null;
    if (!this.dom.settings.classList.contains("hidden")) modal = this.dom.settings;
    else if (this.dom.donateModal && !this.dom.donateModal.classList.contains("hidden")) modal = this.dom.donateModal;
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

  /**
   * Bootstrap the application: load settings, models, and restore state.
   * This is the main initialization entry point.
   */
  async bootstrap() {
    var self = this;
    try {
      await this.getTabId();
      await this.load();
      // Fallback: if API key wasn't loaded via background, try Chrome storage directly
      if (!this.settings.apiKey) {
        try {
          var stored = await chrome.storage.local.get("apiKey");
          if (stored.apiKey) this.settings.apiKey = stored.apiKey;
        } catch (_) {}
      }
      // Restore remembered permissions
      if (this.settings.rememberedPermissions) {
        this.rememberedPermissions = new Set(this.settings.rememberedPermissions);
      }
      // Apply theme
      this.settings.isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.applyTheme();
      this.dom.theme.checked = !!this.settings.isDarkTheme;
      this.dom.saveHistory.checked = this.settings.saveHistory !== false;
      this.dom.autoApprove.checked = !!this.settings.autoApprove;
      this.dom.aiName.value = this.settings.aiName || "ASSISTANT";
      // Load models and apply saved zoom
      await this.loadModels();
      this.applyZoom();
      // Restore API key from storage (auto-load for floating window)
      this.dom.apiKey.value = this.settings.apiKey || "";
      if (!this.settings.apiKey) {
        this.showWelcome();
      } else {
        this.setLocked(false);
        this.updateStatus();
        this.fetchUsage();
        // Validate key is still valid (non-blocking)
        bgWithRetry("validateKey", { key: this.settings.apiKey })
          .then(function (v) {
            if (!v.valid) {
              self.settings.apiKey = null;
              self.save();
              self.showWelcome();
              self.toast("API key expired — enter a new one", "error");
            }
          })
          .catch(function () {});
        // Restore chat history
        if (this.settings.saveHistory) {
          await this.loadHistory();
          await this.loadChatHistories();
        }
      }
      // Persist state on page unload
      window.addEventListener("beforeunload", function () {
        self.persistHistory();
        self.archiveCurrentChat();
      });
      // On tab switch: persist current chat and reload it
      if (chrome.tabs && chrome.tabs.onActivated) {
        chrome.tabs.onActivated.addListener(async function (activeInfo) {
          var oldTabId = self.tabId;
          self.tabId = activeInfo.tabId;
          if (self.tabId !== oldTabId) {
            await self.persistHistory();
            if (self.settings.saveHistory) {
              await self.loadChatHistories();
            }
          }
        });
      }
      // Listen for system theme changes
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
        if (!self.settings._userOverrodeTheme) {
          self.settings.isDarkTheme = e.matches;
          self.applyTheme();
          self.dom.theme.checked = e.matches;
        }
      });
    } catch (e) {
      console.error("bootstrap:", e);
      this.toast("Init error — check console", "error");
    }
  }

  /** Get tab content from the active Chrome tab or specific tabId */
  getTabContent(tabId) {
    return this._getTabContent(tabId);
  }

  /** Fetch the active tab's page content via the background service worker */
  async _getTabContent(tabId) {
    try {
      var r = await bg("getActiveTabContent", tabId ? { tabId: tabId } : {});
      if (r && r.success) { this.tabContent = r.content; return this.tabContent; }
    } catch (e) {}
    return null;
  }

  /** Execute JavaScript code on the active tab */
  async executeOnTab(code) {
    try {
      var r = await bg("executeOnTab", { code: code });
      return (r && r.success) ? r.result : null;
    } catch (e) { return null; }
  }

  /** Open the floating popup window */
  async openFloating() {
    try {
      await bg("openFloatingWindow");
      this.toast("Window opened", "info");
    } catch (e) {
      this.toast("Could not open: " + e.message, "error");
    }
  }

  /** Render markdown text to HTML */
  md(text) {
    return window.md ? window.md(text) : "";
  }

  /** Sanitize HTML to prevent XSS */
  sanitizeHtml(str) {
    return this.escapeHtml(str);
  }

  /** Get the chat history as a clean message array for API calls */
  getHistory() {
    return this.messages.filter(function (m) { return m.role === "user" || m.role === "assistant"; }).map(function (m) { return { role: m.role, content: m.content }; });
  }
}

// ── Initialize on DOM ready ──────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  window.app = new SideRouter();
});