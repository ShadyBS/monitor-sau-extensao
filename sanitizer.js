/**
 * HTML Sanitization utilities for Monitor SAU Extension
 * Provides safe DOM manipulation to prevent XSS attacks
 */

// Importa o logger
import { logger } from "./logger.js";
const sanitizerLogger = logger("[Sanitizer]");

// Define o objeto de API do navegador de forma compatível
const browserAPI = globalThis.browser || globalThis.chrome;

// Allowed HTML tags and attributes for safe rendering
const ALLOWED_TAGS = ['p', 'span', 'strong', 'em', 'br', 'div', 'button', 'label', 'input'];
const ALLOWED_ATTRIBUTES = ['class', 'id', 'data-id', 'data-action', 'data-url', 'type', 'min', 'max', 'value', 'placeholder'];

/**
 * Sanitizes HTML content by removing dangerous elements and attributes
 * @param {string} html - HTML content to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html) {
    if (typeof html !== 'string') {
        sanitizerLogger.warn('sanitizeHTML called with non-string input:', typeof html);
        return '';
    }

    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onload, etc.)
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove data: URLs (potential for data exfiltration)
    sanitized = sanitized.replace(/data:/gi, '');
    
    // Remove style attributes (potential for CSS injection)
    sanitized = sanitized.replace(/style\s*=\s*["'][^"']*["']/gi, '');
    
    sanitizerLogger.debug('HTML sanitized successfully');
    return sanitized;
}

/**
 * Creates a safe DOM element with text content and attributes
 * @param {string} tag - HTML tag name
 * @param {string} textContent - Text content for the element
 * @param {Object} attributes - Attributes to set on the element
 * @returns {HTMLElement} Created element
 */
export function createSafeElement(tag, textContent = '', attributes = {}) {
    if (!ALLOWED_TAGS.includes(tag.toLowerCase())) {
        sanitizerLogger.warn(`Attempted to create disallowed tag: ${tag}`);
        tag = 'span'; // Fallback to safe tag
    }

    const element = document.createElement(tag);
    
    if (textContent) {
        element.textContent = textContent; // Use textContent instead of innerHTML
    }
    
    // Set only allowed attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (ALLOWED_ATTRIBUTES.includes(key.toLowerCase())) {
            element.setAttribute(key, String(value));
        } else {
            sanitizerLogger.warn(`Attempted to set disallowed attribute: ${key}`);
        }
    }
    
    return element;
}

/**
 * Safely sets text content, escaping any HTML
 * @param {HTMLElement} element - Target element
 * @param {string} content - Content to set
 */
export function setSafeTextContent(element, content) {
    if (!element || typeof element.textContent === 'undefined') {
        sanitizerLogger.error('setSafeTextContent called with invalid element');
        return;
    }
    
    element.textContent = String(content || '');
}

/**
 * Safely creates a task element without using innerHTML
 * @param {Object} task - Task object
 * @param {Object} displaySettings - Display configuration
 * @returns {HTMLElement} Task element
 */
