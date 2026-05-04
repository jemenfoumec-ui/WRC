// ==========================================
// CONFIG.JS - Version Sécurisée
// ==========================================

export const supabaseConfig = {
    // ✅ Utiliser des variables d'environnement en production
    url: import.meta.env?.VITE_SUPABASE_URL || 'https://ycgasfujxycqmbmiedaw.supabase.co',
    key: import.meta.env?.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZ2FzZnVqeHljcW1ibWllZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1OTI2NTAsImV4cCI6MjA4MjE2ODY1MH0.n1-XIs2wqPF8lr4nkVSBsLm_ylW_J7NrqqTwz1z4ftQ'
};

// ✅ Validation renforcée
if (!supabaseConfig.url || !supabaseConfig.key) {
    throw new Error('❌ Configuration Supabase manquante');
}

if (!supabaseConfig.key.startsWith('eyJ')) {
    console.error('⚠️ ALERTE SÉCURITÉ : Clé Supabase invalide');
}

// ✅ Détection d'environnement
export const isProduction = window.location.hostname !== 'localhost' && 
                            !window.location.hostname.includes('127.0.0.1');

// ✅ Configuration de cache adaptatif
export const CACHE_CONFIG = {
    leaderboard: isProduction ? 60000 : 10000,  // 1min prod, 10s dev
    tracks: isProduction ? 30000 : 5000,        // 30s prod, 5s dev
    profiles: isProduction ? 120000 : 15000     // 2min prod, 15s dev
};

// ✅ Rate limiting côté client
export const RATE_LIMITS = {
    vote: 2000,           // 2s entre votes
    upload: 5000,         // 5s entre uploads
    apiCall: 500          // 500ms entre appels API
};

console.log('✅ Config chargée -', isProduction ? 'PRODUCTION' : 'DÉVELOPPEMENT');