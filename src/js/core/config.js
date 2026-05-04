/**
 * WRC 2026 - Configuration Module
 * Environment-based configuration with security validation
 */

// Environment detection
const isProduction = window.location.hostname !== 'localhost' && 
                     !window.location.hostname.includes('127.0.0.1');

// Supabase Configuration
export const supabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL || 'https://ycgasfujxycqmbmiedaw.supabase.co',
    key: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZ2FzZnVqeHljcW1ibWllZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1OTI2NTAsImV4cCI6MjA4MjE2ODY1MH0.n1-XIs2wqPF8lr4nkVSBsLm_ylW_J7NrqqTwz1z4ftQ'
};

// Validate configuration
if (!supabaseConfig.url || !supabaseConfig.key) {
    throw new Error('Configuration Supabase manquante');
}

if (!supabaseConfig.key.startsWith('eyJ')) {
    console.warn('ALERTE: Clé Supabase potentiellement invalide');
}

// App Configuration
export const appConfig = {
    name: import.meta.env.VITE_APP_NAME || 'WRC 2026',
    version: import.meta.env.VITE_APP_VERSION || '5.0.0',
    url: import.meta.env.VITE_APP_URL || window.location.origin,
    isProduction,
    debug: import.meta.env.VITE_ENABLE_DEBUG_MODE === 'true'
};

// Cache Configuration (adaptive TTL)
export const cacheConfig = {
    leaderboard: isProduction ? 60000 : 10000,  // 1min prod, 10s dev
    tracks: isProduction ? 30000 : 5000,        // 30s prod, 5s dev
    profiles: isProduction ? 120000 : 15000,   // 2min prod, 15s dev
    defaultTTL: 60000
};

// Rate Limiting Configuration
export const rateLimits = {
    vote: 2000,           // 2s between votes
    upload: 5000,        // 5s between uploads
    apiCall: 500          // 500ms between API calls
};

// Protected Pages
export const protectedPages = [
    'dashboard.html',
    'dashboard-admin.html',
    'dashboard-jury.html',
    'tournament-arena.html',
    'profile-edit.html'
];

// Admin Emails
export const adminEmails = ['admin@wrc.com', 'admin@wrc.fr'];

// Storage Keys
export const storageKeys = {
    user: 'wrc_user',
    session: 'wrc_session',
    preferences: 'wrc_preferences'
};

// Logging utility
const log = (level, ...args) => {
    if (appConfig.debug || level !== 'debug') {
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[WRC]`, ...args);
    }
};

export const logger = {
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
    debug: (...args) => log('debug', ...args)
};

logger.info(`Config chargée - ${isProduction ? 'PRODUCTION' : 'DÉVELOPPEMENT'}`);