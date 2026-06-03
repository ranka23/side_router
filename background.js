// background.js - Service Worker for OpenRouter AI Chat Extension

// Extension ID for messaging
const EXTENSION_ID = chrome.runtime.id;

// Store settings that can be shared with content scripts
let extensionSettings = {
    apiKey: null,
    selectedModel: "meta-llama/llama-3-8b-instruct:free",
    isDarkTheme: false,
    saveHistory: true,
    autoScroll: true
};

// Load settings from storage on startup
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get([
            'openrouterApiKey',
            'openrouterSelectedModel',
            'openrouterIsDarkTheme',
            'openrouterSaveHistory',
            'openrouterAutoScroll'
        ]);
        
        extensionSettings.apiKey = result.openrouterApiKey || null;
        extensionSettings.selectedModel = result.openrouterSelectedModel || "meta-llama/llama-3-8b-instruct:free";
        extensionSettings.isDarkTheme = result.openrouterIsDarkTheme || false;
        extensionSettings.saveHistory = result.openrouterSaveHistory !== undefined ? result.openrouterSaveHistory : true;
        extensionSettings.autoScroll = result.openrouterAutoScroll !== undefined ? result.openrouterAutoScroll : true;
    } catch (error) {
        console.error('Failed to load settings in background:', error);
    }
}

// Save settings to storage
async function saveSettings(updates) {
    try {
        Object.assign(extensionSettings, updates);
        await chrome.storage.local.set({
            openrouterApiKey: extensionSettings.apiKey,
            openrouterSelectedModel: extensionSettings.selectedModel,
            openrouterIsDarkTheme: extensionSettings.isDarkTheme,
            openrouterSaveHistory: extensionSettings.saveHistory,
            openrouterAutoScroll: extensionSettings.autoScroll
        });
        
        // Notify all tabs/views of settings change
        broadcastSettingsUpdate();
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

// Broadcast settings update to all frames/tabs
function broadcastSettingsUpdate() {
    chrome.runtime.sendMessage({
        action: 'settingsUpdate',
        settings: extensionSettings
    });
    
    // Also notify tabs
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id && !tab.url.startsWith('chrome://')) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdate',
                    settings: extensionSettings
                }).catch(() => {}); // Ignore errors for tabs that might be closing
            }
        });
    });
}

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener(async () => {
    await loadSettings();
    await chrome.sidePanel.setOptions({ 
        path: 'sidepanel.html',
        enabled: true 
    });
    console.log('OpenRouter AI Chat Extension installed/updated');
});

// Listen for extension startup
chrome.runtime.onStartup.addListener(async () => {
    await loadSettings();
    // Ensure side panel is enabled and set correctly
    try {
        await chrome.sidePanel.setOptions({ 
            path: 'sidepanel.html',
            enabled: true 
        });
    } catch (error) {
        console.error('Failed to set side panel options:', error);
    }
    console.log('OpenRouter AI Chat Extension started');
});

// Handle action click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
    console.log('Action clicked, opening side panel');
    try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('Side panel opened successfully');
    } catch (error) {
        console.error('Failed to open side panel:', error);
        // Fallback: try to open a tab with the sidepanel
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    }
});

// Listen for messages from popup, sidepanel, or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle settings requests from UI
    if (message.action === 'getSettings') {
        sendResponse(extensionSettings);
        return true; // Indicates we'll respond asynchronously
    }
    
    // Handle settings updates from UI
    if (message.action === 'updateSettings') {
        saveSettings(message.settings);
        sendResponse({ success: true });
        return true;
    }
    
    // Handle API key validation
    if (message.action === 'validateApiKey') {
        validateApiKey(message.apiKey).then(isValid => {
            sendResponse({ valid: isValid });
        });
        return true; // Will respond asynchronously
    }
    
    // Handle model list request
    if (message.action === 'getModelList') {
        sendResponse({ models: getAvailableModels() });
        return true;
    }
    
    return false; // Let other listeners handle the message
});

// Validate OpenRouter API key by making a test request
async function validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('sk-or-')) {
        return false;
    }
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Get list of available models (cached)
let modelsCache = null;
let modelsCacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getAvailableModels() {
    const now = Date.now();
    if (modelsCache && (now - modelsCacheTimestamp) < CACHE_DURATION) {
        return modelsCache;
    }
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Failed to fetch models');
        
        const data = await response.json();
        // Filter and format models for easier consumption
        modelsCache = data.data.map(model => ({
            id: model.id,
            name: model.name || model.id,
            description: model.description || '',
            pricing: model.pricing || {}
        }));
        modelsCacheTimestamp = now;
        return modelsCache;
    } catch (error) {
        console.error('Failed to fetch models:', error);
        // Return fallback list
        return getFallbackModels();
    }
}

// Fallback model list
function getFallbackModels() {
    return [
        { id: "meta-llama/llama-3-8b-instruct:free", name: "Llama 3 8B (Free)", description: "Meta's Llama 3 8B instruction model" },
        { id: "meta-llama/llama-3-70b-instruct:free", name: "Llama 3 70B (Free)", description: "Meta's Llama 3 70B instruction model" },
        { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)", description: "Mistral AI's 7B instruction model" },
        { id: "mistralai/mixtral-8x7b-instruct:free", name: "Mixtral 8x7B (Free)", description: "Mistral AI's Mixtral 8x7B model" },
        { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B (Free)", description: "Google's Gemma 2 9B instruction model" }
    ];
}

// Handle tab updates to apply theme changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && !tab.url.startsWith('chrome://')) {
        // Inject content script if needed for theme synchronization
        // In this version, we're using sidepanel so content script might not be needed
        // But we'll keep this for compatibility
    }
});

// Listen for when the sidepanel is opened
chrome.sidePanel.onOpened.addListener((window) => {
    console.log('Sidepanel opened');
    // Could send initial state here if needed
});

console.log('OpenRouter AI Chat Background Service Worker loaded');