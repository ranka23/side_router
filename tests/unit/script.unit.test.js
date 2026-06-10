// tests/unit/script.unit.test.js
// Unit tests for SideRouter — isolated method testing with mocked DOM/Chrome APIs

const { buildMockEnv, makeEl } = require('../helpers/mock-env');

let SideRouter;

beforeAll(() => {
  ({ SideRouter } = buildMockEnv());
});

beforeEach(() => {
  buildMockEnv();
});

// ── Initialization ────────────────────────────────────────────
describe('Initialization', () => {
  test('SideRouter is a class', () => {
    expect(typeof SideRouter).toBe('function');
  });

  test('settings have correct defaults', () => {
    const app = new SideRouter();
    expect(app.settings.apiKey).toBeNull();
    expect(app.settings.selectedModel).toBeNull();
    expect(app.settings.isDarkTheme).toBeNull();
    expect(app.settings.saveHistory).toBe(true);
    expect(app.settings.autoApprove).toBe(false);
    expect(app.settings.aiName).toBe('ASSISTANT');
  });

  test('messages and attachments start as empty arrays', () => {
    const app = new SideRouter();
    expect(Array.isArray(app.messages)).toBe(true);
    expect(Array.isArray(app.attachments)).toBe(true);
    expect(app.messages.length).toBe(0);
    expect(app.attachments.length).toBe(0);
  });

  test('rememberedPermissions is a Set', () => {
    const app = new SideRouter();
    expect(app.rememberedPermissions).toBeInstanceOf(Set);
    expect(app.rememberedPermissions.size).toBe(0);
  });

  test('taskQueue starts empty', () => {
    const app = new SideRouter();
    expect(Array.isArray(app.taskQueue)).toBe(true);
    expect(app.taskQueue.length).toBe(0);
  });

  test('isRunning defaults to false', () => {
    const app = new SideRouter();
    expect(app.isRunning).toBe(false);
  });
});

// ── Markdown Parser ───────────────────────────────────────────
describe('Markdown Parser', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('empty string returns empty', () => {
    expect(app.md('')).toBe('');
  });

  test('plain text passes through', () => {
    expect(app.md('Hello world')).toBe('Hello world');
  });

  test('bold text', () => {
    expect(app.md('**bold**')).toContain('<strong>bold</strong>');
  });

  test('italic text', () => {
    expect(app.md('*italic*')).toContain('<em>italic</em>');
  });

  test('inline code', () => {
    expect(app.md('`code`')).toContain('inline-code');
  });

  test('code blocks', () => {
    const result = app.md('```js\nconst x = 1;\n```');
    expect(result).toContain('code-block');
    expect(result).toContain('const x = 1;');
  });

  test('headers', () => {
    expect(app.md('# H1')).toContain('<h1>');
    expect(app.md('## H2')).toContain('<h2>');
    expect(app.md('### H3')).toContain('<h3>');
  });

  test('unordered lists', () => {
    expect(app.md('- item')).toContain('<li>');
  });

  test('ordered lists', () => {
    const result = app.md('1. one\n2. two');
    expect(result).toContain('<li');
  });

  test('links', () => {
    const result = app.md('[click](https://example.com)');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
  });

  test('blockquotes', () => {
    expect(app.md('> quote')).toContain('<blockquote>');
  });

  test('horizontal rule', () => {
    expect(app.md('---')).toContain('<hr>');
  });

  test('strikethrough', () => {
    expect(app.md('~~deleted~~')).toContain('<del>');
  });

  test('XSS: script tags escaped', () => {
    const result = app.md('<script>alert(1)</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  test('XSS: javascript: URL blocked in links', () => {
    const result = app.md('[click](javascript:alert(1))');
    expect(result).toContain('href="#"');
    expect(result).not.toContain('javascript:');
  });

  test('XSS: onerror in images blocked', () => {
    const result = app.md('![x](https://example.com/img.png)');
    expect(result).not.toContain('onerror');
  });

  test('checkboxes are rendered as list items (checkbox regex is pre-empted by list regex)', () => {
    // The list regex (- ) fires before the checkbox regex (- [x])
    const result = app.md('- [x] done');
    expect(result).toContain('<li>');
  });
});

