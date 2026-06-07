// src/lib/context.js - Context picker popup and permission system
function ContextModule(app) {
  var _esc = function (str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      if (c === "&") return "&" + "amp;";
      if (c === "<") return "&" + "lt;";
      if (c === ">") return "&" + "gt;";
      if (c === '"') return "&" + "quot;";
      return c;
    });
  };

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

  var closeContextPopup = function () {
    if (app.dom.contextPopup) app.dom.contextPopup.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  var switchContextTab = function (tabName) {
    document.querySelectorAll(".context-tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });
    document.querySelectorAll(".context-panel").forEach(function (p) { p.classList.add("hidden"); });
    document.querySelectorAll(".context-panel").forEach(function (p) { p.classList.remove("active"); });
    var panel = $("context-panel-" + tabName);
    if (panel) { panel.classList.remove("hidden"); panel.classList.add("active"); }
  };

  var loadPagePreview = async function () {
    var preview = app.dom.contextPagePreview;
    if (!preview) return;
    preview.innerHTML = "<p class=\"context-empty\">Loading current page\u2026</p>";
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
        var safeTitle = _esc(content.title);
        var safeUrl = _esc(content.url);
        var safeFormatted = _esc(formattedText) || "No text content available.";
        preview.innerHTML = [
          '<div class="context-page-info">',
          '<div class="context-page-header">',
          '<div class="context-page-title-row">',
          '<svg class="context-page-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
          '<strong class="context-page-title">', safeTitle, '</strong>',
          '</div>',
          '<span class="context-page-url">', safeUrl, '</span>',
          '</div>',
          '<div class="context-page-text">', safeFormatted, '</div>',
          '</div>'
        ].join("");
        preview.dataset.pageTitle = content.title;
        preview.dataset.pageUrl = content.url;
        preview.dataset.pageContent = (content.text || "").slice(0, 4000);
      } else {
        preview.innerHTML = "<p class=\"context-empty\">Unable to load page content.</p>";
      }
    } catch (e) {
      preview.innerHTML = "<p class=\"context-empty\">Unable to load page content.</p>";
    }
  };

  var loadTabsList = async function () {
    var list = app.dom.contextTabsList;
    if (!list) return;
    list.innerHTML = "<p class=\"context-empty\">Loading tabs\u2026</p>";
    try {
      var tabs = await chrome.tabs.query({});
      app._contextSelectedTabs = new Set();
      list.innerHTML = tabs.map(function (tab) {
        var title = _esc(tab.title);
        var url = _esc(tab.url || "");
        var favicon = tab.favIconUrl || "";
        var safeFavicon = _esc(favicon);
        return [
          '<label class="context-tab-item" data-tab-id="', tab.id, '">',
          '<input type="checkbox" data-tab-id="', tab.id, '" />',
          '<span class="context-tab-favicon-wrap">',
          favicon ? '<img src="' + safeFavicon + '" alt="" class="context-tab-favicon" onerror="this.style.display=\'none\'" />' : '<span class="context-tab-favicon context-tab-favicon-placeholder"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>',
          '</span>',
          '<span class="context-tab-info">',
          '<span class="context-tab-title" title="', title, '">', title, '</span>',
          '<span class="context-tab-url" title="', url, '">', url, '</span>',
          '</span>',
          '</label>'
        ].join("");
      }).join("");
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
      addBtn.addEventListener("click", function () { attachTabsContext(tabs); });
      list.appendChild(addBtn);
    } catch (e) {
      list.innerHTML = "<p class=\"context-empty\">Unable to load tabs.</p>";
    }
  };

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
        var safeName = _esc(f.name);
        var previewText = String(reader.result || "").slice(0, 500);
        var safeText = _esc(previewText);
        var sizeKB = (f.size / 1024).toFixed(1);
        preview.innerHTML = [
          '<div class="context-file-info">',
          '<strong>', safeName, '</strong>',
          '<span>', sizeKB, ' KB \u00B7 ', f.type || "unknown", '</span>',
          '<pre class="context-file-preview-text">', safeText, '\u2026</pre>',
          '</div>'
        ].join("");
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
        var safeName = _esc(f.name);
        var sizeKB = (f.size / 1024).toFixed(1);
        preview.innerHTML = [
          '<div class="context-file-info">',
          '<strong>', safeName, '</strong>',
          '<span>', sizeKB, ' KB \u00B7 ', f.type || "unknown", '</span>',
          '</div>'
        ].join("");
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

  var attachTabsContext = function (allTabs) {
    if (!app._contextSelectedTabs || !app._contextSelectedTabs.size) return;
    var ids = Array.from(app._contextSelectedTabs);
    for (var ti = 0; ti < ids.length; ti++) {
      var tab = allTabs.find(function (t) { return t.id.toString() === ids[ti]; });
      if (tab) {
        app.contextItems.push({ type: "tab", title: tab.title, url: tab.url });
      }
    }
    renderContextChips();
    closeContextPopup();
    app.toast(app._contextSelectedTabs.size + " tab(s) added", "success");
  };

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

  var renderContextChips = function () {
    var container = app.dom.contextChips;
    if (!container) return;
    container.innerHTML = "";
    for (var ci = 0; ci < app.contextItems.length; ci++) {
      (function (idx) {
        var item = app.contextItems[idx];
        var chip = document.createElement("div");
        chip.className = "context-chip";
        var label = "";
        if (item.type === "page") label = "\uD83D\uDCC4 " + item.title;
        else if (item.type === "tab") label = "\uD83D\uDD17 " + item.title;
        else if (item.type === "file") label = "\uD83D\uDCCE " + item.name;
        var safeLabel = _esc(label);
        chip.innerHTML = "<span>" + safeLabel + '</span><button class="context-chip-remove" aria-label="Remove context" data-idx="' + idx + '">\u00D7</button>';
        chip.querySelector("button").addEventListener("click", function () {
          app.contextItems.splice(idx, 1);
          renderContextChips();
        });
        container.appendChild(chip);
      })(ci);
    }
  };

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
    approvePermission: approvePermission
  };
}

window.ContextModule = ContextModule;