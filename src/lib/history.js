// src/lib/history.js - Chat history management, popup, and confirm dialog
function HistoryModule(app) {
  var loadHistory = async function () {
    try {
      var d = await chrome.storage.local.get("currentChatMessages");
      if (d.currentChatMessages) {
        app.messages = JSON.parse(d.currentChatMessages);
        app.dom.messages.innerHTML = "";
        for (var mi = 0; mi < app.messages.length; mi++) {
          app.renderBubble(app.messages[mi].role, app.messages[mi].content, app.messages[mi].time, false);
        }
        app.scroll();
      }
    } catch (e) {}
  };

  var persistHistory = async function () {
    try {
      var key = app.tabId ? "chatHistory_" + app.tabId : "chatHistory";
      var data = {};
      data[key] = JSON.stringify(app.messages);
      await chrome.storage.local.set(data);
    } catch (e) {}
  };

  var loadChatHistories = async function () {
    if (!app.settings.saveHistory) return;
    try {
      var data = await chrome.storage.local.get(["archivedChats", "currentChatId"]);
      app.chatHistories = data.archivedChats || [];
      app.currentChatId = data.currentChatId || null;
    } catch (e) {}
  };

  var saveChatHistories = async function () {
    try {
      var json = JSON.stringify(app.chatHistories);
      if (json.length > 5 * 1024 * 1024) { app.chatHistories = app.chatHistories.slice(-20); }
      await chrome.storage.local.set({ archivedChats: app.chatHistories });
    } catch (e) {}
  };

  var generateChatTitle = function (messages) {
    // Extract first user message that contains meaningful content
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "user" && messages[i].content) {
        var content = messages[i].content.trim();
        // Remove any file attachment labels
        content = content.replace(/\s*📷|🎵|🎬|📄|📎/g, '');
        // Remove markdown formatting
        content = content.replace(/[#*`_\[\]()~]/g, '');
        // Take first 50 chars, clean up
        var title = content.slice(0, 50).trim();
        if (title.length < 3) continue; // skip very short messages
        return title + (content.length > 50 ? "..." : "");
      }
    }
    // Fallback: use first assistant message or default
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "assistant" && messages[i].content) {
        var content = messages[i].content.trim().replace(/[#*`_\[\]()~]/g, '');
        var title = content.slice(0, 50).trim();
        if (title.length >= 3) {
          return title + (content.length > 50 ? "..." : "");
        }
      }
    }
    return "New Chat";
  };

  var archiveCurrentChat = async function () {
    if (!app.settings.saveHistory || app.messages.length === 0) return;
    var existing = app.chatHistories.find(function (h) { return h.id === app.currentChatId; });
    if (existing) {
      existing.messages = app.messages.slice();
      existing.updatedAt = Date.now();
    } else {
      app.chatHistories.unshift({
        id: Date.now().toString(),
        title: generateChatTitle(app.messages),
        messages: app.messages.slice(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    await saveChatHistories();
  };

  var newChat = async function () {
    await archiveCurrentChat();
    app.messages = [];
    app.currentChatId = null;
    app.dom.messages.innerHTML = "";
    app.dom.input.value = "";
    app.resize();
    app.clearAttachments();
    app.contextItems = [];
    app.dom.contextChips.innerHTML = "";
    await chrome.storage.local.remove("currentChatId");
    // Restore the default model if set
    if (app.settings.defaultModel && app.dom.modelSelect) {
      var modelExists = Array.from(app.dom.modelSelect.options).some(function (o) { return o.value === app.settings.defaultModel; });
      if (modelExists) {
        app.dom.modelSelect.value = app.settings.defaultModel;
        app.settings.selectedModel = app.settings.defaultModel;
        app.save();
        app.checkPaidModel();
      }
    }
    app.toast("New chat started", "info");
  };

  var openHistoryPopup = function () {
    app._previousFocus = document.activeElement;
    if (app.dom.historyPopup) app.dom.historyPopup.classList.remove("hidden");
    document.addEventListener("keydown", app._focusTrapHandler);
    document.addEventListener("keydown", app._escKeyHandler);
    renderHistoryList();
    requestAnimationFrame(function () {
      var closeBtn = $("history-close-btn");
      if (closeBtn) closeBtn.focus();
    });
  };

  var closeHistoryPopup = function () {
    if (app.dom.historyPopup) app.dom.historyPopup.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  var renderHistoryList = function () {
    var list = app.dom.historyList;
    if (!list) return;
    if (!app.chatHistories.length) {
      list.innerHTML = "<p class=\"history-empty\">No archived chats yet. Start a conversation and it will appear here.</p>";
      if (app.dom.historyClearAllBtn) app.dom.historyClearAllBtn.classList.add("hidden");
      return;
    }
    if (app.dom.historyClearAllBtn) app.dom.historyClearAllBtn.classList.remove("hidden");
    list.innerHTML = app.chatHistories.map(function (chat) {
      var safeTitle = chat.title.replace(/[&<>"]/g, function (c) { if (c === "&") return "&" + "amp;"; if (c === "<") return "&" + "lt;"; if (c === ">") return "&" + "gt;"; if (c === '"') return "&" + "quot;"; return c; });
      var modelInfo = chat.model ? " \u00B7 <span class=\"history-model\">" + chat.model + "</span>" : "";
      return "<div class=\"history-item\" role=\"listitem\" tabindex=\"0\" data-id=\"" + chat.id + "\" aria-label=\"" + safeTitle + "\">" +
        "<div class=\"history-item-main\">" +
        "<div class=\"history-title\">" + safeTitle + "</div>" +
        "<div class=\"history-date\">" + new Date(chat.updatedAt).toLocaleDateString() + " \u00B7 " + chat.messages.length + " messages" + modelInfo + "</div>" +
        "</div>" +
        "<div class=\"history-item-actions\">" +
        "<button class=\"history-rename-btn\" data-rename-id=\"" + chat.id + "\" aria-label=\"Rename chat: " + safeTitle + "\" title=\"Rename\">" +
        "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\" focusable=\"false\">" +
        "<path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/>" +
        "<path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/>" +
        "</svg>" +
        "</button>" +
        "<button class=\"history-delete-btn\" data-delete-id=\"" + chat.id + "\" aria-label=\"Delete chat: " + safeTitle + "\">" +
        "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\" focusable=\"false\">" +
        "<polyline points=\"3 6 5 6 21 6\" />" +
        "<path d=\"M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6\" />" +
        "</svg>" +
        "</button>" +
        "</div>" +
        "</div>";
    }).join("");
    list.querySelectorAll(".history-item").forEach(function (item) {
      var loadChat = function () {
        var id = item.dataset.id;
        var chat = app.chatHistories.find(function (c) { return c.id === id; });
        if (chat) {
          app.archiveCurrentChat();
          app.messages = chat.messages.slice();
          app.currentChatId = id;
          app.dom.messages.innerHTML = "";
          // Restore the model used in this chat
          if (chat.model && app.dom.modelSelect) {
            var modelExists = Array.from(app.dom.modelSelect.options).some(function (o) { return o.value === chat.model; });
            if (modelExists) {
              app.dom.modelSelect.value = chat.model;
              app.settings.selectedModel = chat.model;
              var selectedOpt = app.dom.modelSelect.selectedOptions[0];
              if (selectedOpt) {
                app.updateContextPercent(selectedOpt.dataset.context);
              }
              app.save();
              app.checkPaidModel();
            }
          }
          for (var mi2 = 0; mi2 < app.messages.length; mi2++) {
            app.renderBubble(app.messages[mi2].role, app.messages[mi2].content, app.messages[mi2].time, false);
          }
          app.scroll();
          closeHistoryPopup();
          app.toast("Chat restored", "info");
        }
      };
      item.addEventListener("click", function (e) { if (!e.target.closest(".history-delete-btn") && !e.target.closest(".history-rename-btn")) loadChat(); });
      item.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!e.target.closest(".history-delete-btn") && !e.target.closest(".history-rename-btn")) loadChat(); } });
    });
    list.querySelectorAll(".history-delete-btn").forEach(function (btn) {
      var deleteChat = function (e) {
        e.stopPropagation();
        var id = btn.dataset.deleteId;
        app.chatHistories = app.chatHistories.filter(function (c) { return c.id !== id; });
        if (app.currentChatId === id) app.currentChatId = null;
        saveChatHistories();
        renderHistoryList();
      };
      btn.addEventListener("click", deleteChat);
      btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); deleteChat(e); } });
    });
    list.querySelectorAll(".history-rename-btn").forEach(function (btn) {
      var renameChat = function (e) {
        e.stopPropagation();
        var id = btn.dataset.renameId;
        var chat = app.chatHistories.find(function (c) { return c.id === id; });
        if (!chat) return;
        var newTitle = prompt("Enter new title:", chat.title);
        if (newTitle && newTitle.trim() && newTitle.trim() !== chat.title) {
          chat.title = newTitle.trim();
          chat.updatedAt = Date.now();
          saveChatHistories();
          renderHistoryList();
          app.toast("Chat renamed", "success");
        }
      };
      btn.addEventListener("click", renameChat);
      btn.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); renameChat(e); } });
    });
  };

  var showClearAllConfirm = function () {
    if (!app.chatHistories.length) return;
    app._previousFocus = document.activeElement;
    if (app.dom.confirmMessage) {
      app.dom.confirmMessage.textContent = "Are you sure you want to delete all " + app.chatHistories.length + " archived chat" + (app.chatHistories.length > 1 ? "s" : "") + "? This cannot be undone.";
    }
    if (app.dom.confirmDialog) app.dom.confirmDialog.classList.remove("hidden");
    document.addEventListener("keydown", app._focusTrapHandler);
    document.addEventListener("keydown", app._escKeyHandler);
    requestAnimationFrame(function () { if (app.dom.confirmNoBtn) app.dom.confirmNoBtn.focus(); });
  };

  var closeConfirmDialog = function () {
    if (app.dom.confirmDialog) app.dom.confirmDialog.classList.add("hidden");
    document.removeEventListener("keydown", app._focusTrapHandler);
    document.removeEventListener("keydown", app._escKeyHandler);
    if (app._previousFocus) app._previousFocus.focus();
  };

  var confirmClearAll = async function () {
    app.chatHistories = [];
    app.currentChatId = null;
    await saveChatHistories();
    await chrome.storage.local.remove("currentChatId");
    closeConfirmDialog();
    renderHistoryList();
    app.toast("All chats deleted", "info");
  };

  var clearChat = function () {
    if (!confirm("Clear all messages?")) return;
    app.messages = [];
    app.currentChatId = null;
    app.dom.messages.innerHTML = "";
    if (app.dom.welcome) app.dom.welcome.classList.remove("hidden");
    chrome.storage.local.remove(["currentChatMessages", "currentChatId"]);
  };

  return {
    loadHistory: loadHistory,
    persistHistory: persistHistory,
    loadChatHistories: loadChatHistories,
    saveChatHistories: saveChatHistories,
    archiveCurrentChat: archiveCurrentChat,
    newChat: newChat,
    openHistoryPopup: openHistoryPopup,
    closeHistoryPopup: closeHistoryPopup,
    renderHistoryList: renderHistoryList,
    showClearAllConfirm: showClearAllConfirm,
    closeConfirmDialog: closeConfirmDialog,
    confirmClearAll: confirmClearAll,
    clearChat: clearChat
  };
}

window.HistoryModule = HistoryModule;