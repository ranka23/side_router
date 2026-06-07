// tests/helpers/mock-env.js
// Shared mock environment for all test suites.
// Provides mocked DOM, Chrome APIs, and loads SideRouter class.

const fs = require('fs');
const path = require('path');

/**
 * Create a mock DOM element with all properties SideRouter expects.
 */
function makeEl(id) {
  const listeners = {};
  const el = {
    id,
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    _innerHTML: '',
    className: '',
    style: {},
    dataset: {},
    tagName: 'div',
    type: '',
    selectedOptions: [],
    options: [],
    parentElement: { label: '' },
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 500,
    childNodes: [],
    appendChild: function (child) {
      this._children = this._children || [];
      this._children.push(child);
      return child;
    },
    remove: function () {},
    removeChild: function (child) {
      if (this._children) {
        const idx = this._children.indexOf(child);
        if (idx >= 0) this._children.splice(idx, 1);
      }
    },
    setAttribute: function (name, value) { this[name] = value; },
    getAttribute: function (name) { return this[name]; },
    removeAttribute: function (name) { delete this[name]; },
    addEventListener: function (evt, fn) {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener: function (evt, fn) {
      if (listeners[evt]) {
        const idx = listeners[evt].indexOf(fn);
        if (idx >= 0) listeners[evt].splice(idx, 1);
      }
    },
    contains: () => false,
    focus: function () {},
    click: function () {},
    querySelector: function (sel) {
      if (!el._children) return null;
      const clsMatch = sel.match(/^\.([\w-]+)$/);
      const attrMatch = sel.match(/^\[data-([\w-]+)="([\w-]+)"\]$/);
      return el._children.find(c => {
        if (clsMatch) return c.classList?.contains(clsMatch[1]);
        if (attrMatch) return c.dataset?.[attrMatch[1]] === attrMatch[2];
        return false;
      }) || null;
    },
    querySelectorAll: () => [],
    closest: () => null,
    classList: {
      _classes: new Set(),
      add(c) {
        this._classes.add(c);
      },
      remove(c) {
        this._classes.delete(c);
      },
      toggle(c, force) {
        if (force === true) this._classes.add(c);
        else if (force === false) this._classes.delete(c);
        else this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c);
        this._lastToggled = { c, force };
      },
      contains(c) {
        return this._classes.has(c);
      },
    },
    get innerHTML() {
      return el._innerHTML;
    },
    set innerHTML(v) {
      el._innerHTML = v;
    },
    _listeners: listeners,
    _children: [],
    get children() {
      return el._children;
    },
    get firstChild() {
      return el._children?.[0] || null;
    },
    get lastChild() {
      return el._children?.[el._children.length - 1] || null;
    },
  };
  Object.defineProperty(el, 'disabled', {
    get() {
      return el._disabled || false;
    },
    set(v) {
      el._disabled = v;
    },
  });
  return el;
}

/**
 * Build the full mock environment and return { document, window, navigator, chrome, SideRouter }.
 */
