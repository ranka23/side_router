# SideRouter — Cross-Platform Expansion Plan v2

> Detailed analysis of platform-specific changes required to port SideRouter
> beyond Chrome. Each section identifies exact files, functions, and APIs that
> need modification.

---

## Table of Contents

1. [Codebase Audit — Chrome-Specific Touchpoints](#1-codebase-audit)
2. [Platform: Firefox Extension](#2-firefox)
3. [Platform: Safari Extension](#3-safari)
4. [Platform: Figma Plugin](#4-figma)
5. [Platform: Notion Integration](#5-notion)
6. [Platform: WordPress Plugin](#6-wordpress)
7. [Platform: Shopify App](#7-shopify)
8. [Platform: Wix App](#8-wix)
9. [Platform: Webflow Integration](#9-webflow)
10. [Platform: Joomla Extension](#10-joomla)
11. [Platform: Ghost Integration](#11-ghost)
12. [Recommended Architecture — Platform Adapter Layer](#12-architecture)

---

## 1. Codebase Audit — Chrome-Specific Touchpoints {#1-codebase-audit}

Before diving into each platform, here is a complete map of every Chrome API
dependency in the current codebase and where it lives.

### 1.1 File: `src/lib/api.js` (51 lines)

| Line(s) | Chrome API | Purpose |
|---------|-----------|---------|
| 13 | `chrome.runtime.sendMessage()` | Send messages to background service worker |
| 14 | `chrome.runtime.lastError` | Error checking after message send |

**Impact**: This is the core communication layer. Every platform needs a
replacement for `bg()` and `bgWithRetry()`.

### 1.2 File: `src/background.js` (229 lines)

| Line(s) | Chrome API | Purpose |
|---------|-----------|---------|
| 26 | `chrome.storage.local.get()` | Load settings from persistent storage |
| 40 | `chrome.storage.local.set()` | Save settings to persistent storage |
| 108 | `chrome.runtime.onMessage.addListener()` | Listen for messages from popup/sidepanel |
| 132, 147, 174 | `chrome.tabs.query()` | Get active tab information |
| 134, 149, 181 | `chrome.scripting.executeScript()` | Execute code in page context |
| 196 | `chrome.runtime.getURL()` | Get extension-internal URLs |
| 197 | `chrome.windows.create()` | Open floating popup window |
| 212 | `chrome.action.onClicked` | Handle extension icon click |
| 214 | `chrome.sidePanel.open()` | Open side panel |
| 218 | `chrome.runtime.onInstalled` | Handle installation events |
| 220 | `chrome.sidePanel.setOptions()` | Configure side panel |
| 224 | `chrome.runtime.onStartup` | Handle browser startup |

**Impact**: This is the heaviest Chrome dependency. The entire service worker
must be reimplemented per platform.

### 1.3 File: `src/content.js` (10 lines)

| Line(s) | Chrome API | Purpose |
|---------|-----------|---------|
| 4 | `chrome.runtime.onMessage.addListener()` | Respond to ping from background |

**Impact**: Minimal file. Only used for tab detection ping. Most platforms
won't need a content script.

### 1.4 File: `src/script.js` (350+ lines)

| Line(s) | Chrome API | Purpose |
|---------|-----------|---------|
| ~bootstrap | `chrome.storage.local.get()` | Fallback API key load |
| ~bootstrap | `chrome.tabs.onActivated` | Listen for tab switches |

**Impact**: The tab switch listener is Chrome-specific. The storage fallback
is a one-liner.

### 1.5 File: `src/lib/context.js` (371 lines)

| Line(s) | Chrome API | Purpose |
|---------|-----------|---------|
| 119 | `chrome.tabs.query({})` | List all open tabs for context picker |

**Impact**: The entire "Tabs" context tab depends on Chrome's tab API.

### 1.6 File: `src/lib/settings.js` (725 lines)

| Line(s) | Chrome API | Purpose |
|---------|-----------|---------|
| Via `bgWithRetry()` | Indirect (all storage/messaging) | Settings load/save, model loading |

**Impact**: No direct Chrome API calls — all go through `api.js`. Platform
adapter in `api.js` handles this.

### 1.7 File: `manifest.json` (45 lines)

| Field | Purpose |
|-------|---------|
| `manifest_version: 3` | Chrome MV3 format |
| `permissions` | `storage`, `sidePanel`, `activeTab`, `scripting`, `tabs`, `windows` |
| `background.service_worker` | Background script registration |
| `side_panel.default_path` | Side panel HTML |
| `content_scripts` | Content script injection |
| `host_permissions` | API access permissions |

**Impact**: Entire manifest must be rewritten per platform.

### 1.8 Summary: Chrome API Dependency Matrix

| API | Files Using It | Can Be Stubbed? |
|-----|---------------|-----------------|
| `chrome.runtime.sendMessage` | api.js | Yes — platform adapter |
| `chrome.runtime.lastError` | api.js | Yes — platform adapter |
| `chrome.storage.local` | background.js, script.js | Yes — localStorage/IndexedDB/custom |
| `chrome.tabs.query` | background.js, context.js | Yes — platform-specific tab API |
| `chrome.scripting.executeScript` | background.js | Yes — content script injection |
| `chrome.windows.create` | background.js | Yes — window.open() |
| `chrome.sidePanel.*` | background.js | Yes — popup/fallback |
| `chrome.action.onClicked` | background.js | Yes — browser action |
| `chrome.runtime.onInstalled` | background.js | Yes — init event |
| `chrome.runtime.onStartup` | background.js | Yes — init event |

---

## 2. Platform: Firefox Extension {#2-firefox}

**Difficulty**: ⭐ (Easiest — near drop-in)
**Estimated Effort**: 1–2 days
**Market**: ~300M users, 2nd largest browser extension ecosystem

### 2.1 Overview

Firefox supports the WebExtension API, which is almost identical to Chrome's
Manifest V3. The main differences are namespace conventions and a few API
nuances (notably the lack of `sidePanel` API).

### 2.2 Files Requiring Changes

#### `manifest.json`

**Changes needed**:
- Add `"browser_specific_settings"` with `"gecko"` block for addon ID
- Replace `sidePanel` with `sidebar_action` (Firefox's equivalent)
- Change `background.service_worker` to `background.scripts` array (more
  reliable in Firefox MV3)
- Remove `side_panel` key entirely

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "siderouter@example.com",
      "strict_min_version": "109.0"
    }
  },
  "background": {
    "scripts": ["src/background.js"]
  },
  "sidebar_action": {
    "default_title": "SideRouter",
    "default_panel": "main.html"
  }
}
```

#### `src/background.js`

**Changes needed**:
- **Line 214**: `chrome.sidePanel.open()` → `browser.sidebarAction.open()`
- **Line 220**: `chrome.sidePanel.setOptions()` →
  `browser.sidebarAction.setPanel()`
- **All other lines**: `chrome.*` calls work as-is (Firefox aliases `browser.*`
  to `chrome.*` for WebExtension compat)

**Optional**: Migrate entire file from `chrome.*` to `browser.*` namespace for
consistency. Both work.

#### `src/lib/api.js` — No changes needed
#### `src/lib/context.js` — No changes needed
#### `src/content.js` — No changes needed
#### `src/script.js` — No changes needed

### 2.3 Testing Checklist

- [ ] Install via `about:debugging` → "Load Temporary Add-on"
- [ ] Sidebar opens on icon click
- [ ] Floating window opens and functions
- [ ] Settings persist across browser restarts
- [ ] Model dropdown populates correctly
- [ ] Tab context picker lists Firefox tabs
- [ ] Page context extraction works
- [ ] Content script ping works
- [ ] All 128 tests pass

### 2.4 Distribution

- **AMO (addons.mozilla.org)**: Free, open review process
- **Firefox Add-ons site**: Auto-listed after AMO approval

---

## 3. Platform: Safari Extension {#3-safari}

**Difficulty**: ⭐⭐ (Moderate — Safari Web Extension wrapper)
**Estimated Effort**: 1–2 weeks
**Market**: ~1B Apple device users

### 3.1 Overview

Safari supports Web Extensions via Xcode project wrappers. The JS/HTML/CSS
runs in a webview, but the backend uses Safari's `browser.*` API which has
significant gaps compared to Chrome (no `sidePanel`, no MV3 `scripting` API).

### 3.2 Files Requiring Changes

#### `manifest.json`

**Changes needed**:
- Remove `side_panel` (Safari doesn't support side panels)
- Replace with `browser_action` for toolbar popup
- Change `background.service_worker` to `background.scripts` array
- Remove or limit `content_scripts` (Safari content scripts are restricted)
- Remove `host_permissions` (Safari handles permissions via Xcode entitlements)
- Add `browser_specific_settings.safari`

```json
{
  "browser_specific_settings": {
    "safari": { "strict_min_version": "14.0" }
  },
  "browser_action": {
    "default_title": "SideRouter",
    "default_popup": "main.html"
  }
}
```

#### `src/background.js`

**Changes needed**:
- **Line 26**: `chrome.storage.local.get()` → `browser.storage.local.get()`
- **Line 40**: `chrome.storage.local.set()` → `browser.storage.local.set()`
- **Lines 132, 147, 174**: `chrome.tabs.query()` → `browser.tabs.query()`
  (works, but data structure may differ slightly)
- **Lines 134, 149, 181**: `chrome.scripting.executeScript()` → **NOT
  AVAILABLE**. Must use `browser.tabs.executeScript()` (MV2 API) or route
  through content script messaging
- **Line 196**: `chrome.runtime.getURL()` → `browser.runtime.getURL()`
  (works)
- **Lines 197-199**: `chrome.windows.create()` → `browser.windows.create()`
  (limited — no `type: 'popup'`, use `type: 'normal'`)
- **Line 212**: `chrome.action.onClicked` → `browser.browserAction.onClicked`
  (Safari still uses MV2 naming)
- **Line 214**: `chrome.sidePanel.open()` → **NOT AVAILABLE**. Use
  `browser.windows.create()` to open chat in new window
- **Line 220**: `chrome.sidePanel.setOptions()` → **NOT AVAILABLE**

#### `src/lib/api.js`

**Changes needed**: Safari's `browser.runtime.sendMessage` returns a Promise
directly (no callback pattern). Rewrite `bg()`:

```javascript
const bg = (action, data = {}) =>
  browser.runtime.sendMessage({ action, ...data });
```

The `bgWithRetry()` wrapper works as-is since it handles Promise rejections.

#### `src/lib/context.js`

**Changes needed**:
- **Line 119**: `chrome.tabs.query({})` → `browser.tabs.query({})` — works
  but tab list may be limited to current window

#### `src/content.js`

**Changes needed**: Replace `chrome.runtime.onMessage` with
`browser.runtime.onMessage`.

#### `src/script.js`

**Changes needed**:
- Replace `chrome.storage.local.get` with `browser.storage.local.get`
- Replace `chrome.tabs.onActivated` with `browser.tabs.onActivated`
- Remove or adapt floating window logic (Safari handles this differently)

### 3.3 New Files Needed

```
safari-extension/
├── SideRouter.xcodeproj/           ← Xcode project (required for Safari)
├── SideRouter Extension/
│   ├── Info.plist                   ← Extension configuration
│   ├── entitlements                 ← API permissions (storage, tabs)
│   └── Resources/                   ← Copied web assets
├── SideRouter App/
│   ├── Info.plist                   ← App configuration
│   └── Assets.xcassets/            ← App icons
└── shared/
    └── keychain-storage.js         ← Keychain integration for API key
```

### 3.4 Architecture Changes

| Chrome Feature | Safari Equivalent | Effort |
|----------------|-------------------|--------|
| Side panel | Toolbar popup or separate window | Medium |
| `scripting.executeScript` | Content script messaging + `tabs.executeScript` (MV2) | Medium |
| Side panel icon click | `browserAction.onClicked` | Easy |
| Floating window | `browser.windows.create()` (no type param) | Easy |
| API key storage | `browser.storage.local` or Keychain | Easy |
| Content script | Same, with `browser.*` namespace | Easy |

### 3.5 Testing Checklist

- [ ] Build via Xcode and run on Safari
- [ ] Toolbar icon opens popup
- [ ] Settings persist (check Keychain for API key)
- [ ] Model selection works
- [ ] Tab context limited to current page (no full tab list)
- [ ] Page content extraction works via content script fallback
- [ ] Floating window opens as separate Safari window
- [ ] Dark mode follows system theme
- [ ] Works on both Safari macOS and iOS (with limitations)

### 3.6 Distribution

- **Mac App Store**: Requires Apple Developer account ($99/year), Xcode build,
  notarization process
- **iOS App Store**: Same Apple Developer account, separate build target

---

## 4. Platform: Figma Plugin {#4-figma}

**Difficulty**: ⭐⭐⭐ (Significant — different runtime model)
**Estimated Effort**: 2–3 weeks
**Market**: ~4M designers, high-value professional audience

### 4.1 Overview

Figma plugins run in a sandboxed iframe (UI) with a separate main-thread
script (`code.ts`) that has access to the Figma document. The chat UI
translates well, but all Chrome-specific features must be replaced with
Figma Plugin API equivalents.

### 4.2 Files Requiring Changes

#### `manifest.json` → Complete rewrite

Figma uses its own manifest format:

```json
{
  "name": "SideRouter AI",
  "id": "siderouter-figma",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"]
}
```

#### `src/background.js` → `src/code.ts` (Complete rewrite)

Split into Figma's two-part architecture:
- **`code.ts`**: Main thread — accesses Figma document, stores settings
- **`ui.html`**: Sandbox iframe — the chat UI (your `main.html`)

Key replacements:
- `chrome.storage.local` → `figma.clientStorage.getAsync()` /
  `figma.clientStorage.setAsync()`
- `chrome.tabs.query` → Not available; replaced with
  `figma.currentPage.children` (list design nodes)
- `chrome.scripting.executeScript` → Not available; replaced with direct
  node property access in `code.ts`
- `chrome.windows.create` → Not available; use `figma.ui.resize()` or
  `figma.notify()`
- `chrome.sidePanel` → Not available; plugin panel is fixed-width

```typescript
// code.ts — Figma plugin main thread
figma.showUI(__html__, { width: 400, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.action === 'getSettings') {
    const settings = await figma.clientStorage.getAsync('settings');
    figma.ui.postMessage({ success: true, settings: settings || {} });
  }
  if (msg.action === 'saveSettings') {
    await figma.clientStorage.setAsync('settings', msg.settings);
    figma.ui.postMessage({ success: true });
  }
  if (msg.action === 'getDocumentContent') {
    const nodes = figma.currentPage.children.map(n => ({
      name: n.name, type: n.type
    }));
    figma.ui.postMessage({ success: true, content: nodes });
  }
};
```

#### `src/lib/api.js` (Complete rewrite)

Replace `chrome.runtime.sendMessage` with Figma's message passing:

```javascript
const bg = (action, data = {}) => {
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data?.success !== undefined) {
        window.removeEventListener('message', handler);
        resolve(event.data);
      }
    };
    window.addEventListener('message', handler);
    parent.postMessage({ action, ...data }, '*');
  });
};
```

#### `src/lib/context.js` (Major changes)

| Line(s) | Current | Figma Replacement |
|---------|---------|-------------------|
| 60-111 | `loadPagePreview()` — page content | `loadNodePreview()` — selected Figma nodes |
| 114-169 | `loadTabsList()` — Chrome tabs | `loadPagesList()` — Figma pages/layers |
| 119 | `chrome.tabs.query({})` | `figma.currentPage.children` (via code.ts) |

The context model changes:
- **Page context** → Selected Figma nodes (text, frames, components)
- **Tab context** → Figma pages or component libraries
- **File context** → Same (local file upload works in iframe)

#### `src/content.js` — Delete (not applicable)

#### `src/script.js`

- Remove `chrome.tabs.onActivated` listener
- Replace `chrome.storage.local.get` fallback with Figma message passing
- Remove floating window logic (not available in Figma)

#### `src/styles.css`

- Add Figma plugin-specific overrides (iframe bounds, Figma font stack)
- Remove body margin/padding resets that conflict with Figma's iframe

### 4.3 New Files Needed

```
figma-plugin/
├── manifest.json                   ← Figma plugin manifest
├── src/
│   ├── code.ts                     ← Plugin main thread (new)
│   └── ui.html                     ← Chat UI (adapted from main.html)
├── package.json                    ← Build config (esbuild)
└── tsconfig.json
```

### 4.4 Features That Don't Translate

| Chrome Feature | Figma Equivalent | Status |
|----------------|------------------|--------|
| Side panel | Plugin panel (fixed width) | ✅ Available |
| Floating window | Not available | ❌ Drop |
| Tab context | Page/layer browser | ✅ Adapt |
| Page content | Selected node inspector | ✅ Adapt |
| Execute JS on tab | Direct node property access | ✅ Replace |
| Content script | Not applicable | ❌ Drop |
| Chrome storage | `figma.clientStorage` | ✅ Replace |
| Dark mode | Follows Figma theme | ✅ Auto |

### 4.5 Testing Checklist

- [ ] Plugin loads in Figma desktop and web
- [ ] API key saves/loads from `clientStorage`
- [ ] Model selection works
- [ ] Chat messages send and receive
- [ ] Context picker shows Figma pages/layers
- [ ] Selected node context attaches correctly
- [ ] Markdown renders in plugin UI
- [ ] Plugin survives Figma undo/redo cycles

### 4.6 Distribution

- **Figma Community**: Free listing, open submission
- **Figma Organization**: Can be published as private plugin

---

## 5. Platform: Notion Integration {#5-notion}

**Difficulty**: ⭐⭐⭐ (Moderate — widget/embed model)
**Estimated Effort**: 2–3 weeks
**Market**: 30M+ users, productivity-focused audience

### 5.1 Overview

Notion supports two integration paths:
1. **Notion Widget** — iframe embed in any Notion page (simplest)
2. **Notion Chrome Extension** — enhances Notion's web interface (our
   existing Chrome extension targeting `notion.so`)

### 5.2 Option A: Notion Widget (Embed)

#### New Files Needed

```
notion-widget/
├── index.html                     ← Standalone chat widget
├── src/
│   ├── widget.js                  ← Widget entry point
│   ├── api.js                     ← Adapted API layer
│   └── storage.js                 ← localStorage-based storage
└── embed.js                       ← Embeddable script tag
```

#### Changes Required

**`src/lib/api.js`**:
- Replace `chrome.runtime.sendMessage` with direct `fetch()` to a backend
  proxy, or use `localStorage` for settings and direct OpenRouter API calls
- The widget runs in an iframe, so no Chrome APIs are available

**`src/background.js`**:
- Replace entirely with a lightweight Node.js/Cloudflare Workers backend
  that proxies OpenRouter API calls (avoids CORS, protects API key)
- Or: embed the API key in the widget config (less secure)

**`src/lib/context.js`**:
- Remove tab/page context entirely (widget is sandboxed)
- Keep file context (works in iframe)

**`src/lib/settings.js`**:
- Replace `bgWithRetry("getSettings")` with `localStorage.getItem()`
- Replace `bgWithRetry("saveSettings")` with `localStorage.setItem()`
- Replace `bgWithRetry("getModels")` with direct `fetch()` to OpenRouter API

**`src/script.js`**:
- Remove all Chrome API calls
- Remove tab switch listeners
- Remove floating window logic
- Simplify bootstrap to load from `localStorage`

**`main.html`**:
- Add embed mode styling (compact, iframe-friendly)
- Adjust viewport meta for iframe embedding

### 5.3 Notion Embed Integration

Users embed via:
```
/embed → paste widget URL
```

Or via Notion's "Embed" block with the widget URL.

### 5.4 Features That Don't Translate

| Chrome Feature | Notion Widget Equivalent | Status |
|----------------|--------------------------|--------|
| Side panel | Embedded in Notion page | ✅ Adapt |
| Floating window | Not available | ❌ Drop |
| Tab context | Not available | ❌ Drop |
| Page context | Notion page content via API | ✅ Adapt (Notion API) |
| Execute JS on tab | Not applicable | ❌ Drop |
| Content script | Not applicable | ❌ Drop |
| Chrome storage | localStorage | ✅ Replace |

### 5.5 Option B: Notion Chrome Extension (Existing Extension)

The current Chrome extension already works with Notion — it can read Notion
pages as context, extract headings, etc. No changes needed for basic Notion
page reading.

Enhancement: Add Notion API integration to read structured page content
(blocks, databases) via `https://api.notion.com/v1/`.

### 5.6 Testing Checklist

- [ ] Widget loads in Notion page embed
- [ ] API key saves to localStorage
- [ ] Model selection works in embedded mode
- [ ] Chat messages send and receive
- [ ] File context works in iframe
- [ ] Widget resizes properly in Notion embed
- [ ] Dark mode syncs with Notion theme
- [ ] Widget works in Notion desktop app (Electron-based)

### 5.7 Distribution

- **Notion Marketplace**: Submit as public integration
- **Notion Template Gallery**: Include as template with widget pre-embedded
- **Gumroad/LemonSqueezy**: Sell as embeddable widget code

---

## 6. Platform: WordPress Plugin {#6-wordpress}

**Difficulty**: ⭐⭐ (Moderate — well-documented plugin architecture)
**Estimated Effort**: 1–2 weeks
**Market**: 43% of all websites (~400M sites)

### 6.1 Overview

WordPress plugins use PHP for server-side logic and enqueue JS/CSS for the
frontend. The chat UI loads as a shortcode block or sidebar widget.

### 6.2 Files Requiring Changes

#### New Files Needed

```
wordpress-plugin/
├── siderouter.php                  ← Main plugin file (PHP)
├── includes/
│   ├── class-api.php               ← REST API proxy endpoints
│   ├── class-settings.php          ← Settings page in WP admin
│   └── class-widget.php            ← Sidebar widget registration
├── assets/
│   ├── js/
│   │   ├── siderouter-main.js      ← Adapted main.html logic
│   │   └── siderouter-api.js       ← Adapted api.js
│   └── css/
│       └── siderouter.css          ← Your existing styles.css
├── templates/
│   └── chat-widget.php             ← Widget HTML template
└── readme.txt                      ← WordPress.org format
```

#### `src/lib/api.js` → `siderouter-api.js`

**Complete rewrite**. Replace Chrome messaging with WordPress REST API:

```javascript
// WordPress REST API adapter
const bg = async (action, data = {}) => {
  const res = await fetch(siderouterSettings.apiUrl + '?action=' + action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': siderouterSettings.nonce
    },
    body: JSON.stringify(data)
  });
  return res.json();
};
```

#### `src/background.js` → `includes/class-api.php`

**Complete rewrite in PHP**. The background script's functions become
WordPress REST API endpoints:

```php
// REST API route registration
add_action('rest_api_init', function() {
  register_rest_route('siderouter/v1', '/action', [
    'methods' => 'POST',
    'callback' => 'siderouter_handle_action',
    'permission_callback' => function() {
      return current_user_can('edit_posts');
    }
  ]);
});

function siderouter_handle_action($request) {
  $action = $request->get_param('action');
  switch ($action) {
    case 'getSettings':
      $settings = get_option('siderouter_settings', []);
      return rest_ensure_response(['success' => true, 'settings' => $settings]);
    case 'saveSettings':
      update_option('siderouter_settings', $request->get_param('settings'));
      return rest_ensure_response(['success' => true]);
    case 'getModels':
      // Proxy to OpenRouter API
      $response = wp_remote_get('https://openrouter.ai/api/v1/models');
      // ... process and cache
      return rest_ensure_response(['success' => true, 'models' => $models]);
    case 'validateKey':
      // Validate against OpenRouter API
      // ...
  }
}
```

#### `src/lib/settings.js`

- All `bgWithRetry()` calls work as-is (they go through the adapted `api.js`)
- **No direct changes needed** if `api.js` is properly adapted

#### `src/lib/context.js`

**Changes needed**:
- **Line 119**: `chrome.tabs.query({})` → **Remove tab context** (not
  applicable in WordPress)
- **Lines 60-111**: `loadPagePreview()` → Replace with current WordPress
  page/post content via `siderouterSettings.currentPage` (passed from PHP)
- Keep file context (works in browser)

#### `src/script.js`

**Changes needed**:
- Remove `chrome.storage.local.get` fallback
- Remove `chrome.tabs.onActivated` listener
- Remove floating window logic
- Add WordPress-specific initialization (check `siderouterSettings` global)

#### `main.html` → `templates/chat-widget.php`

**Changes needed**:
- Wrap in PHP template with WordPress-specific header/footer
- Add `wp_localize_script` data injection for settings, nonce, API URL
- Adjust widget container to fit WordPress theme

#### `manifest.json` — Delete (not needed for WordPress)

### 6.3 WordPress Admin Settings Page

```php
// Settings page under Settings → SideRouter
function siderouter_settings_page() {
  add_options_page(
    'SideRouter Settings',
    'SideRouter',
    'manage_options',
    'siderouter',
    'siderouter_render_settings'
  );
}
```

Settings include:
- API Key (encrypted with `wp_salt()`)
- Default model selection
- Widget position (inline, floating, sidebar)
- Allowed user roles

### 6.4 Features That Don't Translate

| Chrome Feature | WordPress Equivalent | Status |
|----------------|---------------------|--------|
| Side panel | Sidebar widget / inline block | ✅ Adapt |
| Floating window | WP Admin toolbar widget | ✅ Adapt |
| Tab context | Not available | ❌ Drop |
| Page context | Current WP page/post content | ✅ Replace |
| Execute JS on tab | Not applicable | ❌ Drop |
| Content script | Not applicable | ❌ Drop |
| Chrome storage | `wp_options` table | ✅ Replace |

### 6.5 Testing Checklist

- [ ] Plugin activates without errors
- [ ] Settings page renders in WP Admin
- [ ] API key saves encrypted in `wp_options`
- [ ] Chat widget renders via shortcode `[siderouter]`
- [ ] Chat widget renders as sidebar widget
- [ ] Chat widget renders as Gutenberg block
- [ ] Model selection works
- [ ] Chat messages send and receive
- [ ] Current page context attaches correctly
- [ ] File upload context works
- [ ] Widget styling doesn't break theme
- [ ] Works with popular themes (Astra, GeneratePress, Kadence)
- [ ] Works with WooCommerce (no conflicts)

### 6.6 Distribution

- **WordPress.org Plugin Directory**: Free, open review
- **CodeCanyon**: Paid plugin ($25-50)
- **Freemius**: Premium plugin licensing

---

## 7. Platform: Shopify App {#7-shopify}

**Difficulty**: ⭐⭐ (Moderate — Shopify's app framework is well-structured)
**Estimated Effort**: 1–2 weeks
**Market**: 4.8M+ stores, strong app marketplace revenue

### 7.1 Overview

Shopify apps run as embedded iframes within the Shopify admin. The chat UI
renders inside the admin panel, and backend logic runs on your server
(Node.js/PHP/Ruby).

### 7.2 Files Requiring Changes

#### New Files Needed

```
shopify-app/
├── package.json                    ← Node.js dependencies
├── server.js                       ← Express server + Shopify auth
├── routes/
│   ├── api.js                      ← REST endpoints (replaces background.js)
│   └── auth.js                     ← OAuth flow
├── public/
│   ├── index.html                  ← Chat UI (adapted from main.html)
│   ├── js/
│   │   ├── siderouter-main.js      ← Adapted script.js
│   │   └── siderouter-api.js       ← Adapted api.js
│   └── css/
│       └── siderouter.css
├── shopify/
│   ├── shopify.app.toml            ← App configuration
│   └── extensions/                 ← Shopify CLI extensions
└── prisma/
    └── schema.prisma               ← Database schema
```

#### `src/lib/api.js` → `siderouter-api.js`

**Complete rewrite**. Replace Chrome messaging with HTTP REST calls:

```javascript
const bg = async (action, data = {}) => {
  const res = await fetch('/api/' + action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + sessionStorage.getItem('shopify_token')
    },
    body: JSON.stringify(data)
  });
  return res.json();
};
```

#### `src/background.js` → `server.js`

**Complete rewrite in Node.js**. Express server handles:
- Shopify OAuth (install/uninstall webhooks)
- Settings storage in database (SQLite/PostgreSQL)
- OpenRouter API proxy
- Model caching

#### `src/lib/context.js`

**Changes needed**:
- Remove tab context entirely
- Replace page context with Shopify product/order/customer data via
  Admin API (`https://{store}.myshopify.com/admin/api/2024-01/`)
- Keep file context

#### `src/script.js`

**Changes needed**:
- Remove all Chrome API calls
- Initialize with Shopify App Bridge (`@shopify/app-bridge`)
- Use Shopify's session token for authentication

#### `main.html` → `public/index.html`

**Changes needed**:
- Add Shopify App Bridge SDK
- Wrap in Shopify admin iframe container
- Adjust for Shopify's admin styling

### 7.3 Shopify-Specific Features

- **Product Context**: AI can see current product being edited
- **Order Context**: AI can analyze recent orders
- **Customer Context**: AI can help with customer service
- **Theme Editor**: AI assists with Liquid template editing

### 7.4 Testing Checklist

- [ ] App installs via Shopify CLI
- [ ] OAuth flow completes
- [ ] Settings save to database
- [ ] Chat renders in Shopify admin
- [ ] Model selection works
- [ ] Chat messages send and receive
- [ ] Product context attaches correctly
- [ ] Works in Shopify mobile admin

### 7.5 Distribution

- **Shopify App Store**: Requires Shopify Partner account, app review

---

## 8. Platform: Wix App {#8-wix}

**Difficulty**: ⭐⭐ (Moderate — Velo has good documentation)
**Estimated Effort**: 1–2 weeks
**Market**: 200M+ users, growing business platform

### 8.1 Overview

Wix apps use Velo (Wix's dev platform) with server-side and client-side
components. The chat widget can be embedded as a custom element.

### 8.2 Files Requiring Changes

#### New Files Needed

```
wix-app/
├── src/
│   ├── pages/
│   │   └── chat-widget/
│   │       ├── chat-widget.js      ← Client-side code
│   │       └── chat-widget.html    ← Widget page
│   └── backend/
│       └── api.web.js              ← Backend code (wix-fetch)
├── wix.config
└── package.json
```

#### `src/lib/api.js` → Client-side adapter

```javascript
// Wix Velo client-side
import wixWindow from 'wix-window';
import wixFetch from 'wix-fetch';

const bg = async (action, data = {}) => {
  const res = await wixFetch.fetch('/api/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};
```

#### `src/background.js` → `backend/api.web.js`

```javascript
// Wix backend
import wixStorage from 'wix-storage';
import { fetch } from 'wix-fetch';

export async function getSettings() {
  const settings = await wixStorage.get('siderouter_settings');
  return { success: true, settings: JSON.parse(settings || '{}') };
}
```

#### `src/lib/context.js`

**Changes needed**:
- Remove tab context
- Remove page context (Wix doesn't expose page content via API)
- Keep file context
- Add Wix-specific context (current page info via `wixWindow`)

#### `src/script.js`

**Changes needed**:
- Remove all Chrome API calls
- Initialize with Velo's `wixWindow` for page info
- Use Velo's storage API for persistence

### 8.3 Testing Checklist

- [ ] App installs in Wix dashboard
- [ ] Settings save via Velo storage
- [ ] Chat widget renders on Wix site
- [ ] Model selection works
- [ ] Chat messages send and receive
- [ ] Widget styling fits Wix theme

### 8.4 Distribution

- **Wix App Market**: Submit via Wix Partners program

---

## 9. Platform: Webflow Integration {#9-webflow}

**Difficulty**: ⭐ (Easiest CMS integration — pure embed)
**Estimated Effort**: 3–5 days
**Market**: Growing designer/developer market

### 9.1 Overview

Webflow supports custom HTML/JS embeds via the "Embed" element or Code
Injection. The chat widget loads as a script tag.

### 9.2 Files Requiring Changes

#### New Files Needed

```
webflow-embed/
├── index.html                     ← Widget page (hosted)
├── embed-code.html                ← Copy-paste snippet for users
├── src/
│   ├── widget.js                  ← Standalone widget entry
│   ├── api.js                     ← Direct fetch (no Chrome APIs)
│   └── storage.js                 ← localStorage wrapper
└── README.md                      ← Setup instructions
```

#### `src/lib/api.js` → Direct fetch

```javascript
// Webflow: direct API calls, no background script
const STORAGE_KEY = 'siderouter_';

const bg = async (action, data = {}) => {
  switch (action) {
    case 'getSettings':
      const raw = localStorage.getItem(STORAGE_KEY + 'settings');
      return { success: true, settings: JSON.parse(raw || '{}') };
    case 'saveSettings':
      localStorage.setItem(STORAGE_KEY + 'settings', JSON.stringify(data.settings));
      return { success: true };
    case 'getModels':
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const json = await res.json();
      // Process models...
      return { success: true, models: processed };
    case 'validateKey':
      // Direct validation
      const vRes = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': 'Bearer ' + data.key }
      });
      return { valid: vRes.ok };
  }
};
```

#### `src/lib/context.js`

**Changes needed**:
- Remove tab context
- Simplify page context to basic `document.title` and `location.href`
- Keep file context

#### `src/script.js`

**Changes needed**:
- Remove all Chrome API calls
- Simplify bootstrap to localStorage-based init

#### Embed Code for Users

```html
<!-- SideRouter AI Chat Widget -->
<div id="siderouter-widget"></div>
<script src="https://your-cdn.com/siderouter-widget.js"></script>
<script>
  SideRouter.init({
    container: '#siderouter-widget',
    position: 'bottom-right',  // or 'inline'
    apiKey: 'optional-preconfigured-key'
  });
</script>
```

### 9.3 Testing Checklist

- [ ] Widget loads via embed code
- [ ] API key saves to localStorage
- [ ] Chat functions correctly
- [ ] Widget positioning works (floating, inline)
- [ ] Responsive on mobile
- [ ] No conflicts with Webflow's built-in JS

### 9.4 Distribution

- **Webflow Marketplace**: Submit as certified app
- **Direct embed**: Users copy-paste code
- **Webflow template bundle**: Include in premium templates

---

## 10. Platform: Joomla Extension {#10-joomla}

**Difficulty**: ⭐⭐ (Moderate — similar to WordPress)
**Estimated Effort**: 1 week
**Market**: ~2M sites, strong in enterprise/government

### 10.1 Overview

Joomla extensions use a module/component/plugin architecture. The chat widget
registers as a module that can be placed in any module position.

### 10.2 Files Requiring Changes

#### New Files Needed

```
joomla-extension/
├── mod_siderouter.php              ← Module entry point
├── helper.php                      ← Module helper class
├── tmpl/
│   └── default.php                 ← Module template (HTML)
├── src/
│   ├── api.php                     ← API proxy (replaces background.js)
│   ├── siderouter.js               ← Adapted main logic
│   └── siderouter.css              ← Styles
└── mod_siderouter.xml              ← Module manifest
```

#### `src/background.js` → `src/api.php`

```php
<?php
// Joomla module helper
class ModSideRouterHelper {
  public static function getSettings() {
    $params = JComponentHelper::getParams('com_siderouter');
    return $params->toArray();
  }
  
  public static function saveSettings($settings) {
    $db = JFactory::getDbo();
    // Save to #__extensions params
  }
  
  public static function proxyApi($endpoint, $apiKey) {
    $ch = curl_init('https://openrouter.ai/api/v1/' . $endpoint);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
      'Authorization: Bearer ' . $apiKey
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
  }
}
```

#### `src/lib/api.js` → Joomla adapter

```javascript
// Joomla REST API adapter
const bg = async (action, data = {}) => {
  const baseUrl = Joomla.getOptions('system').baseurl;
  const res = await fetch(baseUrl + '/index.php?option=com_siderouter&task=api&action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};
```

#### `src/lib/context.js`

- Remove tab context
- Replace page context with Joomla article content via
  `JFactory::getApplication()->input`
- Keep file context

### 10.3 Testing Checklist

- [ ] Module installs via Joomla Extension Manager
- [ ] Module publishes in template position
- [ ] Settings save to Joomla database
- [ ] Chat renders correctly
- [ ] Model selection works
- [ ] Article context attaches correctly
- [ ] Works with popular Joomla templates (Helix, Gantry)

### 10.4 Distribution

- **Joomla Extensions Directory (JED)**: Free/paid listing
- **Direct download**: From your website

---

## 11. Platform: Ghost Integration {#11-ghost}

**Difficulty**: ⭐ (Simplest — code injection only)
**Estimated Effort**: 3–5 days
**Market**: Creator economy, newsletter publishers

### 11.1 Overview

Ghost supports code injection (header/footer) and custom integrations via
its API. The chat widget loads as a script tag injected into the Ghost site.

### 11.2 Files Requiring Changes

#### New Files Needed

```
ghost-widget/
├── index.html                     ← Widget page (hosted externally)
├── embed.js                       ← Embeddable script
├── src/
│   ├── widget.js                  ← Standalone entry point
│   ├── api.js                     ← Direct fetch adapter
│   └── storage.js                 ← localStorage wrapper
└── ghost-integration.md           ← Setup instructions
```

#### `src/lib/api.js` → Direct fetch

Same as Webflow — replace Chrome messaging with direct localStorage + fetch.

#### `src/lib/context.js`

**Changes needed**:
- Remove tab context
- Replace page context with Ghost post content via
  `document.querySelector('.post-content')?.innerText`
- Keep file context

#### `src/script.js`

- Remove all Chrome API calls
- Simplify to localStorage-based init

### 11.3 Ghost-Specific Features

- **Post context**: AI can read the current Ghost post content
- **Member context**: If Ghost Members is enabled, AI knows the current member
- **Newsletter context**: AI can help draft newsletters

### 11.4 Embed Code for Ghost

```html
<!-- Code Injection → Footer -->
<div id="siderouter-widget"></div>
<script src="https://your-cdn.com/siderouter-widget.js"></script>
<script>
  SideRouter.init({
    container: '#siderouter-widget',
    position: 'bottom-right'
  });
</script>
```

### 11.5 Testing Checklist

- [ ] Widget loads via code injection
- [ ] API key saves to localStorage
- [ ] Chat renders correctly
- [ ] Post content attaches as context
- [ ] Works in Ghost admin preview
- [ ] Dark mode follows Ghost theme
- [ ] Widget doesn't interfere with Ghost Members

### 11.6 Distribution

- **Ghost Marketplace**: Submit as integration
- **Gumroad/LemonSqueezy**: Sell as embeddable widget
- **Ghost tutorial/blog**: Content marketing

---

## 12. Recommended Architecture — Platform Adapter Layer {#12-architecture}

### 12.1 The Problem

Every platform needs the same core functionality (chat, UI, settings) but
different implementations for storage, messaging, and platform features.

### 12.2 Solution: Abstract Platform Interface

Create a `src/lib/platform/` directory with a common interface:

```
src/lib/platform/
├── interface.js          ← Platform interface definition
├── chrome.js             ← Chrome Extension (current implementation)
├── firefox.js            ← Firefox (mostly same as Chrome)
├── safari.js             ← Safari (browser.* namespace)
├── web.js                ← Standalone web (localStorage + fetch)
├── wordpress.js          ← WordPress (REST API)
├── shopify.js            ← Shopify (App Bridge)
├── figma.js              ← Figma (postMessage)
└── notion.js             ← Notion (widget)
```

### 12.3 Platform Interface

```javascript
// interface.js — Abstract platform interface
const PlatformInterface = {
  /** Load settings from platform storage */
  async loadSettings() { throw new Error('Not implemented'); },
  
  /** Save settings to platform storage */
  async saveSettings(settings) { throw new Error('Not implemented'); },
  
  /** Fetch available models (with caching) */
  async fetchModels() { throw new Error('Not implemented'); },
  
  /** Validate API key against OpenRouter */
  async validateApiKey(key) { throw new Error('Not implemented'); },
  
  /** Get current page/tab content for context */
  async getPageContent() { throw new Error('Not implemented'); },
  
  /** List available tabs/pages for context */
  async listTabs() { return []; },
  
  /** Execute code on the current page (if supported) */
  async executeOnTab(code) { throw new Error('Not supported on this platform'); },
  
  /** Open a floating window (if supported) */
  async openFloatingWindow() { throw new Error('Not supported on this platform'); },
  
  /** Show a platform-native notification */
  async showNotification(message) { console.log(message); },
  
  /** Get the platform name */
  getName() { return 'unknown'; },
  
  /** Check if a feature is supported */
  supports(feature) { return false; }
};
```

### 12.4 Chrome Implementation

```javascript
// chrome.js
const ChromePlatform = {
  ...PlatformInterface,
  getName() { return 'chrome'; },
  
  supports(feature) {
    const supported = ['tabs', 'floating', 'execute', 'sidePanel', 'contentScript'];
    return supported.includes(feature);
  },
  
  async loadSettings() {
    const data = await chrome.storage.local.get(Object.keys(defaults));
    return data;
  },
  
  async saveSettings(settings) {
    await chrome.storage.local.set(settings);
  },
  
  async fetchModels() {
    // ... current fetchModels() implementation
  },
  
  async getPageContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ title: document.title, text: document.body.innerText.slice(0, 8000) })
    });
    return results[0]?.result;
  }
};
```

### 12.5 Integration Pattern

```javascript
// In api.js — detect platform and load appropriate adapter
let platform;

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  platform = ChromePlatform;
} else if (typeof browser !== 'undefined' && browser.runtime) {
  platform = SafariPlatform;
} else {
  platform = WebPlatform;
}

// Use platform adapter throughout the codebase
const bg = (action, data = {}) => platform[action](data);
```

### 12.6 Migration Strategy

**Phase 1**: Create `platform/interface.js` and `platform/chrome.js`
(extract current implementation). All existing code continues to work.

**Phase 2**: Create `platform/firefox.js` (mostly same as Chrome with minor
namespace changes).

**Phase 3**: Create `platform/web.js` for standalone web/widget deployments
(WordPress, Webflow, Ghost, Notion).

**Phase 4**: Create platform-specific adapters for Figma, Shopify, Wix, etc.

### 12.7 File Changes Summary by Platform

| File | Chrome | Firefox | Safari | Figma | WordPress | Shopify | Webflow | Joomla | Ghost |
|------|--------|---------|--------|-------|-----------|---------|---------|--------|-------|
| `api.js` | — | — | Rewrite | Rewrite | Rewrite | Rewrite | Rewrite | Rewrite | Rewrite |
| `background.js` | — | 2 lines | Rewrite | Rewrite | → PHP | → Node | Delete | → PHP | Delete |
| `content.js` | — | — | 1 line | Delete | Delete | Delete | Delete | Delete | Delete |
| `script.js` | — | — | 5 lines | Major | Major | Major | Major | Major | Major |
| `context.js` | — | — | 1 line | Major | Major | Major | Minor | Minor | Minor |
| `settings.js` | — | — | — | — | — | — | — | — | — |
| `ui.js` | — | — | — | — | — | — | — | — | — |
| `chat.js` | — | — | — | — | — | — | — | — | — |
| `markdown.js` | — | — | — | — | — | — | — | — | — |
| `styles.css` | — | — | Minor | Minor | Minor | Minor | — | Minor | — |
| `manifest.json` | — | Rewrite | Rewrite | Rewrite | Delete | Delete | Delete | Delete | Delete |

**Legend**: `—` = No changes, `Minor` = Small tweaks, `Major` = Significant
rework, `Rewrite` = Complete replacement, `Delete` = Not needed

---

## Appendix: Priority Matrix

| Platform | Effort | Market Size | Revenue | Priority |
|----------|--------|-------------|---------|----------|
| Firefox | 1-2 days | 300M users | Free | **P0 — Ship immediately** |
| Webflow | 3-5 days | Growing | Medium | **P1 — Quick win** |
| Ghost | 3-5 days | Creator economy | Low-Medium | **P1 — Quick win** |
| WordPress | 1-2 weeks | 400M sites | High | **P0 — Highest ROI** |
| Shopify | 1-2 weeks | 4.8M stores | High | **P1 — Strong revenue** |
| Safari | 1-2 weeks | 1B devices | Free | **P2 — Platform coverage** |
| Wix | 1-2 weeks | 200M users | Medium | **P2 — Platform coverage** |
| Joomla | 1 week | 2M sites | Low-Medium | **P3 — Niche** |
| Notion | 2-3 weeks | 30M users | Medium | **P2 — Productivity niche** |
| Figma | 2-3 weeks | 4M designers | Medium | **P3 — Design niche** |