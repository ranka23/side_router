// tests/integration/script.integration.test.js
// Integration tests for SideRouter — testing component interactions and workflows

const { buildMockEnv, makeEl } = require('../helpers/mock-env');

function setup() {
  const { SideRouter } = buildMockEnv();
  return { app: new SideRouter(), SideRouter };
}

describe('Integration: Message Flow', () => {
  test('queueSend renders queued bubble in DOM', () => {
    const { app } = setup();
    app.queueSend('hello world', []);
    // queueSend renders a bubble; processQueue shifts it immediately
    expect(app.dom.messages._children.length).toBeGreaterThanOrEqual(1);
  });

  test('lock -> unlock cycle restores full functionality', () => {
    const { app } = setup();
    app.setLocked(true);
    expect(app.dom.input.disabled).toBe(true);
    app.setLocked(false);
    expect(app.dom.input.disabled).toBe(false);
    expect(app.dom.modelSelect.disabled).toBe(false);
  });

  test('renderBubble adds message to messages array', () => {
    const { app } = setup();
    app.renderBubble('user', 'test message');
    expect(app.messages.length).toBe(1);
    expect(app.messages[0].role).toBe('user');
    expect(app.messages[0].content).toBe('test message');
  });

  test('renderBubble with save=false does not add to messages', () => {
    const { app } = setup();
    const before = app.messages.length;
    app.renderBubble('user', 'test', null, false);
    expect(app.messages.length).toBe(before);
  });

  test('renderTyping creates a thinking row', () => {
    const { app } = setup();
    const el = app.renderTyping();
    expect(el.className).toContain('thinking');
    expect(app.dom.messages._children.length).toBeGreaterThanOrEqual(1);
  });

  test('clearAttachments empties attachments array and DOM', () => {
    const { app } = setup();
    app.attachments = [{ name: 'test', type: 'file', data: 'x' }];
    app.renderAttachments();
    app.clearAttachments();
    expect(app.attachments.length).toBe(0);
    expect(app.dom.attachments._innerHTML).toBe('');
  });
});

describe('Integration: Settings Persistence', () => {
  test('save method calls bg with settings', async () => {
    const { app } = setup();
    const spy = jest.fn((msg, cb) => cb({ success: true }));
    global.chrome.runtime.sendMessage = spy;
    app.settings.apiKey = 'test-key';
    await app.save();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'saveSettings' }),
      expect.any(Function),
    );
  });

  test('theme change persists to settings', () => {
    const { app } = setup();
    app.settings.isDarkTheme = true;
    app.dom.theme = { checked: true };
    app.applyTheme();
    expect(document.body.classList._lastToggled).toBeDefined();
  });

});

describe('Integration: Model Selection Flow', () => {
  test('selecting paid model shows pro notice', () => {
    const { app } = setup();
    app.dom.modelSelect = makeEl('model-select-inline');
    app.dom.proNotice = makeEl('pro-notice');
    app.dom.usageBadge = { innerHTML: '', classList: { add: jest.fn(), remove: jest.fn(), contains: () => false } };
    app.populateSelect([
      { id: 'paid/model', name: 'Paid', isFree: false, contextLength: 32768, pricing: { prompt: '0.01' } },
    ]);
    app.dom.modelSelect.value = 'paid/model';
    app.dom.modelSelect.selectedOptions = [{ parentElement: { label: 'Paid Models' } }];
    app.checkPaidModel();
    expect(app.dom.proNotice.classList.contains('hidden')).toBe(false);
  });

  test('selecting free model hides pro notice', () => {
    const { app } = setup();
    app.dom.modelSelect = makeEl('model-select-inline');
    app.dom.proNotice = makeEl('pro-notice');
    app.dom.usageBadge = { innerHTML: '', classList: { add: jest.fn(), remove: jest.fn(), contains: () => false } };
    app.populateSelect([
      { id: 'free/model', name: 'Free', isFree: true, contextLength: 8192, pricing: {} },
    ]);
    app.dom.modelSelect.value = 'free/model';
    app.dom.modelSelect.selectedOptions = [{ parentElement: { label: 'Free Models' } }];
    app.checkPaidModel();
    expect(app.dom.proNotice.classList.contains('hidden')).toBe(true);
  });

  test('updateContextPercent updates badge with token info', () => {
    const { app } = setup();
    app.dom.usageBadge = { innerHTML: '' };
    app.messages = [{ role: 'user', content: 'Hello' }];
    app.updateContextPercent(4096);
    expect(app.dom.usageBadge.innerHTML).toContain('tokens');
  });
});

