// Sidepanel JavaScript for OpenRouter AI Chat

class OpenRouterChat {
    constructor() {
        this.apiKey = null;
        this.selectedModel = "meta-llama/llama-3-8b-instruct:free"; // Default free model
        this.messages = [];
        this.isDarkTheme = false;
        this.saveHistory = true;
        this.autoScroll = true;
        
        // Bind methods
        this.sendMessage = this.sendMessage.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.clearChat = this.clearChat.bind(this);
        this.showSettings = this.showSettings.bind(this);
        this.hideSettings = this.hideSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.loadSettings = this.loadSettings.bind(this);
        this.attachFile = this.attachFile.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Initialize
        this.init().catch(err => {
            console.error('Failed to initialize OpenRouterChat:', err);
            // Fallback initialization
            this.fallbackInit().catch(fallbackErr => {
                console.error('Fallback initialization also failed:', fallbackErr);
            });
        });
    }
    
    async init() {
        // Load settings from storage
        await this.loadSettings();
        
        // Get DOM elements
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.modelSelect = document.getElementById('model-select');
        this.apiKeyInput = document.getElementById('api-key-input');
        this.themeToggle = document.getElementById('theme-toggle');
        this.saveHistoryCheckbox = document.getElementById('save-history');
        this.autoScrollCheckbox = document.getElementById('auto-scroll');
        this.statusText = document.getElementById('status-text');
        this.currentModelSpan = document.getElementById('current-model');
        this.fileAttachInput = document.getElementById('file-attach');
        
        // Populate model selector
        await this.populateModelSelector();
        
        // Set initial theme
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        
        // Update current model display
        this.updateCurrentModelDisplay();
        
        // Load chat history if enabled
        if (this.saveHistory) {
            await this.loadChatHistory();
        }
        
        // Add event listeners
        this.sendBtn.addEventListener('click', this.sendMessage);
        this.clearChatBtn.addEventListener('click', this.clearChat);
        this.settingsBtn.addEventListener('click', this.showSettings);
        this.userInput.addEventListener('keydown', this.handleKeyDown);
        this.fileAttachInput.addEventListener('change', this.attachFile);
        
        // Settings modal listeners
        document.getElementById('cancel-settings').addEventListener('click', this.hideSettings);
        document.getElementById('save-settings').addEventListener('click', this.saveSettings);
        this.themeToggle.addEventListener('change', this.toggleTheme);
        this.saveHistoryCheckbox.addEventListener('change', (e) => {
            this.saveHistory = e.target.checked;
        });
        this.autoScrollCheckbox.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        // Close modal when clicking outside
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.hideSettings();
            }
        });
        
        // Update status
        this.updateStatus();
    }
    
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The type of toast: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in seconds (default: 3)
     */
    showToast(message, type = 'info', duration = 3) {
        // Remove any existing toast with same message to prevent duplicates
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => {
            if (toast.querySelector('.toast-content').textContent === message) {
                toast.remove();
            }
        });
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        
        // Icon mapping
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12m0-0L6 18m12-12L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 10h-2v4h2v-2m0-4h2v2h-2V8m0 8h2v2h-2v-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">${message}</div>
            <div class="toast-close" aria-label="Close toast">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 6l12 12m0-0L6 18m12-12L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        `;
        
        // Add to container
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            
            // Add close button functionality
            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', () => {
                toast.remove();
            });
            
            // Auto-remove after duration
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, duration * 1000);
        } else {
            console.error('Toast container not found');
        }
    }
    
    async fallbackInit() {
        // Synchronous fallback initialization
        // Use default values since we can't reliably load settings in fallback
        this.apiKey = null;
        this.selectedModel = "meta-llama/llama-3-8b-instruct:free";
        this.isDarkTheme = false;
        this.saveHistory = true;
        this.autoScroll = true;
        
        // Get DOM elements
        this.chatMessages = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.clearChatBtn = document.getElementById('clear-chat');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.modelSelect = document.getElementById('model-select');
        this.apiKeyInput = document.getElementById('api-key-input');
        this.themeToggle = document.getElementById('theme-toggle');
        this.saveHistoryCheckbox = document.getElementById('save-history');
        this.autoScrollCheckbox = document.getElementById('auto-scroll');
        this.statusText = document.getElementById('status-text');
        this.currentModelSpan = document.getElementById('current-model');
        this.fileAttachInput = document.getElementById('file-attach');
        
        // Populate model selector with fallback
        this.populateModelSelectorFallback();
        
        // Set initial theme
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        
        // Update current model display
        this.updateCurrentModelDisplay();
        
        // Load chat history if enabled
        if (this.saveHistory) {
            await this.loadChatHistory();
        }
        
        // Add event listeners
        this.sendBtn.addEventListener('click', this.sendMessage);
        this.clearChatBtn.addEventListener('click', this.clearChat);
        this.settingsBtn.addEventListener('click', this.showSettings);
        this.userInput.addEventListener('keydown', this.handleKeyDown);
        this.fileAttachInput.addEventListener('change', this.attachFile);
        
        // Settings modal listeners
        document.getElementById('cancel-settings').addEventListener('click', this.hideSettings);
        document.getElementById('save-settings').addEventListener('click', this.saveSettings);
        this.themeToggle.addEventListener('change', this.toggleTheme);
        this.saveHistoryCheckbox.addEventListener('change', (e) => {
            this.saveHistory = e.target.checked;
        });
        this.autoScrollCheckbox.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        // Close modal when clicking outside
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.hideSettings();
            }
        });
        
        // Update status
        this.updateStatus();
    }
        
        // Add event listeners
        this.sendBtn.addEventListener('click', this.sendMessage);
        this.clearChatBtn.addEventListener('click', this.clearChat);
        this.settingsBtn.addEventListener('click', this.showSettings);
        this.userInput.addEventListener('keydown', this.handleKeyDown);
        this.fileAttachInput.addEventListener('change', this.attachFile);
        
        // Settings modal listeners
        document.getElementById('cancel-settings').addEventListener('click', this.hideSettings);
        document.getElementById('save-settings').addEventListener('click', this.saveSettings);
        this.themeToggle.addEventListener('change', this.toggleTheme);
        this.saveHistoryCheckbox.addEventListener('change', (e) => {
            this.saveHistory = e.target.checked;
        });
        this.autoScrollCheckbox.addEventListener('change', (e) => {
            this.autoScroll = e.target.checked;
        });
        
        // Close modal when clicking outside
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.hideSettings();
            }
        });
        
        // Update status
        this.updateStatus();
    }
    
    async populateModelSelector() {
        try {
            // Request models from background service worker
            const response = await chrome.runtime.sendMessage({
                action: 'getModelList'
            });
            
            const models = response.models || [];
            
            // Clear and repopulate
            this.modelSelect.innerHTML = '';
            
            // Separate free and paid models
            const freeModels = models.filter(m => m.id.includes(':free'));
            const paidModels = models.filter(m => !m.id.includes(':free'));
            
            // Add free models group
            if (freeModels.length > 0) {
                const freeGroup = document.createElement('optgroup');
                freeGroup.label = 'Free Models';
                freeModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name || model.id;
                    freeGroup.appendChild(option);
                });
                this.modelSelect.appendChild(freeGroup);
            }
            
            // Add paid models group
            if (paidModels.length > 0) {
                const paidGroup = document.createElement('optgroup');
                paidGroup.label = 'Paid Models';
                paidModels.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name || model.id;
                    paidGroup.appendChild(option);
                });
                this.modelSelect.appendChild(paidGroup);
            }
            
            // Set selected model
            this.modelSelect.value = this.selectedModel;
            
            // Listen for changes
            this.modelSelect.addEventListener('change', (e) => {
                this.selectedModel = e.target.value;
                this.updateCurrentModelDisplay();
                this.saveSettings();
            });
        } catch (error) {
            console.error('Failed to load models from background:', error);
            // Fallback to hardcoded models
            this.populateModelSelectorFallback();
        }
    }
    
    populateModelSelectorFallback() {
        // Free models from OpenRouter
        const freeModels = [
            { id: "meta-llama/llama-3-8b-instruct:free", name: "Llama 3 8B (Free)" },
            { id: "meta-llama/llama-3-70b-instruct:free", name: "Llama 3 70B (Free)" },
            { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)" },
            { id: "mistralai/mixtral-8x7b-instruct:free", name: "Mixtral 8x7B (Free)" },
            { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B (Free)" },
            { id: "google/gemma-2-27b-it:free", name: "Gemma 2 27B (Free)" },
            { id: "microsoft/phi-3-mini-128k-instruct:free", name: "Phi-3 Mini 128K (Free)" },
            { id: "microsoft/phi-3-medium-128k-instruct:free", name: "Phi-3 Medium 128K (Free)" }
        ];
        
        // Clear and repopulate
        this.modelSelect.innerHTML = '';
        
        // Add free models group
        const freeGroup = document.createElement('optgroup');
        freeGroup.label = 'Free Models';
        freeModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            freeGroup.appendChild(option);
        });
        this.modelSelect.appendChild(freeGroup);
        
        // Add paid models group (for reference)
        const paidGroup = document.createElement('optgroup');
        paidGroup.label = 'Popular Paid Models';
        const paidModels = [
            { id: "openai/gpt-4o", name: "GPT-4o" },
            { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
            { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
            { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet" },
            { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" }
        ];
        paidModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            paidGroup.appendChild(option);
        });
        this.modelSelect.appendChild(paidGroup);
        
        // Set selected model
        this.modelSelect.value = this.selectedModel;
        
        // Listen for changes
        this.modelSelect.addEventListener('change', (e) => {
            this.selectedModel = e.target.value;
            this.updateCurrentModelDisplay();
            this.saveSettings();
        });
    }
    
    updateCurrentModelDisplay() {
        const selectedOption = this.modelSelect.options[this.modelSelect.selectedIndex];
        this.currentModelSpan.textContent = selectedOption ? selectedOption.textContent : this.selectedModel;
    }
    
    async loadSettings() {
        try {
            // Request settings from background service worker
            const response = await chrome.runtime.sendMessage({
                action: 'getSettings'
            });
            
            this.apiKey = response.apiKey || null;
            this.selectedModel = response.selectedModel || "meta-llama/llama-3-8b-instruct:free";
            this.isDarkTheme = response.isDarkTheme || false;
            this.saveHistory = response.saveHistory !== undefined ? response.saveHistory : true;
            this.autoScroll = response.autoScroll !== undefined ? response.autoScroll : true;
        } catch (e) {
            console.error('Failed to load settings from background:', e);
            // Use defaults
            this.apiKey = null;
            this.selectedModel = "meta-llama/llama-3-8b-instruct:free";
            this.isDarkTheme = false;
            this.saveHistory = true;
            this.autoScroll = true;
        }
    }
    
    saveSettings() {
        const settings = {
            apiKey: this.apiKey,
            selectedModel: this.selectedModel,
            isDarkTheme: this.isDarkTheme,
            saveHistory: this.saveHistory,
            autoScroll: this.autoScroll
        };
        
        // Send settings to background service worker for storage
        chrome.runtime.sendMessage({
            action: 'updateSettings',
            settings: settings
        }).then(response => {
            if (chrome.runtime.lastError) {
                console.error('Failed to save settings via background:', chrome.runtime.lastError);
                this.showToast('Failed to save settings. Some preferences may not be remembered.', 'error');
            } else if (!response || !response.success) {
                console.error('Failed to save settings: Invalid response from background');
                this.showToast('Failed to save settings. Some preferences may not be remembered.', 'error');
            }
            // Success - settings saved via background service worker
        }).catch(error => {
            console.error('Failed to send settings to background:', error);
            this.showToast('Failed to save settings. Some preferences may not be remembered.', 'error');
        });
    }
    
    updateStatus() {
        if (!this.apiKey) {
            this.statusText.textContent = 'API key not set';
            this.statusText.style.color = '#ff6b6b';
            this.sendBtn.disabled = true;
        } else {
            this.statusText.textContent = 'Ready';
            this.statusText.style.color = '';
            this.sendBtn.disabled = false;
        }
    }
    
    showSettings() {
        // Populate settings fields
        this.apiKeyInput.value = this.apiKey || '';
        this.modelSelect.value = this.selectedModel;
        this.themeToggle.checked = this.isDarkTheme;
        this.saveHistoryCheckbox.checked = this.saveHistory;
        this.autoScrollCheckbox.checked = this.autoScroll;
        
        this.settingsModal.classList.add('show');
    }
    
    hideSettings() {
        this.settingsModal.classList.remove('show');
    }
    
    toggleTheme() {
        this.isDarkTheme = this.themeToggle.checked;
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        this.saveSettings();
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.messages = [];
            this.chatMessages.innerHTML = '';
            if (this.saveHistory) {
                this.saveChatHistory();
            }
        }
    }
    
    addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = this.parseMessage(content);
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        this.chatMessages.appendChild(messageDiv);
        
        // Add to messages array
        this.messages.push({
            content: content,
            isUser: isUser,
            timestamp: new Date().toISOString()
        });
        
        // Save history if enabled
        if (this.saveHistory) {
            this.saveChatHistory();
        }
        
        // Auto-scroll
        if (this.autoScroll) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        
        return messageDiv;
    }
    
    parseMessage(text) {
        // Simple markdown-like parsing
        // Convert URLs to links
        text = text.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );
        
        // Convert code blocks
        text = text.replace(
            /```([\s\S]*?)```/g,
            '<pre><code>$1</code></pre>'
        );
        
        // Convert inline code
        text = text.replace(
            /`([^`]+)`/g,
            '<code>$1</code>'
        );
        
        // Convert line breaks
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    async sendMessage() {
        const userText = this.userInput.value.trim();
        if (!userText && !this.fileAttachInput.files.length) return;
        
        // Disable input while sending
        this.userInput.disabled = true;
        this.sendBtn.disabled = true;
        this.statusText.textContent = 'Sending...';
        
        try {
            // Add user message to chat
            this.addMessage(userText, true);
            this.userInput.value = '';
            
            // Show typing indicator
            const typingIndicator = this.showTypingIndicator();
            
            // Prepare message content for API
            let content = [{ type: "text", text: userText }];
            
            // Handle file attachment
            if (this.fileAttachInput.files.length) {
                const file = this.fileAttachInput.files[0];
                const contentType = file.type;
                
                if (contentType.startsWith('image/')) {
                    // Handle image
                    const base64 = await this.fileToBase64(file);
                    content.push({
                        type: "image_url",
                        image_url: { url: base64 }
                    });
                } else if (contentType === 'text/plain' || 
                          contentType.includes('json') || 
                          contentType.includes('xml') ||
                          contentType.includes('html') ||
                          contentType.includes('css') ||
                          contentType.includes('javascript') ||
                          contentType.includes('typescript')) {
                    // Handle text files
                    const text = await this.fileToText(file);
                    content[0].text += `\n\nAttached File Content:\n${text}`;
                }
                // Reset file input
                this.fileAttachInput.value = '';
            }
            
            // Call OpenRouter API
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'OpenRouter AI Chat Extension'
                },
                body: JSON.stringify({
                    model: this.selectedModel,
                    messages: [{ role: 'user', content: content }],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });
            
            // Remove typing indicator
            typingIndicator.remove();
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.choices && data.choices.length > 0) {
                const aiReply = data.choices[0].message.content;
                this.addMessage(aiReply, false);
            } else {
                throw new Error('No response from AI');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage(`Error: ${error.message}`, false);
            this.showToast(`Failed to send message: ${error.message}`, 'error');
        } finally {
            // Re-enable input
            this.userInput.disabled = false;
            this.sendBtn.disabled = !this.apiKey;
            this.userInput.focus();
            this.updateStatus();
        }
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <span>AI is thinking</span>
                <div class="typing-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        if (this.autoScroll) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        return typingDiv;
    }
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    attachFile() {
        // File input change handler - actual processing happens in sendMessage
        if (this.fileAttachInput.files.length) {
            const file = this.fileAttachInput.files[0];
            // Show feedback that file is attached
            this.statusText.textContent = `Attached: ${file.name}`;
            setTimeout(() => {
                this.updateStatus();
            }, 2000);
        }
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
        // Allow Shift+Enter for new line
    }
    
    async saveChatHistory() {
        try {
            await chrome.storage.local.set({ 'openrouterChatHistory': JSON.stringify(this.messages) });
        } catch (e) {
            console.error('Failed to save chat history:', e);
            this.showToast('Failed to save chat history', 'error');
        }
    }
    
    async loadChatHistory() {
        try {
            const result = await chrome.storage.local.get(['openrouterChatHistory']);
            const history = result.openrouterChatHistory ? JSON.parse(result.openrouterChatHistory) : [];
            this.messages = history;
            this.renderChatHistory();
        } catch (e) {
            console.error('Failed to load chat history:', e);
            this.messages = [];
        }
    }
    
    renderChatHistory() {
        this.chatMessages.innerHTML = '';
        this.messages.forEach(msg => {
            this.addMessage(msg.content, msg.isUser);
        });
        // Scroll to bottom
        if (this.autoScroll && this.messages.length > 0) {
            setTimeout(() => {
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }, 100);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.openRouterChat = new OpenRouterChat();
});

// Handle messages from background/content scripts (for real extension)
// In a real extension, we'd use chrome.runtime.onMessage
// For this demo, we'll just note it