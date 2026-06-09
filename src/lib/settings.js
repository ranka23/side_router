// src/lib/settings.js - Settings management
function SettingsModule(app) {
  const defaults = {
    apiKey: null,
    selectedModel: null,
    isDarkTheme: null,
    saveHistory: true,
    autoApprove: false,
    aiName: "ASSISTANT",
    rememberedPermissions: [],
    defaultModel: null,
  };

  const load = async () => {
    try {
      const r = await bgWithRetry("getSettings");
      if (r?.success) {
        Object.assign(app.settings, r.settings);
        if (app.settings.rememberedPermissions) {
          app.rememberedPermissions = new Set(app.settings.rememberedPermissions);
        }
      }
    } catch (_) {}
  };

  const save = async () => {
    try {
      const toSave = { ...app.settings, rememberedPermissions: [...app.rememberedPermissions] };
      await bgWithRetry("saveSettings", { settings: toSave });
    } catch (_) {}
  };

  const applyTheme = () => {
    document.body.classList.toggle("dark", !!app.settings.isDarkTheme);
  };

  const autoDetectTheme = () => {
    if (!app.settings._userOverrodeTheme) {
      app.settings.isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme();
    }
    app.dom.theme.checked = !!app.settings.isDarkTheme;
  };

  const openSettings = () => {
    app._previousFocus = document.activeElement;
    app.dom.apiKey.value = app.settings.apiKey || "";
    app.dom.theme.checked = !!app.settings.isDarkTheme;
    app.dom.saveHistory.checked = app.settings.saveHistory !== false;
    app.dom.autoApprove.checked = !!app.settings.autoApprove;
    app.dom.aiName.value = app.settings.aiName || "ASSISTANT";
    app.dom.keyStatus.textContent = "";
    app.dom.keyStatus.className = "key-status";
    // Populate default model selector
    populateDefaultModelSelect();
    app.dom.settings.classList.remove("hidden");
    document.addEventListener("keydown", app._focusTrapHandler);
    document.addEventListener("keydown", app._escKeyHandler);
    app.dom.settings.setAttribute("aria-modal", "true");
    requestAnimationFrame(() => app.dom.apiKey.focus());
  };

  const closeSettings = () => {
    app.dom.settings.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  const validateKey = async () => {
    const key = app.dom.apiKey.value.trim();
    if (!key) {
      app.dom.keyStatus.textContent = "Enter an API key";
      app.dom.keyStatus.className = "key-status error";
      return;
    }
    app.dom.keyStatus.textContent = "Validating…";
    app.dom.keyStatus.className = "key-status loading";
    try {
      const r = await bgWithRetry("validateKey", { key });
      if (r.valid) {
        app.settings.apiKey = key;
        app.usage = r.usage || null;
        await save();
        app.setLocked(false);
        app.fetchUsage();
        closeSettings();
        app.toast("API key connected!", "success");
      } else {
        app.dom.keyStatus.textContent = r.error || "Invalid key";
        app.dom.keyStatus.className = "key-status error";
      }
    } catch (e) {
      app.dom.keyStatus.textContent = e.message;
      app.dom.keyStatus.className = "key-status error";
    }
  };

  const loadModels = async () => {
    try {
      const r = await bgWithRetry("getModels");
      populateSelect(r?.models || []);
    } catch {
      populateSelect([]);
    }
  };

  const populateSelect = (models) => {
    const sel = app.dom.modelSelect;
    const free = models.filter((m) => m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    const paid = models.filter((m) => !m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    // Build all models with group labels
    var allModels = [];
    free.forEach(function (m) { allModels.push({ id: m.id, context: m.contextLength || 4096, group: "Free Models" }); });
    paid.forEach(function (m) { allModels.push({ id: m.id, context: m.contextLength || 4096, group: "Paid Models" }); });
    // Create custom searchable dropdown
    var wrapper = document.createElement("div");
    wrapper.className = "model-dropdown-wrapper";
    // Hidden select for actual value (keep options in sync for test compat)
    sel.innerHTML = "";
    // Add optgroup labels so checkPaidModel can detect paid vs free
    var freeOptgroup = document.createElement("optgroup");
    freeOptgroup.label = "Free Models";
    var paidOptgroup = document.createElement("optgroup");
    paidOptgroup.label = "Paid Models";
    // Rebuild with optgroups
    sel.innerHTML = "";
    free.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.id;
      o.dataset.context = m.contextLength || 4096;
      freeOptgroup.appendChild(o);
    });
    paid.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.id;
      o.dataset.context = m.contextLength || 4096;
      paidOptgroup.appendChild(o);
    });
    if (free.length) sel.appendChild(freeOptgroup);
    if (paid.length) sel.appendChild(paidOptgroup);
    sel.style.display = "none";
    // Build custom dropdown
    var trigger = document.createElement("div");
    trigger.className = "model-dropdown-trigger";
    trigger.tabIndex = 0;
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "listbox");
    var triggerText = document.createElement("span");
    triggerText.className = "model-dropdown-text";
    triggerText.textContent = app.settings.selectedModel || "Select model";
    var triggerArrow = document.createElement("span");
    triggerArrow.className = "model-dropdown-arrow";
    triggerArrow.innerHTML = "&#9662;";
    trigger.appendChild(triggerText);
    trigger.appendChild(triggerArrow);
    // Dropdown panel
    var panel = document.createElement("div");
    panel.className = "model-dropdown-panel hidden";
    // Search input
    var searchWrap = document.createElement("div");
    searchWrap.className = "model-dropdown-search-wrap";
    var searchIcon = document.createElement("span");
    searchIcon.className = "model-dropdown-search-icon";
    searchIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
    var searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "model-dropdown-search";
    searchInput.placeholder = "Search models…";
    searchInput.setAttribute("aria-label", "Search models");
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    panel.appendChild(searchWrap);
    // Options list
    var optionsList = document.createElement("div");
    optionsList.className = "model-dropdown-options";
    optionsList.setAttribute("role", "listbox");
    function renderOptions(filter) {
      optionsList.innerHTML = "";
      var f = (filter || "").toLowerCase();
      var lastGroup = "";
      allModels.forEach(function (m) {
        if (f && m.id.toLowerCase().indexOf(f) === -1) return;
        if (m.group !== lastGroup) {
          lastGroup = m.group;
          var groupEl = document.createElement("div");
          groupEl.className = "model-dropdown-group";
          groupEl.textContent = m.group;
          optionsList.appendChild(groupEl);
        }
        var optEl = document.createElement("div");
        optEl.className = "model-dropdown-option";
        optEl.setAttribute("role", "option");
        optEl.dataset.value = m.id;
        optEl.dataset.context = m.context;
        optEl.textContent = m.id;
        if (m.id === sel.value) optEl.classList.add("selected");
        optEl.addEventListener("click", function () {
          selectModel(m.id, m.context);
        });
        optionsList.appendChild(optEl);
      });
      if (!optionsList.children.length) {
        var empty = document.createElement("div");
        empty.className = "model-dropdown-empty";
        empty.textContent = "No models found";
        optionsList.appendChild(empty);
      }
    }
    renderOptions("");
    panel.appendChild(optionsList);
    // Assemble
    wrapper.appendChild(sel);
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    if (sel.parentNode) {
      sel.parentNode.insertBefore(wrapper, sel);
    } else {
      document.body.appendChild(wrapper);
    }
    // Store reference
    app.dom.modelDropdownWrapper = wrapper;
    app.dom.modelDropdownTrigger = trigger;
    app.dom.modelDropdownPanel = panel;
    app.dom.modelDropdownSearch = searchInput;
    app.dom.modelDropdownOptions = optionsList;
    app.dom.modelDropdownText = triggerText;
    // Events
    function togglePanel() {
      var isOpen = !panel.classList.contains("hidden");
      if (isOpen) {
        closePanel();
      } else {
        panel.classList.remove("hidden");
        trigger.setAttribute("aria-expanded", "true");
        searchInput.value = "";
        renderOptions("");
        searchInput.focus();
      }
    }
    function closePanel() {
      panel.classList.add("hidden");
      trigger.setAttribute("aria-expanded", "false");
    }
    function selectModel(id, context) {
      sel.value = id;
      app.settings.selectedModel = id;
      triggerText.textContent = id;
      updateContextPercent(context);
      save();
      checkPaidModel();
      closePanel();
    }
    trigger.addEventListener("click", function (e) { e.stopPropagation(); togglePanel(); });
    trigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(); }
      if (e.key === "Escape") closePanel();
    });
    searchInput.addEventListener("input", function () { renderOptions(searchInput.value); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closePanel(); trigger.focus(); }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var firstOpt = optionsList.querySelector(".model-dropdown-option");
        if (firstOpt) firstOpt.focus();
      }
    });
    optionsList.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closePanel(); trigger.focus(); }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = document.activeElement.nextElementSibling;
        if (next && next.classList.contains("model-dropdown-option")) next.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev = document.activeElement.previousElementSibling;
        if (prev && prev.classList.contains("model-dropdown-option")) prev.focus();
        else searchInput.focus();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (document.activeElement.classList.contains("model-dropdown-option")) {
          document.activeElement.click();
        }
      }
    });
    document.addEventListener("click", function (e) {
      if (!wrapper.contains(e.target)) closePanel();
    });
    // Set initial trigger text
    if (app.settings.selectedModel) {
      triggerText.textContent = app.settings.selectedModel;
    }
    // Set initial selected model from settings
    if (app.settings.selectedModel) {
      var found = allModels.find(function (m) { return m.id === app.settings.selectedModel; });
      if (found) {
        sel.value = app.settings.selectedModel;
        triggerText.textContent = app.settings.selectedModel;
        updateContextPercent(found.context);
      }
    }
    if (!sel.value && allModels.length) {
      var freeDefault = allModels.find(function (m) { return m.id === "openrouter/free"; });
      var fallback = freeDefault || allModels[0];
      sel.value = fallback.id;
      app.settings.selectedModel = fallback.id;
      triggerText.textContent = fallback.id;
      updateContextPercent(fallback.context);
      save();
    }
    checkPaidModel();
  };

  const updateContextPercent = (contextLength) => {
    if (!contextLength) return;
    const usedChars = app.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const usedTokens = Math.round(usedChars / 4);
    const pct = Math.min(100, Math.round((usedTokens / contextLength) * 100));
    app.dom.usageBadge.innerHTML = `${usedTokens} / ${contextLength} tokens <span class="context-pct">(${pct}%)</span>`;
  };

  const checkPaidModel = () => {
    const opt = app.dom.modelSelect.selectedOptions[0];
    const isPaid = opt?.parentElement?.label === "Paid Models";
    app.dom.proNotice.classList.toggle("hidden", !isPaid);
  };

  const fetchUsage = async () => {
    if (!app.settings.apiKey) return;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${app.settings.apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        app.usage = data?.data || data || null;
        if (app.usage) {
          const used = app.usage?.usage || app.usage?.total_usage || 0;
          const limit = app.usage?.limit || app.usage?.credit_limit || 0;
          if (limit > 0) {
            const pct = Math.round((used / limit) * 100);
            app.dom.usageBadge.textContent = `${pct}% used ($${used.toFixed(2)}/$${limit.toFixed(2)})`;
            app.dom.usageBadge.className = "usage-badge" + (pct > 80 ? " danger" : pct > 50 ? " warning" : "");
          } else {
            app.dom.usageBadge.textContent = `$${Number(used).toFixed(4)} used`;
            app.dom.usageBadge.className = "usage-badge";
          }
          app.dom.usageBadge.classList.remove("hidden");
          return;
        }
      }
    } catch (_) {}
    app.dom.usageBadge.textContent = "✓ Connected";
    app.dom.usageBadge.className = "usage-badge";
    app.dom.usageBadge.classList.remove("hidden");
  };

  const showWelcome = () => {
    app.dom.input.disabled = true;
    app.dom.sendBtn.disabled = true;
    app.dom.attachBtn.disabled = true;
    app.dom.modelSelect.disabled = true;
    app.dom.usageBadge.classList.add("hidden");
    if (app.dom.welcome) app.dom.welcome.classList.remove("hidden");
  };

  const setLocked = (locked) => {
    if (locked) {
      app.dom.input.disabled = true;
      app.dom.sendBtn.disabled = true;
      app.dom.attachBtn.disabled = true;
      app.dom.modelSelect.disabled = true;
      app.dom.usageBadge.classList.add("hidden");
      if (app.dom.welcome) app.dom.welcome.classList.remove("hidden");
    } else {
      if (app.dom.welcome) app.dom.welcome.classList.add("hidden");
      app.dom.input.disabled = false;
      app.dom.attachBtn.disabled = false;
      app.dom.modelSelect.disabled = false;
      app.updateStatus();
    }
  };

  const updateStatus = () => {
    const has = !!app.settings.apiKey;
    app.dom.sendBtn.disabled = !has;
  };

  const connectFromWelcome = async () => {
    const key = app.dom.welcomeApiKey?.value.trim();
    const statusEl = $("welcome-status");
    if (!key) {
      if (statusEl) { statusEl.textContent = "Enter an API key first"; statusEl.className = "welcome-status error"; }
      return;
    }
    app.dom.welcomeConnectBtn.disabled = true;
    app.dom.welcomeConnectBtn.textContent = "Connecting...";
    if (statusEl) { statusEl.textContent = "Validating API key…"; statusEl.className = "welcome-status loading"; }
    try {
      const r = await bgWithRetry("validateKey", { key });
      if (r.valid) {
        app.settings.apiKey = key;
        app.usage = r.usage || null;
        await save();
        if (app.dom.welcome) app.dom.welcome.classList.add("hidden");
        app.dom.input.disabled = false;
        app.dom.attachBtn.disabled = false;
        app.dom.modelSelect.disabled = false;
        app.dom.sendBtn.disabled = false;
        app.fetchUsage();
        updateStatus();
        if (app.settings.saveHistory) {
          await app.loadHistory();
          await app.loadChatHistories();
        }
        app.toast("API key connected!", "success");
      } else {
        if (statusEl) { statusEl.textContent = r.error || "Invalid key"; statusEl.className = "welcome-status error"; }
      }
    } catch (e) {
      if (statusEl) { statusEl.textContent = e.message || "Connection failed — try again"; statusEl.className = "welcome-status error"; }
    }
    app.dom.welcomeConnectBtn.disabled = false;
    app.dom.welcomeConnectBtn.textContent = "Connect";
  };

  const getTabId = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) app.tabId = tab.id;
    } catch (_) {}
  };

  const populateDefaultModelSelect = () => {
    const sel = app.dom.defaultModelSelect;
    if (!sel) return;
    // Save current options
    sel.innerHTML = '<option value="">Use most recent model</option>';
    // Copy from the main model select
    if (app.dom.modelSelect) {
      const options = app.dom.modelSelect.querySelectorAll('option');
      options.forEach(opt => {
        const newOpt = document.createElement('option');
        newOpt.value = opt.value;
        newOpt.textContent = opt.textContent;
        sel.appendChild(newOpt);
      });
    }
    // Set current value
    sel.value = app.settings.defaultModel || '';
  };

  return {
    load, save, applyTheme, autoDetectTheme,
    openSettings, closeSettings, validateKey,
    loadModels, populateSelect, updateContextPercent, checkPaidModel,
    fetchUsage, showWelcome, setLocked, updateStatus, connectFromWelcome, getTabId,
    populateDefaultModelSelect
  };
}

window.SettingsModule = SettingsModule;