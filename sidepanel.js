// sidepanel.js — SideRouter v4 (Complete)

const bg = (action, data = {}) => new Promise((ok, fail) => {
  chrome.runtime.sendMessage({ action, ...data }, r => {
    if (chrome.runtime.lastError) fail(new Error(chrome.runtime.lastError.message));
    else ok(r);
  });
});
const $ = id => document.getElementById(id);

class SideRouter {
  constructor() {
    this.settings = {
      apiKey: null, selectedModel: null, isDarkTheme: null,
      saveHistory: true, sidePosition: 'right',
      autoApprove: false, alwaysOnTop: false,
    };
    this.messages = [];
    this.attachments = [];
    this.typingEl = null;
    this.usage = null;
    this.tabContent = null;

    this.dom = {
      messages:     $('chat-messages'),
      input:        $('msg-input'),
      sendBtn:      $('btn-send'),
      attachBtn:    $('btn-attach'),
      fileInput:    $('file-input'),
      modelSelect:  $('model-select-inline'),
      settings:     $('settings-modal'),
      apiKey:       $('api-key'),
      keyStatus:    $('key-status'),
      theme:        $('theme-toggle'),
      saveHistory:  $('save-history-toggle'),
      autoApprove:  $('auto-approve-toggle'),
      alwaysOnTop:  $('always-on-top-toggle'),
      proNotice:    $('pro-notice'),
      toast:        $('toast-container'),
      attachments:  $('input-attachments'),
      usageBadge:   $('usage-badge'),
      welcome:      $('welcome-screen'),
    };

    // ── Event bindings ──
    this.dom.sendBtn.onclick = () => this.send();
    this.dom.input.oninput = () => this.resize();
    this.dom.input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } };
    this.dom.attachBtn.onclick = () => this.dom.fileInput.click();
    this.dom.fileInput.onchange = e => { this.handleFiles(e.target.files); e.target.value = ''; };
    this.dom.modelSelect.onchange = () => {
      this.settings.selectedModel = this.dom.modelSelect.value;
      this.save();
      this.checkPaidModel();
    };
    $('btn-settings').onclick = () => this.openSettings();
    $('btn-clear').onclick = () => this.clearChat();
    $('modal-close').onclick = () => { if (this.settings.apiKey) this.closeSettings(); };
    this.dom.settings.onclick = e => { if (e.target === this.dom.settings && this.settings.apiKey) this.closeSettings(); };
    $('btn-validate-key').onclick = () => this.validateKey();
    this.dom.theme.onchange = () => { this.settings.isDarkTheme = this.dom.theme.checked; this.applyTheme(); this.save(); };
    this.dom.saveHistory.onchange = () => { this.settings.saveHistory = this.dom.saveHistory.checked; this.save(); };
    this.dom.autoApprove.onchange = () => { this.settings.autoApprove = this.dom.autoApprove.checked; this.save(); };
    this.dom.alwaysOnTop.onchange = () => { this.settings.alwaysOnTop = this.dom.alwaysOnTop.checked; this.save(); };
    document.querySelectorAll('input[name="side-pos"]').forEach(r => {
      r.onchange = () => { this.settings.sidePosition = r.value; this.save(); };
    });
    $('btn-float').onclick = () => this.openFloating();
    this.dom.usageBadge.onclick = () => window.open('https://openrouter.ai/settings/billing', '_blank');

    this.bootstrap();
  }

  // ════════════════════════════════════════════════════════════
  // BOOTSTRAP
  // ════════════════════════════════════════════════════════════
  async bootstrap() {
    try {
      const r = await bg('getSettings');
      if (r?.success) Object.assign(this.settings, r.settings);

      // Theme auto-detect
      if (this.settings.isDarkTheme === null)
        this.settings.isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyTheme();
      this.dom.theme.checked = !!this.settings.isDarkTheme;
      this.dom.saveHistory.checked = this.settings.saveHistory !== false;
      this.dom.autoApprove.checked = !!this.settings.autoApprove;
      this.dom.alwaysOnTop.checked = !!this.settings.alwaysOnTop;
      const pos = this.settings.sidePosition || 'right';
      const pr = document.querySelector(`input[name="side-pos"][value="${pos}"]`);
      if (pr) pr.checked = true;

      await this.loadModels();
      if (this.settings.saveHistory) await this.loadHistory();
      this.setLocked(!this.settings.apiKey);
      this.dom.apiKey.value = this.settings.apiKey || '';

      if (this.settings.apiKey) {
        this.updateStatus();
        this.fetchUsage();
        // Silent re-validate
        bg('validateKey', { key: this.settings.apiKey }).then(v => {
          if (!v.valid) {
            this.setLocked(true);
            this.toast('API key expired — re-enter in Settings', 'error');
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.error('bootstrap:', e);
      this.toast('Init error — check console', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════
  // LOCK / UNLOCK
  // ════════════════════════════════════════════════════════════
  setLocked(locked) {
    if (locked) {
      this.dom.messages.innerHTML = '';
      if (this.dom.welcome) {
        this.dom.welcome.classList.remove('hidden');
        this.dom.welcome.innerHTML = `
          <div class="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="6" fill="#6366f1"/>
              <path d="M7 8h6v2H7zm0 4h10v2H7zm0 4h8v2H7z" fill="#fff" opacity=".9"/>
              <circle cx="17" cy="8" r="2" fill="#34d399"/>
            </svg>
          </div>
          <h3>Welcome to SideRouter</h3>
          <p>Open <strong id="osl">Settings</strong> and connect your<br>OpenRouter API key to start chatting.</p>`;
        this.dom.welcome.querySelector('#osl')?.addEventListener('click', () => this.openSettings());
      }
      this.dom.input.disabled = true;
      this.dom.sendBtn.disabled = true;
      this.dom.attachBtn.disabled = true;
      this.dom.modelSelect.disabled = true;
      this.dom.usageBadge.classList.add('hidden');
    } else {
      if (this.dom.welcome) this.dom.welcome.classList.add('hidden');
      this.dom.input.disabled = false;
      this.dom.attachBtn.disabled = false;
      this.dom.modelSelect.disabled = false;
      this.updateStatus();
    }
  }

  // ════════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════════
  openSettings() {
    this.dom.apiKey.value = this.settings.apiKey || '';
    this.dom.theme.checked = !!this.settings.isDarkTheme;
    this.dom.saveHistory.checked = this.settings.saveHistory !== false;
    this.dom.autoApprove.checked = !!this.settings.autoApprove;
    this.dom.alwaysOnTop.checked = !!this.settings.alwaysOnTop;
    this.dom.keyStatus.textContent = '';
    this.dom.keyStatus.className = 'key-status';
    this.dom.settings.classList.remove('hidden');
    this.dom.apiKey.focus();
  }
  closeSettings() { this.dom.settings.classList.add('hidden'); }

  async validateKey() {
    const key = this.dom.apiKey.value.trim();
    if (!key) {
      this.dom.keyStatus.textContent = 'Enter an API key';
      this.dom.keyStatus.className = 'key-status error';
      return;
    }
    this.dom.keyStatus.textContent = 'Validating…';
    this.dom.keyStatus.className = 'key-status loading';
    try {
      const r = await bg('validateKey', { key });
      if (r.valid) {
        this.settings.apiKey = key;
        this.usage = r.usage || null;
        await this.save();
        this.setLocked(false);
        this.fetchUsage();
        this.closeSettings();
        this.toast('API key connected!', 'success');
      } else {
        this.dom.keyStatus.textContent = r.error || 'Invalid key';
        this.dom.keyStatus.className = 'key-status error';
      }
    } catch (e) {
      this.dom.keyStatus.textContent = e.message;
      this.dom.keyStatus.className = 'key-status error';
    }
  }

  // ════════════════════════════════════════════════════════════
  // THEME
  // ════════════════════════════════════════════════════════════
  applyTheme() { document.body.classList.toggle('dark', !!this.settings.isDarkTheme); }

  // ════════════════════════════════════════════════════════════
  // MODELS (always from API, never hardcoded)
  // ════════════════════════════════════════════════════════════
  async loadModels() {
    try {
      const r = await bg('getModels');
      this.populateSelect(r?.models || []);
    } catch { this.populateSelect([]); }
  }

  populateSelect(models) {
    const sel = this.dom.modelSelect;
    sel.innerHTML = '';
    const free = models.filter(m => m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    const paid = models.filter(m => !m.isFree).sort((a, b) => a.name.localeCompare(b.name));
    const mk = m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.id; return o; };
    if (free.length) {
      const og = document.createElement('optgroup'); og.label = 'Free Models';
      free.forEach(m => og.appendChild(mk(m))); sel.appendChild(og);
    }
    if (paid.length) {
      const og = document.createElement('optgroup'); og.label = 'Paid Models';
      paid.forEach(m => og.appendChild(mk(m))); sel.appendChild(og);
    }
    if (this.settings.selectedModel) {
      const m = Array.from(sel.options).find(o => o.value === this.settings.selectedModel);
      if (m) sel.value = this.settings.selectedModel;
    }
    if (!sel.value && sel.options.length) {
      sel.value = sel.options[0].value;
      this.settings.selectedModel = sel.value;
      this.save();
    }
    this.checkPaidModel();
  }

  checkPaidModel() {
    const opt = this.dom.modelSelect.selectedOptions[0];
    const isPaid = opt?.parentElement?.label === 'Paid Models';
    this.dom.proNotice.classList.toggle('hidden', !isPaid);
  }

  // ════════════════════════════════════════════════════════════
  // SAVE / LOAD
  // ════════════════════════════════════════════════════════════
  async save() { try { await bg('saveSettings', { settings: this.settings }); } catch (_) {} }

  async loadHistory() {
    try {
      const d = await chrome.storage.local.get('chatHistory');
      if (d.chatHistory) {
        this.messages = JSON.parse(d.chatHistory);
        this.dom.messages.innerHTML = '';
        this.messages.forEach(m => this.renderBubble(m.role, m.content, m.time, false));
        this.scroll();
      }
    } catch (_) {}
  }

  async persistHistory() {
    try { await chrome.storage.local.set({ chatHistory: JSON.stringify(this.messages) }); } catch (_) {}
  }

  // ════════════════════════════════════════════════════════════
  // USAGE
  // ════════════════════════════════════════════════════════════
  async fetchUsage() {
    if (!this.settings.apiKey) return;
    try {
      // Try the auth/key endpoint for usage data
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${this.settings.apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        this.usage = data?.data || data || null;
        if (this.usage) {
          // Display usage info
          const used = this.usage?.usage || this.usage?.total_usage || 0;
          const limit = this.usage?.limit || this.usage?.credit_limit || 0;
          if (limit > 0) {
            const pct = Math.round((used / limit) * 100);
            this.dom.usageBadge.textContent = `${pct}% used ($${used.toFixed(2)}/$${limit.toFixed(2)})`;
            this.dom.usageBadge.className = 'usage-badge' + (pct > 80 ? ' danger' : pct > 50 ? ' warning' : '');
          } else {
            this.dom.usageBadge.textContent = `$${Number(used).toFixed(4)} used`;
            this.dom.usageBadge.className = 'usage-badge';
          }
          this.dom.usageBadge.classList.remove('hidden');
          return;
        }
      }
    } catch (_) {}
    // Fallback: just show connected
    this.dom.usageBadge.textContent = '✓ Connected';
    this.dom.usageBadge.className = 'usage-badge';
    this.dom.usageBadge.classList.remove('hidden');
  }

  // ════════════════════════════════════════════════════════════
  // TAB CONTENT ACCESS
  // ════════════════════════════════════════════════════════════
  async getTabContent() {
    try {
      const r = await bg('getActiveTabContent');
      if (r?.success) { this.tabContent = r.content; return this.tabContent; }
    } catch (_) {}
    return null;
  }

  async executeOnTab(code) {
    try {
      const r = await bg('executeOnTab', { code });
      return r?.success ? r.result : null;
    } catch (_) { return null; }
  }

  // ════════════════════════════════════════════════════════════
  // CHAT
  // ════════════════════════════════════════════════════════════
  async send() {
    const text = this.dom.input.value.trim();
    if (!text && !this.attachments.length) return;
    if (!this.settings.apiKey) { this.openSettings(); return; }
    if (!this.settings.selectedModel) { this.toast('Select a model', 'error'); return; }

    // If user mentions the page, inject tab content
    let fullText = text;
    const pageRef = text.match(/\b(this page|the page|current page|webpage|website|tab|this site)\b/i);
    if (pageRef && !this.tabContent) {
      await this.getTabContent();
    }
    if (this.tabContent && pageRef) {
      fullText = `${text}\n\n[Current Page Context]\nTitle: ${this.tabContent.title}\nURL: ${this.tabContent.url}\nContent: ${this.tabContent.text.slice(0, 4000)}`;
      if (this.tabContent.forms?.length) {
        fullText += `\n\nForms: ${JSON.stringify(this.tabContent.forms.slice(0, 3))}`;
      }
    }

    // Build content parts
    const parts = [];
    if (fullText) parts.push({ type: 'text', text: fullText });
    for (const a of this.attachments) {
      if (a.type === 'image') parts.push({ type: 'image_url', image_url: { url: a.data } });
      else parts.push({ type: 'text', text: `\n\n[File: ${a.name}]\n${a.text || a.data.slice(0, 2000)}` });
    }

    this.renderBubble('user', text || `[${this.attachments.length} attachment(s)]`);
    this.dom.input.value = '';
    this.resize();
    this.clearAttachments();

    this.typingEl = this.renderTyping();
    this.scroll();

    try {
      let userContent;
      if (parts.length === 1 && parts[0].type === 'text') userContent = parts[0].text;
      else userContent = parts;

      const body = {
        model: this.settings.selectedModel,
        messages: [...this.getHistory(), { role: 'user', content: userContent }],
      };

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.settings.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let raw = ''; try { raw = await res.text(); } catch (_) {}
      let data = {}; try { data = JSON.parse(raw); } catch (_) {}
      if (this.typingEl) this.typingEl.remove();

      if (!res.ok) {
        const msg = data?.error?.message || data?.message || this.httpMsg(res.status);
        // Paid model / credit errors
        if (msg.match(/credit|payment|subscription|billing|insufficient|exhausted|quota|limit/i)) {
          this.dom.proNotice.classList.remove('hidden');
          throw new Error(msg + ' — Buy credits at openrouter.ai/settings/billing');
        }
        if (res.status === 401) { this.setLocked(true); this.openSettings(); }
        throw new Error(msg);
      }

      this.fetchUsage();
      const reply = data?.choices?.[0]?.message?.content || 'No response.';
      this.renderBubble('assistant', reply);

      // If AI response contains code to execute on tab, offer to run it
      const codeMatch = reply.match(/```(?:javascript|js)\n([\s\S]*?)```/);
      if (codeMatch && this.settings.autoApprove) {
        this.executeOnTab(codeMatch[1]);
      }
    } catch (e) {
      if (this.typingEl) this.typingEl.remove();
      this.renderBubble('assistant', `⚠️ ${e.message}`);
      this.toast(e.message, 'error');
    }
    this.scroll();
    if (this.settings.saveHistory) this.persistHistory();
  }

  httpMsg(s) {
    const m = { 401: 'Invalid API key', 429: 'Rate limited — wait a moment', 403: 'Forbidden', 404: 'Model not found' };
    return m[s] || `HTTP ${s}`;
  }

  getHistory() {
    return this.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
  }

  // ════════════════════════════════════════════════════════════
  // RENDERING — no bubbles, markdown-style like ChatGPT/Gemini
  // ════════════════════════════════════════════════════════════
  renderBubble(role, content, time = null, save = true) {
    const t = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (save) this.messages.push({ role, content, time: t });

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    const isUser = role === 'user';
    const text = typeof content === 'string' ? content : JSON.stringify(content);

    // Extract media URLs from text for download
    const mediaUrls = this.extractMediaUrls(text);

    row.innerHTML = `
      <div class="msg-role ${role}">${isUser ? 'You' : 'Assistant'}</div>
      <div class="msg-content md-content">${this.md(text)}</div>
      ${mediaUrls.length ? `<div class="msg-media">${mediaUrls.map(u => `<a href="${u}" target="_blank" class="media-link">📎 ${u.split('/').pop().split('?')[0]}</a>`).join(' ')}</div>` : ''}
      <div class="msg-footer">
        <span class="msg-time">${t}</span>
        <div class="msg-actions">
          <button class="msg-btn" data-action="copy">Copy</button>
          ${!isUser ? `<button class="msg-btn" data-action="download">Download</button>` : ''}
        </div>
      </div>`;

    row.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      const btn = row.querySelector('[data-action="copy"]');
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
    row.querySelector('[data-action="download"]')?.addEventListener('click', () => {
      // Download as text file
      const ext = text.startsWith('```') ? 'md' : 'txt';
      const blob = new Blob([text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `response-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
      this.toast('Downloaded!', 'success');
    });

    this.dom.messages.appendChild(row);
    return row;
  }

  extractMediaUrls(text) {
    const urls = [];
    // Match image URLs
    const imgRe = /https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg|bmp|ico)\b[^\s]*/gi;
    let m;
    while ((m = imgRe.exec(text)) !== null) urls.push(m[0]);
    // Match audio URLs
    const audioRe = /https?:\/\/[^\s]+\.(?:mp3|wav|ogg|flac|aac|m4a)\b[^\s]*/gi;
    while ((m = audioRe.exec(text)) !== null) urls.push(m[0]);
    // Match video URLs
    const vidRe = /https?:\/\/[^\s]+\.(?:mp4|webm|mov|avi|mkv)\b[^\s]*/gi;
    while ((m = vidRe.exec(text)) !== null) urls.push(m[0]);
    // Match file URLs
    const fileRe = /https?:\/\/[^\s]+\.(?:pdf|doc|docx|xls|xlsx|zip|rar|tar|gz|csv|json|xml)\b[^\s]*/gi;
    while ((m = fileRe.exec(text)) !== null) urls.push(m[0]);
    return [...new Set(urls)].slice(0, 10); // deduplicate, max 10
  }

  renderTyping() {
    const row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.innerHTML = `<div class="msg-role assistant">Assistant</div><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
    this.dom.messages.appendChild(row);
    this.scroll();
    return row;
  }

  // ── Markdown parser ──
  md(text) {
    if (!text) return '';
    let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Code blocks with copy button
    h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const lb = lang ? `<span class="code-lang">${lang}</span>` : '';
      return `<div class="code-block"><button class="code-copy" onclick="const t=this;t.textContent='✓';setTimeout(()=>t.textContent='Copy',1500);navigator.clipboard.writeText(this.nextElementSibling.textContent)">Copy</button><pre>${lb}<code>${code.replace(/</g,'&lt;')}</code></pre></div>`;
    });
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    h = h.replace(/^#{1,6}\s+(.+)$/gm, (_, t) => `<strong style="font-size:1.05em">${t}</strong><br>`);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
    h = h.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
    h = h.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    h = h.replace(/^---+$/gm, '<hr>');
    h = h.replace(/\n/g, '<br>');
    h = h.replace(/(<br>){3,}/g, '<br><br>');
    return h;
  }

  // ════════════════════════════════════════════════════════════
  // ATTACHMENTS
  // ════════════════════════════════════════════════════════════
  handleFiles(fileList) {
    for (const f of fileList) {
      if (f.size > 10 * 1024 * 1024) { this.toast(`${f.name} too large (max 10MB)`, 'error'); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        const isImage = f.type.startsWith('image/');
        const isAudio = f.type.startsWith('audio/');
        const isVideo = f.type.startsWith('video/');
        this.attachments.push({
          name: f.name,
          type: isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'file',
          data: reader.result,
          mime: f.type,
        });
        this.renderAttachments();
      };
      reader.readAsDataURL(f);
    }
  }

  renderAttachments() {
    this.dom.attachments.innerHTML = '';
    this.attachments.forEach((a, i) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      if (a.type === 'image') { const img = document.createElement('img'); img.src = a.data; chip.appendChild(img); }
      else { const icon = document.createElement('span'); icon.textContent = a.type === 'audio' ? '🎵' : a.type === 'video' ? '🎬' : '📎'; chip.appendChild(icon); }
      const nm = document.createElement('span'); nm.textContent = a.name; nm.title = a.name; chip.appendChild(nm);
      const rm = document.createElement('span'); rm.className = 'att-remove'; rm.textContent = '×';
      rm.onclick = () => { this.attachments.splice(i, 1); this.renderAttachments(); };
      chip.appendChild(rm);
      this.dom.attachments.appendChild(chip);
    });
  }

  clearAttachments() { this.attachments = []; this.dom.attachments.innerHTML = ''; }

  // ════════════════════════════════════════════════════════════
  // FLOATING WINDOW
  // ════════════════════════════════════════════════════════════
  async openFloating() {
    try {
      await bg('openFloatingWindow');
      if (this.settings.alwaysOnTop) {
        this.toast('Window opened — use OS "Always on Top" shortcut', 'info');
      }
    } catch (e) { this.toast('Could not open: ' + e.message, 'error'); }
  }

  // ════════════════════════════════════════════════════════════
  // UI HELPERS
  // ════════════════════════════════════════════════════════════
  updateStatus() {
    const has = !!this.settings.apiKey;
    this.dom.sendBtn.disabled = !has;
  }

  scroll() { requestAnimationFrame(() => { this.dom.messages.scrollTop = this.dom.messages.scrollHeight; }); }

  resize() { this.dom.input.style.height = 'auto'; this.dom.input.style.height = Math.min(this.dom.input.scrollHeight, 120) + 'px'; }

  clearChat() {
    if (!confirm('Clear all messages?')) return;
    this.messages = [];
    this.dom.messages.innerHTML = '';
    chrome.storage.local.remove('chatHistory');
  }

  toast(msg, type = 'info') {
    while (this.dom.toast.children.length > 4) this.dom.toast.firstChild.remove();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    this.dom.toast.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 4000);
  }
}

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { window.app = new SideRouter(); });
