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
    sel.innerHTML = "";
    const free = models.filter((m) => m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    const paid = models.filter((m) => !m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    const mk = (m) => {
      const o = document.createElement("option");
      o.value = m.id;
      o.dataset.context = m.contextLength || 4096;
      o.textContent = m.id;
      return o;
    };
    if (free.length) {
      const og = document.createElement("optgroup");
      og.label = "Free Models";
      free.forEach((m) => og.appendChild(mk(m)));
      sel.appendChild(og);
    }
    if (paid.length) {
      const og = document.createElement("optgroup");
      og.label = "Paid Models";
      paid.forEach((m) => og.appendChild(mk(m)));
      sel.appendChild(og);
    }
    if (app.settings.selectedModel) {
      const m = Array.from(sel.options).find((o) => o.value === app.settings.selectedModel);
      if (m) {
        sel.value = app.settings.selectedModel;
        updateContextPercent(m.dataset.context);
      }
    }
    if (!sel.value && sel.options.length) {
      const freeDefault = Array.from(sel.options).find((o) => o.value === "openrouter/free");
      const fallback = freeDefault || sel.options[0];
      sel.value = fallback.value;
      app.settings.selectedModel = fallback.value;
      updateContextPercent(fallback.dataset.context);
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