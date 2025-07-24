# Security Fixes TODO List

## Priority 1: Critical XSS Vulnerabilities

### 1. Fix innerHTML Usage in popup.js

**Current Issue:**
```javascript
taskElement.innerHTML = `
    ${headerHTML}
    <div class="task-actions">
        <button data-action="open" data-url="${task.link}" data-id="${task.id}">Abrir</button>
        // ... more HTML with user data
    </div>
`;
```

**Solution:**
```javascript
// Create elements safely
const taskElement = document.createElement("div");
taskElement.className = "task-item";

// Create header safely
const headerDiv = document.createElement("div");
headerDiv.textContent = `${task.numero}: ${task.titulo}`;
taskElement.appendChild(headerDiv);

// Create actions container
const actionsDiv = document.createElement("div");
actionsDiv.className = "task-actions";

// Create buttons safely
const openButton = document.createElement("button");
openButton.textContent = "Abrir";
openButton.dataset.action = "open";
openButton.dataset.url = task.link;
openButton.dataset.id = task.id;
actionsDiv.appendChild(openButton);
```

### 2. Implement HTML Sanitization

**Create new file: `sanitizer.js`**
```javascript
/**
 * HTML Sanitization utilities for Monitor SAU Extension
 */

const ALLOWED_TAGS = ['p', 'span', 'strong', 'em', 'br'];
const ALLOWED_ATTRIBUTES = ['class', 'data-id', 'data-action'];

export function sanitizeHTML(html) {
    // Simple sanitization - remove script tags and dangerous attributes
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
}

export function createSafeElement(tag, textContent, attributes = {}) {
    const element = document.createElement(tag);
    if (textContent) {
        element.textContent = textContent;
    }
    
    for (const [key, value] of Object.entries(attributes)) {
        if (ALLOWED_ATTRIBUTES.includes(key)) {
            element.setAttribute(key, value);
        }
    }
    
    return element;
}
```

### 3. Fix Message Passing Security

**Update interceptor.js:**
```javascript
// Current vulnerable code:
window.postMessage({
    type: "SAU_TASKS_RESPONSE",
    htmlContent: this.responseText,
}, "*");

// Secure version:
window.postMessage({
    type: "SAU_TASKS_RESPONSE",
    htmlContent: this.responseText,
}, window.location.origin); // Specific origin instead of "*"
```

**Update content.js message listener:**
```javascript
window.addEventListener("message", (event) => {
    // Enhanced security validation
    if (event.source !== window) {
        console.warn("Message from untrusted source rejected");
        return;
    }
    
    if (event.origin !== window.location.origin) {
        console.warn("Message from wrong origin rejected:", event.origin);
        return;
    }
    
    if (!event.data || typeof event.data !== 'object') {
        console.warn("Invalid message data rejected");
        return;
    }
    
    if (event.data.type === "SAU_TASKS_RESPONSE") {
        // Validate HTML content before processing
        if (typeof event.data.htmlContent === 'string' && 
            event.data.htmlContent.length < 1000000) { // Size limit
            processTasksHtml(event.data.htmlContent);
        }
    }
});
```

## Priority 2: Credential Security

### 4. Implement Credential Encryption

**Create new file: `crypto-utils.js`**
```javascript
/**
 * Encryption utilities for sensitive data
 */

export class SecureStorage {
    constructor() {
        this.browserAPI = globalThis.browser || globalThis.chrome;
    }

    async generateKey() {
        // Use Web Crypto API for key generation
        return await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    async encryptData(data, key) {
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encoder.encode(data)
        );

        return {
            encrypted: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv)
        };
    }

    async decryptData(encryptedData, key) {
        const decoder = new TextDecoder();
        const iv = new Uint8Array(encryptedData.iv);
        const data = new Uint8Array(encryptedData.encrypted);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );

        return decoder.decode(decrypted);
    }

    async storeCredentials(username, password) {
        // Warning: This is still not fully secure in browser extensions
        // Consider using browser's built-in password manager
        console.warn("Storing credentials in extension storage. Consider using browser password manager.");
        
        const key = await this.generateKey();
        const encryptedPassword = await this.encryptData(password, key);
        
        await this.browserAPI.storage.local.set({
            sauUsername: username,
            sauPasswordEncrypted: encryptedPassword,
            // Note: Key storage is still a challenge in browser extensions
        });
    }
}
```

## Priority 3: Content Security Policy

### 5. Add CSP to manifest.json

**Update both manifest files:**
```json
{
    "content_security_policy": {
        "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none';"
    }
}
```

### 6. Fix Firefox Manifest Background Script

**Update manifest-firefox.json:**
```json
{
    "background": {
        "service_worker": "background.js",
        "type": "module"
    }
}
```

## Priority 4: Performance Optimizations

### 7. Implement Proper Cleanup

**Update content.js with cleanup:**
```javascript
// Add cleanup function
function cleanup() {
    // Remove event listeners
    window.removeEventListener("message", messageHandler);
    
    // Clear observers
    if (mutationObserver) {
        mutationObserver.disconnect();
    }
    
    // Clear any intervals/timeouts
    if (checkInterval) {
        clearInterval(checkInterval);
    }
}

// Listen for page unload
window.addEventListener("beforeunload", cleanup);

// Listen for extension context invalidation
if (browserAPI.runtime.onConnect) {
    browserAPI.runtime.onConnect.addListener(() => {
        // Extension context is still valid
    });
}
```

### 8. Optimize DOM Operations

**Cache DOM elements:**
```javascript
// Create DOM cache
const DOMCache = {
    tasksList: null,
    statusMessage: null,
    
    get(id) {
        if (!this[id]) {
            this[id] = document.getElementById(id);
        }
        return this[id];
    },
    
    clear() {
        Object.keys(this).forEach(key => {
            if (key !== 'get' && key !== 'clear') {
                this[key] = null;
            }
        });
    }
};

// Usage
const tasksList = DOMCache.get('tasks-list');
```

## Priority 5: Error Handling

### 9. Standardize Error Handling

**Create error-handler.js:**
```javascript
export class ExtensionError extends Error {
    constructor(message, code, context = {}) {
        super(message);
        this.name = 'ExtensionError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

export function handleError(error, logger, context = {}) {
    const errorInfo = {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        context: { ...context, ...error.context },
        stack: error.stack,
        timestamp: error.timestamp || new Date().toISOString()
    };
    
    logger.error('Extension error occurred:', errorInfo);
    
    // Report to background script for centralized error handling
    if (globalThis.browser || globalThis.chrome) {
        const browserAPI = globalThis.browser || globalThis.chrome;
        browserAPI.runtime.sendMessage({
            action: 'reportError',
            error: errorInfo
        }).catch(() => {
            // Ignore if background script is not available
        });
    }
    
    return errorInfo;
}
```

## Testing Checklist

After implementing fixes:

- [ ] Test XSS prevention with malicious task titles
- [ ] Verify message passing security
- [ ] Test credential encryption/decryption
- [ ] Verify CSP enforcement
- [ ] Test cross-browser compatibility
- [ ] Performance testing with large task lists
- [ ] Memory leak testing
- [ ] Error handling verification

## Commit Message Template

```
security: fix critical XSS vulnerabilities and improve security posture

- Replace innerHTML with safe DOM manipulation
- Add HTML sanitization utilities
- Implement secure message passing validation
- Add credential encryption (with warnings)
- Implement Content Security Policy
- Fix Firefox manifest background script configuration
- Add proper cleanup and error handling
- Optimize DOM operations and caching

BREAKING CHANGE: Credential storage format changed, users need to re-enter credentials

Fixes: #security-audit-2025
```