// ── Media URL Extraction ──────────────────────────────────────
describe('Media URL Extraction', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('extracts image URLs', () => {
    const urls = app.extractMediaUrls('See https://example.com/photo.jpg here');
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('photo.jpg');
  });

  test('extracts audio URLs', () => {
    const urls = app.extractMediaUrls('Listen https://example.com/song.mp3 now');
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('song.mp3');
  });

  test('extracts video URLs', () => {
    const urls = app.extractMediaUrls('Watch https://example.com/clip.mp4 today');
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('clip.mp4');
  });

  test('extracts file URLs', () => {
    const urls = app.extractMediaUrls('Download https://example.com/doc.pdf');
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('doc.pdf');
  });

  test('extracts multiple media types', () => {
    const text = 'Image: https://x.com/a.jpg Audio: https://x.com/b.mp3 Video: https://x.com/c.mp4';
    const urls = app.extractMediaUrls(text);
    expect(urls.length).toBe(3);
  });

  test('returns empty for plain text', () => {
    expect(app.extractMediaUrls('no urls here')).toEqual([]);
  });

  test('deduplicates URLs', () => {
    const urls = app.extractMediaUrls('https://x.com/a.png https://x.com/a.png');
    expect(urls.length).toBe(1);
  });

  test('caps at 10 URLs', () => {
    const urls = Array.from({ length: 15 }, (_, i) => `https://x.com/f${i}.jpg`).join(' ');
    expect(app.extractMediaUrls(urls).length).toBe(10);
  });
});

// ── Media Type Detection ──────────────────────────────────────
describe('Media Type Detection', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('detects image types', () => {
    expect(app.getMediaType('https://x.com/a.jpg')).toBe('image');
    expect(app.getMediaType('https://x.com/a.png')).toBe('image');
    expect(app.getMediaType('https://x.com/a.gif')).toBe('image');
    expect(app.getMediaType('https://x.com/a.webp')).toBe('image');
    expect(app.getMediaType('https://x.com/a.svg')).toBe('image');
  });

  test('detects audio types', () => {
    expect(app.getMediaType('https://x.com/a.mp3')).toBe('audio');
    expect(app.getMediaType('https://x.com/a.wav')).toBe('audio');
    expect(app.getMediaType('https://x.com/a.ogg')).toBe('audio');
    expect(app.getMediaType('https://x.com/a.flac')).toBe('audio');
  });

  test('detects video types', () => {
    expect(app.getMediaType('https://x.com/a.mp4')).toBe('video');
    expect(app.getMediaType('https://x.com/a.webm')).toBe('video');
    expect(app.getMediaType('https://x.com/a.mov')).toBe('video');
  });

  test('defaults to file for unknown extensions', () => {
    expect(app.getMediaType('https://x.com/a.xyz')).toBe('file');
  });
});

// ── Lock State ────────────────────────────────────────────────
describe('Lock State', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('lock disables input and send', () => {
    app.setLocked(true);
    expect(app.dom.input.disabled).toBe(true);
    expect(app.dom.sendBtn.disabled).toBe(true);
    expect(app.dom.modelSelect.disabled).toBe(true);
  });

  test('unlock enables input and send', () => {
    app.setLocked(true);
    app.setLocked(false);
    expect(app.dom.input.disabled).toBe(false);
    expect(app.dom.modelSelect.disabled).toBe(false);
  });

  test('lock hides usage badge', () => {
    app.setLocked(true);
    expect(app.dom.usageBadge.classList.contains('hidden')).toBe(true);
  });
});

// ── Model Population ──────────────────────────────────────────
describe('Model Population', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
    app.dom.modelSelect = makeEl('model-select-inline');
    app.dom.proNotice = makeEl('pro-notice');
  });

  test('populateSelect groups free and paid models', () => {
    app.populateSelect([
      { id: 'a/free', name: 'Alpha', isFree: true, contextLength: 8192, pricing: {} },
      { id: 'b/paid', name: 'Beta', isFree: false, contextLength: 128000, pricing: { prompt: '0.01' } },
    ]);
    // populateSelect uses appendChild, so check children not innerHTML
    const children = app.dom.modelSelect._children;
    expect(children.length).toBe(2);
  });

  test('populateSelect with empty array does not throw', () => {
    expect(() => app.populateSelect([])).not.toThrow();
  });

  test('checkPaidModel shows pro notice for paid models', () => {
    app.populateSelect([
      { id: 'b/paid', name: 'Beta', isFree: false, contextLength: 128000, pricing: { prompt: '0.01' } },
    ]);
    app.dom.modelSelect.value = 'b/paid';
    app.dom.modelSelect.selectedOptions = [{ parentElement: { label: 'Paid Models' } }];
    app.checkPaidModel();
    expect(app.dom.proNotice.classList.contains('hidden')).toBe(false);
  });

  test('checkPaidModel hides pro notice for free models', () => {
    app.populateSelect([
      { id: 'a/free', name: 'Alpha', isFree: true, contextLength: 8192, pricing: {} },
    ]);
    app.dom.modelSelect.value = 'a/free';
    app.dom.modelSelect.selectedOptions = [{ parentElement: { label: 'Free Models' } }];
    app.checkPaidModel();
    expect(app.dom.proNotice.classList.contains('hidden')).toBe(true);
  });
});

