// src/lib/context.js - Context picker popup and permission system
// Manages the context picker UI (page, tabs, file context), renders
// context chips with proper styling, and handles the permission flow
// for AI requests to execute JavaScript on web pages.

/**
 * ContextModule provides context management for the chat.
 * Handles page context, tab context, file context, permission requests,
 * and context chip rendering.
 * @param {SideRouter} app - The main application instance
 * @returns {Object} Public API methods mixed into the app
 */
function ContextModule(app) {
  /** Escape HTML entities for safe rendering */
  var _esc = function (str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      if (c === "&") return "&" + "amp;";
      if (c === "<") return "&" + "lt;";
      if (c === ">") return "&" + "gt;";
      if (c === '"') return "&" + "quot;";
      return c;
    });
  };

  /** Truncate text to max length with ellipsis */
  var _truncate = function (str, maxLen) {
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
  };

  /** Open the context picker popup and load previews */
  var openContextPopup = function () {
    app._previousFocus = document.activeElement;
    if (app.dom.contextPopup) app.dom.contextPopup.classList.remove("hidden");
    document.addEventListener("keydown", app._focusTrapHandler);
    document.addEventListener("keydown", app._escKeyHandler);
    switchContextTab("page");
    loadPagePreview();
    loadTabsList();
    requestAnimationFrame(function () {
      var closeBtn = $("context-close-btn");
      if (closeBtn) closeBtn.focus();
    });
  };

  /** Close the context picker popup and restore focus */
  var closeContextPopup = function () {
    if (app.dom.contextPopup) app.dom.contextPopup.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  /** Switch between context tabs (page, tabs, file) */
  var switchContextTab = function (tabName) {
    document.querySelectorAll(".context-tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });
    document.querySelectorAll(".context-panel").forEach(function (p) { p.classList.add("hidden"); });
    document.querySelectorAll(".context-panel").forEach(function (p) { p.classList.remove("active"); });
    var panel = $("context-panel-" + tabName);
    if (panel) { panel.classList.remove("hidden"); panel.classList.add("active"); }
  };

  /** Load and display the current page's content preview */
  var loadPagePreview = async function () {
    var preview = app.dom.contextPagePreview;
    if (!preview) return;
    preview.textContent = "Loading current page\u2026";
    try {
      var content = await app.getTabContent();
      if (content) {
        var headings = [];
        try {
          var r = await bg("getPageHeadings");
          if (r && r.success && r.headings) headings.push.apply(headings, r.headings);
        } catch (e) {}
        var formattedText = "";
        if (headings.length) {
          formattedText += "\u2500\u2500 Headings \u2500\u2500\n";
          headings.forEach(function (h) {
            var indent = "  ".repeat(Math.max(0, h.level - 1));
            formattedText += indent + h.text + "\n";
          });
          formattedText += "\n";
        }
        var bodyText = (content.text || "").replace(/\s+/g, " ").trim();
        if (bodyText) {
          formattedText += "\u2500\u2500 Content \u2500\u2500\n";
          formattedText += bodyText.slice(0, 1500);
          if (bodyText.length > 1500) formattedText += "\u2026";
        }
        var displayTitle = _truncate(content.title, 50);
        var displayUrl = _truncate(content.url, 50);

        preview.textContent = "";
        var pageInfo = document.createElement("div");
        pageInfo.className = "context-page-info";

        var pageHeader = document.createElement("div");
        pageHeader.className = "context-page-header";

        var titleRow = document.createElement("div");
        titleRow.className = "context-page-title-row";

        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "context-page-icon");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "10");
        var line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line1.setAttribute("x1", "2");
        line1.setAttribute("y1", "12");
        line1.setAttribute("x2", "22");
        line1.setAttribute("y2", "12");
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z");
        svg.appendChild(circle);
        svg.appendChild(line1);
        svg.appendChild(path);

        var titleStrong = document.createElement("strong");
        titleStrong.className = "context-page-title";
        titleStrong.textContent = displayTitle;

        titleRow.appendChild(svg);
        titleRow.appendChild(titleStrong);

        var urlSpan = document.createElement("span");
        urlSpan.className = "context-page-url";
        urlSpan.textContent = displayUrl;

        pageHeader.appendChild(titleRow);
        pageHeader.appendChild(urlSpan);

        var textDiv = document.createElement("div");
        textDiv.className = "context-page-text";
        textDiv.textContent = formattedText || "No text content available.";

        pageInfo.appendChild(pageHeader);
        pageInfo.appendChild(textDiv);
        preview.appendChild(pageInfo);

        preview.dataset.pageTitle = content.title;
        preview.dataset.pageUrl = content.url;
        preview.dataset.pageContent = (content.text || "").slice(0, 4000);
      } else {
        preview.textContent = "Unable to load page content.";
      }
    } catch (e) {
      preview.textContent = "Unable to load page content.";
    }
  };

  /** Load the list of open Chrome tabs for selection */
  var loadTabsList = async function () {
    var list = app.dom.contextTabsList;
    if (!list) return;
    list.textContent = "Loading tabs\u2026";
    try {
      var tabs = await chrome.tabs.query({});
      app._contextSelectedTabs = new Set();
      list.textContent = "";
      tabs.forEach(function (tab) {
        var label = document.createElement("label");
        label.className = "context-tab-item";
        label.dataset.tabId = tab.id;

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.dataset.tabId = tab.id;

        var faviconWrap = document.createElement("span");
        faviconWrap.className = "context-tab-favicon-wrap";
        if (tab.favIconUrl) {
          var favImg = document.createElement("img");
          favImg.src = tab.favIconUrl;
          favImg.alt = "";
          favImg.className = "context-tab-favicon";
          favImg.onerror = function () { this.style.display = "none"; };
          faviconWrap.appendChild(favImg);
        } else {
          var placeholder = document.createElement("span");
          placeholder.className = "context-tab-favicon context-tab-favicon-placeholder";
          var phSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          phSvg.setAttribute("width", "16");
          phSvg.setAttribute("height", "16");
          phSvg.setAttribute("viewBox", "0 0 24 24");
          phSvg.setAttribute("fill", "none");
          phSvg.setAttribute("stroke", "currentColor");
          phSvg.setAttribute("stroke-width", "2");
          phSvg.setAttribute("aria-hidden", "true");
          phSvg.setAttribute("focusable", "false");
          var phRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          phRect.setAttribute("x", "2");
          phRect.setAttribute("y", "3");
          phRect.setAttribute("width", "20");
          phRect.setAttribute("height", "14");
          phRect.setAttribute("rx", "2");
          var phLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          phLine1.setAttribute("x1", "8");
          phLine1.setAttribute("y1", "21");
          phLine1.setAttribute("x2", "16");
          phLine1.setAttribute("y2", "21");
          var phLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          phLine2.setAttribute("x1", "12");
          phLine2.setAttribute("y1", "17");
          phLine2.setAttribute("x2", "12");
          phLine2.setAttribute("y2", "21");
          phSvg.appendChild(phRect);
          phSvg.appendChild(phLine1);
          phSvg.appendChild(phLine2);
          placeholder.appendChild(phSvg);
          faviconWrap.appendChild(placeholder);
        }

        var tabInfo = document.createElement("span");
        tabInfo.className = "context-tab-info";

        var tabTitle = document.createElement("span");
        tabTitle.className = "context-tab-title";
        tabTitle.title = tab.title;
        tabTitle.textContent = _truncate(tab.title, 50);

        var tabUrl = document.createElement("span");
        tabUrl.className = "context-tab-url";
        tabUrl.title = tab.url || "";
        tabUrl.textContent = _truncate(tab.url || "", 50);

        tabInfo.appendChild(tabTitle);
        tabInfo.appendChild(tabUrl);

        label.appendChild(cb);
        label.appendChild(faviconWrap);
        label.appendChild(tabInfo);
        list.appendChild(label);
      });
      list.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var item = cb.closest(".context-tab-item");
          if (cb.checked) {
            app._contextSelectedTabs.add(cb.dataset.tabId);
            if (item) item.classList.add("selected");
          } else {
            app._contextSelectedTabs.delete(cb.dataset.tabId);
            if (item) item.classList.remove("selected");
          }
        });
      });
      list.querySelectorAll(".context-tab-item").forEach(function (item) {
        item.addEventListener("click", function (e) {
          if (e.target.tagName === "INPUT") return;
          var cb = item.querySelector("input[type=checkbox]");
          if (cb) {
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event("change"));
          }
        });
      });
      var addBtn = document.createElement("button");
      addBtn.className = "btn btn-primary context-add-btn";
      addBtn.textContent = "Add Selected Tabs";
      addBtn.addEventListener("click", async function () { await attachTabsContext(tabs); });
      list.appendChild(addBtn);
    } catch (e) {
      list.textContent = "Unable to load tabs.";
    }
  };

  /** Handle file selection from the context file picker */
  var handleContextFile = function (fileList) {
    if (!fileList || !fileList.length) return;
    var f = fileList[0];
    var preview = app.dom.contextFilePreview;
    if (!preview) return;
    preview.classList.remove("hidden");
    var isText = f.type.startsWith("text/") || /\.(txt|md|json|csv|xml|html|css|js|py|ts|jsx|tsx|doc|docx|xls|xlsx)$/i.test(f.name);
    if (isText) {
      var reader = new FileReader();
      reader.onload = function () {
        var display_name = _truncate(f.name, 50);
        var previewText = String(reader.result || "").slice(0, 500);
        var sizeKB = (f.size / 1024).toFixed(1);
        preview.textContent = "";
        var fileInfo = document.createElement("div");
        fileInfo.className = "context-file-info";
        var nameStrong = document.createElement("strong");
        nameStrong.textContent = display_name;
        var metaSpan = document.createElement("span");
        metaSpan.textContent = sizeKB + " KB \u00B7 " + (f.type || "unknown");
        var preText = document.createElement("pre");
        preText.className = "context-file-preview-text";
        preText.textContent = previewText + "\u2026";
        fileInfo.appendChild(nameStrong);
        fileInfo.appendChild(metaSpan);
        fileInfo.appendChild(preText);
        preview.appendChild(fileInfo);
        preview.dataset.fileName = f.name;
        preview.dataset.fileData = reader.result;
        preview.dataset.fileMime = f.type;
        preview.dataset.fileText = reader.result;
        var addBtn = document.createElement("button");
        addBtn.className = "btn btn-primary context-add-btn";
        addBtn.textContent = "Add File Context";
        addBtn.addEventListener("click", function () { attachFileContext(); });
        preview.appendChild(addBtn);
      };
      reader.readAsText(f);
    } else {
      var reader2 = new FileReader();
      reader2.onload = function () {
        var display_name = _truncate(f.name, 50);
        var sizeKB = (f.size / 1024).toFixed(1);
        preview.textContent = "";
        var fileInfo = document.createElement("div");
        fileInfo.className = "context-file-info";
        var nameStrong = document.createElement("strong");
        nameStrong.textContent = display_name;
        var metaSpan = document.createElement("span");
        metaSpan.textContent = sizeKB + " KB \u00B7 " + (f.type || "unknown");
        fileInfo.appendChild(nameStrong);
        fileInfo.appendChild(metaSpan);
        preview.appendChild(fileInfo);
        preview.dataset.fileName = f.name;
        preview.dataset.fileData = reader2.result;
        preview.dataset.fileMime = f.type;
        var addBtn = document.createElement("button");
        addBtn.className = "btn btn-primary context-add-btn";
        addBtn.textContent = "Add File Context";
        addBtn.addEventListener("click", function () { attachFileContext(); });
        preview.appendChild(addBtn);
      };
      reader2.readAsDataURL(f);
    }
  };

  /** Add the current page as context */
  var attachPageContext = function () {
    var preview = app.dom.contextPagePreview;
    if (!preview || !preview.dataset.pageTitle) return;
    app.contextItems.push({
      type: "page",
      title: preview.dataset.pageTitle,
      url: preview.dataset.pageUrl,
      content: preview.dataset.pageContent
    });
    renderContextChips();
    closeContextPopup();
    app.toast("Page context added", "success");
  };

  /** Add selected tabs as context */
  var attachTabsContext = async function (allTabs) {
    if (!app._contextSelectedTabs || !app._contextSelectedTabs.size) return;
    var ids = Array.from(app._contextSelectedTabs);
    for (var ti = 0; ti < ids.length; ti++) {
      var tab = allTabs.find(function (t) { return t.id.toString() === ids[ti]; });
      if (tab) {
        var content = await app.getTabContent(tab.id);
        app.contextItems.push({ type: "tab", title: tab.title, url: tab.url, content: content });
      }
    }
    renderContextChips();
    closeContextPopup();
    app.toast(ids.length + " tab(s) added", "success");
  };

  /** Add the selected file as context */
  var attachFileContext = function () {
    var preview = app.dom.contextFilePreview;
    if (!preview || !preview.dataset.fileName) return;
    app.contextItems.push({
      type: "file",
      name: preview.dataset.fileName,
      data: preview.dataset.fileData,
      mime: preview.dataset.fileMime,
      text: preview.dataset.fileText || null
    });
    renderContextChips();
    closeContextPopup();
    app.toast("File context added", "success");
  };

  /**
   * Render context chips above the input area.
   * Each chip shows the context label with a styled X button (no background, white text).
   */
  var renderContextChips = function () {
    var container = app.dom.contextChips;
    if (!container) return;
    container.textContent = "";
    for (var ci = 0; ci < app.contextItems.length; ci++) {
      (function (idx) {
        var item = app.contextItems[idx];
        var chip = document.createElement("div");
        chip.className = "context-chip";
        var label = "";
        if (item.type === "page") label = "\uD83D\uDCC4 " + _truncate(item.title, 50);
        else if (item.type === "tab") label = "\uD83D\uDD17 " + _truncate(item.title, 50);
        else if (item.type === "file") label = "\uD83D\uDCCE " + _truncate(item.name, 50);
        var safeLabel = _esc(label);
        var removeBtn = document.createElement("button");
        removeBtn.className = "context-chip-remove";
        removeBtn.setAttribute("aria-label", "Remove context");
        removeBtn.textContent = "\u00D7";
        removeBtn.addEventListener("click", function () {
          app.contextItems.splice(idx, 1);
          renderContextChips();
        });
        var labelSpan = document.createElement("span");
        labelSpan.textContent = safeLabel;
        chip.appendChild(labelSpan);
        chip.appendChild(removeBtn);
        container.appendChild(chip);
      })(ci);
    }
  };

  /** Request permission from the user for an AI action */
  var requestPermission = function (type, details) {
    return new Promise(function (resolve) {
      app._pendingPermission = { resolve: resolve, type: type, details: details };
      if (app.dom.permActionType) app.dom.permActionType.textContent = type;
      if (app.dom.permActionDetails) app.dom.permActionDetails.textContent = details;
      if (app.dom.permAiName) app.dom.permAiName.textContent = app.settings.aiName || "ASSISTANT";
      if (app.dom.permRememberType) app.dom.permRememberType.textContent = type;
      var rememberCb = $("perm-remember");
      if (rememberCb) rememberCb.checked = false;
      if (app.dom.permissionScreen) app.dom.permissionScreen.classList.remove("hidden");
      document.addEventListener("keydown", app._focusTrapHandler);
      document.addEventListener("keydown", app._escKeyHandler);
      requestAnimationFrame(function () {
        var denyBtn = $("perm-deny");
        if (denyBtn) denyBtn.focus();
      });
    });
  };

  /** Deny the pending permission request */
  var denyPermission = function () {
    if (app._pendingPermission) {
      var remember = $("perm-remember");
      app._pendingPermission.resolve({ approved: false, remember: remember ? remember.checked : false });
      app._pendingPermission = null;
    }
    if (app.dom.permissionScreen) app.dom.permissionScreen.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
  };

  /** Approve the pending permission request */
  var approvePermission = function () {
    if (app._pendingPermission) {
      var remember = $("perm-remember");
      app._pendingPermission.resolve({ approved: true, remember: remember ? remember.checked : false });
      app._pendingPermission = null;
    }
    if (app.dom.permissionScreen) app.dom.permissionScreen.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
  };

  return {
    openContextPopup: openContextPopup,
    closeContextPopup: closeContextPopup,
    switchContextTab: switchContextTab,
    loadPagePreview: loadPagePreview,
    loadTabsList: loadTabsList,
    handleContextFile: handleContextFile,
    attachPageContext: attachPageContext,
    attachTabsContext: attachTabsContext,
    attachFileContext: attachFileContext,
    renderContextChips: renderContextChips,
    requestPermission: requestPermission,
    denyPermission: denyPermission,
    approvePermission: approvePermission,
    _truncate: _truncate
  };
}

window.ContextModule = ContextModule;