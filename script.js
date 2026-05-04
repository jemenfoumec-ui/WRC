// ==========================================
// SCRIPT PRINCIPAL - WRC 2026 v11
// Homepage - Stats & Leaderboard
// ==========================================
import { supabase } from './supabaseClient.js';

console.log('✅ Script Principal Chargé');

// ==========================================
// HOME PAGE - INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏠 Home page init...');
    
    // Charger les stats
    await loadHomeStats();
    
    // Charger le leaderboard
    await loadHomeLeaderboard();
    
    console.log('✅ Home page ready');
});

// ==========================================
// HOME PAGE - STATS
// ==========================================
async function loadHomeStats() {
    try {
        const [artistsRes, votesRes] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'artist'),
            supabase.from('profiles').select('votes_received').eq('role', 'artist')
        ]);
        
        const totalArtists = artistsRes.count || 0;
        const totalVotes = votesRes.data?.reduce((sum, p) => sum + (p.votes_received || 0), 0) || 0;
        
        // Mettre à jour l'UI
        const artistsEl = document.getElementById('totalArtists');
        const votesEl = document.getElementById('totalVotes');
        
        if (artistsEl) artistsEl.textContent = totalArtists.toLocaleString();
        if (votesEl) votesEl.textContent = totalVotes.toLocaleString();
        
    } catch (err) {
        console.warn('Stats error:', err);
    }
}

// ==========================================
// HOME PAGE - LEADERBOARD
// ==========================================
async function loadHomeLeaderboard() {
    const container = document.getElementById('homeLeaderboard');
    if (!container) return;
    
    try {
        const { data: artists, error } = await supabase
            .from('profiles')
            .select('id, username, stage_name, country, votes_received, avatar_url')
            .eq('role', 'artist')
            .order('votes_received', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        if (!artists || artists.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">Aucun artiste pour le moment</p>';
            return;
        }
        
        container.innerHTML = artists.map((artist, i) => {
            const name = artist.stage_name || artist.username || 'Artiste';
            const votes = artist.votes_received || 0;
            const flag = getCountryFlag(artist.country);
            
            return `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank">${i + 1}</span>
                    <span class="leaderboard-flag">${flag}</span>
                    <span class="leaderboard-name">${escapeHtml(name)}</span>
                    <span class="leaderboard-votes">${votes.toLocaleString()} votes</span>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        console.warn('Leaderboard error:', err);
        container.innerHTML = '<p class="text-muted text-center">Erreur de chargement</p>';
    }
}

// ==========================================
// UTILITIES
// ==========================================
function getCountryFlag(code) {
    const flags = {
        'FR': '🇫🇷', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'ES': '🇪🇸',
        'IT': '🇮🇹', 'BE': '🇧🇪', 'CH': '🇨🇭', 'CA': '🇨🇦', 'BR': '🇧🇷',
        'JP': '🇯🇵', 'KR': '🇰🇷', 'AU': '🇦🇺', 'NL': '🇳🇱', 'PT': '🇵🇹',
        'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱'
    };
    return flags[code] || '🌍';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('✅ Script principal initialisé');
