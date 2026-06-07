// src/lib/chat.js - Chat send flow, queue, and attachments
function ChatModule(app) {
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

  var getLabel = function (type, mime) {
    if (type === "image") return "\uD83D\uDCF7";
    if (type === "audio") return "\uD83C\uDFB5";
    if (type === "video") return "\uD83C\uDFAC";
    if (mime === "application/pdf") return "\uD83D\uDCC4";
    return "\uD83D\uDCCE";
  };

  var getHistoryForApi = function () {
    return app.messages
      .filter(function (m) { return m.role === "user" || m.role === "assistant"; })
      .map(function (m) {
        var msg = { role: m.role, content: m.content };
        if (m.annotations) msg.annotations = m.annotations;
        return msg;
      });
  };

  var queueSend = function (text, attachments) {
    var timestamp = Date.now();
    app.taskQueue.push({ text: text, attachments: attachments, timestamp: timestamp });
    var queueEl = document.createElement("div");
    queueEl.className = "msg-row queued";
    queueEl.style.cssText = "align-self:flex-end;align-items:flex-end;max-width:85%;";
    queueEl.dataset.queueTimestamp = timestamp;
    var attLabel = attachments.length ? " " + attachments.map(function (a) { return getLabel(a.type, a.mime); }).join(" ") : "";
    queueEl.innerHTML = "<div class=\"msg-role queued\" style=\"flex-direction:row-reverse;\">Queued</div>" +
      "<div class=\"msg-content md-content queued-content\">" + window.md(text) + attLabel + "</div>" +
      "<div class=\"msg-queue-tag\" style=\"text-align:right;\">QUEUED</div>";
    app.dom.messages.appendChild(queueEl);
    app.scroll();
    app.dom.input.value = "";
    app.resize();
    app.clearAttachments();
    if (!app.isRunning) { processQueue(); }
  };

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
    await handleSend(text, attachments, timestamp);
    processQueue();
  };

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

  var handleSendDirect = async function (text, attachments) {
    var attLabel = attachments.length ? attachments.map(function (a) { return getLabel(a.type, a.mime); }).join(" ") + " (" + attachments.length + ")" : "";
    var ctxLabel = app.contextItems.length ? " [" + app.contextItems.length + " context]" : "";
    var bubbleText = [text, attLabel + ctxLabel].filter(Boolean).join(" ");
    // Store file data for the bubble so it can render attachments
    if (attachments.length) {
      app._pendingAttachments = attachments.slice();
    }
    app.renderBubble("user", bubbleText || attLabel);
    app._pendingAttachments = null;
    app.dom.input.value = "";
    app.resize();
    app.clearAttachments();
    app.contextItems = [];
    app.dom.contextChips.innerHTML = "";
    await handleSend(text, attachments, null);
  };

  var handleSend = async function (text, initialAttachments, queueTimestamp) {
    if (queueTimestamp === undefined || queueTimestamp === null) queueTimestamp = null;
    app.setRunning(true);
    app.updateSendIcon();
    var fullText = text;
    var pageRef = text.match(/\b(this page|the page|current page|webpage|website|tab|this site)\b/i);
    if (pageRef && !app.tabContent) { await app.getTabContent(); }
    if (app.tabContent && pageRef) {
      fullText = text + "\n\n[Current Page Context]\nTitle: " + app.tabContent.title + "\nURL: " + app.tabContent.url + "\nContent: " + app.tabContent.text.slice(0, 4000);
      if (app.tabContent.forms && app.tabContent.forms.length) {
        fullText += "\n\nForms: " + JSON.stringify(app.tabContent.forms.slice(0, 3));
      }
    }
    if (app.contextItems.length) {
      for (var ci = 0; ci < app.contextItems.length; ci++) {
        var ctx = app.contextItems[ci];
        if (ctx.type === "page") {
          fullText += "\n\n[Page Context: " + ctx.title + "]\nURL: " + ctx.url + "\nContent: " + (ctx.content ? ctx.content.slice(0, 4000) : "");
        } else if (ctx.type === "tab") {
          fullText += "\n\n[Tab Context: " + ctx.title + "]\nURL: " + ctx.url;
        } else if (ctx.type === "file") {
          fullText += "\n\n[File: " + ctx.name + "]\n" + (ctx.text || "[binary file]");
        }
      }
    }
    var contentParts = [];
    if (fullText) contentParts.push({ type: "text", text: fullText });
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
        contentParts.push({ type: "file", file: { filename: a.name, file_data: dataUrl3 } });
        plugins.push({ id: "file-parser", pdf: { engine: "cloudflare-ai" } });
      } else {
        var fileText;
        if (a.text) {
          fileText = a.text;
        } else {
          var raw = a.data.startsWith("data:") ? atob(a.data.split(",")[1] || "") : a.data;
          fileText = raw.length > 2000 ? raw.slice(0, 2000) + "\n[truncated]" : raw;
        }
        contentParts.push({ type: "text", text: "\n\n[File: " + a.name + "]\n" + fileText });
      }
    }
    app.typingEl = app.renderTyping();
    app.scroll();
    try {
      var body = {
        model: app.settings.selectedModel,
        messages: getHistoryForApi().concat([{
          role: "user",
          content: contentParts.length === 1 && contentParts[0].type === "text" ? contentParts[0].text : contentParts
        }])
      };
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
      if (app.typingEl) app.typingEl.remove();
      if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.reasoning) {
        app.renderThinking(data.choices[0].message.reasoning);
      }
      if (!res.ok) {
        var msg = (data && data.error && data.error.message) || (data && data.message) || app.httpMsg(res.status);
        if (msg.match(/credit|payment|subscription|billing|insufficient|exhausted|quota|limit/i)) {
          app.dom.proNotice.classList.remove("hidden");
          throw new Error(msg + " — Buy credits at openrouter.ai/settings/billing");
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
      var reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "No response.";
      var annotations = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.annotations) || null;
      if (annotations) { app._pendingAnnotations = annotations; }
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
      // Auto-archive to chat history for crash recovery
      await app.autoArchive();
    }
  };

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

  var renderAttachments = function () {
    app.dom.attachments.innerHTML = "";
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
        nm.textContent = a2.name;
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

  var clearAttachments = function () {
    app.attachments = [];
    app.dom.attachments.innerHTML = "";
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
    getAudioFormat: getAudioFormat
  };
}

window.ChatModule = ChatModule;