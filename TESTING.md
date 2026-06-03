# Testing the OpenRouter AI Chat Extension

You can test the extension in two ways:

## Method 1: As a Chrome Extension (Recommended)

This is how users will actually use it:

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" 
4. Select the `/Users/user/code/web_apps/open_ai_chat` directory
5. The extension icon will appear in your toolbar
6. Click the icon to open the sidebar
7. Go to Settings (gear icon) to add your OpenRouter API key
8. Start chatting!

## Method 2: Using a Live Server (for quick UI testing)

If you want to test just the HTML/CSS/JS without extension APIs:

### Option A: Using Python (if available)
```bash
python3 -m http.server 8080
```
Then visit: http://localhost:8080/sidepanel.html

### Option B: Using Node.js
```bash
npx http-server . -p 8080
```
Then visit: http://localhost:8080/sidepanel.html

### Option C: Using VS Code Live Server
If you have the Live Server extension installed in VS Code:
1. Right-click on sidepanel.html
2. Select "Open with Live Server"

## ⚠️ Important Notes for Live Server Testing:
- Extension-specific APIs like `chrome.runtime.sendMessage` and `chrome.storage` won't work
- The model dropdown will fall back to hardcoded models
- Settings won't persist between reloads
- You won't be able to actually send messages to OpenRouter (missing API key handling)

For full functionality testing, Method 1 (Chrome Extension) is required.

Would you like me to:
1. Help you test it as a Chrome Extension?
2. Set up a live server for UI testing?
3. Show you how to get an OpenRouter API key?
4. Explain any specific part of the code in more detail?