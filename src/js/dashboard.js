/**
 * WRC 2026 - Dashboard Module
 * Gestion du dashboard jury avec données Supabase
 * @version 4.0
 */

import { supabase, fetchLeaderboard, clearCache } from './supabaseClient.js';

// ==========================================
// STATE
// ==========================================
let currentUser = null;
let artists = [];
let currentPlayingTrack = null;

// ==========================================
// TOAST HELPER
// ==========================================
const toast = {
    success: (msg) => window.showToast?.(msg, 'success') || console.log('✅', msg),
    error: (msg) => window.showToast?.(msg, 'error') || console.error('❌', msg),
    info: (msg) => window.showToast?.(msg, 'info') || console.log('ℹ️', msg)
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎤 Dashboard initializing...');
    
    // Vérifier la session
    await checkAuth();
    
    // Charger les données
    await Promise.all([
        loadStats(),
        loadArtists(),
        loadLeaderboard()
    ]);
    
    // Setup realtime
    setupRealtime();
    
    console.log('✅ Dashboard ready');
});

// ==========================================
// AUTH CHECK
// ==========================================
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            console.warn('⚠️ No session, checking local storage...');
            const localUser = localStorage.getItem('wrc_user') || sessionStorage.getItem('wrc_user');
            if (localUser) {
                currentUser = JSON.parse(localUser);
                return;
            }
            return;
        }
        
        currentUser = session.user;
        
        // Récupérer le profil complet
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (profile) {
            currentUser = { ...currentUser, ...profile };
        }
        
        console.log('✅ User authenticated:', currentUser.email);
        
    } catch (err) {
        console.error('Auth check error:', err);
    }
}

// ==========================================
// LOAD STATS
// ==========================================
async function loadStats() {
    try {
        // Récupérer les stats via RPC ou requêtes directes
        const { data: stats, error } = await supabase.rpc('get_global_stats');
        
        if (error) {
            // Fallback: requêtes individuelles
            const [artistsRes, tracksRes, votesRes] = await Promise.all([
                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'artist'),
                supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('profiles').select('votes_received').eq('role', 'artist')
            ]);
            
            updateStatsUI({
                total_artists: artistsRes.count || 0,
                total_tracks: tracksRes.count || 0,
                total_votes: votesRes.data?.reduce((sum, p) => sum + (p.votes_received || 0), 0) || 0
            });
            return;
        }
        
        updateStatsUI(stats);
        
    } catch (err) {
        console.error('Load stats error:', err);
        // Afficher des stats par défaut
        updateStatsUI({ total_artists: 0, total_tracks: 0, total_votes: 0 });
    }
}

function updateStatsUI(stats) {
    const elements = {
        totalArtists: document.getElementById('totalArtists'),
        totalTracks: document.getElementById('totalTracks'),
        totalVotes: document.getElementById('totalVotes'),
        remainingTime: document.getElementById('remainingTime')
    };
    
    if (elements.totalArtists) {
        elements.totalArtists.textContent = formatNumber(stats.total_artists || 0);
    }
    if (elements.totalTracks) {
        elements.totalTracks.textContent = formatNumber(stats.total_tracks || 0);
    }
    if (elements.totalVotes) {
        elements.totalVotes.textContent = formatNumber(stats.total_votes || 0);
    }
    if (elements.remainingTime) {
        // Calculer les jours restants jusqu'à la fin des inscriptions
        const endDate = new Date('2026-06-01');
        const now = new Date();
        const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        elements.remainingTime.textContent = diff > 0 ? diff : 0;
    }
}

// ==========================================
// LOAD ARTISTS
// ==========================================
async function loadArtists() {
    const container = document.getElementById('artistsList');
    if (!container) return;
    
    try {
        // Charger les artistes avec leurs tracks
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                id,
                username,
                stage_name,
                avatar_url,
                country,
                city,
                votes_received,
                tracks_count,
                tracks (
                    id,
                    title,
                    file_url,
                    votes_count,
                    duration
                )
            `)
            .eq('role', 'artist')
            .eq('is_active', true)
            .order('votes_received', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        artists = data || [];
        renderArtists(container, artists);
        
        // Mettre à jour la playlist du player
        updatePlayerPlaylist();
        
    } catch (err) {
        console.error('Load artists error:', err);
        container.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                Erreur de chargement des artistes
            </div>
        `;
    }
}

