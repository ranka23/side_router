# SideRouter - Browser Extension

AI chat powered by OpenRouter.ai in your browser sidebar. Chat with free and paid models, execute JavaScript on web pages with permission prompts, and manage conversations with a clean, minimal interface.

## Features

- **Sidebar Integration**: Click the extension icon to open the chat sidebar instantly
- **Floating Window**: Open chats in a separate popup window for multitask workflows  
- **Model Selection**: Browse all OpenRouter models with automatic free/paid grouping
- **Task Queue**: Queue multiple messages while one is processing; cancel with stop button
- **Permission System**: Approve or deny AI requests to execute JavaScript on pages
- **File Attachments**: Upload images, audio, video, and text files via the context popup
- **Page Context**: Include "this page" content for contextual AI assistance
- **Tab Context**: Add context from any open browser tab
- **History Persistence**: Optionally save chat history to extension storage
- **Chat History Popup**: View and restore past conversations from the history button
- **Dark Mode**: Auto-detect or manually toggle dark theme
- **Context Tracking**: See token usage vs model context limit in real-time
- **Thinking Display**: View AI reasoning before final response (auto-clears in 5s)
- **Content Zoom**: Adjust text size in the chat area (- / 100% / +) with persistent settings
- **Context Compression**: Automatically compresses context to fit within model limits
- **Donate Modal**: Crypto donation support with QR codes for ETH, SOL, USDC, USDT

## Installation

1. Clone or download this repository
2. Open Firefox → `about:debugging`
3. Select "This Firefox"
4. Click "Load Temporary Add-on" and select this extension's Firefox `manifest.firefox.json`
5. Get an OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys)
6. Click the extension icon → paste your API key in Settings

For Chrome, load the default `manifest.json` from `chrome://extensions/` with Developer mode enabled.

## Usage

### Basic Chat
1. Click the SideRouter icon in the browser toolbar
2. Type a message and press Enter or click Send
3. The sidebar opens with AI responses

### Context Features
1. Click the @ icon in the input area to open the context picker
2. **Current Page**: Add the active tab's content as context
3. **Tabs**: Select multiple open tabs to add as context
4. **File**: Upload text files, PDFs, images, or code files as context
5. Context chips appear above the input showing attached context

### Zoom Controls
1. Open Settings (gear icon in header)
2. Use the Content Zoom controls (- / 100% / +)
3. Zoom level persists across sessions

### JavaScript Execution
1. AI can request to run JavaScript on the current page
2. Permission modal appears asking for approval
3. Check "Remember" to auto-approve future requests of that type
4. Toggle "Auto-approve" in Settings to skip prompts

### Floating Window
Click the window icon in the header to open chats in a separate popup window.

### Chat History
Click the history icon (three stacked panels) in the header to view past conversations. Select a saved chat to restore it.

## Architecture

```
main.html              ← UI layout (messages, input, settings, donate modals)
src/
  script.js            ← SideRouter class (frontend controller)
  background.js        ← Persistent background script (model API, tab execution)
  content.js           ← Content script (page context extraction)
  styles.css           ← All styling with CSS variables
  lib/
    api.js             ← Background API communication with retry
    storage.js         ← Storage utilities
    markdown.js        ← Markdown parser with XSS protection
    dom.js             ← DOM element caching
    settings.js        ← Settings, zoom, donate modal, model population
    ui.js              ← UI rendering (bubbles, typing, media)
    chat.js            ← Send flow, queue, context compression
    history.js         ← Chat history management
    context.js         ← Context picker, permission system
media/                 ← Extension icons
manifest.json          ← Chrome extension configuration (MV3)
manifest.firefox.json  ← Firefox extension configuration (MV3 sidebar)
```

## Key Components

### SideRouter Class (src/script.js)
Main controller handling:
- UI initialization and event binding
- Message queuing and processing
- Markdown rendering with XSS protection
- Permission request flow
- Settings persistence
- Zoom controls and donate modal

