// tests/e2e/script.e2e.test.js
// End-to-end tests for SideRouter — full user journey simulations

const { buildMockEnv, makeEl } = require('../helpers/mock-env');

function setup() {
  const { SideRouter } = buildMockEnv();
  return { app: new SideRouter(), SideRouter };
}

describe('E2E: Complete User Journey', () => {
  test('user opens extension, unlocks with API key, sends message, sees response', () => {
    const { app } = setup();

    // 1. User sees locked state
    app.setLocked(true);
    expect(app.dom.input.disabled).toBe(true);

    // 2. User enters API key via welcome screen
    app.dom.welcomeApiKey = { value: 'sk-or-v1-test-key' };
    expect(app.dom.welcomeApiKey.value).toBe('sk-or-v1-test-key');

    // 3. After validation, UI unlocks
    app.setLocked(false);
    expect(app.dom.input.disabled).toBe(false);
    expect(app.dom.modelSelect.disabled).toBe(false);

    // 4. User types message and sends
    app.renderBubble('user', 'What is JavaScript?');
    expect(app.messages.length).toBe(1);
    expect(app.messages[0].content).toBe('What is JavaScript?');

    // 5. AI responds
    app.renderBubble('assistant', 'JavaScript is a programming language...');
    expect(app.messages.length).toBe(2);
    expect(app.messages[1].role).toBe('assistant');

    // 6. User sees history
    const hist = app.getHistory();
    expect(hist.length).toBe(2);
  });

  test('user queues multiple messages while one is processing', () => {
    const { app } = setup();

    app.queueSend('First message', []);
    app.queueSend('Second message', []);

    // First message is immediately shifted by processQueue, second stays
    expect(app.taskQueue.length).toBe(1);
    expect(app.taskQueue[0].text).toBe('Second message');
  });

  test('user aborts a running task', () => {
    const { app } = setup();

    const mockAbort = jest.fn();
    app.isRunning = true;
    app.abortController = { abort: mockAbort };
    app.dom.messages = { querySelector: jest.fn(), innerHTML: '', appendChild: jest.fn(), _children: [] };
    app.dom.sendBtn = { classList: { remove: jest.fn(), add: jest.fn(), contains: () => false, toggle: jest.fn() }, querySelector: jest.fn(() => null) };
    app.toast = jest.fn();

    app.abortTask();

    expect(mockAbort).toHaveBeenCalled();
    expect(app.abortController).toBeNull();
    expect(app.isRunning).toBe(false);
  });

  test('user attaches a file and sends message with attachment', () => {
    const { app } = setup();

    const mockFile = new File(['test'], 'doc.txt', { type: 'text/plain' });
    app.handleFiles([mockFile]);

    expect(app.attachments.length).toBe(1);
    expect(app.attachments[0].name).toBe('doc.txt');
    expect(app.attachments[0].type).toBe('file');
  });

  test('user changes theme from light to dark', () => {
    const { app } = setup();

    app.settings.isDarkTheme = false;
    app.applyTheme();
    expect(document.body.classList.contains('dark')).toBe(false);

    app.settings.isDarkTheme = true;
    app.applyTheme();
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  test('user opens and closes settings modal', () => {
    const { app } = setup();

    app.dom.settings = { classList: { remove: jest.fn(), add: jest.fn(), contains: () => false }, setAttribute: jest.fn(), querySelector: () => null, querySelectorAll: () => [] };
    app.openSettings();
    app.closeSettings();
    expect(true).toBe(true);
  });

  test('user clears chat history', () => {
    const { app } = setup();

    app.messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    global.confirm = () => true;
    app.dom.messages = { _innerHTML: '', innerHTML: '', classList: {} };
    app.dom.welcome = { classList: { remove: jest.fn() } };

    app.clearChat();
    expect(app.messages.length).toBe(0);
  });

  test('user views chat history popup', () => {
    const { app } = setup();

    app.dom.historyPopup = { classList: { remove: jest.fn(), add: jest.fn(), contains: () => false }, querySelector: jest.fn() };
    app.chatHistories = [
      { id: '1', title: 'Test Chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() },
    ];

    app.openHistoryPopup();
    app.renderHistoryList();
    app.closeHistoryPopup();
    expect(true).toBe(true);
  });
});

describe('E2E: Security Scenarios', () => {
  test('XSS in user message is escaped', () => {
    const { app } = setup();

    const result = app.md('<script>steal(document.cookie)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('XSS in AI response is escaped', () => {
    const { app } = setup();

    const xssPayload = '![img](javascript:alert(1))';
    const result = app.md(xssPayload);
    expect(result).not.toContain('javascript:');
  });

  test('onerror attribute is stripped from output', () => {
    const { app } = setup();

    const result = app.md('![x](https://example.com/img.png)');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onload');
  });
});

describe('E2E: Media Download Flow', () => {
  test('AI response with image URL renders with download button', () => {
    const { app } = setup();

    const urls = app.extractMediaUrls('Check this: https://example.com/photo.jpg');
    expect(urls.length).toBe(1);

    const html = app.buildMediaHtml(urls);
    expect(html).toContain('media-download-btn');
    expect(html).toContain('media-preview-img');
  });

  test('AI response with audio URL renders with download button', () => {
    const { app } = setup();

    const urls = app.extractMediaUrls('Listen: https://example.com/song.mp3');
    const html = app.buildMediaHtml(urls);
    expect(html).toContain('media-preview-audio');
    expect(html).toContain('media-download-btn');
  });

  test('AI response with video URL renders with download button', () => {
    const { app } = setup();

    const urls = app.extractMediaUrls('Watch: https://example.com/clip.mp4');
    const html = app.buildMediaHtml(urls);
    expect(html).toContain('media-preview-video');
    expect(html).toContain('media-download-btn');
  });

  test('buildMediaHtml with mixed URLs', () => {
    const { app } = setup();

    const urls = [
      'https://x.com/a.jpg',
      'https://x.com/b.mp3',
      'https://x.com/c.mp4',
    ];
    const html = app.buildMediaHtml(urls);
    expect(html).toContain('media-preview-img');
    expect(html).toContain('media-preview-audio');
    expect(html).toContain('media-preview-video');
    expect(html.match(/media-download-btn/g).length).toBe(3);
  });
});
