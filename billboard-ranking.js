// ==========================================
// BILLBOARD RANKING - TOP 100
// ==========================================
import { supabase } from './supabaseClient.js';

let billboardData = [];
let lastUpdate = null;

async function loadBillboard() {
    try {
        console.log('📊 Chargement du Billboard...');
        
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select(`
                id,
                title,
                average_rating,
                ratings_count,
                artist_id,
                profiles!tracks_artist_id_fkey(username, avatar_url)
            `)
            .order('average_rating', { ascending: false })
            .order('ratings_count', { ascending: false })
            .limit(100);

        if (error) throw error;

        billboardData = tracks || [];
        lastUpdate = new Date();
        
        renderBillboard();
        updateLastUpdateTime();
        
        console.log('✅ Billboard chargé:', billboardData.length, 'tracks');
        
    } catch (error) {
        console.error('❌ Erreur chargement billboard:', error);
    }
}

function renderBillboard() {
    const container = document.getElementById('billboardList');
    if (!container) return;

    if (billboardData.length === 0) {
        container.innerHTML = '<div class="empty-state small"><p>Aucune donnée</p></div>';
        return;
    }

    container.innerHTML = billboardData.slice(0, 10).map((track, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `top-${rank}` : '';
        const artistName = track.profiles?.username || 'Artiste';
        const avatar = track.profiles?.avatar_url 
            ? `<img src="${track.profiles.avatar_url}" alt="${artistName}">`
            : artistName.charAt(0).toUpperCase();

        return `
            <div class="leaderboard-item ${rankClass}">
                <span class="leaderboard-rank">${rank}</span>
                <div class="leaderboard-avatar">${avatar}</div>
                <div class="leaderboard-info">
                    <span class="leaderboard-name">${escapeHtml(artistName)}</span>
                    <span class="leaderboard-track">${escapeHtml(track.title)}</span>
                </div>
                <span class="leaderboard-score">⭐ ${track.average_rating?.toFixed(1) || '0.0'}</span>
            </div>
        `;
    }).join('');
}

function updateLastUpdateTime() {
    const element = document.getElementById('lastUpdate');
    if (!element || !lastUpdate) return;
    
    const hours = String(lastUpdate.getHours()).padStart(2, '0');
    const minutes = String(lastUpdate.getMinutes()).padStart(2, '0');
    element.textContent = `Mise à jour: ${hours}:${minutes}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Setup refresh button
document.getElementById('refreshBillboard')?.addEventListener('click', loadBillboard);

// Auto-refresh every 30 seconds
setInterval(loadBillboard, 30000);

// Function exposée globalement
window.billboardNeedsRefresh = loadBillboard;

// Initial load
document.addEventListener('DOMContentLoaded', loadBillboard);

export { loadBillboard };