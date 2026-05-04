// ==========================================
// BILLBOARD RANKING TRANSLATIVE - CORRIGÉ
// Gestion complète de l'ouverture/fermeture
// ==========================================
import { supabase } from './supabaseClient.js';

let billboardData = [];
let lastUpdate = null;
let isOpen = false;

// ==========================================
// INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Billboard Translative - Initialisation...');
    
    setupBillboardToggle();
    setupCloseButton();
    setupRefreshButton();
    
    // Chargement initial
    loadBillboard();
    
    // Auto-refresh toutes les 30 secondes
    setInterval(loadBillboard, 30000);
    
    console.log('✅ Billboard Translative initialisé');
});

// ==========================================
// SETUP DU BOUTON TOGGLE
// ==========================================
function setupBillboardToggle() {
    const toggleBtn = document.getElementById('billboardToggleBtn');
    const menu = document.getElementById('billboardMenu');
    
    if (!toggleBtn || !menu) {
        console.warn('⚠️ Éléments billboard non trouvés');
        return;
    }
    
    toggleBtn.addEventListener('click', () => {
        console.log('🔘 Toggle clicked, état actuel:', isOpen);
        toggleBillboard();
    });
    
    // Fermer en cliquant en dehors
    document.addEventListener('click', (e) => {
        if (isOpen && 
            !menu.contains(e.target) && 
            !toggleBtn.contains(e.target)) {
            closeBillboard();
        }
    });
    
    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeBillboard();
        }
    });
}

// ==========================================
// SETUP DU BOUTON CLOSE
// ==========================================
function setupCloseButton() {
    const closeBtn = document.getElementById('billboardCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeBillboard();
        });
    }
}

// ==========================================
// SETUP DU BOUTON REFRESH
// ==========================================
function setupRefreshButton() {
    const refreshBtn = document.getElementById('billboardRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '⏳ CHARGEMENT...';
            
            await loadBillboard();
            
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '↻ ACTUALISER';
            
            if (window.showToast) {
                window.showToast('Billboard', 'Classement actualisé');
            }
        });
    }
}

// ==========================================
// TOGGLE BILLBOARD (PRINCIPAL)
// ==========================================
function toggleBillboard() {
    const menu = document.getElementById('billboardMenu');
    const toggleBtn = document.getElementById('billboardToggleBtn');
    
    if (!menu || !toggleBtn) return;
    
    isOpen = !isOpen;
    
    if (isOpen) {
        console.log('📂 Ouverture du billboard');
        menu.classList.remove('collapsed');
        menu.classList.add('expanded');
        toggleBtn.classList.add('active');
        
        // Charger les données si vides
        if (billboardData.length === 0) {
            loadBillboard();
        }
    } else {
        console.log('📁 Fermeture du billboard');
        menu.classList.remove('expanded');
        menu.classList.add('collapsed');
        toggleBtn.classList.remove('active');
    }
}

// ==========================================
// OPEN / CLOSE EXPLICITES
// ==========================================
function openBillboard() {
    if (!isOpen) toggleBillboard();
}

function closeBillboard() {
    if (isOpen) toggleBillboard();
}

// ==========================================
// CHARGEMENT DES DONNÉES
// ==========================================
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
        renderError();
    }
}

// ==========================================
// RENDU DU BILLBOARD
// ==========================================
function renderBillboard() {
    const container = document.getElementById('billboardListTranslative');
    if (!container) return;

    if (billboardData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>🎵 Aucun classement disponible</p>
            </div>
        `;
        return;
    }

    container.innerHTML = billboardData.map((track, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const artistName = track.profiles?.username || 'Artiste';
        const rating = track.average_rating?.toFixed(1) || '0.0';
        const votes = track.ratings_count || 0;

        // Nombre de digits pour ajustement responsive
        const rankDigits = rank < 10 ? '1' : rank < 100 ? '2' : '3';

        return `
            <div class="billboard-item ${rankClass}" data-rank-digits="${rankDigits}">
                <div class="rank-number">${rank}</div>
                <div class="billboard-track-info">
                    <div class="billboard-track-title">${escapeHtml(track.title)}</div>
                    <div class="billboard-track-artist">${escapeHtml(artistName)}</div>
                </div>
                <div class="billboard-votes">
                    <div class="votes-count">⭐ ${rating}</div>
                </div>
            </div>
        `;
    }).join('');

    // Ajouter les event listeners pour la lecture
    container.querySelectorAll('.billboard-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const track = billboardData[index];
            if (track && window.playTrack) {
                window.playTrack(
                    track.file_url,
                    track.title,
                    item,
                    track.profiles?.username || 'Artiste',
                    track.cover_url || null
                );
            }
        });
    });
}

// ==========================================
// RENDU D'ERREUR
// ==========================================
function renderError() {
    const container = document.getElementById('billboardListTranslative');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <p>❌ Erreur de chargement</p>
            <button onclick="window.billboardNeedsRefresh()" class="btn btn-sm btn-outline" style="margin-top: 12px;">
                Réessayer
            </button>
        </div>
    `;
}

// ==========================================
// MISE À JOUR DU TIMESTAMP
// ==========================================
function updateLastUpdateTime() {
    const element = document.getElementById('billboardLastUpdate');
    if (!element || !lastUpdate) return;
    
    const hours = String(lastUpdate.getHours()).padStart(2, '0');
    const minutes = String(lastUpdate.getMinutes()).padStart(2, '0');
    element.textContent = `Mise à jour: ${hours}:${minutes}`;
}

// ==========================================
// UTILITAIRE: ESCAPE HTML
// ==========================================
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ==========================================
// EXPORT DES FONCTIONS GLOBALES
// ==========================================
window.billboardNeedsRefresh = loadBillboard;
window.openBillboard = openBillboard;
window.closeBillboard = closeBillboard;

console.log('✅ Module Billboard Translative chargé');