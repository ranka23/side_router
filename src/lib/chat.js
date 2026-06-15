// src/lib/chat.js - Chat send flow, queue, and attachments
// Handles message sending, queuing, context compression, file attachments,
// and the API request/response lifecycle for OpenRouter.

/**
 * ChatModule provides all chat-related functionality.
 * Handles sending messages, queue management, file attachments,
 * context compression, and API integration with OpenRouter.
 * @param {SideRouter} app - The main application instance
 * @returns {Object} Public API methods mixed into the app
 */
function ChatModule(app) {
  var _truncate = function (str, maxLen) {
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
  };

  /**
   * Safe HTML-to-DOM parser using only createElement/textContent/appendChild.
   * Parses a limited HTML subset produced by our markdown parser.
   */
  var parseHtmlToDom = function (html, container) {
    var stack = [{ node: container, html: html, tag: 'div' }];
    while (stack.length) {
      var frame = stack.pop();
      var node = frame.node;
      var h = frame.html;
      var tag = frame.tag;
      var i = 0;
      while (i < h.length) {
        if (h[i] === '<') {
          var closePos = h.indexOf('>', i);
          if (closePos === -1) break;
          var tagContent = h.slice(i + 1, closePos);
          var isClosing = tagContent.startsWith('/');
          var tagName = isClosing ? tagContent.slice(1) : tagContent.split(/\s|>/)[0];
          if (!isClosing) {
            var el = document.createElement(tagName);
            var attrMatch = tagContent.match(/(\w+)="([^"]*)"/g);
            if (attrMatch) {
              attrMatch.forEach(function (m) {
                var match = m.match(/(\w+)="([^"]*)"/);
                if (match) el.setAttribute(match[1], match[2]);
              });
            }
            if (/^(br|hr|img|input)$/i.test(tagName)) {
              node.appendChild(el);
            } else {
              stack.push({ node: el, html: '', tag: tagName });
              node.appendChild(el);
              node = el;
            }
          } else {
            while (stack.length && stack[stack.length - 1].tag !== tagName) {
              stack.pop();
            }
            if (stack.length) stack.pop();
            if (stack.length) node = stack[stack.length - 1].node;
          }
          i = closePos + 1;
        } else {
          var nextTag = h.indexOf('<', i);
          var textEnd = nextTag === -1 ? h.length : nextTag;
          if (textEnd > i) {
            node.appendChild(document.createTextNode(h.slice(i, textEnd)));
          }
          i = textEnd;
        }
      }
    }
  };

  /** Get audio format from file name and MIME type */
  var getAudioFormat = function (filename, mime) {
    var ext = (filename.split(".").pop() || "").toLowerCase();
    var fmtMap = { wav: "wav", mp3: "mp3", aiff: "aiff", aac: "aac", ogg: "ogg", flac: "flac", m4a: "mp3" };
    if (fmtMap[ext]) return fmtMap[ext];
    if (mime) {
      if (mime.includes("wav")) return "wav";
      if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
      if (mime.includes("aac")) return "aac";
      if (mime.includes("ogg")) return "ogg";
      if (mime.includes("flac")) return "flac";
      if (mime.includes("aiff")) return "aiff";
    }
    return "wav";
  };

  /** Get a unicode label/icon for a given file type */
  var getLabel = function (type, mime) {
    if (type === "image") return "\uD83D\uDCF7";
    if (type === "audio") return "\uD83C\uDFB5";
    if (type === "video") return "\uD83C\uDFAC";
    if (mime === "application/pdf") return "\uD83D\uDCC4";
    return "\uD83D\uDCCE";
  };

  /** Get chat history for API calls (filter to user/assistant only) */
  var getHistoryForApi = function () {
    return app.messages
      .filter(function (m) { return m.role === "user" || m.role === "assistant"; })
      .map(function (m) {
        var msg = { role: m.role, content: m.content };
        if (m.annotations) msg.annotations = m.annotations;

        if (app.settings.cavemanCompression !== false && m.role === "assistant" && window.CavemanModule) {
          msg.content = window.CavemanModule.compressContextText(msg.content, 4000);
        }
        return msg;
      });
  };

  // ── Context Compression ─────────────────────────────────────

  /**
   * Calculate approximate token count from text (≈4 chars per token).
   * @param {string} text - The text to estimate token count for
   * @returns {number} Approximate token count
   */
  var estimateTokens = function (text) {
    return Math.ceil((text || "").length / 4);
  };

  /**
   * Compress context to fit within a given token budget.
   * Uses intelligent truncation: keeps headers, key paragraphs, removes
   * boilerplate and redundant content. Falls back to simple truncation
   * if needed.
   * @param {string} text - The text to compress
   * @param {number} maxTokens - Maximum token budget
   * @returns {string} Compressed text
   */
  var compressContext = function (text, maxTokens) {
    if (!text) return "";
    var currentTokens = estimateTokens(text);
    // If already within budget, return as-is
    if (currentTokens <= maxTokens) return text;
    // Strip HTML tags and extra whitespace
    var cleaned = text
      .replace(/<[^>]*>/g, "")  // Remove HTML tags
      .replace(/\s+/g, " ")    // Collapse whitespace
      .trim();
    // Remove common boilerplate patterns
    cleaned = cleaned
      .replace(/cookie policy|cookie notice|privacy policy|terms of service|accept all|reject all/gi, "")
      .replace(/subscribe|unsubscribe|sign up|sign in|log in|log out/gi, "")
      .replace(/skip to content|skip to main/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    // Recalculate after cleaning
    currentTokens = estimateTokens(cleaned);
    if (currentTokens <= maxTokens) return cleaned;
    // Extract key sections: prioritize headings and first paragraphs
    var lines = cleaned.split(/\.\s+/);  // Split into sentences
    var result = [];
    var tokenCount = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var lineTokens = estimateTokens(line);
      if (tokenCount + lineTokens > maxTokens) break;
      result.push(line);
      tokenCount += lineTokens;
    }
    var compressed = result.join(". ");
    if (compressed.length < text.length * 0.3) {
      // If we've lost too much content, fall back to simple truncation
      compressed = text.slice(0, Math.min(text.length, maxTokens * 4));
    }
    // Truncate to exact token budget if still over
    if (estimateTokens(compressed) > maxTokens) {
      compressed = compressed.slice(0, maxTokens * 4);
    }
    return compressed;
  };

  /**
   * Compress all attached context items before sending to API.
   * This ensures the request payload fits within the model's context window.
   * @param {string} fullText - The complete text with context appended
   * @param {number} contextWindow - The model's context window size
   * @returns {string} Compressed text
   */
  var compressFullContext = function (fullText, contextWindow) {
    // Leave 20% of context for the response
    var maxContextTokens = Math.floor(contextWindow * 0.8);
    var currentTokens = estimateTokens(fullText);
    if (currentTokens <= maxContextTokens) return fullText;
    // Compress the context to fit
    var savings = currentTokens - maxContextTokens;
    return compressContext(fullText, contextWindow - savings);
  };

  // ── Queue Management ────────────────────────────────────────

  /**
   * Queue a message for sending when the current request finishes.
   * Shows a queued bubble in the chat and processes the queue.
   * @param {string} text - The message text
   * @param {Array} attachments - File attachments
   */
  var queueSend = function (text, attachments) {
    var timestamp = Date.now();
    var contextItems = app.contextItems.slice();
    app.taskQueue.push({ text: text, attachments: attachments, timestamp: timestamp, contextItems: contextItems });
    var queueEl = document.createElement("div");
    queueEl.className = "msg-row queued";
    queueEl.style.cssText = "align-self:flex-end;align-items:flex-end;max-width:85%;";
    queueEl.dataset.queueTimestamp = timestamp;
    var attLabel = attachments.length ? " " + attachments.map(function (a) { return getLabel(a.type, a.mime); }).join(" ") : "";

    var roleDiv = document.createElement("div");
    roleDiv.className = "msg-role queued";
    roleDiv.style.flexDirection = "row-reverse";
    roleDiv.textContent = "Queued";

    var contentDiv = document.createElement("div");
    contentDiv.className = "msg-content md-content queued-content";
    parseHtmlToDom(window.md(text), contentDiv);
    if (attLabel) contentDiv.appendChild(document.createTextNode(attLabel));

    var tagDiv = document.createElement("div");
    tagDiv.className = "msg-queue-tag";
    tagDiv.style.textAlign = "right";
    tagDiv.textContent = "QUEUED";

    queueEl.appendChild(roleDiv);
    queueEl.appendChild(contentDiv);
    queueEl.appendChild(tagDiv);
    app.dom.messages.appendChild(queueEl);
    app.scroll();
    app.dom.input.value = "";
    app.resize();
    app.clearAttachments();
    app.contextItems = [];
    app.dom.contextChips.textContent = "";
    if (!app.isRunning) { processQueue(); }
  };

  /**
   * Process the message queue sequentially.
   * Shifts items one at a time and calls handleSend for each.
   */
  var processQueue = async function () {
    if (app.taskQueue.length === 0) {
      app.setRunning(false);
      app.updateSendIcon();
      return;
    }
    app.setRunning(true);
    app.updateSendIcon();
    var item = app.taskQueue.shift();
    var text = item.text;
    var attachments = item.attachments;
    var timestamp = item.timestamp;
    var contextItems = item.contextItems || [];
    var queueEl = app.dom.messages.querySelector("[data-queue-timestamp=\"" + timestamp + "\"]");
    if (queueEl) {
      queueEl.classList.remove("queued");
      queueEl.classList.add("user");
      var roleEl = queueEl.querySelector(".msg-role");
      if (roleEl) {
        roleEl.classList.remove("queued");
        roleEl.classList.add("user");
        roleEl.textContent = "You";
        roleEl.style.cssText = "";
      }
      var tag = queueEl.querySelector(".msg-queue-tag");
      if (tag) tag.remove();
      queueEl.style.cssText = "";
    }
    await handleSend(text, attachments, timestamp, contextItems);
    processQueue();
  };

  // ── Send Flow ───────────────────────────────────────────────

  /**
   * Main send entry point. Handles validation, model selection, and routing
   * to either queueSend (if busy) or handleSendDirect.
   */
  var send = async function () {
    var text = app.dom.input.value.trim();
    if (!text && !app.attachments.length && !app.contextItems.length) return;
    if (!app.settings.apiKey) { app.toast("Enter an API key to start chatting", "info"); return; }
    if (!app.settings.selectedModel) {
      app.settings.selectedModel = "openrouter/free";
      if (app.dom.modelSelect) {
        var opt = Array.from(app.dom.modelSelect.options).find(function (o) { return o.value === "openrouter/free"; });
        if (opt) app.dom.modelSelect.value = "openrouter/free";
      }
      app.save();
    }
    if (app.isRunning) {
      queueSend(text, app.attachments.slice());
      return;
    }
    await handleSendDirect(text, app.attachments.slice());
  };

  /** Build HTML for file attachment cards */
  var buildFileAttachmentHtml = function (attachments) {
    if (!attachments || !attachments.length) return "";
    return attachments.map(function (a) {
      var icon = getLabel(a.type, a.mime);
      var name = escapeHtml(a.name);
      var size = formatFileSize(a.size || 0);
      var typeLabel = getFileTypeLabel(a.type, a.mime);
      return "<div class=\"file-attachment\" data-name=\"" + name + "\">" +
        "<span class=\"file-icon\">" + icon + "</span>" +
        "<span class=\"file-info\">" +
        "<span class=\"file-name\">" + name + "</span>" +
        "<span class=\"file-meta\">" + typeLabel + " \u00B7 " + size + "</span>" +
        "</span>" +
        "<button class=\"file-download-btn\" data-action=\"download-file\" title=\"Download file\">" +
        "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
        "<path d=\"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>" +
        "</svg>" +
        "</button>" +
        "</div>";
    }).join("");
  };

  var formatFileSize = function (bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  var getFileTypeLabel = function (type, mime) {
    if (type === "image") return "Image";
    if (type === "audio") return "Audio";
    if (type === "video") return "Video";
    if (mime === "application/pdf") return "PDF";
    return "File";
  };

  var escapeHtml = function (str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      if (c === "&") return "&" + "amp;";
      if (c === "<") return "&" + "lt;";
      if (c === ">") return "&" + "gt;";
      if (c === '"') return "&" + "quot;";
      return c;
    });
  };

  /**
   * Direct send without queuing. Renders user bubble and processes the request.
   * @param {string} text - The message text
   * @param {Array} attachments - File attachments
   */
  var handleSendDirect = async function (text, attachments) {
    var attLabel = attachments.length ? attachments.map(function (a) { return getLabel(a.type, a.mime); }).join(" ") + " (" + attachments.length + ")" : "";
    var ctxLabel = app.contextItems.length ? " [" + app.contextItems.length + " context]" : "";
    var bubbleText = [text, attLabel + ctxLabel].filter(Boolean).join(" ");
    var contextItems = app.contextItems.slice();
    if (attachments.length) {
      app._pendingAttachments = attachments.slice();
    }
    app.renderBubble("user", bubbleText || attLabel);
    app._pendingAttachments = null;
    app.dom.input.value = "";
    app.resize();
    app.clearAttachments();
    app.contextItems = [];
    app.dom.contextChips.textContent = "";
    await handleSend(text, attachments, null, contextItems);
  };

