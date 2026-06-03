// sidepanel.js — OpenRouter AI Chat Extension

class ChatApp {
  constructor() {
    // State
    this.settings = { apiKey: null, selectedModel: null, isDarkTheme: false, saveHistory: true };
    this.messages = [];

    // Cache DOM elements
    this.$ = {
      messages:    document.getElementById('chat-messages'),
      input:       document.getElementById('msg-input'),
      sendBtn:     document.getElementById('btn-send'),
      modelSelect: document.getElementById('model-select'),
      statusDot:   document.getElementById('status-dot'),
      settings:    document.getElementById('settings-modal'),
      apiKey:      document.getElementById('api-key'),
      theme:       document.getElementById('theme-toggle'),
      saveHistory: document.getElementById('save-history-toggle'),
      toast:       document.getElementById('toast-container'),
    };

    // Bind events
    this.$.sendBtn.onclick = () => this.send();
    this.$.input.oninput = () => this.resizeInput();
    this.$.input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } };
    this.$.modelSelect.onchange = () => { this.settings.selectedModel = this.$.modelSelect.value; this.saveSettings(); };
    document.getElementById('btn-settings').onclick = () => this.openSettings();
    document.getElementById('btn-clear').onclick = () => this.clearChat();
    document.getElementById('modal-close').onclick = () => this.closeSettings();
    document.getElementById('btn-save-key').onclick = () => this.saveApiKey();
    this.$.settings.onclick = (e) => { if (e.target === this.$.settings) this.closeSettings(); };
    this.$.theme.onchange = () => { this.settings.isDarkTheme = this.$.theme.checked; document.body.classList.toggle('dark', this.settings.isDarkTheme); this.saveSettings(); };
    this.$.saveHistory.onchange = () => { this.settings.saveHistory = this.$.saveHistory.checked; this.saveSettings(); };

    // Init
    this.bootstrap();
  }

  // ── Bootstrap ───────────────────────────────────────────────
  async bootstrap() {
    try {
      // Load saved settings
      const res = await this.bg('getSettings', {});
      if (res?.success) Object.assign(this.settings, res.settings);

      // Load saved models list
      const mod = await this.bg('getModels', {});
      if (mod?.success && mod.models?.length) this.populateModels(mod.models);

      // Fallback models if API fetch failed
      if (!this.$.modelSelect.options.length) this.populateModels(null);

      // Select saved model
      if (this.settings.selectedModel) this.$.modelSelect.value = this.settings.selectedModel;

      // Apply theme
      document.body.classList.toggle('dark', this.settings.isDarkTheme);
      this.$.theme.checked = this.settings.isDarkTheme;
      this.$.saveHistory.checked = this.settings.saveHistory;

      // Populate settings form
      this.$.apiKey.value = this.settings.apiKey || '';

      // Load chat history
      if (this.settings.saveHistory) await this.loadHistory();

      this.updateStatus();
    } catch (e) {
      console.error('bootstrap:', e);
      this.showToast('Failed to initialize — check console', 'error');
    }
  }

  // ── Background messaging ────────────────────────────────────
  bg(action, data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });
  }

  // ── Save / Load Settings ────────────────────────────────────
  async saveSettings() {
    try {
      await this.bg('saveSettings', { settings: this.settings });
    } catch (e) { console.error('saveSettings:', e); }
  }

  async saveApiKey() {
    const key = this.$.apiKey.value.trim();
    if (!key) { this.showToast('Please enter an API key', 'error'); return; }
    this.settings.apiKey = key;
    await this.saveSettings();
    this.updateStatus();
    this.showToast('API key saved!', 'success');
  }

  // ── Models ──────────────────────────────────────────────────
  populateModels(models) {
    this.$.modelSelect.innerHTML = '';
    const list = models || [
      { id: 'meta-llama/llama-3.3-70b-instruct:free',       name: 'Llama 3.3 70B' },
      { id: 'meta-llama/llama-3.2-3b-instruct:free',        name: 'Llama 3.2 3B' },
      { id: 'nousresearch/hermes-3-llama-3.1-405b:free',    name: 'Hermes 3 405B' },
      { id: 'moonshotai/kimi-k2.6:free',                    name: 'Kimi K2.6' },
      { id: 'openai/gpt-oss-120b:free',                     name: 'GPT-OSS 120B' },
      { id: 'z-ai/glm-4.5-air:free',                        name: 'GLM 4.5 Air' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free',        name: 'Qwen3 Next 80B' },
      { id: 'qwen/qwen3-coder:free',                        name: 'Qwen3 Coder' },
      { id: 'google/gemma-4-31b-it:free',                   name: 'Gemma 4 31B' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free',       name: 'Nemotron Super 120B' },
      { id: 'nvidia/nemotron-nano-9b-v2:free',              name: 'Nemotron Nano 9B' },
      { id: 'liquid/lfm-2.5-1.2b-instruct:free',            name: 'LFM 2.5 1.2B' },
      { id: 'poolside/laguna-m.1:free',                      name: 'Laguna M.1' },
    ];
    list.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      if (m.name) opt.title = m.name;
      this.$.modelSelect.appendChild(opt);
    });
    // Try to match saved model
    if (this.settings.selectedModel) {
      const match = Array.from(this.$.modelSelect.options).find(o => o.value === this.settings.selectedModel);
      if (match) this.$.modelSelect.value = this.settings.selectedModel;
    }
    // If no model selected, pick first
    if (!this.$.modelSelect.value) this.settings.selectedModel = this.$.modelSelect.options[0]?.value || '';
  }

  // ── Chat ────────────────────────────────────────────────────
  async send() {
    const text = this.$.input.value.trim();
    if (!text) return;
    if (!this.settings.apiKey) { this.openSettings(); this.showToast('Please set your API key first', 'error'); return; }
    if (!this.settings.selectedModel) { this.showToast('Please select a model', 'error'); return; }

    // Add user message
    this.appendBubble(text, 'user');
    this.$.input.value = '';
    this.resizeInput();

    // Show typing
    const typing = this.appendTyping();

    try {
      const body = {
        model: this.settings.selectedModel,
        messages: [...this.getChatHistory(), { role: 'user', content: text }],
      };
      console.log('Sending to OpenRouter:', JSON.stringify(body));

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      let rawText = '';
      try { rawText = await res.text(); } catch (_) {}
      let data = {};
      try { data = JSON.parse(rawText); } catch (_) {}

      typing.remove();
      console.log('OpenRouter response status:', res.status);

      if (!res.ok) {
        // Try to extract meaningful error
        let errMsg = '';
        if (data?.error?.message) {
          errMsg = data.error.message;
        } else if (typeof data?.error === 'string') {
          errMsg = data.error;
        } else if (data?.message) {
          errMsg = data.message;
        } else if (res.status === 401) {
          errMsg = 'Invalid API key. Please check your OpenRouter API key in Settings.';
        } else if (res.status === 429) {
          errMsg = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (res.status === 403) {
          errMsg = 'Forbidden — your API key may not have access to this model.';
        } else if (res.status >= 500) {
          errMsg = `Provider error (${res.status}). The model may be temporarily unavailable.`;
        } else {
          errMsg = `HTTP ${res.status}: ${res.statusText || 'Unknown error'}`;
        }
        // Log full response for debugging
        if (!data?.error && rawText) {
          console.error('OpenRouter error body:', rawText.slice(0, 500));
        }
        throw new Error(errMsg);
      }

      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) {
        console.warn('Unexpected response shape:', JSON.stringify(data).slice(0, 500));
        throw new Error('Empty response from model. The model may have returned no content.');
      }

      this.appendBubble(reply, 'assistant');
    } catch (e) {
      typing.remove();
      console.error('API error:', e.message);
      this.appendBubble(`Error: ${e.message}`, 'assistant');
      this.showToast(e.message, 'error');
    }

    this.scrollBottom();
    if (this.settings.saveHistory) this.persistHistory();
  }

  getChatHistory() {
    return this.messages.map(m => ({ role: m.role, content: m.content }));
  }

  appendBubble(content, role) {
    this.messages.push({ role, content });
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="msg-content">${this.escape(content)}</div><div class="msg-time">${time}</div>`;
    this.$.messages.appendChild(div);
    this.scrollBottom();
    return div;
  }

  appendTyping() {
    const div = document.createElement('div');
    div.className = 'msg assistant typing';
    div.innerHTML = `<div class="msg-content"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
    this.$.messages.appendChild(div);
    this.scrollBottom();
    return div;
  }

  scrollBottom() {
    requestAnimationFrame(() => { this.$.messages.scrollTop = this.$.messages.scrollHeight; });
  }

  resizeInput() {
    this.$.input.style.height = 'auto';
    this.$.input.style.height = Math.min(this.$.input.scrollHeight, 120) + 'px';
  }

  clearChat() {
    if (!confirm('Clear all messages?')) return;
    this.messages = [];
    this.$.messages.innerHTML = '';
    chrome.storage.local.remove('chatHistory');
  }

  // ── History Persistence ─────────────────────────────────────
  async loadHistory() {
    try {
      const data = await chrome.storage.local.get('chatHistory');
      if (data.chatHistory) {
        this.messages = JSON.parse(data.chatHistory);
        this.$.messages.innerHTML = '';
        this.messages.forEach(m => {
          const div = document.createElement('div');
          div.className = `msg ${m.role}`;
          const time = m.time || '';
          div.innerHTML = `<div class="msg-content">${this.escape(m.content)}</div><div class="msg-time">${time}</div>`;
          this.$.messages.appendChild(div);
        });
        this.scrollBottom();
      }
    } catch (e) { console.error('loadHistory:', e); }
  }

  async persistHistory() {
    try {
      const data = this.messages.map(m => ({ ...m, time: m.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
      await chrome.storage.local.set({ chatHistory: JSON.stringify(data) });
    } catch (e) { console.error('persistHistory:', e); }
  }

  // ── Settings Modal ──────────────────────────────────────────
  openSettings() {
    this.$.apiKey.value = this.settings.apiKey || '';
    this.$.theme.checked = this.settings.isDarkTheme;
    this.$.saveHistory.checked = this.settings.saveHistory;
    this.$.settings.classList.remove('hidden');
    this.$.apiKey.focus();
  }

  closeSettings() {
    this.$.settings.classList.add('hidden');
  }

  updateStatus() {
    this.$.statusDot.classList.toggle('active', !!this.settings.apiKey);
    this.$.statusDot.title = this.settings.apiKey ? 'API key set' : 'API key not set';
    this.$.sendBtn.disabled = !this.settings.apiKey;
  }

  // ── Toast ───────────────────────────────────────────────────
  showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    this.$.toast.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ── Helpers ─────────────────────────────────────────────────
  escape(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { window.app = new ChatApp(); });