function renderArtists(container, artists) {
    if (!artists.length) {
        container.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                Aucun artiste inscrit pour le moment
            </div>
        `;
        return;
    }
    
    container.innerHTML = artists.map(artist => `
        <div class="artist-card" data-artist-id="${artist.id}">
            <div class="artist-avatar">
                ${artist.avatar_url 
                    ? `<img src="${artist.avatar_url}" alt="${artist.stage_name || artist.username}">`
                    : `<span>🎤</span>`
                }
            </div>
            <div class="artist-info">
                <div class="artist-name">${artist.stage_name || artist.username || 'Artiste'}</div>
                <div class="artist-meta">${artist.city || ''} ${artist.country ? getFlag(artist.country) : ''} • ${artist.tracks_count || 0} tracks</div>
            </div>
            <div class="artist-stats">
                <span class="artist-votes">${formatNumber(artist.votes_received || 0)}</span>
                <span class="artist-votes-label">votes</span>
            </div>
            ${artist.tracks?.length ? `
                <button class="btn btn-sm btn-primary artist-play" onclick="playArtistTrack('${artist.id}')">
                    ▶
                </button>
            ` : ''}
            <button class="btn btn-sm btn-outline artist-vote" onclick="voteForArtist('${artist.id}')" ${!currentUser ? 'disabled title="Connectez-vous pour voter"' : ''}>
                ⚖️ Voter
            </button>
        </div>
    `).join('');
    
    // Ajouter styles inline si pas dans CSS
    if (!document.getElementById('artist-card-styles')) {
        const style = document.createElement('style');
        style.id = 'artist-card-styles';
        style.textContent = `
            .artist-card {
                display: flex;
                align-items: center;
                gap: var(--space-4);
                padding: var(--space-4);
                background: var(--glass-light);
                border: 1px solid var(--border-light);
                border-radius: var(--radius-xl);
                transition: all 200ms var(--ease-out);
            }
            .artist-card:hover {
                background: var(--glass-medium);
                border-color: var(--border-medium);
                transform: translateX(4px);
            }
            .artist-avatar {
                width: 48px;
                height: 48px;
                border-radius: var(--radius-xl);
                background: linear-gradient(135deg, var(--primary) 0%, var(--accent-pink) 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                flex-shrink: 0;
                overflow: hidden;
            }
            .artist-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .artist-info {
                flex: 1;
                min-width: 0;
            }
            .artist-name {
                font-weight: var(--weight-semibold);
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .artist-meta {
                font-size: var(--text-sm);
                color: var(--text-muted);
            }
            .artist-stats {
                text-align: center;
                padding: 0 var(--space-3);
            }
            .artist-votes {
                font-family: var(--font-display);
                font-size: var(--text-xl);
                font-weight: var(--weight-bold);
                color: var(--primary-400);
            }
            .artist-votes-label {
                display: block;
                font-size: var(--text-2xs);
                color: var(--text-muted);
                text-transform: uppercase;
            }
        `;
        document.head.appendChild(style);
    }
}

// ==========================================
// LOAD LEADERBOARD
// ==========================================
async function loadLeaderboard() {
    const container = document.getElementById('leaderboardList');
    if (!container) return;
    
    try {
        const data = await fetchLeaderboard(10);
        renderLeaderboard(container, data || []);
    } catch (err) {
        console.error('Load leaderboard error:', err);
        container.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                Erreur de chargement
            </div>
        `;
    }
}

function renderLeaderboard(container, data) {
    if (!data.length) {
        container.innerHTML = `
            <div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">
                Aucun classement disponible
            </div>
        `;
        return;
    }
    
    container.innerHTML = data.map((artist, index) => `
        <div class="leaderboard-item">
            <div class="leaderboard-rank ${index < 3 ? ['gold', 'silver', 'bronze'][index] : ''}">
                ${index + 1}
            </div>
            <div class="leaderboard-avatar">
                ${artist.avatar_url 
                    ? `<img src="${artist.avatar_url}" alt="">`
                    : `🎤`
                }
            </div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">${artist.stage_name || artist.username || 'Artiste'}</div>
                <div class="leaderboard-meta">${getFlag(artist.country)} ${artist.country || ''}</div>
            </div>
            <div class="leaderboard-score">${formatNumber(artist.votes_received || 0)}</div>
        </div>
    `).join('');
}

// ==========================================
// VOTING
// ==========================================
window.voteForArtist = async function(artistId) {
    if (!currentUser) {
        toast.error('Connectez-vous pour voter');
        window.openAuth?.('fan');
        return;
    }
    
    try {
        // Trouver un track de l'artiste
        const artist = artists.find(a => a.id === artistId);
        if (!artist?.tracks?.length) {
            toast.error('Cet artiste n\'a pas de track à voter');
            return;
        }
        
        const trackId = artist.tracks[0].id;
        
        const { data, error } = await supabase.rpc('vote_for_track', {
            p_track_id: trackId,
            p_user_id: currentUser.id
        });
        
        if (error) throw error;
        
        if (data?.success) {
            toast.success(data.message || 'Vote enregistré !');
            clearCache();
            await loadArtists();
            await loadLeaderboard();
            await loadStats();
        } else {
            toast.info(data?.message || 'Vote non enregistré');
        }
        
    } catch (err) {
        console.error('Vote error:', err);
        toast.error(err.message || 'Erreur lors du vote');
    }
};

// ==========================================
// PLAYER INTEGRATION
// ==========================================
function updatePlayerPlaylist() {
    if (!window.globalPlayer) return;
    
    const allTracks = artists.flatMap(artist => 
        (artist.tracks || []).map(track => ({
            url: track.file_url,
            title: track.title || 'Sans titre',
            artist: artist.stage_name || artist.username || 'Artiste',
            coverUrl: artist.avatar_url
        }))
    ).filter(t => t.url);
    
    if (allTracks.length) {
        window.globalPlayer.setPlaylist(allTracks);
        console.log(`✅ Playlist: ${allTracks.length} tracks`);
    }
}

window.playArtistTrack = function(artistId) {
    const artist = artists.find(a => a.id === artistId);
    if (!artist?.tracks?.length) return;
    
    const track = artist.tracks[0];
    if (window.globalPlayer && track.file_url) {
        window.globalPlayer.setPlaylist([{
            url: track.file_url,
            title: track.title || 'Sans titre',
            artist: artist.stage_name || artist.username
        }], 0);
        window.globalPlayer.play();
    }
};

// ==========================================
// REALTIME UPDATES
// ==========================================
function setupRealtime() {
    // Écouter les changements sur les profils (votes)
    const profilesChannel = supabase
        .channel('profiles-changes')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: 'role=eq.artist'
        }, (payload) => {
            console.log('📡 Realtime update:', payload);
            // Rafraîchir les données
            loadLeaderboard();
            loadStats();
        })
        .subscribe();
    
    // Écouter les nouveaux tracks
    const tracksChannel = supabase
        .channel('tracks-changes')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'tracks'
        }, () => {
            loadArtists();
            loadStats();
        })
        .subscribe();
}

// ==========================================
// HELPERS
// ==========================================
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function getFlag(countryCode) {
    if (!countryCode) return '';
    const flags = {
        'FR': '🇫🇷', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'ES': '🇪🇸',
        'IT': '🇮🇹', 'BE': '🇧🇪', 'CH': '🇨🇭', 'CA': '🇨🇦', 'BR': '🇧🇷',
        'JP': '🇯🇵', 'KR': '🇰🇷', 'AU': '🇦🇺', 'NL': '🇳🇱', 'PT': '🇵🇹'
    };
    return flags[countryCode.toUpperCase()] || `[${countryCode}]`;
}

console.log('✅ Dashboard module loaded');
