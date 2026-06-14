# Chrome Web Store — SideRouter Listing

## Short Description (132 chars max)
AI chat sidebar powered by OpenRouter. Chat with free and paid models, add page context, and manage conversations.

## Detailed Description

SideRouter brings AI chat directly into your browser sidebar. Powered by OpenRouter, it gives you access to hundreds of free and paid language models in a clean, minimal interface.

### Features

- **Sidebar Integration** — Click the extension icon to open the chat sidebar instantly. Also supports a floating window for multitasking.
- **Model Selection** — Browse all OpenRouter models with automatic free/paid grouping. Never run out of free models.
- **Context Awarenes** — Add the current page, any open tab, or uploaded files as context for the AI.
- **Chat History** — Optionally save conversations and restore them later.
- **Floating Window** - Detach chat to a floating window to work outside of Google Chrome.
- **Content Zoom** — Adjust text size in the chat area from 50% to 200%.
- **Dark Mode** — Auto-detect from your browser or manually toggle.
- **Caveman Compression** — Reduces token usage by 60-75% through intelligent context compression.

### How It Works

1. Click the SideRouter icon in your browser toolbar
2. Enter your OpenRouter API key (get one free at openrouter.ai/keys)
3. Select a model (free models available!) and start chatting
4. Add context with the @ button — page content, tabs, or file uploads
5. AI can interact with web pages when you approve permission requests

### Permissions

- **storage** — Save your settings and chat history locally
- **activeTab** — Read the current tab when you add it as context
- **tabs** — List open tabs for adding context
- **windows** — Open floating popup windows
- **sidePanel** — Sidebar chat experience
- **Host permissions** — Required for page content reading and OpenRouter API access

### Privacy

Your API key and chat data stay on your device. Data is only sent to OpenRouter.ai for generating responses. No analytics, no tracking, no data collection. See our privacy policy for details.

## Category
Productivity

## Language
English

## Single Purpose Declaration
SideRouter provides an AI chat interface in the browser sidebar, powered by OpenRouter. It enables users to chat with AI models and optionally interact with web pages.

## Permission Justifications

- **storage:** Required to persist user settings (API key, theme, model selection) and chat history across browser sessions.
- **activeTab:** Required to read the current tab's content when the user explicitly adds it as AI context via the @ context picker.
- **scripting:** Required to execute JavaScript on the current page when the user approves AI-initiated code execution requests.
- **tabs:** Required to list open browser tabs so users can select them as AI context.
- **windows:** Required to open the floating detached chat window.
- **sidePanel:** Required to provide the sidebar chat experience.
- **host_permissions (openrouter.ai):** Required to communicate with the OpenRouter API for model listing, API key validation, and chat completions.
- **host_permissions (http/https):** Required to read web page content for context and execute approved JavaScript on pages.

## Privacy Practices

- Does this extension collect personal data: No (API key is stored locally, not transmitted to developer)
- Does this extension collect browsing activity: Only when user explicitly adds page context
- Does this extension transmit data to third parties: Yes, to OpenRouter.ai
- Does this extension use data for purposes unrelated to its functionality: No
- Is the data use disclosed in a privacy policy: Yes
