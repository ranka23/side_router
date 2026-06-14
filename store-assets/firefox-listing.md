# Firefox Add-ons (AMO) — SideRouter Listing

## Name (max 50 chars)
SideRouter — AI Chat Sidebar

## Summary (max 250 chars)
AI chat in your Firefox sidebar powered by OpenRouter. Access all models from OpenRouter with automatic free/paid grouping, attach page context and files to your chats, keep track of your chat history, detach chat to a floating window, and a clean minimal interface.

## Description

SideRouter brings AI chat directly into your Firefox sidebar. Powered by OpenRouter, it gives you access to hundreds of free and paid language models in a clean, minimal interface.

### Features

- **Sidebar Integration** — Click the extension icon to open the chat sidebar instantly. Also supports a floating window for multitasking.
- **Model Selection** — Browse all OpenRouter models with automatic free/paid grouping. Never run out of free models.
- **Context Awareness** — Add the current page, any open tab, or uploaded files as context for the AI.
- **Chat History** — Optionally save conversations and restore them later.
- **Content Zoom** — Adjust text size in the chat area from 50% to 200%.
- **Dark Mode** — Auto-detect from your browser or manually toggle.
- **Caveman Compression** — Reduces token usage by 60-75% through intelligent context compression.

### How It Works

1. Click the SideRouter icon in the toolbar
2. Enter your OpenRouter API key (get one free at openrouter.ai/keys)
3. Select a model (free models available!) and start chatting
4. Add context with the @ button — page content, tabs, or file uploads.
5. Manage chat history and continue previous chats so the AI remembers your context.

### Permissions

- storage — Save your settings and chat history locally
- activeTab — Read the current tab when you add it as context
- scripting — Execute JavaScript on pages (with your approval)
- tabs — List open tabs for adding context
- windows — Open floating popup windows
- Host permissions — Required for page content reading and OpenRouter API access

### Privacy

Your API key and chat data stay on your device. Data is only sent to OpenRouter.ai for generating responses. No analytics, no tracking, no data collection. See our privacy policy for details.

## Categories
- Productivity
- Security & Privacy

## Tags
ai, chat, openrouter, sidebar, assistant, productivity, llm

## License
MIT

## Notes for Reviewers

- This extension requires an OpenRouter API key to function (user provides their own key at openrouter.ai/keys)
- The extension makes API calls only to openrouter.ai for model listing, key validation, and chat completions
- No user data is collected or transmitted to the developer
- All settings and chat history are stored locally in browser extension storage
- JavaScript execution feature is opt-in and requires explicit user approval per request