# SideRouter - Chrome Extension

AI chat powered by OpenRouter.ai in your browser's side panel. Chat with free and paid models, execute JavaScript on web pages with permission prompts, and manage conversations with a clean, minimal interface.

## Features

- **Side Panel Integration**: Click the extension icon to open the chat sidebar instantly
- **Floating Window**: Open chats in a separate popup window for multitask workflows  
- **Model Selection**: Browse all OpenRouter models with automatic free/paid grouping
- **Task Queue**: Queue multiple messages while one is processing; cancel with stop button
- **Permission System**: Approve or deny AI requests to execute JavaScript on pages
- **File Attachments**: Upload images, audio, video, and text files up to 10MB
- **Page Context**: Include "this page" content for contextual AI assistance
- **History Persistence**: Optionally save chat history to Chrome storage
- **Chat History Popup**: View and restore past conversations from the history button
- **Dark Mode**: Auto-detect or manually toggle dark theme
- **Context Tracking**: See token usage vs model context limit in real-time
- **Thinking Display**: View AI reasoning before final response (auto-clears in 5s)

## Installation

1. Clone or download this repository
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked" and select the extension folder
5. Get an OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys)
6. Click the extension icon → paste your API key in Settings

## Usage

### Basic Chat
1. Click the SideRouter icon in Chrome's toolbar
2. Type a message and press Enter or click Send
3. The side panel opens with AI responses

### File Attachments
1. Click the paperclip icon in the input area
2. Select files (images, documents, code files)
3. Messages with attachments send the file content to the AI

### Page Context
Ask about "this page", "the webpage", or "current page" to include:
- Page title and URL
- Text content (first 8000 characters)
- Form structure (up to 3 forms)

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
main.html              ← UI layout (messages, input, settings modal)
src/
  script.js            ← SideRouter class (frontend controller)
  background.js       ← Service worker (model API, tab execution)
  content.js           ← Content script (page context extraction)
  styles.css           ← All styling with CSS variables
media/
  icon16.svg           ← Extension icons
  icon32.svg
  icon48.svg
  icon128.svg
manifest.json          ← Extension configuration (MV3)
```

## Key Components

### SideRouter Class (src/script.js)
Main controller handling:
- UI initialization and event binding
- Message queuing and processing
- Markdown rendering with XSS protection
- Permission request flow
- Settings persistence

### Flow: Sending a Message
1. `send()` validates input → `queueSend()` adds to queue
2. `processQueue()` picks up and calls `handleSend()`
3. Constructs prompt with optional page context
4. POSTs to OpenRouter API with AbortController support
5. Renders typing indicator during wait
6. Displays response (with optional thinking/reasoning)
7. Saves history if enabled

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
| Dark Mode | Auto-detect or manual toggle |
| Save History | Persist messages between sessions |
| Auto-approve | Skip permission prompts for JS execution |
| AI Agent Name | Custom display name in chat bubbles |

## Development

```bash
# Run tests
node tests/side-router.test.js

# Reload extension
# Go to chrome://extensions → click "Reload" on SideRouter card
```

## Permissions

- `storage` — Save settings and history
- `sidePanel` — Side panel integration
- `activeTab` — Inject scripts into current tab
- `scripting` — Execute JavaScript on pages
- `tabs` — Query active tab for context
- `windows` — Create floating popup windows
- Host permissions: `https://openrouter.ai/*` and all HTTP/HTTPS for page context

## License

MIT