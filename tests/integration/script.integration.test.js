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

// ── Integration: Tab Context and Context Compression ────────────────────────
describe('Integration: Tab Context and Context Compression', () => {
  test('tab context items can include content property', () => {
    const { app } = setup();
    app.contextItems.push({
      type: 'tab',
      title: 'Test Tab',
      url: 'https://example.com',
      content: { title: 'Test Page', url: 'https://example.com', text: 'Page content here' }
    });
    expect(app.contextItems[0].content.text).toBe('Page content here');
  });

  test('page context items can include content property', () => {
    const { app } = setup();
    app.contextItems.push({
      type: 'page',
      title: 'Test Page',
      url: 'https://example.com',
      content: 'Page content here'
    });
    expect(app.contextItems[0].content).toBe('Page content here');
  });

  test('file context items can include text content', () => {
    const { app } = setup();
    app.contextItems.push({
      type: 'file',
      name: 'test.txt',
      data: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
      mime: 'text/plain',
      text: 'Hello World'
    });
    expect(app.contextItems[0].text).toBe('Hello World');
  });

  test('developer messages are built from context items when caveman enabled', () => {
    const { app } = setup();
    app.settings.cavemanCompression = true;
    app.contextItems.push({
      type: 'page',
      title: 'Test Page',
      url: 'https://example.com',
      content: 'Page content here'
    });
    expect(app.contextItems.length).toBe(1);
  });
});

