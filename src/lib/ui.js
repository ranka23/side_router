// src/lib/ui.js - UI rendering and DOM manipulation
function UIModule(app) {
  var _amp = function (c) {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return c;
  };
  const escapeHtml = (str) => {
    return String(str).replace(/[&<>"]/g, _amp);
  };

  /**
   * Create a proper SVG element in the SVG namespace
   */
  const createSvgIcon = (width, height, viewBox, paths) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", viewBox);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    paths.forEach(p => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", p.tag || "path");
      if (p.d) path.setAttribute("d", p.d);
      if (p.x) path.setAttribute("x", p.x);
      if (p.y) path.setAttribute("y", p.y);
      if (p.width) path.setAttribute("width", p.width);
      if (p.height) path.setAttribute("height", p.height);
      if (p.rx) path.setAttribute("rx", p.rx);
      if (p.ry) path.setAttribute("ry", p.ry);
      if (p.points) path.setAttribute("points", p.points);
      if (p.cx) path.setAttribute("cx", p.cx);
      if (p.cy) path.setAttribute("cy", p.cy);
      if (p.r) path.setAttribute("r", p.r);
      if (p.stroke) path.setAttribute("stroke", p.stroke);
      if (p.fill) path.setAttribute("fill", p.fill);
      svg.appendChild(path);
    });
    return svg;
  };

  /**
   * Create copy button with proper SVG
   */
  const createCopyBtn = (text, tooltip) => {
    const btn = document.createElement("button");
    btn.className = "msg-btn-icon";
    btn.dataset.action = "copy";
    btn.title = tooltip || "Copy";
    btn.appendChild(createSvgIcon("14", "14", "0 0 24 24", [
      { tag: "rect", x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" },
      { tag: "path", d: "M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" }
    ]));
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(text);
      toast("Copied!", "success");
    });
    return btn;
  };

  /**
   * Create download button with proper SVG
   */
  const createDownloadBtn = (text, tooltip) => {
    const btn = document.createElement("button");
    btn.className = "msg-btn-icon";
    btn.dataset.action = "download";
    btn.title = tooltip || "Download";
    btn.appendChild(createSvgIcon("14", "14", "0 0 24 24", [
      { tag: "path", d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" },
      { tag: "polyline", points: "7 10 12 15 17 10" },
      { tag: "line", x1: "12", y1: "15", x2: "12", y2: "3" }
    ]));
    btn.addEventListener("click", function () {
      var ext = text.startsWith("```") ? "md" : "txt";
      var blob = new Blob([text], { type: "text/plain" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "response-" + Date.now() + "." + ext;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Downloaded!", "success");
    });
    return btn;
  };

  /**
   * Create actions container (copy + download buttons)
   */
  const createActions = (text, isUser) => {
    const container = document.createElement("div");
    container.className = "msg-actions";
    container.appendChild(createCopyBtn(text, "Copy"));
    container.appendChild(createDownloadBtn(text, "Download"));
    return container;
  };

  /**
   * Safe HTML-to-DOM parser using only createElement/textContent/appendChild.
   * Parses a limited HTML subset produced by our markdown parser.
   * No innerHTML, no createContextualFragment, no eval.
   */
  const parseHtmlToDom = (html, container) => {
    const stack = [{ node: container, html: html, tag: 'div' }];
    while (stack.length) {
      let { node, html: h, tag } = stack.pop();
      let i = 0;
      while (i < h.length) {
        if (h[i] === '<') {
          const closePos = h.indexOf('>', i);
          if (closePos === -1) break;
          const tagContent = h.slice(i + 1, closePos);
          const isClosing = tagContent.startsWith('/');
          const tagName = isClosing ? tagContent.slice(1) : tagContent.split(/\s|>/)[0];
          if (!isClosing) {
            const el = document.createElement(tagName);
            // Copy attributes
            const attrMatch = tagContent.match(/(\w+)="([^"]*)"/g);
            if (attrMatch) {
              attrMatch.forEach(m => {
                const [, name, value] = m.match(/(\w+)="([^"]*)"/);
                el.setAttribute(name, value);
              });
            }
            // Void elements
            if (/^(br|hr|img|input)$/i.test(tagName)) {
              node.appendChild(el);
            } else {
              stack.push({ node: el, html: '', tag: tagName });
              node.appendChild(el);
              node = el;
            }
          } else {
            // Closing tag - pop to parent
            while (stack.length && stack[stack.length - 1].tag !== tagName) {
              stack.pop();
            }
            if (stack.length) stack.pop();
            if (stack.length) node = stack[stack.length - 1].node;
          }
          i = closePos + 1;
        } else {
          // Text content
          const nextTag = h.indexOf('<', i);
          const textEnd = nextTag === -1 ? h.length : nextTag;
          if (textEnd > i) {
            node.appendChild(document.createTextNode(h.slice(i, textEnd)));
          }
          i = textEnd;
        }
      }
    }
  };

  const toast = (msg, type) => {
    if (!type) type = "info";
    while (app.dom.toast.children.length > 4) app.dom.toast.removeChild(app.dom.toast.firstChild);
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = msg;
    app.dom.toast.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
      setTimeout(function () {
        if (t.parentNode) t.remove();
      }, 300)
    }, 3500);
  };

  const scroll = function () {
    requestAnimationFrame(function () {
      app.dom.messages.scrollTop = app.dom.messages.scrollHeight;
    });
  };

  const resize = function () {
    var el = app.dom.input;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  };

  const scrollToBottom = function () {
    app.dom.messages.scrollTop = app.dom.messages.scrollHeight;
    app.dom.scrollBtn.classList.add("hidden");
  };

  const checkScrollPosition = function () {
    var st = app.dom.messages.scrollTop;
    var sh = app.dom.messages.scrollHeight;
    var ch = app.dom.messages.clientHeight;
    app.dom.scrollBtn.classList.toggle("hidden", sh - st - ch < 50);
  };

  const adjustScrollAfterMessageRemoval = function () {
    var st = app.dom.messages.scrollTop;
    var sh = app.dom.messages.scrollHeight;
    var ch = app.dom.messages.clientHeight;
    if (sh - st - ch >= 50) {
      app.dom.scrollBtn.classList.remove("hidden");
    }
  };

  const updateSendIcon = function () {
    var running = app.dom.sendBtn.classList.contains("running");
    var sendIcon = app.dom.sendBtn.querySelector(".icon-send");
    var stopIcon = app.dom.sendBtn.querySelector(".icon-stop");
    if (sendIcon) sendIcon.classList.toggle("hidden", running);
    if (stopIcon) stopIcon.classList.toggle("hidden", !running);
  };

  const setRunning = function (running) {
    app.isRunning = running;
    if (running) {
      app.dom.sendBtn.classList.add("running");
      // Don't disable the button - allow clicking to stop
      app.dom.input.disabled = true;
    } else {
      app.dom.sendBtn.classList.remove("running");
      var hasKey = !!app.settings.apiKey;
      app.dom.sendBtn.disabled = !hasKey;
      app.dom.input.disabled = false;
    }
  };

  const httpMsg = function (s) {
    var m = {
      401: "Invalid API key",
      429: "Rate limited — wait a moment",
      403: "Forbidden",
      404: "Model not found"
    };
    return m[s] || "HTTP " + s;
  };

  const getMediaType = function (url) {
    var u = url.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?|$)/i.test(u)) return "image";
    if (/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/i.test(u)) return "audio";
    if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(u)) return "video";
    return "file";
  };

  const getFileIconChar = function (type, mime) {
    if (type === "image") return "\uD83D\uDCF7";
    if (type === "audio") return "\uD83C\uDFB5";
    if (type === "video") return "\uD83C\uDFAC";
    if (mime === "application/pdf") return "\uD83D\uDCC4";
    return "\uD83D\uDCCE";
  };

  const formatFileSize = function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileTypeLabel = function (type, mime) {
    if (type === "image") return "Image";
    if (type === "audio") return "Audio";
    if (type === "video") return "Video";
    if (mime === "application/pdf") return "PDF";
    return "File";
  };

  const downloadFileAttachment = async function (name, mime, data) {
    try {
      var blob;
      if (data && data.startsWith("data:")) {
        var parts = data.split(",");
        var byteStr = atob(parts[1] || "");
        var ab = new ArrayBuffer(byteStr.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
        blob = new Blob([ab], { type: mime || "application/octet-stream" });
      } else {
        blob = new Blob([data || ""], { type: mime || "text/plain" });
      }
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = blobUrl;
      a.download = name || "file";
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast("Downloaded: " + name, "success");
    } catch (e) {
      toast("Could not download: " + e.message, "error");
    }
  };

  const buildAnnotationHtml = function (annotations) {
    if (!annotations || !annotations.length) return "";
    var items = [];
    for (var ai = 0; ai < annotations.length; ai++) {
      var ann = annotations[ai];
      if (!ann || !ann.type) continue;
      var type = ann.type;
      var data = ann.data || ann;
      if (type === "image" || type === "image_url") {
        var url = data.url || data.image_url || "";
        var alt = data.alt || data.name || "Image";
        if (!url) continue;
        var safeAlt = escapeHtml(alt);
        var safeUrl = escapeHtml(url);
        items.push("<div class=\"media-item\" data-url=\"" + safeUrl + "\" data-name=\"" + safeAlt + "\">" +
          "<img src=\"" + safeUrl + "\" alt=\"" + safeAlt + "\" loading=\"lazy\" class=\"media-preview-img\">" +
          "<div class=\"media-item-footer\">" +
          "<span class=\"media-item-name\" title=\"" + safeAlt + "\">" + safeAlt + "</span>" +
          "<button class=\"media-download-btn\" data-action=\"download-media\" title=\"Download\">" +
          "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
          "</svg></button></div></div>");
      } else if (type === "audio" || type === "audio_url") {
        var url = data.url || data.audio_url || "";
        var name = data.name || "audio";
        if (!url) continue;
        var safeName = escapeHtml(name);
        var safeUrl = escapeHtml(url);
        items.push("<div class=\"media-item\" data-url=\"" + safeUrl + "\" data-name=\"" + safeName + "\">" +
          "<audio src=\"" + safeUrl + "\" controls class=\"media-preview-audio\"></audio>" +
          "<div class=\"media-item-footer\">" +
          "<span class=\"media-item-name\" title=\"" + safeName + "\">" + safeName + "</span>" +
          "<button class=\"media-download-btn\" data-action=\"download-media\" title=\"Download\">" +
          "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
          "</svg></button></div></div>");
      } else if (type === "video" || type === "video_url") {
        var url = data.url || data.video_url || "";
        var name = data.name || "video";
        if (!url) continue;
        var safeName = escapeHtml(name);
        var safeUrl = escapeHtml(url);
        items.push("<div class=\"media-item\" data-url=\"" + safeUrl + "\" data-name=\"" + safeName + "\">" +
          "<video src=\"" + safeUrl + "\" controls muted loop class=\"media-preview-video\"></video>" +
          "<div class=\"media-item-footer\">" +
          "<span class=\"media-item-name\" title=\"" + safeName + "\">" + safeName + "</span>" +
          "<button class=\"media-download-btn\" data-action=\"download-media\" title=\"Download\">" +
          "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
          "</svg></button></div></div>");
      } else if (type === "file" || type === "document" || type === "sheet" || type === "pdf") {
        var url = data.url || "";
        var name = data.name || data.filename || "file";
        var mime = data.content_type || data.mime || "";
        var ext = name.includes(".") ? name.split(".").pop() : "";
        var safeName = escapeHtml(name);
        var safeExt = ext ? "." + escapeHtml(ext) : "";
        var safeUrl = escapeHtml(url);
        var icon = "\uD83D\uDCC4";
        if (mime.includes("spreadsheet") || mime.includes("excel") || ext === "xls" || ext === "xlsx") icon = "\uD83D\uDCCA";
        else if (mime.includes("pdf") || ext === "pdf") icon = "\uD83D\uDCC4";
        else if (ext === "doc" || ext === "docx") icon = "\uD83D\uDCDD";
        items.push("<div class=\"file-attachment\" data-url=\"" + safeUrl + "\" data-name=\"" + safeName + "\" data-mime=\"" + escapeHtml(mime) + "\">" +
          "<span class=\"file-icon\">" + icon + "</span>" +
          "<span class=\"file-info\">" +
          "<span class=\"file-name\">" + safeName + "</span>" +
          "<span class=\"file-meta\">" + escapeHtml(mime || "File") + (safeExt ? " \u00B7 " + safeExt : "") + "</span>" +
          "</span>" +
          "<button class=\"file-download-btn\" data-action=\"download-annotation-file\" title=\"Download file\">" +
          "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
          "</svg></button></div>");
      }
    }
    return items.length ? "<div class=\"msg-annotations\">" + items.join("") + "</div>" : "";
  };

  const extractMediaUrls = function (text) {
    var urls = [];
    var patterns = [
      /https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)\b[^\s]*/gi,
      /https?:\/\/[^\s]+\.(?:mp3|wav|ogg|flac|aac|m4a)\b[^\s]*/gi,
      /https?:\/\/[^\s]+\.(?:mp4|webm|mov|avi|mkv)\b[^\s]*/gi,
      /https?:\/\/[^\s]+\.(?:pdf|doc|docx|xls|xlsx|zip|rar|tar|gz|csv|json|xml)\b[^\s]*/gi
    ];
    for (var pi = 0; pi < patterns.length; pi++) {
      var m;
      while ((m = patterns[pi].exec(text)) !== null) urls.push(m[0]);
    }
    return [...new Set(urls)].slice(0, 10);
  };

  const buildMediaHtml = function (urls) {
    if (!urls.length) return "";
    var items = urls.map(function (url) {
      var type = getMediaType(url);
      var name = decodeURIComponent(url.split("/").pop().split("?")[0] || "file");
      var safeName = escapeHtml(name);
      var preview = "";
      if (type === "image") {
        preview = "<img src=\"" + url + "\" alt=\"" + safeName + "\" loading=\"lazy\" class=\"media-preview-img\">";
      } else if (type === "audio") {
        preview = "<audio src=\"" + url + "\" controls class=\"media-preview-audio\"></audio>";
      } else if (type === "video") {
        preview = "<video src=\"" + url + "\" controls muted loop class=\"media-preview-video\"></video>";
      }
      return "<div class=\"media-item\" data-url=\"" + url + "\" data-name=\"" + safeName + "\">" +
        preview +
        "<div class=\"media-item-footer\">" +
        "<span class=\"media-item-name\" title=\"" + safeName + "\">" + safeName + "</span>" +
        "<button class=\"media-download-btn\" data-action=\"download-media\" title=\"Download\">" +
        "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
        "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
        "</svg>" +
        "</button>" +
        "</div>" +
        "</div>";
    }).join("");
    return "<div class=\"msg-media-grid\">" + items + "</div>";
  };

  const downloadMedia = async function (url, filename) {
    try {
      var res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Fetch failed");
      var blob = await res.blob();
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast("Downloaded: " + filename, "success");
    } catch (e) {
      window.open(url, "_blank");
      toast("Opened in new tab (CORS blocked download)", "info");
    }
  };

  const renderTyping = function () {
    var row = document.createElement("div");
    row.className = "msg-row assistant thinking";
    var aiName = app.settings.aiName || "ASSISTANT";
    var roleDiv = document.createElement("div");
    roleDiv.className = "msg-role assistant";
    roleDiv.textContent = aiName;
    var dotsDiv = document.createElement("div");
    dotsDiv.className = "typing-dots";
    for (var d = 0; d < 3; d++) {
      var dot = document.createElement("div");
      dot.className = "dot";
      dotsDiv.appendChild(dot);
    }
    var label = document.createElement("span");
    label.className = "typing-label";
    label.textContent = "thinking";
    row.appendChild(roleDiv);
    row.appendChild(dotsDiv);
    row.appendChild(label);
    app.dom.messages.appendChild(row);
    scroll();
    return row;
  };

  const renderThinking = function (reasoning) {
    var row = document.createElement("div");
    row.className = "msg-row thinking thinking-collapsible thinking-collapsed";
    var fullText = String(reasoning);
    var renderedMd = window.md(fullText);
    var aiName = app.settings.aiName || "ASSISTANT";

    var toggleEl = document.createElement("div");
    toggleEl.className = "thinking-toggle";
    toggleEl.setAttribute("role", "button");
    toggleEl.setAttribute("tabindex", "0");
    var arrow = document.createElement("span");
    arrow.className = "thinking-arrow";
    arrow.textContent = "\u25BC";
    toggleEl.appendChild(arrow);
    toggleEl.appendChild(document.createTextNode(" " + aiName + " (thinking)"));

    var bodyDiv = document.createElement("div");
    bodyDiv.className = "thinking-body";
    var contentDiv = document.createElement("div");
    contentDiv.className = "thinking-content md-content";
    parseHtmlToDom(renderedMd, contentDiv);
    bodyDiv.appendChild(contentDiv);

    row.appendChild(toggleEl);
    row.appendChild(bodyDiv);
    app.dom.messages.appendChild(row);
    // Toggle expand/collapse on click
    var toggleEl = row.querySelector(".thinking-toggle");
    toggleEl.addEventListener("click", function () {
      row.classList.toggle("thinking-collapsed");
    });
    toggleEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        row.classList.toggle("thinking-collapsed");
      }
    });
    scroll();
    return row;
  };

  const renderBubble = function (role, content, time, save) {
    if (time === undefined || time === null) time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (save === undefined) save = true;
    var msg = { role: role, content: content, time: time };
    if (save) {
      if (role === "assistant" && app._pendingAnnotations) {
        msg.annotations = app._pendingAnnotations;
        app._pendingAnnotations = null;
      }
      app.messages.push(msg);
    }
    var row = document.createElement("div");
    row.className = "msg-row " + role;
    var isUser = role === "user";
    var text = typeof content === "string" ? content : JSON.stringify(content);
    var mediaUrls = extractMediaUrls(text);
    var aiName = app.settings.aiName || "ASSISTANT";
    var mediaHtml = mediaUrls.length ? buildMediaHtml(mediaUrls) : "";
    var fileAttachmentsHtml = "";
    if (isUser && app._pendingAttachments && app._pendingAttachments.length) {
      fileAttachmentsHtml = app._pendingAttachments.map(function (a) {
        var icon = getFileIconChar(a.type, a.mime);
        var name = escapeHtml(a.name);
        var size = (a.size || 0) > 0 ? formatFileSize(a.size) : "";
        var typeLabel = getFileTypeLabel(a.type, a.mime);
        return "<div class=\"file-attachment\">" +
          "<span class=\"file-icon\">" + icon + "</span>" +
          "<span class=\"file-info\">" +
          "<span class=\"file-name\">" + name + "</span>" +
          "<span class=\"file-meta\">" + typeLabel + (size ? " \u00B7 " + size : "") + "</span>" +
          "</span>" +
          "<button class=\"file-download-btn\" data-action=\"download-file\" title=\"Download file\">" +
          "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
          "</svg>" +
          "</button>" +
          "</div>";
      }).join("");
    }
    var annotationHtml = "";
    if (!isUser && msg.annotations && msg.annotations.length) {
      annotationHtml = buildAnnotationHtml(msg.annotations);
    }

    var roleDiv = document.createElement("div");
    roleDiv.className = "msg-role " + (isUser ? "user" : "assistant");
    var roleText = isUser ? "You " : (aiName + " ");
    var timeSpan = document.createElement("span");
    timeSpan.className = "msg-time-inline";
    timeSpan.textContent = time;
    roleDiv.textContent = roleText;
    roleDiv.appendChild(timeSpan);
    row.appendChild(roleDiv);

    var contentDiv = document.createElement("div");
    contentDiv.className = "msg-content md-content";
    parseHtmlToDom(window.md(text), contentDiv);
    row.appendChild(contentDiv);

    if (fileAttachmentsHtml) {
      var faDiv = document.createElement("div");
      faDiv.className = "file-attachments";
      parseHtmlToDom(fileAttachmentsHtml, faDiv);
      row.appendChild(faDiv);
    }
    if (mediaHtml) {
      var mDiv = document.createElement("div");
      parseHtmlToDom(mediaHtml, mDiv);
      while (mDiv.firstChild) row.appendChild(mDiv.firstChild);
    }
    if (annotationHtml) {
      var aDiv = document.createElement("div");
      parseHtmlToDom(annotationHtml, aDiv);
      while (aDiv.firstChild) row.appendChild(aDiv.firstChild);
    }

    // Create actions using proper DOM methods (not HTML strings) to ensure SVG renders correctly
    var actions = createActions(text, isUser);
    // For ALL messages (user and assistant), add actions inside the row
    // This ensures consistent hover behavior via CSS .msg-row:hover .msg-actions
    row.appendChild(actions);
    row.querySelectorAll('[data-action="code-copy"]').forEach(function (btn) {
      if (btn) {
        btn.addEventListener("click", function () {
          var codeEl = btn.parentElement ? btn.parentElement.querySelector("code") : null;
          if (codeEl) {
            navigator.clipboard.writeText(codeEl.textContent);
            btn.textContent = "Copied!";
            btn.classList.add("copied");
            setTimeout(function () {
              btn.textContent = "Copy";
              btn.classList.remove("copied");
            }, 1500);
          }
        });
      }
    });
    row.querySelectorAll(".inline-code").forEach(function (el) {
      if (el) {
        el.addEventListener("click", function () {
          navigator.clipboard.writeText(el.textContent);
        });
        el.title = "Click to copy";
      }
    });
    row.querySelectorAll('[data-action="download-media"]').forEach(function (btn) {
      if (btn) {
        btn.addEventListener("click", function () {
          var item = btn.closest(".media-item");
          var url = item ? item.dataset.url : null;
          var name = item ? (item.dataset.name || "file") : "file";
          if (url) downloadMedia(url, name);
        });
      }
    });
    // Also handle download-media buttons in annotation containers that may be outside the row
    document.querySelectorAll('.msg-actions-outside [data-action="download-media"]').forEach(function (btn) {
      if (btn) {
        btn.addEventListener("click", function () {
          var item = btn.closest(".media-item");
          var url = item ? item.dataset.url : null;
          var name = item ? (item.dataset.name || "file") : "file";
          if (url) downloadMedia(url, name);
        });
      }
    });
    row.querySelectorAll('[data-action="download-file"]').forEach(function (btn) {
      if (btn) {
        btn.addEventListener("click", function () {
          var container = btn.closest(".file-attachments") || btn.closest(".file-attachment");
          var fileCard = btn.closest(".file-attachment");
          if (fileCard) {
            var name = (fileCard.querySelector(".file-name") || {}).textContent || "file";
            // Look for file name in the pending attachments
            var pending = app._pendingAttachments || [];
            var match = pending.find(function (a) { return a.name === name; });
            if (match) {
              downloadFileAttachment(match.name, match.mime, match.data);
            } else {
              // Try to find it from the message data stored on the row
              // Fallback: download from the bubble text
              var blob = new Blob([text], { type: "text/plain" });
              var a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = name || "file";
              a.click();
              URL.revokeObjectURL(a.href);
              toast("Downloaded: " + name, "success");
            }
          }
        });
      }
    });
    // Handle annotation file downloads (inside or outside row)
    var annotationFileBtns = (isUser ? document.querySelectorAll('.msg-actions-outside [data-action="download-annotation-file"]') : row.querySelectorAll('[data-action="download-annotation-file"]'));
    annotationFileBtns.forEach(function (btn) {
      if (btn) {
        btn.addEventListener("click", function () {
          var fileCard = btn.closest(".file-attachment");
          if (fileCard) {
            var url = fileCard.dataset.url || "";
            var name = fileCard.dataset.name || "file";
            var mime = fileCard.dataset.mime || "";
            if (url) {
              downloadMedia(url, name);
            } else {
              toast("No download URL available", "info");
            }
          }
        });
      }
    });
    // Append row to the DOM
    app.dom.messages.appendChild(row);
    return row;
  };

  return {
    escapeHtml: escapeHtml,
    toast: toast,
    scroll: scroll,
    resize: resize,
    scrollToBottom: scrollToBottom,
    checkScrollPosition: checkScrollPosition,
    adjustScrollAfterMessageRemoval: adjustScrollAfterMessageRemoval,
    updateSendIcon: updateSendIcon,
    setRunning: setRunning,
    httpMsg: httpMsg,
    getMediaType: getMediaType,
    extractMediaUrls: extractMediaUrls,
    buildMediaHtml: buildMediaHtml,
    downloadMedia: downloadMedia,
    renderTyping: renderTyping,
    renderThinking: renderThinking,
    renderBubble: renderBubble
  };
}

window.UIModule = UIModule;