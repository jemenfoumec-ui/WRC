/**
 * WRC 2026 - Main Entry Point
 * Initializes all core modules and sets up the application
 */

// PWA Support
import { registerSW } from 'virtual:pwa-register';

// Core modules
import './js/auth/toast.js';
import './js/auth/auth.js';
import './js/components/nav.js';

import { logger, appConfig } from './js/core/config.js';
import { supabase } from './js/core/supabaseClient.js';

// Premium Experience Modules
import { scroller } from './js/core/scroller.js';
import { Arena3D } from './js/arena/Arena3D.js';
import { initAnimations } from './js/core/animations.js';

// Register Service Worker
registerSW({
    onNeedRefresh() {
        logger.info('Nouvelle version disponible');
    },
    onOfflineReady() {
        logger.info('App prête pour le mode hors-ligne');
    },
});

// ==========================================
// APP INITIALIZATION
// ==========================================
async function initApp() {
    logger.info(`WRC 2026 v${appConfig.version} starting...`);
    
    // Initialize 3D Arena
    const arena = new Arena3D('arena-canvas');
    
    // Initialize Animations
    initAnimations(arena);
    
    // Initialize Supabase auth state listener
    initAuthListener();
    
    // Initialize countdown if present
    initCountdown();
    
    // Initialize live leaderboard if present
    initLiveLeaderboard();
    
    logger.info('App initialized');
}

// ==========================================
// AUTH LISTENER
// ==========================================
function initAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        logger.debug('Auth state change:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
            window.dispatchEvent(new CustomEvent('wrc-auth-change', {
                detail: { user: session.user, isAuthenticated: true }
            }));
        } else if (event === 'SIGNED_OUT') {
            window.dispatchEvent(new CustomEvent('wrc-auth-change', {
                detail: { user: null, isAuthenticated: false }
            }));
        }
    });
}

// ==========================================
// COUNTDOWN
// ==========================================
function initCountdown() {
    const countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;
    
    // Target date for WRC 2026
    const target = new Date('2026-06-01T00:00:00').getTime();
    
    function update() {
        const now = Date.now();
        const diff = target - now;
        
        if (diff <= 0) {
            document.getElementById('days').textContent = '00';
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            return;
        }
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById('days').textContent = String(d).padStart(2, '0');
        document.getElementById('hours').textContent = String(h).padStart(2, '0');
        document.getElementById('minutes').textContent = String(m).padStart(2, '0');
        document.getElementById('seconds').textContent = String(s).padStart(2, '0');
    }
    
    update();
    setInterval(update, 1000);
}

// ==========================================
// LIVE LEADERBOARD
// ==========================================
async function initLiveLeaderboard() {
    const leaderboardEl = document.getElementById('leaderboardLive');
    if (!leaderboardEl) return;
    
    const { supabase } = await import('./js/core/supabaseClient.js');
    
    async function loadLeaderboard() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, stage_name, votes_received, country, avatar_url')
                .eq('role', 'artist')
                .eq('is_active', true)
                .order('votes_received', { ascending: false })
                .limit(3);
            
            if (error) throw error;
            
            renderLeaderboard(data || []);
        } catch (err) {
            logger.error('Leaderboard load error:', err);
        }
    }
    
    function renderLeaderboard(artists) {
        if (!artists.length) {
            leaderboardEl.innerHTML = `
                <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                    Aucun participant pour le moment
                </div>
            `;
            return;
        }
        
        const medals = ['gold', 'silver', 'bronze'];
        const flags = {
            'FR': '🇫🇷', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'ES': '🇪🇸',
            'IT': '🇮🇹', 'BE': '🇧🇪', 'CH': '🇨🇭', 'CA': '🇨🇦', 'BR': '🇧🇷'
        };
        
        leaderboardEl.innerHTML = artists.map((artist, index) => `
            <div class="leaderboard-item ${medals[index]}">
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-avatar">
                    ${artist.avatar_url 
                        ? `<img src="${artist.avatar_url}" alt="">`
                        : `<span style="font-size: 1.5rem;">🎤</span>`
                    }
                </div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${escapeHtml(artist.stage_name || artist.username || 'Artiste')}</div>
                    <div class="leaderboard-meta">${flags[artist.country?.toUpperCase()] || ''} ${artist.country || ''}</div>
                </div>
                <div class="leaderboard-score">${formatNumber(artist.votes_received || 0)}</div>
            </div>
        `).join('');
    }
    
    function formatNumber(num) {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
    
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Initial load
    await loadLeaderboard();
    
    // Subscribe to updates
    const channel = supabase
        .channel('leaderboard-updates')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: 'role=eq.artist'
        }, () => {
            loadLeaderboard();
        })
        .subscribe();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        supabase.removeChannel(channel);
    });
}

// ==========================================
// START
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for module usage
export { initApp };