# Chrome Web Store — Dashboard Step-by-Step Guide

This guide walks through every field in the Chrome Web Store Developer Dashboard. Copy-paste the exact text from the appropriate section in `store-assets/chrome-listing.md`.

---

## Pre-Required Setup

### 1. Developer Account
Go to https://chrome.google.com/webstore/devconsole and sign in with your Google account.
Pay the **$5 one-time registration fee**.

### 2. Contact Email
- Navigate to **Settings** in the Developer Dashboard
- Enter your contact email address
- Click the verification link sent to your email
- Wait for verification to complete (usually instant)

---

## Publishing Your Item

### Step 1: Create New Item
- Click **"Add a new item"** or **"New Item"**
- Upload `dist/chrome.zip`

### Step 2: Item Description Tab

**Name:**
```
SideRouter
```

**Short description:**
```
AI chat sidebar powered by OpenRouter. Chat with free and paid models, add page context, and manage conversations.
```

**Detailed description:**
Copy from `store-assets/chrome-listing.md` under "## Detailed Description" — paste the FULL text (this will be reviewed and must be at least 25 characters).

**Language:**
Select **English** from the dropdown.

**Category:**
Select **Productivity** from the dropdown.

---

### Step 3: Screenshots Tab

Upload at least **1 screenshot** from the `screenshots/` folder. Recommended order:

1. `screenshots/chat-screen.jpg` (main screenshot)
2. `screenshots/welcome-screen.jpg`
3. `screenshots/settings-screen.jpg`
4. `screenshots/models-dropdown.jpg`
5. `screenshots/add-context-chat-screen.jpg`

**Important:** Screenshots must be **1280×800** or **640×400** pixels.

---

### Step 4: Icon

Upload `media/icon128.png` as the extension icon. The icon will appear in the Chrome Web Store and in the browser toolbar.

---

### Step 5: Privacy Policy Tab

Enter the URL of your hosted privacy policy. 

**To host the privacy policy:**
1. Enable GitHub Pages on your repo (Settings → Pages → Source: `main` branch)
2. The URL will be: `https://ranka23.github.io/side-router/privacy-policy.html`
3. Paste this URL in the "Privacy policy URL" field

---

### Step 6: Privacy Practices Tab

This is where you must enter justifications for all permissions and remote code usage.

#### Permission Justifications

Copy-paste each justification exactly as written in `store-assets/chrome-listing.md` under "## Permission Justifications". Each justification must be entered in the corresponding field.

**activeTab:**
```
Required to read the current tab's content when the user explicitly adds it as AI context via the @ context picker. The extension reads page content only when the user clicks "Add Page Context" — it does not read page content automatically. The content is sent to OpenRouter.ai as context for the AI model, and is not stored or transmitted to any other server.
```

**host_permissions:**
```
Required to: 1) Communicate with the OpenRouter API (https://openrouter.ai/api/v1/) for model listing, API key validation, and chat completions — this is the core functionality of the extension. 2) Read web page content on any page when the user explicitly adds it as context (activeTab + host permissions combo). 3) Execute approved JavaScript on any page when the user approves AI-initiated code execution requests (scripting + host permissions combo). The extension does not access or modify any web content without explicit user action.
```

**scripting:**
```
Required to execute JavaScript on the current page when the user approves AI-initiated code execution requests. The user must explicitly approve each execution request through a permission dialog (unless "Auto-approve" is enabled in settings). The extension blocks potentially dangerous patterns (such as document.cookie, localStorage, sessionStorage, eval, Function, fetch, XMLHttpRequest) to prevent security issues. The scripting API is used only for the AI's code execution feature, not for any other purpose.
```

**sidePanel:**
```
Required to provide the sidebar chat experience in Chrome. The extension uses Chrome's sidePanel API to display the chat interface in a browser side panel, which is the primary user interface of the extension.
```

**storage:**
```
Required to persist user settings (API key, theme, model selection, zoom level, auto-approve preference, agent name, save history preference, caveman compression preference, default model) and chat history across browser sessions. All data is stored locally in the browser's extension storage. No data is sent to external servers or the extension developer. Users can delete all data by clearing the extension's storage in settings or by uninstalling the extension.
```

**tabs:**
```
Required to list open browser tabs so users can select them as AI context. This is used only when the user opens the context picker and selects the "Tabs" tab to add tabs as context for the AI. The extension does not access or modify any tab content without explicit user action.
```

#### Remote Code Justification

```
The extension fetches remote code from the OpenRouter API (https://openrouter.ai/api/v1/) to: 1) Retrieve available AI models (model list endpoint). 2) Validate API keys (auth endpoint). 3) Send chat messages and receive AI responses (chat completions endpoint). No remote code is injected into web pages. All remote communication uses standard fetch() calls to the OpenRouter API, and requests are only made when the user explicitly sends a message or validates their API key. The extension does NOT use any remote code from sources other than the OpenRouter API.
```

#### Data Collection
- Does this extension collect personal data: **No**
- Does this extension collect browsing activity: **Only when user explicitly adds page context**
- Does this extension transmit data to third parties: **Yes, to OpenRouter.ai**
- Does this extension use data for purposes unrelated to its functionality: **No**
- Is the data use disclosed in a privacy policy: **Yes**
- Privacy policy URL: `https://ranka23.github.io/side-router/privacy-policy.html`

#### Certification
Check **all the boxes** to certify that your data usage complies with the Chrome Web Store developer programme policies.

#### Single Purpose Declaration

```
SideRouter provides an AI chat interface in the browser sidebar, powered by the OpenRouter API. It enables users to chat with AI language models, optionally attach page context and file context, and receive AI-generated responses.
```

---

### Step 7: Submit for Review

After filling all fields, click **"Submit for Review"**.

**Review process:** Typically 1-3 business days. You will receive an email notification when the review is complete.

**Common review issues:**
- If review fails, check the email for specific feedback
- If permissions are questioned, ensure justifications are clear and specific
- If screenshots are missing, ensure at least 1 screenshot is uploaded

---

## Verification Checklist

Before submitting, verify all these are complete:

- [ ] Contact email provided AND verified in Settings
- [ ] Language selected: English
- [ ] Category selected: Productivity
- [ ] Icon image uploaded (128×128)
- [ ] At least 1 screenshot uploaded (1280×800 or 640×400)
- [ ] Privacy policy URL entered
- [ ] All 6 permission justifications entered (activeTab, host_permissions, scripting, sidePanel, storage, tabs)
- [ ] Remote code justification entered
- [ ] Data usage certification checkboxes checked
- [ ] Single purpose declaration entered
- [ ] Detailed description filled (minimum 25 characters)
- [ ] Short description filled