describe('Integration: Permission Flow', () => {
  test('permission request returns a Promise', () => {
    const { app } = setup();
    const result = app.requestPermission('execute', 'fill form');
    expect(result).toBeInstanceOf(Promise);
    // Clean up: remove any overlay that was appended
    if (document.body._children) {
      document.body._children = document.body._children.filter(c => !c._innerHTML?.includes('permission-overlay'));
    }
  });

  test('remembered permissions persist across permission checks', () => {
    const { app } = setup();
    app.rememberedPermissions.add('execute');
    expect(app.rememberedPermissions.has('execute')).toBe(true);
    app.rememberedPermissions.add('navigate');
    expect(app.rememberedPermissions.size).toBe(2);
  });
});

describe('Integration: Chat History', () => {
  test('getHistory filters out system messages', () => {
    const { app } = setup();
    app.messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    const hist = app.getHistory();
    expect(hist.length).toBe(2);
    expect(hist.some((m) => m.role === 'system')).toBe(false);
  });

  test('chatHistories array starts empty', () => {
    const { app } = setup();
    expect(Array.isArray(app.chatHistories)).toBe(true);
    expect(app.chatHistories.length).toBe(0);
  });

  test('no current chat selected by default', () => {
    const { app } = setup();
    expect(app.currentChatId).toBeNull();
  });
});

describe('Integration: Attachment Flow', () => {
  test('handleFiles processes file and adds to attachments', () => {
    const { app } = setup();
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    app.handleFiles([mockFile]);
    expect(app.attachments.length).toBe(1);
    expect(app.attachments[0].name).toBe('test.txt');
  });

  test('renderAttachments builds chip elements', () => {
    const { app } = setup();
    app.attachments = [{ name: 'test.png', type: 'image', data: 'data:image/png;base64,abc' }];
    app.renderAttachments();
    expect(app.dom.attachments._children.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Integration: Toast Notifications', () => {
  test('toast creates a toast element', () => {
    const { app } = setup();
    app.toast('Hello!', 'success');
    expect(app.dom.toast._children.length).toBeGreaterThanOrEqual(1);
  });

  test('toast caps at 5 visible toasts', () => {
    const { app } = setup();
    for (let i = 0; i < 7; i++) app.toast('msg ' + i);
    expect(app.dom.toast._children.length).toBeLessThanOrEqual(5);
  });
});

describe('Integration: Clear Chat', () => {
  test('clearChat resets messages and DOM', () => {
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
});

describe('Integration: Download Media', () => {
  test('downloadMedia is a function', () => {
    const { app } = setup();
    expect(typeof app.downloadMedia).toBe('function');
  });

  test('buildMediaHtml returns empty string for no URLs', () => {
    const { app } = setup();
    expect(app.buildMediaHtml([])).toBe('');
  });

  test('buildMediaHtml returns grid HTML for URLs', () => {
    const { app } = setup();
    const html = app.buildMediaHtml(['https://x.com/photo.jpg']);
    expect(html).toContain('msg-media-grid');
    expect(html).toContain('media-download-btn');
  });

  test('buildMediaHtml includes image preview for images', () => {
    const { app } = setup();
    const html = app.buildMediaHtml(['https://x.com/photo.jpg']);
    expect(html).toContain('media-preview-img');
  });

  test('buildMediaHtml includes audio element for audio', () => {
    const { app } = setup();
    const html = app.buildMediaHtml(['https://x.com/song.mp3']);
    expect(html).toContain('media-preview-audio');
  });

  test('buildMediaHtml includes video element for video', () => {
    const { app } = setup();
    const html = app.buildMediaHtml(['https://x.com/clip.mp4']);
    expect(html).toContain('media-preview-video');
  });
});