export function createSafeTaskElement(task, displaySettings = {}) {
    const taskElement = createSafeElement('div', '', { class: 'task-item' });
    
    // Create header
    const headerP = createSafeElement('p');
    const strongElement = createSafeElement('strong', task.numero);
    headerP.appendChild(strongElement);
    headerP.appendChild(document.createTextNode(`: ${task.titulo}`));
    taskElement.appendChild(headerP);
    
    // Create meta information
    const metaItems = [];
    if (displaySettings.dataEnvio && task.dataEnvio) {
        metaItems.push(`Envio: ${task.dataEnvio}`);
    }
    if (displaySettings.posicao && task.posicao) {
        metaItems.push(`Posição: ${task.posicao}`);
    }
    if (displaySettings.solicitante && task.solicitante) {
        metaItems.push(`Solicitante: ${task.solicitante}`);
    }
    if (displaySettings.unidade && task.unidade) {
        metaItems.push(`Unidade: ${task.unidade}`);
    }
    
    if (metaItems.length > 0) {
        const metaP = createSafeElement('p', metaItems.join(' | '), { class: 'task-meta' });
        taskElement.appendChild(metaP);
    }
    
    // Create actions container
    const actionsDiv = createSafeElement('div', '', { class: 'task-actions' });
    
    // Create action buttons
    const openButton = createSafeElement('button', 'Abrir', {
        'data-action': 'open',
        'data-url': task.link,
        'data-id': task.id
    });
    
    const detailsButton = createSafeElement('button', 'Detalhes', {
        'data-action': 'details',
        'data-id': task.id
    });
    
    const ignoreButton = createSafeElement('button', 'Ignorar', {
        'data-action': 'ignore',
        'data-id': task.id
    });
    
    const snoozeButton = createSafeElement('button', 'Lembrar Mais Tarde', {
        'data-action': 'snooze',
        'data-id': task.id
    });
    
    actionsDiv.appendChild(openButton);
    actionsDiv.appendChild(detailsButton);
    actionsDiv.appendChild(ignoreButton);
    actionsDiv.appendChild(snoozeButton);
    
    taskElement.appendChild(actionsDiv);
    
    // Create details container
    const detailsDiv = createSafeElement('div', '', {
        class: 'task-details-expanded',
        id: `details-${task.id}`
    });
    
    // Add detail fields
    const detailFields = [
        { label: 'Solicitante', value: task.solicitante, show: !displaySettings.solicitante },
        { label: 'Unidade', value: task.unidade, show: !displaySettings.unidade },
        { label: 'Data de Envio', value: task.dataEnvio, show: !displaySettings.dataEnvio },
        { label: 'Posição', value: task.posicao, show: !displaySettings.posicao },
        { label: 'Descrição', value: task.descricao, show: true }
    ];
    
    detailFields.forEach(field => {
        if (field.show) {
            const fieldP = createSafeElement('p');
            const labelStrong = createSafeElement('strong', `${field.label}: `);
            fieldP.appendChild(labelStrong);
            fieldP.appendChild(document.createTextNode(field.value || 'N/A'));
            detailsDiv.appendChild(fieldP);
        }
    });
    
    // Add addresses if available
    if (task.enderecos && task.enderecos.length > 0) {
        const addressP = createSafeElement('p');
        const addressLabel = createSafeElement('strong', 'Endereço(s): ');
        addressP.appendChild(addressLabel);
        
        task.enderecos.forEach((addr, index) => {
            if (index > 0) {
                addressP.appendChild(document.createElement('br'));
            }
            const addrSpan = createSafeElement('span', addr);
            addressP.appendChild(addrSpan);
        });
        
        detailsDiv.appendChild(addressP);
    }
    
    // Add link
    const linkP = createSafeElement('p');
    const linkLabel = createSafeElement('strong', 'Link: ');
    linkP.appendChild(linkLabel);
    
    const linkA = document.createElement('a');
    linkA.href = task.link;
    linkA.textContent = 'Abrir no SAU';
    linkA.target = '_blank';
    linkA.rel = 'noopener noreferrer';
    linkP.appendChild(linkA);
    
    detailsDiv.appendChild(linkP);
    taskElement.appendChild(detailsDiv);
    
    sanitizerLogger.debug(`Safe task element created for task ${task.id}`);
    return taskElement;
}

/**
 * Validates and sanitizes task data
 * @param {Object} task - Task object to validate
 * @returns {Object} Sanitized task object
 */
export function sanitizeTaskData(task) {
    if (!task || typeof task !== 'object') {
        sanitizerLogger.warn('Invalid task data provided to sanitizeTaskData');
        return null;
    }
    
    const sanitized = {
        id: String(task.id || '').substring(0, 100), // Limit length
        numero: String(task.numero || '').substring(0, 50),
        titulo: String(task.titulo || '').substring(0, 200),
        link: String(task.link || '').substring(0, 500),
        dataEnvio: String(task.dataEnvio || '').substring(0, 50),
        posicao: String(task.posicao || '').substring(0, 50),
        solicitante: String(task.solicitante || '').substring(0, 100),
        unidade: String(task.unidade || '').substring(0, 100),
        descricao: String(task.descricao || '').substring(0, 1000),
        enderecos: Array.isArray(task.enderecos) 
            ? task.enderecos.slice(0, 10).map(addr => String(addr).substring(0, 200))
            : []
    };
    
    // Validate URL format for link
    try {
        new URL(sanitized.link);
    } catch (error) {
        sanitizerLogger.warn(`Invalid URL in task ${sanitized.id}: ${sanitized.link}`);
        sanitized.link = '#'; // Safe fallback
    }
    
    sanitizerLogger.debug(`Task data sanitized for task ${sanitized.id}`);
    return sanitized;
}

/**
 * Safely clears and populates a container element
 * @param {HTMLElement} container - Container to populate
 * @param {HTMLElement[]} elements - Elements to add
 */
export function safelyPopulateContainer(container, elements) {
    if (!container) {
        sanitizerLogger.error('safelyPopulateContainer called with invalid container');
        return;
    }
    
    // Clear existing content safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // Add new elements
    if (Array.isArray(elements)) {
        elements.forEach(element => {
            if (element instanceof HTMLElement) {
                container.appendChild(element);
            }
        });
    }
    
    sanitizerLogger.debug('Container populated safely');
}