function buildMockEnv() {
  const elements = {};

  const _docListeners = {};
  const document = {
    getElementById: (id) => {
      if (!elements[id]) elements[id] = makeEl(id);
      return elements[id];
    },
    createElement: (tag) => {
      const el = makeEl(tag);
      el.tagName = tag;
      return el;
    },
    body: {
      ...makeEl('body'),
      appendChild: function (child) {
        this._children = this._children || [];
        this._children.push(child);
        return child;
      },
      querySelector: function(sel) { return this._children?.find(c => c.classList?.contains(sel.replace(/^\./, ''))) || null; },
      querySelectorAll: function (sel) {
        if (!this._children) return [];
        const clsMatch = sel.match(/^\.([\w-]+)$/);
        const results = this._children.filter(c => {
          if (clsMatch) return c.classList?.contains(clsMatch[1]);
          return false;
        });
        results.forEach = results.forEach.bind(results);
        return results;
      },
    },
    readyState: 'complete',
    activeElement: null,
    addEventListener: function (evt, fn) {
      _docListeners[evt] = _docListeners[evt] || [];
      _docListeners[evt].push(fn);
    },
    removeEventListener: function (evt, fn) {
      if (_docListeners[evt]) {
        const idx = _docListeners[evt].indexOf(fn);
        if (idx >= 0) _docListeners[evt].splice(idx, 1);
      }
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  const win = {
    matchMedia: () => ({ matches: false }),
    open: () => {},
    URL: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => {},
    },
    Blob: class Blob {
      constructor(d, t) {
        this.data = d;
        this.type = t;
      }
    },
    addEventListener: () => {},
    location: { href: '' },
    confirm: () => true,
    requestAnimationFrame: (fn) => fn(),
  };

  const navigator = { clipboard: { writeText: () => Promise.resolve() } };

  const chrome = {
    runtime: {
      lastError: null,
      sendMessage: (msg, cb) => {
        if (cb) {
          if (msg.action === 'getSettings') cb({ success: true, settings: { saveHistory: true, rememberedPermissions: [] } });
          else if (msg.action === 'getModels') cb({ success: true, models: [] });
          else if (msg.action === 'validateKey') cb({ valid: false });
          else cb({ success: false, error: 'Unknown action' });
        }
      },
      onMessage: { addListener: () => {} },
      getURL: (p) => `chrome-extension://test/${p}`,
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      },
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, windowId: 1 }]),
      executeScript: () => Promise.resolve([{ result: null }]),
    },
    scripting: {
      executeScript: () => Promise.resolve([{ result: { ok: true, result: null } }]),
    },
    sidePanel: {
      open: () => Promise.resolve(),
      setOptions: () => Promise.resolve(),
      setPanelBehavior: () => Promise.resolve(),
    },
    windows: {
      create: () => Promise.resolve({ id: 1 }),
    },
    action: { onClicked: { addListener: () => {} } },
  };

  global.location = { search: '', href: '' };
  global.document = document;
  global.window = win;
  global.navigator = navigator;
  global.chrome = chrome;
  global.console = { log: () => {}, error: () => {}, warn: () => {}, info: () => {} };
  global.confirm = () => true;
  global.requestAnimationFrame = (fn) => fn();
  global.AbortSignal = global.AbortSignal || { timeout: (ms) => ({}) };
  global.FileReader =
    global.FileReader ||
    class FileReader {
      readAsDataURL() {
        this.onload &&
          this.onload({ target: { result: 'data:test;base64,abc' } });
      }
      readAsText() {
        this.onload &&
          this.onload({ target: { result: 'sample text' } });
      }
    };
  global.fetch = global.fetch || (() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
  global.URL = win.URL;

  // Delete any stale globals first
  var toDelete = ['bg', 'bgWithRetry', 'md', '$', 'cacheDom', 'DomModule', 'SettingsModule', 'UIModule', 'ChatModule', 'HistoryModule', 'ContextModule', 'SideRouter', 'sanitizeHtml'];
  for (var di = 0; di < toDelete.length; di++) {
    delete global[toDelete[di]];
  }

  // Concatenate all source files into one string and eval in global scope
  var files = [
    'src/lib/api.js',
    'src/lib/storage.js',
    'src/lib/markdown.js',
    'src/lib/dom.js',
    'src/lib/settings.js',
    'src/lib/ui.js',
    'src/lib/chat.js',
    'src/lib/history.js',
    'src/lib/context.js',
    'src/script.js',
  ];

  var combined = '';
  for (var fi = 0; fi < files.length; fi++) {
    var fullPath = path.join(__dirname, '..', '..', files[fi]);
    var src = fs.readFileSync(fullPath, 'utf8');
    // Remove module.exports
    src = src.replace(/module\.exports[^]*$/m, '');
    // Remove DOMContentLoaded listener
    src = src.replace(/document\.addEventListener\(['"]DOMContentLoaded['"][\s\S]*$/m, '');
    combined += src + '\n';
  }
  combined += '\nreturn SideRouter;';

  var SideRouter = new Function(combined)();
  global.SideRouter = SideRouter;

  return { document, window: win, navigator, chrome, SideRouter, elements };
}

module.exports = { makeEl, buildMockEnv };