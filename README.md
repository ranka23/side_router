# OpenRouter AI Chat Extension

A Chrome extension that allows you to chat with free AI models from OpenRouter directly in your browser sidebar.

## Features

- Chat with various free AI models from OpenRouter
- Sidebar interface using Chrome's Side Panel API
- Conversation history persistence
- File attachments (images and text files)
- Light/Dark theme support
- Settings persistence
- Model selection
- Clean, modern UI

## Installation

1. Clone or download this repository
2. (Optional but recommended) Create icon files:
   - icon16.png (16x16 pixels)
   - icon32.png (32x32 pixels)
   - icon48.png (48x48 pixels)
   - icon128.png (128x128 pixels)
   Place them in the extension root directory.
3. Open Chrome and go to `chrome://extensions`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extension directory
6. The extension icon will appear in your toolbar

## Usage

1. Click the extension icon to open the sidebar
2. Click the settings icon (gear) in the sidebar header
3. Enter your OpenRouter API key (get one at [openrouter.ai/keys](https://openrouter.ai/keys))
4. Select a model from the dropdown (free models are prioritized)
5. Start chatting!

## Features in Detail

### Chat Interface
- Type messages and press Enter to send (Shift+Enter for new line)
- Attach files using the paperclip icon
- Images are processed as multimodal input
- Text files are appended to your message as context
- Clear chat using the trash can icon
- Toggle theme using the settings panel

### Settings
- **API Key**: Your OpenRouter API key (starts with `sk-or-`)
- **Model Selection**: Choose from various free and paid models
- **Appearance**: Toggle between light and dark themes
- **Chat Options**: 
  - Save Chat History: Persists conversations between sessions
  - Auto-scroll: Automatically scroll to latest message

### Model Support
The extension includes a curated list of free models from OpenRouter:
- Llama 3 8B & 70B (Free)
- Mistral 7B & Mixtral 8x7B (Free)
- Gemma 2 9B & 27B (Free)
- Phi-3 Mini & Medium (Free)

Paid models are also available for selection if you want to use them.

## How It Works

This extension uses:
- Chrome's Side Panel API for a native sidebar experience
- OpenRouter's API to communicate with AI models
- Local storage for persisting settings and chat history
- Modern JavaScript ES6 modules

## Security Notes

- Your API key is stored locally in Chrome's storage and never transmitted to any third party (except OpenRouter when making API calls)
- The extension only makes requests to `https://openrouter.ai/*`
- No analytics or tracking is included

## Troubleshooting

### Extension not working?
1. Make sure you've entered a valid OpenRouter API key
2. Check that the extension has permission to access `https://openrouter.ai/*`
3. Try reloading the extension from `chrome://extensions`

### Not seeing responses?
1. Verify your API key has sufficient credits
2. Check the browser console for errors (right-click sidebar → Inspect)
3. Some models may be temporarily unavailable

### Want to contribute?
Feel free to submit issues or pull requests!

## License

MIT License - feel free to modify and use as you wish.