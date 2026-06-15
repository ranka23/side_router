// src/lib/history.js - Chat history management, popup, and confirm dialog
function HistoryModule(app) {
  var loadHistory = async function () {
    try {
      var d = await chrome.storage.local.get("currentChatMessages");
      if (d.currentChatMessages) {
        app.messages = JSON.parse(d.currentChatMessages);
        app.dom.messages.textContent = "";
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
      // Deduplicate: when titles and message counts match, keep the most recent
      if (app.chatHistories.length > 1) {
        var seen = {};
        var deduped = [];
        for (var i = 0; i < app.chatHistories.length; i++) {
          var chat = app.chatHistories[i];
          var key = chat.title + "|" + (chat.messages ? chat.messages.length : 0);
          if (!seen[key] || chat.updatedAt > seen[key].updatedAt) {
            if (seen[key]) {
              // Replace existing entry with this more recent one
              deduped = deduped.filter(function (c) { return c !== seen[key]; });
            }
            seen[key] = chat;
            deduped.push(chat);
          }
        }
        app.chatHistories = deduped;
      }
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
    // Extract the last user message for the title to help distinguish chats
    var lastUserMsg = null;
    var lastAssistantMsg = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (!lastUserMsg && messages[i].role === "user" && messages[i].content) {
        lastUserMsg = messages[i];
      }
      if (!lastAssistantMsg && messages[i].role === "assistant" && messages[i].content) {
        lastAssistantMsg = messages[i];
      }
      if (lastUserMsg && lastAssistantMsg) break;
    }
    // Prefer last user message, fall back to last assistant message
    var source = lastUserMsg || lastAssistantMsg;
    if (source) {
      var content = source.content.trim();
      // Remove any file attachment labels
      content = content.replace(/\s*📷|🎵|🎬|📄|📎/g, '');
      // Remove markdown formatting
      content = content.replace(/[#*`_\[\]()~]/g, '');
      // Collapse whitespace
      content = content.replace(/\s+/g, ' ');
      // Take first 40 chars, clean up
      var title = content.slice(0, 40).trim();
      if (title.length >= 3) {
        return title + (content.length > 40 ? "..." : "");
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
      existing.title = generateChatTitle(app.messages);
    } else {
      var newId = Date.now().toString();
      app.chatHistories.unshift({
        id: newId,
        title: generateChatTitle(app.messages),
        messages: app.messages.slice(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      app.currentChatId = newId;
    }
    await saveChatHistories();
  };

  var newChat = async function () {
    await archiveCurrentChat();
    app.messages = [];
    app.currentChatId = null;
    app.dom.messages.textContent = "";
    app.dom.input.value = "";
    app.resize();
    app.clearAttachments();
    app.contextItems = [];
    app.dom.contextChips.textContent = "";
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
      list.textContent = "";
      var emptyP = document.createElement("p");
      emptyP.className = "history-empty";
      emptyP.textContent = "No archived chats yet. Start a conversation and it will appear here.";
      list.appendChild(emptyP);
      if (app.dom.historyClearAllBtn) app.dom.historyClearAllBtn.classList.add("hidden");
      return;
    }
    if (app.dom.historyClearAllBtn) app.dom.historyClearAllBtn.classList.remove("hidden");
    list.textContent = "";
    app.chatHistories.forEach(function (chat) {
      var item = document.createElement("div");
      item.className = "history-item";
      item.setAttribute("role", "listitem");
      item.setAttribute("tabindex", "0");
      item.dataset.id = chat.id;
      item.setAttribute("aria-label", chat.title);

      var main = document.createElement("div");
      main.className = "history-item-main";

      var title = document.createElement("div");
      title.className = "history-title";
      title.textContent = chat.title;

      var date = document.createElement("div");
      date.className = "history-date";
      var modelInfo = chat.model ? " \u00B7 " + chat.model : "";
      date.textContent = new Date(chat.updatedAt).toLocaleDateString() + " " + new Date(chat.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " \u00B7 " + chat.messages.length + " messages" + modelInfo;

      main.appendChild(title);
      main.appendChild(date);

      var actions = document.createElement("div");
      actions.className = "history-item-actions";

      var renameBtn = document.createElement("button");
      renameBtn.className = "history-rename-btn";
      renameBtn.dataset.renameId = chat.id;
      renameBtn.setAttribute("aria-label", "Rename chat: " + chat.title);
      renameBtn.title = "Rename";
      renameBtn.textContent = "\u270E";

      var deleteBtn = document.createElement("button");
      deleteBtn.className = "history-delete-btn";
      deleteBtn.dataset.deleteId = chat.id;
      deleteBtn.setAttribute("aria-label", "Delete chat: " + chat.title);
      deleteBtn.textContent = "\u2715";

      actions.appendChild(renameBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(main);
      item.appendChild(actions);
      list.appendChild(item);
    });
    list.querySelectorAll(".history-item").forEach(function (item) {
      var loadChat = function () {
        var id = item.dataset.id;
        var chat = app.chatHistories.find(function (c) { return c.id === id; });
        if (chat) {
          app.archiveCurrentChat();
          app.messages = chat.messages.slice();
          app.currentChatId = id;
          app.dom.messages.textContent = "";
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

  /** Auto-archive the current chat (alias for archiveCurrentChat) */
  var autoArchive = archiveCurrentChat;

  /** Clear the current chat and reset the UI */
  var clearChat = function () {
    if (!confirm("Clear all messages?")) return;
    app.messages = [];
    app.currentChatId = null;
    app.dom.messages.textContent = "";
    if (app.dom.welcome) app.dom.welcome.classList.remove("hidden");
    chrome.storage.local.remove(["currentChatMessages", "currentChatId"]);
  };

  return {
    loadHistory: loadHistory,
    persistHistory: persistHistory,
    loadChatHistories: loadChatHistories,
    saveChatHistories: saveChatHistories,
    archiveCurrentChat: archiveCurrentChat,
    autoArchive: autoArchive,
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