/**
    * Core send handler. Constructs the API request body, sends to OpenRouter,
    * handles the response (including thinking/reasoning), and saves history.
    * Uses context compression to fit within the model's context window.
    * @param {string} text - The user message text
    * @param {Array} initialAttachments - File attachments
    * @param {number|null} queueTimestamp - Timestamp from queue (or null)
    */
  var handleSend = async function (text, initialAttachments, queueTimestamp, contextItems) {
    if (queueTimestamp === undefined || queueTimestamp === null) queueTimestamp = null;
    if (!contextItems) contextItems = app.contextItems;
    app.setRunning(true);
    app.updateSendIcon();
    var fullText = text;

    // ── Page Context Integration ───────────────────────────────
    var pageRef = text.match(/\b(this page|the page|current page|webpage|website|tab|this site)\b/i);
    if (pageRef && !app.tabContent) { await app.getTabContent(); }
    if (app.tabContent && pageRef) {
      fullText = text + "\n\n[Current Page Context]\nTitle: " + app.tabContent.title + "\nURL: " + app.tabContent.url + "\nContent: " + app.tabContent.text.slice(0, 4000);
      if (app.tabContent.forms && app.tabContent.forms.length) {
        fullText += "\n\nForms: " + JSON.stringify(app.tabContent.forms.slice(0, 3));
      }
    }

    // ── Build Developer Messages for Context Items ───────────────
    var developerMessages = [];
    var contextFileParts = [];
    if (contextItems.length) {
      var caveman = window.CavemanModule;
      var compressContextText = caveman && app.settings.cavemanCompression !== false ? caveman.compressContextText : function (t) { return t; };
      var maxContextChars = app.settings.cavemanCompression !== false ? 4000 : 8000;

      for (var ci = 0; ci < contextItems.length; ci++) {
        var ctx = contextItems[ci];
        if (ctx.type === "page") {
          var pageContent = ctx.content || "";
          var pageContextContent = "Page Context: " + ctx.title + "\nURL: " + ctx.url;
          if (pageContent) {
            pageContextContent += "\nContent: " + compressContextText(pageContent.slice(0, maxContextChars), maxContextChars);
          } else {
            pageContextContent += "\nContent: [Page content was not available. The page may be on a restricted URL such as chrome://, about:blank, or another extension page.]";
          }
          developerMessages.push({
            role: "developer",
            content: pageContextContent
          });
        } else if (ctx.type === "tab") {
          var tabContent = ctx.content || {};
          var tabText = tabContent.text || "";
          var tabContextContent = "Tab Context: " + ctx.title + "\nURL: " + ctx.url + "\nTitle: " + (tabContent.title || ctx.title || "");
          if (tabText) {
            tabContextContent += "\nContent: " + compressContextText(tabText.slice(0, maxContextChars), maxContextChars);
          } else {
            tabContextContent += "\nContent: [Tab content was not available. The tab may be on a restricted page such as chrome://, a new tab page, or another extension page that the browser blocks from reading.]";
          }
          developerMessages.push({
            role: "developer",
            content: tabContextContent
          });
} else if (ctx.type === "file") {
         // Add file context as developer message with compressed text
         if (ctx.text) {
           developerMessages.push({
             role: "developer",
             content: "File Context: " + ctx.name + "\nContent: " + compressContextText(ctx.text.slice(0, maxContextChars), maxContextChars)
           });
         }
         
         // Add ALL files as file attachments via the completion API
         // Use type-specific formats matching the OpenRouter/OpenAI API spec
         if (ctx.data && ctx.mime) {
           var fileDataUrl;
           if (ctx.text) {
             // Text file: convert plain text to proper base64 data URL
             var base64Text = btoa(unescape(encodeURIComponent(ctx.text)));
             fileDataUrl = "data:" + ctx.mime + ";base64," + base64Text;
           } else {
             // Binary file: data is already a data URL from readAsDataURL
             fileDataUrl = ctx.data.startsWith("data:") ? ctx.data : "data:" + ctx.mime + ";base64," + ctx.data;
           }
           
           // Use the correct content part type based on file MIME type
           if (ctx.mime.startsWith("image/")) {
             contextFileParts.push({ type: "image_url", image_url: { url: fileDataUrl } });
           } else if (ctx.mime.startsWith("audio/")) {
             var audioBase64 = fileDataUrl.split(",")[1] || "";
             var audioFmt = getAudioFormat(ctx.name, ctx.mime);
             contextFileParts.push({ type: "input_audio", input_audio: { data: audioBase64, format: audioFmt } });
           } else if (ctx.mime.startsWith("video/")) {
             contextFileParts.push({ type: "video_url", video_url: { url: fileDataUrl } });
           } else if (ctx.mime === "application/pdf") {
             contextFileParts.push({ type: "file", file: { filename: ctx.name, file_data: fileDataUrl } });
           } else {
             contextFileParts.push({ type: "file", file: { filename: ctx.name, file_data: fileDataUrl } });
           }
         }
       }
      }
    }

    // ── Build User Message Content ───────────────────────────────
    var contentParts = [];
    if (fullText) contentParts.push({ type: "text", text: fullText });

    // ── Build Plugins and Attachments ─────────────────────────────
    var plugins = [];
    for (var ai = 0; ai < initialAttachments.length; ai++) {
      var a = initialAttachments[ai];
      if (a.type === "image") {
        var dataUrl = a.data.startsWith("data:") ? a.data : "data:" + (a.mime || "image/png") + ";base64," + a.data;
        contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
      } else if (a.type === "audio") {
        var base64Data = a.data.startsWith("data:") ? a.data.split(",")[1] : a.data;
        var fmt = getAudioFormat(a.name, a.mime);
        contentParts.push({ type: "input_audio", input_audio: { data: base64Data, format: fmt } });
      } else if (a.type === "video") {
        var dataUrl2 = a.data.startsWith("data:") ? a.data : "data:" + (a.mime || "video/mp4") + ";base64," + a.data;
        contentParts.push({ type: "video_url", video_url: { url: dataUrl2 } });
      } else if (a.type === "file" && a.mime === "application/pdf") {
        var dataUrl3 = a.data.startsWith("data:") ? a.data : "data:application/pdf;base64," + a.data;
        var filePart = { type: "file", file: { filename: a.name, file_data: dataUrl3 } };
        if (app._pdfAnnotations && app._pdfAnnotations[a.name]) {
          filePart.file.annotations = app._pdfAnnotations[a.name].content;
          filePart.file.annotation_type = "pdf";
        } else {
          plugins.push({ id: "file-parser", pdf: { engine: "cloudflare-ai" } });
        }
        contentParts.push(filePart);
      } else {
        var dataUrl = a.data.startsWith("data:") ? a.data : "data:" + (a.mime || "application/octet-stream") + ";base64," + a.data;
        contentParts.push({ type: "file", file: { filename: a.name, file_data: dataUrl } });
      }
    }

    // ── Merge Context File Attachments ────────────────────────────
    for (var cfi = 0; cfi < contextFileParts.length; cfi++) {
      contentParts.push(contextFileParts[cfi]);
    }

    // ── Calculate Token Estimate and Compress ─────────────────────
    var contextWindow = 4096;
    var modelSelect = app.dom.modelSelect;
    if (modelSelect && modelSelect.selectedOptions && modelSelect.selectedOptions[0]) {
      contextWindow = parseInt(modelSelect.selectedOptions[0].dataset.context) || 4096;
    }

    // Calculate estimated tokens for context compression decision
    var estimatedTokens = estimateTokens(fullText || "");
    for (var di = 0; di < developerMessages.length; di++) {
      estimatedTokens += estimateTokens(developerMessages[di].content || "");
    }
    for (var ai2 = 0; ai2 < initialAttachments.length; ai2++) {
      var a2 = initialAttachments[ai2];
      if (a2.text) estimatedTokens += estimateTokens(a2.text);
    }
    for (var mi = 0; mi < app.messages.length; mi++) {
      estimatedTokens += estimateTokens(app.messages[mi].content || "");
    }

    // Add context-compression plugin when tokens exceed 80% of context window
    if (estimatedTokens > contextWindow * 0.8) {
      plugins.push({ id: "context-compression", engine: "middle-out" });
    }

    // Compress the context text to fit within the model's context window
    if (contentParts.length > 0 && contentParts[0].type === "text" && app.settings.cavemanCompression !== false) {
      contentParts[0].text = compressFullContext(contentParts[0].text, contextWindow);
    }

    // ── Show Typing Indicator ──────────────────────────────────
    app.typingEl = app.renderTyping();
    app.scroll();

    // ── Send API Request ───────────────────────────────────────
    try {
      var messages = getHistoryForApi();
      if (app.settings.cavemanCompression !== false && window.CavemanModule) {
        messages = [
          { role: "system", content: window.CavemanModule.CAVEMAN_SYSTEM_PROMPT },
          ...messages
        ];
      }
      var body = {
        model: app.settings.selectedModel,
        messages: [...messages, ...developerMessages, {
          role: "user",
          content: contentParts.length === 1 && contentParts[0].type === "text" ? contentParts[0].text : contentParts
        }]
      };
      // Add transforms for OpenRouter middle-out compression
      if (estimatedTokens > contextWindow * 0.8) {
        body.transforms = ["middle-out"];
      }
      if (plugins.length) body.plugins = plugins;
      app.abortController = new AbortController();
      var res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + app.settings.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: app.abortController.signal
      });
      var raw = "";
      try { raw = await res.text(); } catch (e) {}
      var data = {};
      try { data = JSON.parse(raw); } catch (e) {}

      // ── Handle Response ──────────────────────────────────────
      if (app.typingEl) app.typingEl.remove();
      // Render thinking/reasoning if present
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.reasoning) {
        app.renderThinking(data.choices[0].message.reasoning);
      }
      // Handle HTTP errors
      if (!res.ok) {
        var msg = (data && data.error && data.error.message) || (data && data.message) || app.httpMsg(res.status);
        if (msg.match(/credit|payment|subscription|billing|insufficient|exhausted|quota|limit/i)) {
          app.dom.proNotice.classList.remove("hidden");
          throw new Error(msg + " — Buy credits at openrouter.ai/settings/billing");
        }
        if (msg.match(/does not support|not support|unsupported|content type|modality|multimodal|only supports text/i)) {
          throw new Error("AI Model doesn't support your request. Please choose another model to process your request.");
        }
        if (res.status === 401) {
          app.settings.apiKey = null;
          app.save();
          app.showWelcome();
          app.toast("API key invalid — enter a new one", "error");
        }
        throw new Error(msg);
      }
      app.fetchUsage();

      // ── Parse Success Response ───────────────────────────────
      var reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "No response.";
      var annotations = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.annotations) || null;
      if (annotations && app._pendingAttachments) {
        var cachedAnnotations = {};
        for (var pi = 0; pi < annotations.length; pi++) {
          var ann = annotations[pi];
          if (ann.type === "file" && ann.file_id) {
            cachedAnnotations[ann.file_id] = ann;
          }
        }
        if (Object.keys(cachedAnnotations).length > 0) {
          app._pdfAnnotations = cachedAnnotations;
        }
      }

      // ── Permission Handling ──────────────────────────────────
      if (!app.settings.autoApprove) {
        var respPermMatch = reply.match(/\[ASK_PERMISSION:(\w+)\]([\s\S]*?)(\[\/ASK_PERMISSION\])/i);
        if (respPermMatch) {
          var permType = respPermMatch[1].toLowerCase();
          var permDetails = respPermMatch[2].trim();
          if (app.rememberedPermissions.has(permType)) {
            var cmdMatch = reply.match(/```(?:javascript|js)\n([\s\S]*?)```/);
            if (cmdMatch) {
              app.executeOnTab(cmdMatch[1]);
              app.renderBubble("assistant", reply.replace(respPermMatch[0], "[Command executed - remembered permission]"));
            }
          } else {
            var result = await app.requestPermission(permType, permDetails);
            if (result.approved) {
              var cmdMatch2 = reply.match(/```(?:javascript|js)\n([\s\S]*?)```/);
              if (cmdMatch2) {
                app.executeOnTab(cmdMatch2[1]);
                if (result.remember) { app.rememberedPermissions.add(permType); app.save(); }
                app.renderBubble("assistant", reply.replace(respPermMatch[0], "[Command executed with your permission]"));
              }
            } else {
              app.renderBubble("assistant", "\u274C Permission denied.");
            }
          }
        } else {
          app.renderBubble("assistant", reply);
          var codeMatch = reply.match(/```(?:javascript|js)\n([\s\S]*?)```/);
          if (codeMatch && app.settings.autoApprove) { app.executeOnTab(codeMatch[1]); }
        }
      } else {
        app.renderBubble("assistant", reply);
        var codeMatch2 = reply.match(/```(?:javascript|js)\n([\s\S]*?)```/);
        if (codeMatch2 && app.settings.autoApprove) { app.executeOnTab(codeMatch2[1]); }
      }
    } catch (e) {
      // ── Handle Errors ────────────────────────────────────────
      if (e.name === "AbortError") {
        app.renderBubble("assistant", "\u23F9\uFE0F Task stopped by user.");
        if (queueTimestamp) {
          var queueEl2 = app.dom.messages.querySelector("[data-queue-timestamp=\"" + queueTimestamp + "\"]");
          if (queueEl2) {
            queueEl2.classList.add("stopped");
            var stopTagEl = queueEl2.querySelector(".msg-queue-tag");
            if (stopTagEl) stopTagEl.remove();
            var stopTag = document.createElement("div");
            stopTag.className = "msg-queue-tag stopped-tag";
            stopTag.textContent = "STOPPED";
            queueEl2.appendChild(stopTag);
          }
        }
      } else {
        if (app.typingEl) app.typingEl.remove();
        app.renderBubble("assistant", "\u26A0\uFE0F " + e.message);
        app.toast(e.message, "error");
      }
    }
    app.scroll();
    app.setRunning(false);
    app.updateSendIcon();
    if (app.settings.saveHistory) {
      await app.persistHistory();
      await app.autoArchive();
    }
  };

  /** Abort the current in-flight request */
  var abortTask = function () {
    if (app.abortController) {
      app.abortController.abort();
      app.abortController = null;
      app.stopped = true;
      if (app.typingEl) { app.typingEl.remove(); app.typingEl = null; }
      app.renderBubble("assistant", "\u23F9\uFE0F Stopped");
      var queueEl = app.dom.messages.querySelector(".msg-row.queued, .msg-row.processing");
      if (queueEl) {
        queueEl.classList.add("stopped");
        queueEl.classList.remove("queued", "processing");
        var tag = queueEl.querySelector(".msg-queue-tag");
        if (tag) { tag.textContent = "STOPPED"; tag.className = "msg-queue-tag stopped-tag"; }
      }
      app.setRunning(false);
      app.updateSendIcon();
      app.toast("Stopped", "info");
    }
  };

  /**
   * Handle file uploads from the file input.
   * @param {FileList} fileList - The list of files to process
   */
  var handleFiles = function (fileList) {
    for (var fi = 0; fi < fileList.length; fi++) {
      var f = fileList[fi];
      var isAudio = f.type.startsWith("audio/");
      var isVideo = f.type.startsWith("video/");
      var isPdf = f.type === "application/pdf";
      var maxMB = (isAudio || isVideo) ? 50 : (isPdf ? 25 : 10);
      if (f.size > maxMB * 1024 * 1024) { app.toast(f.name + " too large (max " + maxMB + "MB)", "error"); continue; }
      var reader = new FileReader();
      reader.onload = function (ff) {
        return function () {
          var isImage = ff.type.startsWith("image/");
          var att = {
            name: ff.name,
            type: isImage ? "image" : isAudio ? "audio" : isVideo ? "video" : "file",
            data: reader.result,
            mime: ff.type
          };
          if (!isImage && !isAudio && !isVideo && ff.type.startsWith("text/")) {
            try { att.text = atob(reader.result.split(",")[1] || ""); } catch (e) {}
          }
          app.attachments.push(att);
          renderAttachments();
        };
      }(f);
      reader.readAsDataURL(f);
    }
  };

  /** Render attachment chips in the input area */
  var renderAttachments = function () {
    app.dom.attachments.textContent = "";
    for (var ai2 = 0; ai2 < app.attachments.length; ai2++) {
      var a2 = app.attachments[ai2];
      (function (idx) {
        var chip = document.createElement("div");
        chip.className = "attachment-chip";
        if (a2.type === "image") {
          var img = document.createElement("img");
          img.src = a2.data;
          chip.appendChild(img);
        } else {
          var icon = document.createElement("span");
          icon.textContent = a2.type === "audio" ? "\uD83C\uDFB5" : a2.type === "video" ? "\uD83C\uDFAC" : "\uD83D\uDCCE";
          chip.appendChild(icon);
        }
        var nm = document.createElement("span");
        nm.textContent = _truncate(a2.name, 50);
        nm.title = a2.name;
        chip.appendChild(nm);
        var rm = document.createElement("span");
        rm.className = "att-remove";
        rm.textContent = "\u00D7";
        rm.setAttribute("role", "button");
        rm.setAttribute("tabindex", "0");
        rm.setAttribute("aria-label", "Remove attachment " + a2.name);
        var removeAttachment = function () { app.attachments.splice(idx, 1); renderAttachments(); };
        rm.onclick = removeAttachment;
        rm.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); removeAttachment(); } };
        chip.appendChild(rm);
        app.dom.attachments.appendChild(chip);
      })(ai2);
    }
  };

  /** Clear all attachments */
  var clearAttachments = function () {
    app.attachments = [];
    app.dom.attachments.textContent = "";
  };

  return {
    queueSend: queueSend,
    processQueue: processQueue,
    send: send,
    handleSendDirect: handleSendDirect,
    handleSend: handleSend,
    abortTask: abortTask,
    handleFiles: handleFiles,
    renderAttachments: renderAttachments,
    clearAttachments: clearAttachments,
    getHistoryForApi: getHistoryForApi,
    getAudioFormat: getAudioFormat,
    compressContext: compressContext,
    compressFullContext: compressFullContext,
    estimateTokens: estimateTokens,
    _truncate: _truncate,
  };
}

window.ChatModule = ChatModule;