### Flow: Sending a Message
1. `send()` validates input → `queueSend()` adds to queue
2. `processQueue()` picks up and calls `handleSend()`
3. Constructs prompt with optional page context
4. Compresses context to fit within model's context window
5. POSTs to OpenRouter API with AbortController support
6. Renders typing indicator during wait
7. Displays response (with optional thinking/reasoning)
8. Saves history if enabled

### Context Compression

Automatically compresses context when the total text exceeds the model's context window:
- Strips HTML tags and removes boilerplate (cookie notices, navigation, etc.)
- Removes common UI text (subscribe, sign in, etc.)
- Falls back to intelligent sentence-level truncation
- Leaves 20% of context window for the AI's response

### Caveman Compression

SideRouter uses caveman-style compression to reduce token usage by ~60-75%:

- **Assistant replies** are instructed to be terse and skip filler (no pleasantries, hedging, or verbose explanations)
- **Natural-language context** (page, tab, and text-file context) is compressed before sending
- **Assistant chat history** is compressed before sending (user messages remain exact to preserve intent)
- **Code blocks, URLs, file paths, commands, JSON-like blocks, and binary media are preserved**
- **Images, audio, video, and PDF binary payloads are never caveman-compressed**
- Can be toggled in Settings → "Caveman compression" (enabled by default)

### Security
- API calls use fetch with Authorization header
- XSS prevention via HTML escaping and sanitization
- JavaScript execution blocked for dangerous patterns:
  - `document.cookie`, `localStorage`, `sessionStorage`
  - `eval`, `Function`, `import()`
  - `fetch`, `XMLHttpRequest`
  - `navigator.sendBeacon`, `window.location`

## Settings

| Setting | Description |
|---------|-------------|
| API Key | Your OpenRouter key (stored in chrome.storage.local) |
| Content Zoom | Adjust chat text size (50%-200%, persisted) |
| Dark Mode | Auto-detect or manual toggle |
| Save History | Persist messages between sessions |
| Auto-approve | Skip permission prompts for JS execution |
| AI Agent Name | Custom display name in chat bubbles |
| Default AI Model | Model for new chats (optional) |
| Caveman Compression | Reduce token usage by compressing context and requesting terse AI replies |

## Building for Production

```bash
# Build both Chrome and Firefox ZIPs (minified, ready for store upload)
npm run build

# Build Chrome only
npm run build:chrome

# Build Firefox only
npm run build:firefox
```

Output will be in `dist/chrome.zip` and `dist/firefox.zip`. The build script:
- Minifies all JavaScript (terser, 3-pass compression + mangling)
- Optimizes CSS (csso)
- Minifies HTML (html-minifier-terser)
- Strips comments and whitespace from all files
- Excludes tests, screenshots, dev configs, and other non-runtime files
- Reports before/after size reduction

## Publishing

### Chrome Web Store
1. Run `npm run build:chrome`
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the $5 one-time registration fee (if new account)
4. Click "New Item" and upload `dist/chrome.zip`
5. Use screenshots from `screenshots/` folder (1280×800 recommended)
6. Copy store listing from `store-assets/chrome-listing.md`
7. Set the privacy policy URL (host `privacy-policy.html` on GitHub Pages or your site)
8. Submit for review (typically 1-3 business days)

### Firefox Add-ons (AMO)
1. Run `npm run build:firefox`
2. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
3. Create a free developer account (if new)
4. Click "Submit a New Add-on" and upload `dist/firefox.zip`
5. Add screenshots from `screenshots/` folder
6. Copy store listing from `store-assets/firefox-listing.md`
7. Submit for review (typically 1-5 business days)

## Development

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests only
npm run test:e2e

# Reload extension
# Firefox: open about:debugging → This Firefox → Load Temporary Add-on → manifest.firefox.json
# Chrome: open chrome://extensions → enable Developer mode → Reload the SideRouter card loaded from manifest.json
```

## Permissions

- `storage` — Save settings and history
- `sidebar_action` / `sidePanel` — Sidebar or side panel integration
- `activeTab` — Inject scripts into current tab
- `scripting` — Execute JavaScript on pages
- `tabs` — Query active tab for context
- `windows` — Create floating popup windows
- Host permissions: `https://openrouter.ai/*` and all HTTP/HTTPS for page context

## License

MIT