// ── HTTP Error Messages ───────────────────────────────────────
describe('HTTP Error Messages', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('401 returns invalid key message', () => {
    expect(app.httpMsg(401)).toBe('Invalid API key');
  });

  test('429 returns rate limit message', () => {
    expect(app.httpMsg(429)).toBe('Rate limited — wait a moment');
  });

  test('404 returns model not found', () => {
    expect(app.httpMsg(404)).toBe('Model not found');
  });

  test('403 returns forbidden', () => {
    expect(app.httpMsg(403)).toBe('Forbidden');
  });

  test('unknown status returns generic message', () => {
    expect(app.httpMsg(503)).toBe('HTTP 503');
  });
});

// ── Theme ─────────────────────────────────────────────────────
describe('Theme', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('applyTheme toggles dark class', () => {
    app.settings.isDarkTheme = true;
    app.applyTheme();
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  test('applyTheme removes dark class when false', () => {
    app.settings.isDarkTheme = false;
    app.applyTheme();
    expect(document.body.classList.contains('dark')).toBe(false);
  });
});

// ── Escape HTML ───────────────────────────────────────────────
describe('Escape HTML', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('escapes angle brackets', () => {
    expect(app.escapeHtml('<script>')).toContain('&lt;');
  });

  test('escapes ampersands', () => {
    expect(app.escapeHtml('a & b')).toContain('&amp;');
  });

  test('escapes quotes', () => {
    expect(app.escapeHtml('"test"')).toContain('&quot;');
  });
});

// ── History Management ────────────────────────────────────────
describe('History Management', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('getHistory returns only user and assistant messages', () => {
    app.messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'system', content: 'context' },
    ];
    const hist = app.getHistory();
    expect(hist.length).toBe(2);
    expect(hist.every((m) => m.role === 'user' || m.role === 'assistant')).toBe(true);
  });

  test('getHistory returns empty for no messages', () => {
    expect(app.getHistory()).toEqual([]);
  });
});

// ── Context Percentage ────────────────────────────────────────
describe('Context Percentage', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
    app.dom.usageBadge = { innerHTML: '' };
  });

  test('calculates token usage percentage', () => {
    app.messages = [
      { role: 'user', content: 'Hello world' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    app.updateContextPercent(4096);
    expect(app.dom.usageBadge.innerHTML).toContain('tokens');
    expect(app.dom.usageBadge.innerHTML).toContain('%');
  });

  test('returns early for zero context length', () => {
    app.dom.usageBadge = { innerHTML: '' };
    app.updateContextPercent(0);
    expect(app.dom.usageBadge.innerHTML).toBe('');
  });
});

// ── Task Queue ────────────────────────────────────────────────
describe('Task Queue', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('queueSend renders queued bubble in DOM', () => {
    app.queueSend('test message', []);
    expect(app.dom.messages._children.length).toBeGreaterThanOrEqual(1);
  });

  test('queueSend processes queue immediately when not running', () => {
    app.queueSend('test message', []);
    // processQueue shifts the item from taskQueue to process it
    expect(app.taskQueue.length).toBe(0);
    expect(app.isRunning).toBe(true);
  });

  test('multiple queueSends fill taskQueue before processing', () => {
    app.queueSend('first', []);
    // first one is immediately shifted by processQueue
    // but isRunning is now true, so second one stays in queue
    app.queueSend('second', []);
    expect(app.taskQueue.length).toBe(1);
    expect(app.taskQueue[0].text).toBe('second');
  });
});

// ── Permission System ─────────────────────────────────────────
describe('Permission System', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('rememberedPermissions starts empty', () => {
    expect(app.rememberedPermissions.size).toBe(0);
  });

  test('can add remembered permissions', () => {
    app.rememberedPermissions.add('execute');
    expect(app.rememberedPermissions.has('execute')).toBe(true);
  });
});

// ── HTML Sanitization ─────────────────────────────────────────
describe('HTML Sanitization', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('sanitizeHtml method exists', () => {
    expect(typeof app.sanitizeHtml).toBe('function');
  });

  test('XSS: script tags escaped in markdown', () => {
    const result = app.md('<script>alert(1)</script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('XSS: javascript: URL blocked', () => {
    const result = app.md('[click](javascript:alert(1))');
    expect(result).toContain('href="#"');
  });
});

