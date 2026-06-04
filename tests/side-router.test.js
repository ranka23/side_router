// tests/side-router.test.js — Unit Tests for SideRouter
// Run: node tests/side-router.test.js

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const assert = (cond, msg) => {
  if (cond) { passed++; process.stdout.write('  ✓ ' + msg + '\n'); }
  else { failed++; process.stdout.write('  ✗ ' + msg + '\n'); }
};

// ── Mock Chrome APIs globally ────────────────────────────────
const makeEl = (id) => {
  const el = {
    id, value: '', checked: false, disabled: false, textContent: '', _innerHTML: '',
    className: '', style: {}, dataset: {}, tagName: 'div', type: '',
    appendChild: function() { return {}; }, remove: function() {},
    addEventListener: function() {}, removeEventListener: function() {},
    contains: () => false, focus: function() {},
    classList: { add: function(){}, remove: function(){}, toggle: function(c,s){ this._toggled={c,s}; }, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [],
    selectedOptions: [], options: [], parentElement: { label: '' },
  };
  Object.defineProperty(el, 'disabled', {
    get() { return el._disabled; },
    set(v) { el._disabled = v; },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._innerHTML; },
    set(v) { el._innerHTML = v; },
  });
  return el;
};
const elements = {};
global.document = {
  getElementById: (id) => { if (!elements[id]) elements[id] = makeEl(id); return elements[id]; },
  createElement: (tag) => { const el = makeEl(tag); el.tagName = tag; return el; },
  body: makeEl('body'),
  readyState: 'complete', addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [],
};
global.window = {
  matchMedia: () => ({ matches: false }), open: () => {},
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
  Blob: class Blob { constructor(d,t){this.data=d;this.type=t} },
  addEventListener: () => {}, location: { href: '' },
};
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.console = { log: () => {}, error: () => {}, warn: () => {}, info: () => {} };
global.AbortSignal = global.AbortSignal || { timeout: function timeout(ms) { return {}; } };
global.FileReader = global.FileReader || class FileReader { readAsDataURL() { this.onload && this.onload({ target: { result: 'data:test;base64,abc' } }); } };

// ── Load SideRouter via Function constructor ────────────────
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'script.js'), 'utf8');
const cleanSrc = src.replace(/document\.addEventListener\('DOMContentLoaded'[\s\S]*$/, '');
const SideRouter = new Function(cleanSrc + '\nreturn SideRouter;')();
assert(typeof SideRouter === 'function', 'SideRouter loaded via Function constructor');

process.stdout.write('\n═══ SideRouter Test Suite ═══\n\n');

// ── Unit: Initialization ─────────────────────────────────────
process.stdout.write('Unit: Initialization\n');
assert(typeof SideRouter === 'function', 'SideRouter is a class');

const app = new SideRouter();
assert(app.settings !== null, 'Settings initialized');
assert(app.settings.isDarkTheme === null, 'isDarkTheme defaults to null (auto)');
assert(app.settings.saveHistory === true, 'saveHistory defaults true');
assert(app.settings.autoApprove === false, 'autoApprove defaults false');
assert(Array.isArray(app.messages), 'messages is array');
assert(Array.isArray(app.attachments), 'attachments is array');

// ── Unit: Markdown Parser ────────────────────────────────────
process.stdout.write('\nUnit: Markdown Parser\n');
assert(app.md('') === '', 'Empty string');
assert(app.md('Hello world') === 'Hello world', 'Plain text');
assert(app.md('**bold**').includes('<strong>bold</strong>'), 'Bold');
assert(app.md('`code`').includes('inline-code'), 'Inline code');
assert(app.md('[link](https://x.com)').includes('<a href="https://x.com"'), 'Links');
assert(app.md('# H1').includes('<h1>'), 'Headers');
assert(app.md('- item').includes('<li>'), 'Lists');
assert(app.md('```js\nconst x=1;\n```').includes('code-block'), 'Code blocks');
assert(app.md('<script>').includes('&lt;script&gt;'), 'XSS prevention');

// ── Unit: Media URL Extraction ───────────────────────────────
process.stdout.write('\nUnit: Media URL Extraction\n');
const urls = app.extractMediaUrls('See https://example.com/photo.jpg and https://x.com/audio.mp3');
assert(urls.length === 2, 'Extracts image + audio URLs');
assert(urls[0].includes('photo.jpg'), 'Image URL found');
assert(app.extractMediaUrls('plain text').length === 0, 'No URLs in plain text');
assert(app.extractMediaUrls('https://x.com/a.png https://x.com/a.png').length === 1, 'Dedup');

// ── Unit: Lock State ─────────────────────────────────────────
process.stdout.write('\nUnit: Lock State\n');
app.setLocked(true);
assert(app.dom.input.disabled === true, 'Locked: input disabled');
assert(app.dom.sendBtn.disabled === true, 'Locked: send disabled');
app.setLocked(false);
assert(app.dom.input.disabled === false, 'Unlocked: input enabled');

// ── Unit: Model Population ───────────────────────────────────
process.stdout.write('\nUnit: Model Population\n');
app.dom.modelSelect = makeEl('model-select-inline');
app.dom.proNotice = makeEl('pro-notice');
// Should not throw — populates from API models
try {
  app.populateSelect([
    { id: 'a/free', name: 'Alpha', isFree: true, contextLength: 8192, pricing: {} },
    { id: 'b/paid', name: 'Beta', isFree: false, contextLength: 128000, pricing: { prompt: '0.01' } },
  ]);
  assert(true, 'populateSelect runs without error');
} catch(e) { assert(false, 'populateSelect should not throw: ' + e.message); }
// Pro notice toggles with model type
app.dom.modelSelect.value = 'b/paid';
app.checkPaidModel();
assert(true, 'checkPaidModel runs without error');

// ── Unit: HTTP Error Messages ────────────────────────────────
process.stdout.write('\nUnit: HTTP Error Messages\n');
assert(app.httpMsg(401) === 'Invalid API key', '401 message');
assert(app.httpMsg(429) === 'Rate limited — wait a moment', '429 message');
assert(app.httpMsg(404) === 'Model not found', '404 message');
assert(app.httpMsg(503).includes('HTTP 503'), 'Generic HTTP message');

// ── Integration: Theme ───────────────────────────────────────
process.stdout.write('\nIntegration: Theme\n');
const app2 = new SideRouter();
app2.settings.isDarkTheme = false;
app2.dom.theme = { checked: true };
app2.applyTheme();
// The mock body.classList.toggle was called with ('dark', true)
assert(document.body.classList._toggled && document.body.classList._toggled.c === 'dark', 'Theme toggles dark class');

// ── Summary ──────────────────────────────────────────────────
process.stdout.write('\n═══ Results ═══\n');
process.stdout.write('Passed: ' + passed + '\n');
process.stdout.write('Failed: ' + failed + '\n');
process.stdout.write(passed > 0 && failed === 0 ? '✓ All tests passed!\n' : '⚠ ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