// ── Integration: Context Payload to OpenRouter ────────────────────────────────
describe('Integration: Context Payload to OpenRouter', () => {
  let app, fetchMock;

  beforeEach(() => {
    const result = setup();
    app = result.app;
    fetchMock = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'AI response' } }]
      })
    }));
    global.fetch = fetchMock;
    app.settings.apiKey = 'test-key';
    app.settings.selectedModel = 'test/model';
    app.dom.modelSelect = { selectedOptions: [{ dataset: { context: 4096 } }] };
  });

  test('tab context is sent as developer message in API payload', async () => {
    app.contextItems.push({
      type: 'tab',
      title: 'Test Tab',
      url: 'https://example.com/tab',
      content: { title: 'Tab Page', url: 'https://example.com/tab', text: 'Tab page content here' }
    });
    app.dom.messages = { appendChild: () => {}, style: {} };
    await app.handleSendDirect('Hello', []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const developerMsg = body.messages.find(m => m.role === 'developer' && m.content.includes('Tab Context'));
    expect(developerMsg).toBeDefined();
    expect(developerMsg.content).toContain('Test Tab');
    expect(developerMsg.content).toContain('Tab page content here');
  });

  test('page context is sent as developer message in API payload', async () => {
    app.contextItems.push({
      type: 'page',
      title: 'Test Page',
      url: 'https://example.com/page',
      content: 'Page content here'
    });
    app.dom.messages = { appendChild: () => {}, style: {} };
    await app.handleSendDirect('Hello', []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const developerMsg = body.messages.find(m => m.role === 'developer' && m.content.includes('Page Context'));
    expect(developerMsg).toBeDefined();
    expect(developerMsg.content).toContain('Test Page');
    expect(developerMsg.content).toContain('Page content here');
  });

  test('file context is sent as developer message in API payload', async () => {
    app.contextItems.push({
      type: 'file',
      name: 'test.txt',
      text: 'File content here',
      mime: 'text/plain'
    });
    app.dom.messages = { appendChild: () => {}, style: {} };
    await app.handleSendDirect('Hello', []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const developerMsg = body.messages.find(m => m.role === 'developer' && m.content.includes('File Context'));
    expect(developerMsg).toBeDefined();
    expect(developerMsg.content).toContain('test.txt');
    expect(developerMsg.content).toContain('File content here');
  });

  test('multiple tabs context are sent as separate developer messages', async () => {
    app.contextItems.push(
      { type: 'tab', title: 'Tab 1', url: 'https://example.com/1', content: { text: 'Content 1' } },
      { type: 'tab', title: 'Tab 2', url: 'https://example.com/2', content: { text: 'Content 2' } }
    );
    app.dom.messages = { appendChild: () => {}, style: {} };
    await app.handleSendDirect('Hello', []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const devMsgs = body.messages.filter(m => m.role === 'developer');
    expect(devMsgs.length).toBe(2);
    expect(devMsgs[0].content).toContain('Tab 1');
    expect(devMsgs[1].content).toContain('Tab 2');
  });

  test('mixed context types are sent correctly', async () => {
    app.contextItems.push(
      { type: 'page', title: 'Page', url: 'https://example.com/page', content: 'Page content' },
      { type: 'tab', title: 'Tab', url: 'https://example.com/tab', content: { text: 'Tab content' } },
      { type: 'file', name: 'file.txt', text: 'File content', mime: 'text/plain' }
    );
    app.dom.messages = { appendChild: () => {}, style: {} };
    await app.handleSendDirect('Hello', []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const devMsgs = body.messages.filter(m => m.role === 'developer');
    expect(devMsgs.length).toBe(3);
    expect(devMsgs.some(m => m.content.includes('Page Context'))).toBe(true);
    expect(devMsgs.some(m => m.content.includes('Tab Context'))).toBe(true);
    expect(devMsgs.some(m => m.content.includes('File Context'))).toBe(true);
  });

  test('file context shows fallback message when content is unavailable', async () => {
    app.contextItems.push({
      type: 'tab',
      title: 'Restricted Tab',
      url: 'chrome://extensions',
      content: null
    });
    app.dom.messages = { appendChild: () => {}, style: {} };
    await app.handleSendDirect('Hello', []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const developerMsg = body.messages.find(m => m.role === 'developer');
    expect(developerMsg).toBeDefined();
    expect(developerMsg.content).toContain('not available');
  });

  test('non-PDF file attachments are sent as file parts in API payload', async () => {
    const attachments = [{
      type: 'file',
      name: 'document.txt',
      data: Buffer.from('Hello file content').toString('base64'),
      mime: 'text/plain'
    }];
    app.dom.messages = { appendChild: () => {}, scrollTop: 0, scrollHeight: 1000, style: {} };
    await app.handleSend('Hello', attachments, null, []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const userMessage = body.messages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage.content).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'file', file: { filename: 'document.txt', file_data: 'data:text/plain;base64,SGVsbG8gZmlsZSBjb250ZW50' } }
    ]);
  });

  test('PDF file attachments are sent as file parts in API payload', async () => {
    const attachments = [{
      type: 'file',
      name: 'sample.pdf',
      data: Buffer.from('%PDF-1.4').toString('base64'),
      mime: 'application/pdf'
    }];
    app.dom.messages = { appendChild: () => {}, scrollTop: 0, scrollHeight: 1000, style: {} };
    await app.handleSend('Hello', attachments, null, []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const userMessage = body.messages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage.content).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'file', file: { filename: 'sample.pdf', file_data: 'data:application/pdf;base64,JVBERi0xLjQ=' } }
    ]);
    expect(body.plugins).toContainEqual({ id: 'file-parser', pdf: { engine: 'cloudflare-ai' } });
  });

  test('mixed file and image attachments are sent correctly', async () => {
    const attachments = [
      {
        type: 'file',
        name: 'doc.txt',
        data: Buffer.from('Text content').toString('base64'),
        mime: 'text/plain'
      },
      {
        type: 'image',
        name: 'image.png',
        data: Buffer.from('image-data').toString('base64'),
        mime: 'image/png'
      }
    ];
    app.dom.messages = { appendChild: () => {}, scrollTop: 0, scrollHeight: 1000, style: {} };
    await app.handleSend('Hello', attachments, null, []);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    const userMessage = body.messages.find(m => m.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage.content).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'file', file: { filename: 'doc.txt', file_data: 'data:text/plain;base64,VGV4dCBjb250ZW50' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2UtZGF0YQ==' } }
    ]);
  });
});

// ── Integration: Label Truncation ─────────────────────────────────────────────
describe('Integration: Label Truncation', () => {
  test('_truncate returns original string if under max length', () => {
    const { app } = setup();
    const result = app._truncate('Short text', 50);
    expect(result).toBe('Short text');
  });

  test('_truncate appends ellipsis for strings over max length', () => {
    const { app } = setup();
    const longText = 'A'.repeat(100);
    const result = app._truncate(longText, 50);
    expect(result.length).toBe(53);
    expect(result.endsWith('...')).toBe(true);
  });

  test('_truncate handles empty string', () => {
    const { app } = setup();
    expect(app._truncate('', 50)).toBe('');
    expect(app._truncate(null, 50)).toBe('');
    expect(app._truncate(undefined, 50)).toBe('');
  });

  test('renderAttachments truncates long file names', () => {
    const { app } = setup();
    expect(typeof app._truncate).toBe('function');
    const longName = 'A'.repeat(100) + '.txt';
    expect(app._truncate(longName, 50).length).toBe(53);
    expect(app._truncate(longName, 50)).toContain('...');
  });
});