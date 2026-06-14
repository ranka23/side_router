# Chrome Web Store — SideRouter Listing

## Short Description (132 chars max)
AI chat sidebar powered by OpenRouter. Chat with free and paid models, add page context, and manage conversations.

## Detailed Description

SideRouter brings AI chat directly into your browser sidebar. Powered by OpenRouter, it gives you access to hundreds of free and paid language models in a clean, minimal interface. No installation required beyond the browser extension — just add your OpenRouter API key and start chatting.

### Core Features

• **Sidebar Integration** — Click the extension icon to open the AI chat sidebar instantly. Also supports a floating window mode for multitasking while browsing. The sidebar opens as a side panel in Chrome, giving you a dedicated space for AI conversations without leaving your current page.

• **Model Selection** — Browse all OpenRouter models with automatic free and paid grouping. The extension fetches models directly from the OpenRouter API, so you always have access to the latest models. Free models are listed first for quick access. Models include language models from OpenAI, Anthropic, Meta, Mistral, and many more providers.

• **Context Awareness** — Add the current page, any open tab, or uploaded files as context for the AI. The AI can then answer questions about what you're looking at, summarize content, or provide suggestions based on the page content. Supports text files, images, audio, video, PDFs, and code files.

• **Content Zoom** — Adjust text size in the chat area from 50% to 200% to suit your preferences. The zoom level persists across browser sessions.

• **Chat History** — Optionally save conversations and restore them later. Chat history is stored locally in your browser's extension storage. No chat data is sent to any external server.

• **Dark Mode** — Auto-detect from your browser's system preference or manually toggle. Dark mode reduces eye strain during extended use.

• **Floating Window** — Detach chat to a floating popup window to work outside of the sidebar. Useful for multitasking while browsing.

• **Caveman Compression** — Reduces token usage by 60-75% through intelligent context compression. Saves on API costs by compressing context and requesting concise AI replies.

### How It Works

1. Click the SideRouter icon in your browser toolbar
2. Enter your OpenRouter API key (get one free at openrouter.ai/keys)
3. Select a model (free models available!) and start chatting
4. Add context with the @ button — page content, tabs, or file uploads
5. AI can interact with web pages when you approve permission requests

### Permissions Explained

The extension requests the following browser permissions, each required for specific functionality:

• **storage** — Save your settings (API key, theme, model selection, zoom level) and chat history locally in your browser's extension storage. No data is sent to external servers.

• **activeTab** — Read the current tab's content when the user explicitly adds it as AI context via the @ context picker. This permission is only used when the user clicks "Add Page Context" — the extension does not read page content automatically.

• **scripting** — Execute JavaScript on the current page when the user approves AI-initiated code execution requests. The user must explicitly approve each code execution request through a permission dialog. Dangerous patterns (such as cookie access, localStorage access, eval) are automatically blocked.

• **tabs** — List open browser tabs so users can select them as AI context. This is used only when the user opens the context picker and selects the "Tabs" tab.

• **sidePanel** — Provide the sidebar chat experience in Chrome. This is the core UI of the extension.

• **Host permissions (openrouter.ai)** — Required to communicate with the OpenRouter API for model listing, API key validation, and chat completions. No other servers are contacted.

• **Host permissions (http/https)** — Required to read web page content for context and execute approved JavaScript on pages.

### Privacy

Your API key and chat data stay on your device. Data is only sent to OpenRouter.ai for generating responses. The extension does not collect analytics, track usage, or transmit data to any other third-party server. No data is shared with the extension developer. See our privacy policy for details.

## Category
Productivity

## Language
English

## Single Purpose Declaration
SideRouter provides an AI chat interface in the browser sidebar, powered by the OpenRouter API. It enables users to chat with AI language models, optionally attach page context and file context, and receive AI-generated responses.

