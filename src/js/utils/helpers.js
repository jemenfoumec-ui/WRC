/**
 * WRC 2026 - Utility Helpers
 * Shared utility functions
 */

// ==========================================
// FORMATTERS
// ==========================================

export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

export function formatDate(dateStr, options = {}) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const defaults = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('fr-FR', { ...defaults, ...options });
}

export function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatRelativeTime(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes}min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return formatDate(dateStr);
}

// ==========================================
// COUNTRY FLAGS
// ==========================================

export const countryFlags = {
    'FR': '🇫🇷', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'ES': '🇪🇸',
    'IT': '🇮🇹', 'BE': '🇧🇪', 'CH': '🇨🇭', 'CA': '🇨🇦', 'BR': '🇧🇷',
    'JP': '🇯🇵', 'KR': '🇰🇷', 'AU': '🇦🇺', 'NL': '🇳🇱', 'PT': '🇵🇹',
    'RU': '🇷🇺', 'CN': '🇨🇳', 'IN': '🇮🇳', 'MX': '🇲🇽', 'AR': '🇦🇷',
    'PL': '🇵🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮',
    'GR': '🇬🇷', 'TR': '🇹🇷', 'ZA': '🇿🇦', 'EG': '🇪🇬', 'NG': '🇳🇬'
};

export function getFlag(countryCode) {
    if (!countryCode) return '';
    return countryFlags[countryCode.toUpperCase()] || `[${countryCode}]`;
}

// ==========================================
// HTML ESCAPE
// ==========================================

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// VALIDATORS
// ==========================================

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidDuration(duration) {
    return /^[0-5]?\d:[0-5]\d$/.test(duration);
}

export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// ==========================================
// STORAGE
// ==========================================

export function setStorage(key, value, remember = true) {
    const data = JSON.stringify(value);
    if (remember) {
        localStorage.setItem(key, data);
    } else {
        sessionStorage.setItem(key, data);
    }
}

export function getStorage(key) {
    const data = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export function removeStorage(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
}

// ==========================================
// DEBOUNCE & THROTTLE
// ==========================================

export function debounce(fn, delay = 100) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function throttle(fn, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==========================================
// DOM UTILITIES
// ==========================================

export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return document.querySelectorAll(selector);
}

export function createElement(tag, attributes = {}, children = []) {
    const el = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on')) {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    });
    
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });
    
    return el;
}

// ==========================================
// ARRAY UTILITIES
// ==========================================

export function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
}

export function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        const modifier = order === 'desc' ? -1 : 1;
        if (aVal < bVal) return -1 * modifier;
        if (aVal > bVal) return 1 * modifier;
        return 0;
    });
}

export function unique(array) {
    return [...new Set(array)];
}

// ==========================================
// NETWORK UTILITIES
// ==========================================

export async function retry(fn, maxAttempts = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
}

// ==========================================
// EXPORTS
// ==========================================

export default {
    formatNumber,
    formatTime,
    formatDuration,
    formatDate,
    formatDateTime,
    formatRelativeTime,
    countryFlags,
    getFlag,
    escapeHtml,
    isValidEmail,
    isValidDuration,
    isValidUrl,
    setStorage,
    getStorage,
    removeStorage,
    debounce,
    throttle,
    $,
    $$,
    createElement,
    groupBy,
    sortBy,
    unique,
    retry
};