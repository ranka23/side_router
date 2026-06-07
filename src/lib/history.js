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

  var archiveCurrentChat = async function () {
    if (!app.settings.saveHistory || app.messages.length === 0) return;
    var existing = app.chatHistories.find(function (h) { return h.id === app.currentChatId; });
    if (existing) {
      existing.messages = app.messages.slice();
      existing.updatedAt = Date.now();
    } else {
      app.chatHistories.unshift({
        id: Date.now().toString(),
        title: (app.messages[0] && app.messages[0].content ? app.messages[0].content.slice(0, 40) : "New Chat") + (app.messages[0] && app.messages[0].content && app.messages[0].content.length > 40 ? "..." : ""),
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
      if (app.dom.historyActions) app.dom.historyActions.classList.add("hidden");
      return;
    }
    if (app.dom.historyActions) app.dom.historyActions.classList.remove("hidden");
    list.innerHTML = app.chatHistories.map(function (chat) {
      var safeTitle = chat.title.replace(/[&<>"]/g, function (c) { if (c === "&") return "&" + "amp;"; if (c === "<") return "&" + "lt;"; if (c === ">") return "&" + "gt;"; if (c === '"') return "&" + "quot;"; return c; });
      return "<div class=\"history-item\" role=\"listitem\" tabindex=\"0\" data-id=\"" + chat.id + "\" aria-label=\"" + safeTitle + "\">" +
        "<div class=\"history-item-main\">" +
        "<div class=\"history-title\">" + safeTitle + "</div>" +
        "<div class=\"history-date\">" + new Date(chat.updatedAt).toLocaleDateString() + " \u00B7 " + chat.messages.length + " messages</div>" +
        "</div>" +
        "<button class=\"history-delete-btn\" data-delete-id=\"" + chat.id + "\" aria-label=\"Delete chat: " + safeTitle + "\">" +
        "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\" focusable=\"false\">" +
        "<polyline points=\"3 6 5 6 21 6\" />" +
        "<path d=\"M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6\" />" +
        "</svg>" +
        "</button>" +
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
          for (var mi2 = 0; mi2 < app.messages.length; mi2++) {
            app.renderBubble(app.messages[mi2].role, app.messages[mi2].content, app.messages[mi2].time, false);
          }
          app.scroll();
          closeHistoryPopup();
          app.toast("Chat restored", "info");
        }
      };
      item.addEventListener("click", function (e) { if (!e.target.closest(".history-delete-btn")) loadChat(); });
      item.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!e.target.closest(".history-delete-btn")) loadChat(); } });
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