## Remote Code Justification
The extension fetches remote code from the OpenRouter API (https://openrouter.ai/api/v1/) to:
1. Retrieve available AI models (model list endpoint)
2. Validate API keys (auth endpoint)
3. Send chat messages and receive AI responses (chat completions endpoint)
No remote code is injected into web pages. All remote communication uses standard fetch() calls to the OpenRouter API, and requests are only made when the user explicitly sends a message or validates their API key.

The extension does NOT use any remote code from sources other than the OpenRouter API.

## Permission Justifications

### activeTab
Required to read the current tab's content when the user explicitly adds it as AI context via the @ context picker. The extension reads page content only when the user clicks "Add Page Context" — it does not read page content automatically. The content is sent to OpenRouter.ai as context for the AI model, and is not stored or transmitted to any other server.

### host_permissions
Required to:
1. Communicate with the OpenRouter API (https://openrouter.ai/api/v1/) for model listing, API key validation, and chat completions — this is the core functionality of the extension.
2. Read web page content on any page when the user explicitly adds it as context (activeTab + host permissions combo).
3. Execute approved JavaScript on any page when the user approves AI-initiated code execution requests (scripting + host permissions combo).
The extension does not access or modify any web content without explicit user action.

### scripting
Required to execute JavaScript on the current page when the user approves AI-initiated code execution requests. The user must explicitly approve each execution request through a permission dialog (unless "Auto-approve" is enabled in settings). The extension blocks potentially dangerous patterns (such as document.cookie, localStorage, sessionStorage, eval, Function, fetch, XMLHttpRequest) to prevent security issues. The scripting API is used only for the AI's code execution feature, not for any other purpose.

### sidePanel
Required to provide the sidebar chat experience in Chrome. The extension uses Chrome's sidePanel API to display the chat interface in a browser side panel, which is the primary user interface for the extension.

### storage
Required to persist user settings (API key, theme, model selection, zoom level, auto-approve preference, agent name, save history preference, caveman compression preference, default model) and chat history across browser sessions. All data is stored locally in the browser's extension storage. No data is sent to external servers or the extension developer. Users can delete all data by clearing the extension's storage in settings or by uninstalling the extension.

### tabs
Required to list open browser tabs so users can select them as AI context. This is used only when the user opens the context picker and selects the "Tabs" tab to add tabs as context for the AI. The extension does not access or modify any tab content without explicit user action.

### remote code justification (see above)
The extension fetches remote code from the OpenRouter API for model listing, API key validation, and chat completions. No remote code is injected into web pages.

## Privacy Practices

### Does this extension collect personal data?
No. The API key is stored locally in the browser's extension storage and is not transmitted to the extension developer. No analytics, tracking, or data collection is performed.

### Does this extension collect browsing activity?
Only when the user explicitly adds page context via the @ context picker. The extension does not read page content automatically or passively. Page content is sent only to OpenRouter.ai as context for the AI model.

### Does this extension transmit data to third parties?
Yes, to OpenRouter.ai for the following purposes:
- Model listing (fetching available models)
- API key validation (verifying the user's API key is valid)
- Chat completions (sending messages and receiving AI responses)
- User data is not transmitted to any other third party.

### Does this extension use data for purposes unrelated to its functionality?
No. All data usage is directly related to the core functionality of the extension (chatting with AI models).

### Is the data use disclosed in a privacy policy?
Yes. The privacy policy is available at: [INSERT PRIVACY POLICY URL HERE — See chrome-dashboard-guide.md]

### Certification
By publishing this extension, I certify that the data usage described above complies with the Chrome Web Store Developer Programme Policies. Data is collected solely for the purpose of the extension's functionality and is not used for any unrelated purpose.

## Screenshots

Upload these screenshots from the `screenshots/` folder, in order:

1. `screenshots/chat-screen.jpg` — Active conversation (recommended as main screenshot, 1280×800)
2. `screenshots/welcome-screen.jpg` — Initial setup with API key input
3. `screenshots/settings-screen.jpg` — Settings panel
4. `screenshots/models-dropdown.jpg` — Model selection dropdown
5. `screenshots/add-context-chat-screen.jpg` — Context picker in action

At least 1 screenshot is required. All screenshots must be 1280×800 or 640×400 pixels.