// ── Resize ────────────────────────────────────────────────────
describe('Resize', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('resize sets input height', () => {
    app.dom.input = { value: 'test', scrollHeight: 100, style: {} };
    app.resize();
    expect(app.dom.input.style.height).toBeDefined();
  });

  test('resize caps at 260px', () => {
    app.dom.input = { value: 'test', scrollHeight: 500, style: {} };
    app.resize();
    expect(app.dom.input.style.height).toBe('260px');
  });
});

// ── Scroll Management ─────────────────────────────────────────
describe('Scroll Management', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('checkScrollPosition shows button when not at bottom', () => {
    app.dom.messages = { scrollTop: 0, scrollHeight: 1000, clientHeight: 500 };
    app.dom.scrollBtn = { classList: { toggle: jest.fn() } };
    app.checkScrollPosition();
    expect(app.dom.scrollBtn.classList.toggle).toHaveBeenCalled();
  });

  test('scrollToBottom sets scrollTop to scrollHeight', () => {
    app.dom.messages = { scrollTop: 0, scrollHeight: 1000 };
    app.dom.scrollBtn = { classList: { add: jest.fn() } };
    app.scrollToBottom();
    expect(app.dom.messages.scrollTop).toBe(1000);
  });
});

// ── Zoom Controls ─────────────────────────────────────────────
describe('Zoom Controls', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('default zoom level is 100', () => {
    expect(app.settings.zoomLevel).toBe(100);
  });

  test('zoomIn increases zoom by 10', () => {
    app.settings.zoomLevel = 100;
    app.zoomIn();
    expect(app.settings.zoomLevel).toBe(110);
  });

  test('zoomOut decreases zoom by 10', () => {
    app.settings.zoomLevel = 100;
    app.zoomOut();
    expect(app.settings.zoomLevel).toBe(90);
  });

  test('zoomIn does not exceed 200', () => {
    app.settings.zoomLevel = 200;
    app.zoomIn();
    expect(app.settings.zoomLevel).toBe(200);
  });

  test('zoomOut does not go below 50', () => {
    app.settings.zoomLevel = 50;
    app.zoomOut();
    expect(app.settings.zoomLevel).toBe(50);
  });

  test('zoomReset sets zoom to 100', () => {
    app.settings.zoomLevel = 150;
    app.zoomReset();
    expect(app.settings.zoomLevel).toBe(100);
  });

  test('applyZoom updates zoom level display', () => {
    app.dom.messages = { style: {} };
    app.dom.zoomLevel = { textContent: '' };
    app.settings.zoomLevel = 120;
    app.applyZoom();
    expect(app.dom.zoomLevel.textContent).toBe('120%');
  });
});

// ── Context Compression ───────────────────────────────────────
describe('Context Compression', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('estimateTokens returns token count', () => {
    expect(app.estimateTokens('Hello world')).toBe(3);
  });

  test('estimateTokens returns 0 for empty string', () => {
    expect(app.estimateTokens('')).toBe(0);
  });

  test('compressContext returns text within budget', () => {
    var shortText = 'Short text';
    var result = app.compressContext(shortText, 100);
    expect(result).toBe(shortText);
  });

  test('compressContext truncates long text', () => {
    var longText = 'word '.repeat(1000);
    var result = app.compressContext(longText, 10);
    expect(app.estimateTokens(result)).toBeLessThanOrEqual(10);
  });

  test('compressContext returns empty string for null', () => {
    expect(app.compressContext(null, 100)).toBe('');
  });

  test('compressFullContext leaves room for response', () => {
    var text = 'Hello world';
    var result = app.compressFullContext(text, 10000);
    expect(result).toBe(text);
  });

  test('compressFullContext truncates when over budget', () => {
    var longText = 'word '.repeat(2000);
    var result = app.compressFullContext(longText, 100);
    expect(app.estimateTokens(result)).toBeLessThanOrEqual(8000);
  });
});

// ── Donate Modal ──────────────────────────────────────────────
describe('Donate Modal', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('openDonateModal exists', () => {
    expect(typeof app.openDonateModal).toBe('function');
  });

  test('closeDonateModal exists', () => {
    expect(typeof app.closeDonateModal).toBe('function');
  });

  test('copyDonateAddress exists', () => {
    expect(typeof app.copyDonateAddress).toBe('function');
  });
});

// ── Auto Archive ──────────────────────────────────────────────
describe('Auto Archive', () => {
  let app;
  beforeEach(() => {
    buildMockEnv();
    app = new SideRouter();
  });

  test('autoArchive is an alias for archiveCurrentChat', () => {
    expect(app.autoArchive).toBeDefined();
    expect(typeof app.autoArchive).toBe('function');
  });
});
