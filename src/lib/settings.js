// src/lib/settings.js - Settings management, zoom controls, and donate modal
// Handles all settings persistence, model selection, theme, zoom level,
// and the crypto donation modal with QR code generation.

/**
 * SettingsModule provides settings persistence, model population,
 * zoom controls, donate modal, and UI state management.
 * @param {SideRouter} app - The main application instance
 * @returns {Object} Public API methods mixed into the app
 */
function SettingsModule(app) {
  /** Default settings values — kept in sync with background.js defaults */
  const defaults = {
    apiKey: null,
    selectedModel: null,
    isDarkTheme: null,
    saveHistory: true,
    autoApprove: false,
    aiName: "ASSISTANT",
    rememberedPermissions: [],
    defaultModel: null,
    zoomLevel: 100,
    cavemanCompression: false,
  };

  /** Minimum and maximum zoom percentages */
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 200;
  const ZOOM_STEP = 10;

  // ── Settings Load/Save ──────────────────────────────────────

  /** Load settings from Chrome storage via background service worker */
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

  /** Save current settings to Chrome storage via background service worker */
  const save = async () => {
    try {
      const toSave = { ...app.settings, rememberedPermissions: [...app.rememberedPermissions] };
      await bgWithRetry("saveSettings", { settings: toSave });
    } catch (_) {}
  };

  // ── Theme Management ────────────────────────────────────────

  /** Apply the current theme by toggling the dark class on body */
  const applyTheme = () => {
    document.body.classList.toggle("dark", !!app.settings.isDarkTheme);
  };

  /** Auto-detect theme from system preference if user hasn't overridden */
  const autoDetectTheme = () => {
    if (!app.settings._userOverrodeTheme) {
      app.settings.isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme();
    }
    app.dom.theme.checked = !!app.settings.isDarkTheme;
  };

  // ── Zoom Controls ───────────────────────────────────────────

  /** Apply the current zoom level to the messages container */
  const applyZoom = () => {
    var level = app.settings.zoomLevel || 100;
    // Clamp to valid range
    level = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level));
    app.settings.zoomLevel = level;
    // Apply CSS transform scale to messages container
    var messages = app.dom.messages;
    if (messages) {
      messages.style.transform = "scale(" + (level / 100) + ")";
      messages.style.transformOrigin = "top left";
      messages.style.width = (100 / (level / 100)) + "%";
    }
    // Update the zoom level display
    if (app.dom.zoomLevel) {
      app.dom.zoomLevel.textContent = level + "%";
    }
  };

  /** Increase zoom by one step */
  const zoomIn = () => {
    if (app.settings.zoomLevel < ZOOM_MAX) {
      app.settings.zoomLevel = (app.settings.zoomLevel || 100) + ZOOM_STEP;
      applyZoom();
      save();
    }
  };

  /** Decrease zoom by one step */
  const zoomOut = () => {
    if (app.settings.zoomLevel > ZOOM_MIN) {
      app.settings.zoomLevel = (app.settings.zoomLevel || 100) - ZOOM_STEP;
      applyZoom();
      save();
    }
  };

  /** Reset zoom to 100% */
  const zoomReset = () => {
    app.settings.zoomLevel = 100;
    applyZoom();
    save();
  };

  // ── Donate Modal ────────────────────────────────────────────

  /** Wallet addresses (placeholder — replace with actual addresses) */
  var walletAddresses = {
    eth: "0x907DB6Ad294bD6B9adAE4C2340d34883E32F121A",
    sol: "H9kw2HG3eik5uKYoULHuzohoY7gCi1Jfqk38ppn1Szyo",
    usdc: "0x907DB6Ad294bD6B9adAE4C2340d34883E32F121A",
    usdt: "0x907DB6Ad294bD6B9adAE4C2340d34883E32F121A",
  };

  /**
   * Generate a minimal QR code as an SVG element.
   * Uses a simple QR code algorithm for encoding text data.
   * @param {string} text - The text to encode in the QR code
   * @param {number} size - The size in pixels
   * @returns {string} SVG markup string
   */
  var generateQrSvg = function (text, size) {
    // Use the canvas-based QR generator if available, otherwise fall back to SVG pattern
    try {
      var canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext("2d");
      // Simple pattern-based QR code representation
      var modules = encodeTextToModules(text, 21);
      var cellSize = size / modules.length;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#1a1a2e";
      for (var r = 0; r < modules.length; r++) {
        for (var c = 0; c < modules[r].length; c++) {
          if (modules[r][c]) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
          }
        }
      }
      return '<img src="' + canvas.toDataURL("image/png") + '" alt="QR Code" width="' + size + '" height="' + size + '" style="border-radius:4px;">';
    } catch (e) {
      return '<div style="width:' + size + 'px;height:' + size + 'px;background:#f1f3f4;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b7280;">QR</div>';
    }
  };

  /**
   * Encode text into a simple QR-like module pattern.
   * This creates a visual representation suitable for wallet addresses.
   * @param {string} text - Text to encode
   * @param {number} modules - Number of modules per side
   * @returns {boolean[][]} 2D array of module values
   */
  var encodeTextToModules = function (text, modules) {
    var grid = [];
    var hash = 0;
    // Simple hash from text
    for (var i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    // Seed a pseudo-random number generator with the hash
    var seed = Math.abs(hash) || 1;
    var prng = function () {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed & 0x7fffffff) / 2147483647;
    };
    // Generate grid with finder patterns in corners
    for (var r = 0; r < modules; r++) {
      var row = [];
      for (var c = 0; c < modules; c++) {
        // Finder patterns (top-left, top-right, bottom-left)
        if (isFinderPattern(r, c, modules)) {
          row.push(true);
        } else if (r < 9 && c < 9) {
          // Top-left finder separator
          row.push(false);
        } else if (r < 9 && c >= modules - 8) {
          // Top-right finder separator
          row.push(false);
        } else if (r >= modules - 8 && c < 9) {
          // Bottom-left finder separator
          row.push(false);
        } else {
          // Data area: use hash-based pseudo-random values
          row.push(prng() > 0.5);
        }
      }
      grid.push(row);
    }
    return grid;
  };

  /** Check if a cell is part of a QR code finder pattern */
  var isFinderPattern = function (r, c, size) {
    // Top-left finder
    if (r < 7 && c < 7) {
      return r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
    }
    // Top-right finder
    if (r < 7 && c >= size - 7) {
      var sc = c - (size - 7);
      return r === 0 || r === 6 || sc === 0 || sc === 6 || (r >= 2 && r <= 4 && sc >= 2 && sc <= 4);
    }
    // Bottom-left finder
    if (r >= size - 7 && c < 7) {
      var sr = r - (size - 7);
      return sr === 0 || sr === 6 || c === 0 || c === 6 || (sr >= 2 && sr <= 4 && c >= 2 && c <= 4);
    }
    return false;
  };

  /** Render QR code images for wallet addresses in the donate modal.
   *  Uses actual JPEG images from media/ instead of generated QR codes.
   *  USDC/USDT show both ETH and SOL QR images side by side.
   */
  var renderDonateQrCodes = function () {
    var ethImg = "media/eth-address.jpg";
    var solImg = "media/sol-address.jpg";
    var ethAddr = walletAddresses.eth;
    var solAddr = walletAddresses.sol;
    // Simple single-QR wallets: ETH and SOL
    var simpleCoins = [
      { id: "eth", img: ethImg, addr: ethAddr, label: "ETH" },
      { id: "sol", img: solImg, addr: solAddr, label: "SOL" },
    ];
    for (var i = 0; i < simpleCoins.length; i++) {
      var c = simpleCoins[i];
      var qrEl = document.getElementById("qr-" + c.id);
      var addrEl = document.getElementById("donate-" + c.id + "-addr");
      if (qrEl) qrEl.innerHTML = '<img src="' + c.img + '" alt="' + c.label + ' QR Code" class="donate-qr-img" />';
      if (addrEl) { addrEl.textContent = c.addr; addrEl.title = c.addr; }
    }
    // Dual-QR wallets: USDC and USDT (both chains)
    var dualCoins = ["usdc", "usdt"];
    for (var j = 0; j < dualCoins.length; j++) {
      var coin = dualCoins[j];
      // ETH side
      var ethQr = document.getElementById("qr-" + coin + "-eth");
      var ethAddrEl = document.getElementById("donate-" + coin + "-eth-addr");
      if (ethQr) ethQr.innerHTML = '<img src="' + ethImg + '" alt="' + coin.toUpperCase() + ' ETH QR Code" class="donate-qr-img" />';
      if (ethAddrEl) { ethAddrEl.textContent = ethAddr; ethAddrEl.title = ethAddr; }
      // SOL side
      var solQr = document.getElementById("qr-" + coin + "-sol");
      var solAddrEl = document.getElementById("donate-" + coin + "-sol-addr");
      if (solQr) solQr.innerHTML = '<img src="' + solImg + '" alt="' + coin.toUpperCase() + ' SOL QR Code" class="donate-qr-img" />';
      if (solAddrEl) { solAddrEl.textContent = solAddr; solAddrEl.title = solAddr; }
    }
  };

  /** Open the donate modal and render QR codes */
  var openDonateModal = function () {
    app._previousFocus = document.activeElement;
    if (app.dom.donateModal) app.dom.donateModal.classList.remove("hidden");
    renderDonateQrCodes();
    document.addEventListener("keydown", app._focusTrapHandler);
    document.addEventListener("keydown", app._escKeyHandler);
    requestAnimationFrame(function () {
      if (app.dom.donateCloseBtn) app.dom.donateCloseBtn.focus();
    });
  };

  /** Close the donate modal */
  var closeDonateModal = function () {
    if (app.dom.donateModal) app.dom.donateModal.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  /** Copy wallet address to clipboard */
  var copyDonateAddress = function (coin) {
    var addr = walletAddresses[coin];
    if (!addr || addr.startsWith("YOUR_")) {
      app.toast("Replace this address with your wallet address", "info");
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(addr).then(function () {
        app.toast("Address copied!", "success");
      });
    }
  };

  // ── Settings Modal ──────────────────────────────────────────

  /** Open the settings modal, populating all fields from current settings */
  const openSettings = () => {
    app._previousFocus = document.activeElement;
    app.dom.apiKey.value = app.settings.apiKey || "";
    app.dom.theme.checked = !!app.settings.isDarkTheme;
    app.dom.saveHistory.checked = app.settings.saveHistory !== false;
    app.dom.autoApprove.checked = !!app.settings.autoApprove;
    app.dom.caveman.checked = app.settings.cavemanCompression !== false;
    app.dom.aiName.value = app.settings.aiName || "ASSISTANT";
    app.dom.keyStatus.textContent = "";
    app.dom.keyStatus.className = "key-status";
    // Update zoom display
    if (app.dom.zoomLevel) {
      app.dom.zoomLevel.textContent = (app.settings.zoomLevel || 100) + "%";
    }
    // Populate default model selector
    populateDefaultModelSelect();
    app.dom.settings.classList.remove("hidden");
    document.addEventListener("keydown", app._focusTrapHandler);
    document.addEventListener("keydown", app._escKeyHandler);
    app.dom.settings.setAttribute("aria-modal", "true");
    requestAnimationFrame(() => app.dom.apiKey.focus());
  };

  /** Close the settings modal and restore focus */
  const closeSettings = () => {
    app.dom.settings.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  // ── API Key Validation ──────────────────────────────────────

  /**
   * Validate the API key entered in the settings modal.
   * If valid, save it and unlock the chat UI.
   */
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

  // ── Model Population ────────────────────────────────────────

  /** Load models from the background service worker */
  const loadModels = async () => {
    try {
      const r = await bgWithRetry("getModels");
      populateSelect(r?.models || []);
    } catch {
      populateSelect([]);
    }
  };

  /**
   * Populate the model selection dropdown with grouped free/paid models.
   * Creates a custom searchable dropdown UI.
   * @param {Array} models - Array of model objects from OpenRouter API
   */
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
    // Build custom dropdown trigger
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
    // Dropdown panel with search
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
    // Assemble — handle re-population by removing old wrapper first
    var oldParent = null;
    var oldWrapper = sel.parentNode;
    if (oldWrapper && oldWrapper.classList && oldWrapper.classList.contains("model-dropdown-wrapper")) {
      oldParent = oldWrapper.parentNode;
      oldWrapper.remove();
    } else if (sel.parentNode) {
      oldParent = sel.parentNode;
    }
    wrapper.appendChild(sel);
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    if (oldParent) {
      oldParent.appendChild(wrapper);
    } else if (sel.parentNode === wrapper) {
      // sel was detached; find the original parent from the DOM
      // Fall back to inserting where the old select was
      var placeholder = document.getElementById("model-select-inline");
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.appendChild(wrapper);
      }
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

  /** Update the usage badge with token count vs context window */
  const updateContextPercent = (contextLength) => {
    if (!contextLength) return;
    const usedChars = app.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const usedTokens = Math.round(usedChars / 4);
    const pct = Math.min(100, Math.round((usedTokens / contextLength) * 100));
    app.dom.usageBadge.innerHTML = `${usedTokens} / ${contextLength} tokens <span class="context-pct">(${pct}%)</span>`;
  };

  /** Show/hide the pro notice based on whether the selected model is paid */
  const checkPaidModel = () => {
    const opt = app.dom.modelSelect.selectedOptions[0];
    const isPaid = opt?.parentElement?.label === "Paid Models";
    app.dom.proNotice.classList.toggle("hidden", !isPaid);
  };

  /** Fetch current usage from the OpenRouter API */
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

  /** Show the welcome screen when no API key is configured */
  const showWelcome = () => {
    app.dom.input.disabled = true;
    app.dom.sendBtn.disabled = true;
    app.dom.modelSelect.disabled = true;
    app.dom.usageBadge.classList.add("hidden");
    if (app.dom.welcome) app.dom.welcome.classList.remove("hidden");
  };

  /** Lock or unlock the UI based on whether an API key is present */
  const setLocked = (locked) => {
    if (locked) {
      app.dom.input.disabled = true;
      app.dom.sendBtn.disabled = true;
      app.dom.modelSelect.disabled = true;
      app.dom.usageBadge.classList.add("hidden");
      if (app.dom.welcome) app.dom.welcome.classList.remove("hidden");
    } else {
      if (app.dom.welcome) app.dom.welcome.classList.add("hidden");
      app.dom.input.disabled = false;
      app.dom.modelSelect.disabled = false;
      app.updateStatus();
    }
  };

  /** Update send button state based on API key presence */
  const updateStatus = () => {
    const has = !!app.settings.apiKey;
    app.dom.sendBtn.disabled = !has;
  };

  /**
   * Handle the welcome screen Connect button click.
   * Validates the API key and unlocks the chat UI.
   */
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

  /** Get the current active tab ID via Chrome API */
  const getTabId = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) app.tabId = tab.id;
    } catch (_) {}
  };

  /** Populate the default model selector in the settings modal */
  const populateDefaultModelSelect = () => {
    const sel = app.dom.defaultModelSelect;
    if (!sel) return;
    sel.innerHTML = '<option value="">Use most recent model</option>';
    if (app.dom.modelSelect) {
      const options = app.dom.modelSelect.querySelectorAll('option');
      options.forEach(opt => {
        const newOpt = document.createElement('option');
        newOpt.value = opt.value;
        newOpt.textContent = opt.textContent;
        sel.appendChild(newOpt);
      });
    }
    sel.value = app.settings.defaultModel || '';
  };

  return {
    load, save, applyTheme, autoDetectTheme,
    openSettings, closeSettings, validateKey,
    loadModels, populateSelect, updateContextPercent, checkPaidModel,
    fetchUsage, showWelcome, setLocked, updateStatus, connectFromWelcome, getTabId,
    populateDefaultModelSelect,
    applyZoom, zoomIn, zoomOut, zoomReset,
    openDonateModal, closeDonateModal, copyDonateAddress,
  };
}

window.SettingsModule = SettingsModule;