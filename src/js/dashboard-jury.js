// ==========================================
// DASHBOARD JURY - AVEC RAFRAÎCHISSEMENT AUTO
// ==========================================
import { supabase, clearCache } from './supabaseClient.js';

let currentUser = null;
let currentUserRole = 'fan';
let currentPage = 0;
let currentFilter = 'all';
let isLoading = false;
let hasMoreData = true;
const ITEMS_PER_PAGE = 20;

const ratingCache = new Map();
const lastRatingTime = new Map();
// ==========================================
// NOUVELLES VARIABLES POUR OPTIMISATION
// ==========================================
let currentView = 'list'; // 'list', 'grid', 'covers'
let currentSort = 'rating_desc';
let searchQuery = '';
let allTracksCache = []; // Cache pour recherche locale
let isSearching = false;

// Intersection Observer pour lazy loading des images
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
                img.src = src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        }
    });
}, {
    rootMargin: '50px'
});

const notify = {
    success: (title, msg) => window.toast ? window.toast.success(title, msg) : console.log(`✅ ${title}: ${msg}`),
    error: (title, msg) => window.toast ? window.toast.error(title, msg) : console.error(`❌ ${title}: ${msg}`),
    warning: (title, msg) => window.toast ? window.toast.warning(title, msg) : console.warn(`⚠️ ${title}: ${msg}`)
};

function updateGlobalPlayerPlaylist(tracks) {
    if (!window.globalPlayer || !tracks || tracks.length === 0) {
        console.log('⚠️ Playlist player: pas de tracks ou player non initialisé');
        return;
    }

    const playlist = tracks
        .filter(track => track.file_url && track.file_url.startsWith('http'))
        .map(track => ({
            url: track.file_url,
            title: track.title || 'Sans titre',
            artist: track.artist || 'Artiste',
            coverUrl: track.coverUrl || null
        }));

    if (playlist.length > 0) {
        window.globalPlayer.setPlaylist(playlist, 0);
        console.log(`✅ Playlist mise à jour: ${playlist.length} tracks réelles`);
    }
}

// ==========================================
// INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Initialisation Dashboard Jury...');
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) { 
        window.location.replace('index.html'); 
        return; 
    }
    
    currentUser = session.user;
    currentUserRole = currentUser.user_metadata?.role || 'fan';

    // ✅ AFFICHER LE NOM DE L'UTILISATEUR
    const username = currentUser.user_metadata?.username || currentUser.email.split('@')[0];
    const headerName = document.getElementById('headerUsername');
    const sidebarName = document.getElementById('sidebarUsername');
    const sidebarInitial = document.getElementById('sidebarAvatarInitial');
    
    if (headerName) headerName.innerText = username.toUpperCase();
    if (sidebarName) sidebarName.innerText = username;
    if (sidebarInitial) sidebarInitial.innerText = username.charAt(0).toUpperCase();

    if (currentUserRole === 'artist') {
        showArtistInfo();
    }

    setupLogout();
    setupFilters();
    setupInfiniteScroll();
    setupRealtimeRatings();
    setupViewModeSwitcher();
    setupSort();
    setupSearch();
    setupCompactMode();  // ✅ AJOUTÉ  // ✅ AJOUTÉ

    // ✅ CORRECTION CRITIQUE : APPELER loadTracks()
    console.log('📡 Chargement des tracks...');
    await loadTracks();
    
    // ✅ CHARGER LES STATS
    await loadUserStats();
    
    console.log('✅ Dashboard Jury initialisé avec succès');
});

function showArtistInfo() {
    const hero = document.querySelector('.hero-player-section');
    if (!hero) return;
    
    const infoBar = document.createElement('div');
    infoBar.style.cssText = `
        background: rgba(123, 44, 191, 0.2);
        border: 1px solid #7b2cbf;
        padding: 15px 20px;
        margin-bottom: 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 15px;
    `;
    
    infoBar.innerHTML = `
        <span style="font-size: 1.5rem;">🎤</span>
        <div>
            <strong style="color: #7b2cbf;">MODE ARTISTE</strong><br>
            <span style="font-size: 0.9rem; color: #ccc;">Vous pouvez consulter les participants et les notes, mais vous ne pouvez pas noter.</span>
        </div>
    `;
    
    hero.insertBefore(infoBar, hero.firstChild);
}

// ==========================================
// ✅ CHARGEMENT DES TRACKS - TRIÉ PAR NOTE
// ==========================================
async function loadTracks(append = false) {
    if (isLoading || (!append && !hasMoreData && currentPage > 0)) return;
    
    isLoading = true;
    const container = document.getElementById('tracksGrid');
    
    // ✅ VÉRIFICATION + FALLBACK
    if (!container) {
        console.error('❌ Container #tracksGrid introuvable !');
        isLoading = false;
        return;
    }
    
    if (!append) {
        container.innerHTML = '<div class="loading-state">🎵 Chargement des tracks...</div>';
    }
    
    try {
        console.log('📡 Chargement des tracks, page:', currentPage, 'filter:', currentFilter);
        
       let query = supabase
    .from('tracks')
    .select('id, title, duration, average_rating, ratings_count, created_at, file_url, artist_id, cover_url');

// Filtres
if (currentFilter === 'new') {
    query = query.order('created_at', { ascending: false });
} else if (currentFilter === 'trending') {
    query = query.gte('ratings_count', 3).order('average_rating', { ascending: false });
} else if (currentFilter === 'voted') {
    const { data: ratedIds } = await supabase
        .from('ratings')
        .select('track_id')
        .eq('user_id', currentUser.id);
    
    const rated = ratedIds?.map(r => r.track_id) || [];
    if (rated.length > 0) {
        query = query.in('id', rated);
    } else {
        container.innerHTML = '<div class="empty-state">Vous n\'avez encore noté aucune track</div>';
        isLoading = false;
        return;
    }
}

// ✅ SORT (nouveau)
switch(currentSort) {
    case 'rating_desc':
        query = query.order('average_rating', { ascending: false })
                     .order('ratings_count', { ascending: false });
        break;
    case 'rating_asc':
        query = query.order('average_rating', { ascending: true });
        break;
    case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
    case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
    case 'popular':
        query = query.order('ratings_count', { ascending: false });
        break;
    case 'alpha':
        query = query.order('title', { ascending: true });
        break;
    default:
        query = query.order('average_rating', { ascending: false });
}

        query = query.range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);

        const { data: tracks, error } = await query;

        if (error) {
            console.error('❌ Erreur Supabase:', error);
            throw error;
        }

        console.log('✅ Tracks reçues:', tracks?.length || 0);

        if (!tracks || tracks.length === 0) {
            if (currentPage === 0) {
                container.innerHTML = '<div class="empty-state">Aucun participant pour le moment</div>';
            }
            hasMoreData = false;
            isLoading = false;
            return;
        }

        const artistIds = [...new Set(tracks.map(t => t.artist_id))];
        
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, social_spotify, social_youtube, social_instagram, social_tiktok, social_soundcloud')
            .in('id', artistIds);

        if (profilesError) {
            console.warn('⚠️ Erreur chargement profils:', profilesError);
        }

        const profilesMap = new Map();
        profiles?.forEach(p => profilesMap.set(p.id, p));

        const tracksWithRatings = await Promise.all(tracks.map(async (track) => {
            const userRating = currentUserRole === 'fan' ? await getUserRating(track.id) : null;
            const profile = profilesMap.get(track.artist_id);
            
            
            return {
                id: track.id,
                title: track.title,
                artist: profile?.username || 'Artiste Anonyme',
                averageRating: track.average_rating || 0,
                ratingsCount: track.ratings_count || 0,
                duration: track.duration || '0:00',
                file_url: track.file_url,
                artistId: track.artist_id,
                userRating: userRating,
                color: getRandomColor(),
                coverUrl: track.cover_url || null,
                avatarUrl: profile?.avatar_url || null,
                profile: profile || null
            };
        }));
        // ✅ METTRE EN CACHE POUR LA RECHERCHE
if (currentPage === 0) {
    allTracksCache = tracksWithRatings;
} else {
    allTracksCache = [...allTracksCache, ...tracksWithRatings];
}

// ✅ METTRE À JOUR LE COMPTEUR
updateTracksCount(allTracksCache.length);

        if (currentPage === 0 && !append) {
            updateGlobalPlayerPlaylist(tracksWithRatings);
        }

        if (currentPage === 0 && tracksWithRatings.length > 0) {
            renderHero(tracksWithRatings[0]);
        }

        if (append) {
            container.innerHTML += tracksWithRatings.map(track => createTrackCard(track)).join('');
        } else {
            container.innerHTML = tracksWithRatings.map(track => createTrackCard(track)).join('');
        }

        currentPage++;
        hasMoreData = tracks.length === ITEMS_PER_PAGE;

    } catch (error) {
        console.error('❌ Erreur fatale chargement tracks:', error);
        container.innerHTML = `
            <div class="error-state">
                ❌ Erreur de chargement<br>
                <small style="color: #888;">${error.message}</small>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// ==========================================
// RÉCUPÉRATION DE LA NOTE UTILISATEUR
// ==========================================
async function getUserRating(trackId) {
    const cacheKey = `${currentUser.id}-${trackId}`;
    
    if (ratingCache.has(cacheKey)) {
        return ratingCache.get(cacheKey);
    }

    const { data } = await supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', currentUser.id)
        .eq('track_id', trackId)
        .maybeSingle();
    
    const rating = data?.rating || null;
    ratingCache.set(cacheKey, rating);
    return rating;
}

// ==========================================
// ✅ SYSTÈME DE NOTATION AVEC RAFRAÎCHISSEMENT
// ==========================================
window.rateTrack = async function(trackId, artistId, rating) {
    if (currentUserRole === 'artist') {
        notify.warning('Notation impossible', 'Les artistes ne peuvent pas noter.');
        return;
    }
    
    if (!currentUser) {
        notify.warning('Connexion requise', 'Créez un compte pour noter');
        return;
    }

    if (rating < 0 || rating > 10) {
        notify.error('Note invalide', 'La note doit être entre 0 et 10');
        return;
    }

    const now = Date.now();
    const lastRating = lastRatingTime.get(currentUser.id) || 0;
    
    if (now - lastRating < 1000) {
        notify.warning('Trop rapide', 'Attendez 1 seconde entre chaque notation');
        return;
    }

    try {
        console.log('📊 Notation:', { trackId, rating });

        const { data, error } = await supabase.rpc('rate_track', {
            p_track_id: trackId,
            p_user_id: currentUser.id,
            p_rating: rating
        });

        if (error) {
            console.error('❌ Erreur RPC:', error);
            throw error;
        }


        lastRatingTime.set(currentUser.id, now);
        notify.success('Note enregistrée', `Vous avez donné ${rating}/10`);
        
        // Mise à jour UI locale immédiate
        updateRatingUI(trackId, rating, data);
        
        // Mise à jour cache
        ratingCache.set(`${currentUser.id}-${trackId}`, rating);
        clearCache();
        
        // ✅ RAFRAÎCHISSEMENT AUTOMATIQUE APRÈS NOTATION
        console.log('🔄 Rafraîchissement de l\'ordre des tracks...');
        
        // 1. Déclencher le refresh du billboard
        if (window.billboardNeedsRefresh) {
            window.billboardNeedsRefresh();
        }
        
        // 2. Recharger les tracks avec le nouvel ordre
        setTimeout(async () => {
            currentPage = 0;
            hasMoreData = true;
            await loadTracks(false);
            console.log('✅ Ordre des tracks mis à jour');
        }, 1000); // Délai de 1s pour laisser la DB se mettre à jour
        
    } catch (error) {
        console.error('❌ Erreur notation:', error);
        notify.error('Notation impossible', error.message || 'Une erreur est survenue');
    }
};

// ==========================================
// CHARGEMENT DES STATS UTILISATEUR
// ==========================================
async function loadUserStats() {
    try {
        console.log('📊 Chargement des statistiques...');
        
        // Stats de l'utilisateur
        const { data: userRatings } = await supabase
            .from('ratings')
            .select('rating', { count: 'exact' })
            .eq('user_id', currentUser.id);
        
        const votesGiven = userRatings?.length || 0;
        const avgRating = userRatings?.length > 0 
            ? (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1)
            : '0.0';
        
        // Total tracks disponibles
        const { count: totalTracks } = await supabase
            .from('tracks')
            .select('*', { count: 'exact', head: true });
        
        // Tracks non encore votées
        const tracksToVote = Math.max(0, (totalTracks || 0) - votesGiven);
        
        // Battles actives (simulation - à adapter selon votre logique)
        const activeBattles = 0;
        
        // ✅ METTRE À JOUR L'UI
        const statTracksToVote = document.getElementById('statTracksToVote');
        const statVotesGiven = document.getElementById('statVotesGiven');
        const statAvgRating = document.getElementById('statAvgRating');
        const statActiveBattles = document.getElementById('statActiveBattles');
        const sidebarVotes = document.getElementById('sidebarVotesGiven');
        const sidebarListened = document.getElementById('sidebarTracksListened');
        
        if (statTracksToVote) statTracksToVote.textContent = tracksToVote;
        if (statVotesGiven) statVotesGiven.textContent = votesGiven;
        if (statAvgRating) statAvgRating.textContent = avgRating;
        if (statActiveBattles) statActiveBattles.textContent = activeBattles;
        if (sidebarVotes) sidebarVotes.textContent = votesGiven;
        if (sidebarListened) sidebarListened.textContent = votesGiven;
        
        console.log('✅ Stats chargées:', { votesGiven, avgRating, tracksToVote });
        
    } catch (error) {
        console.error('❌ Erreur chargement stats:', error);
    }
}

// ==========================================
// MISE À JOUR UI APRÈS NOTATION
// ==========================================
function updateRatingUI(trackId, userRating, rpcData) {
    const ratingBar = document.querySelector(`[data-track-id="${trackId}"] .rating-bar`);
    if (ratingBar) {
        const slider = ratingBar.querySelector('.rating-slider');
        const display = ratingBar.querySelector('.rating-display');
        
        if (slider) slider.value = userRating;
        if (display) {
            display.textContent = `${userRating}/10`;
            display.classList.add('updated');
            setTimeout(() => display.classList.remove('updated'), 400);
        }
        
        updateSliderColor(slider, userRating);
    }

    if (rpcData) {
        const avgDisplay = document.querySelector(`[data-track-id="${trackId}"] .average-rating`);
        const countDisplay = document.querySelector(`[data-track-id="${trackId}"] .ratings-count`);
        
        if (avgDisplay && rpcData.new_average !== undefined) {
            avgDisplay.textContent = `⭐ ${rpcData.new_average.toFixed(1)}/10`;
            avgDisplay.classList.add('updated');
            setTimeout(() => avgDisplay.classList.remove('updated'), 400);
        }
        
        if (countDisplay && rpcData.new_count !== undefined) {
            countDisplay.textContent = `${rpcData.new_count} note${rpcData.new_count > 1 ? 's' : ''}`;
        }
    }

    confetti(ratingBar);
}

// ==========================================
// MISE À JOUR COULEUR SLIDER
// ==========================================
function updateSliderColor(slider, value) {
    if (!slider) return;
    
    let color;
    if (value >= 8) {
        color = '#4ade80';
    } else if (value >= 5) {
        color = '#fbbf24';
    } else {
        color = '#ef4444';
    }
    
    const percentage = (value / 10) * 100;
    slider.style.background = `linear-gradient(90deg, ${color} ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
}

// ==========================================
// ✅ TEMPS RÉEL - ÉCOUTE DES CHANGEMENTS
// ==========================================
function setupRealtimeRatings() {
    supabase
        .channel('public:tracks')
        .on('postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'tracks' 
            }, 
            (payload) => {
                console.log('📊 Mise à jour track reçue:', payload);
                
                const trackId = payload.new.id;
                const newAverage = payload.new.average_rating;
                const newCount = payload.new.ratings_count;
                
                updateRatingDisplay(trackId, newAverage, newCount);
                
                // ✅ Refresh automatique après un court délai
                setTimeout(() => {
                    if (window.billboardNeedsRefresh) {
                        window.billboardNeedsRefresh();
                    }
                    
                    // Rafraîchir la liste si on n'est pas en train de charger
                    if (!isLoading) {
                        console.log('🔄 Rafraîchissement automatique suite à une mise à jour...');
                        currentPage = 0;
                        hasMoreData = true;
                        loadTracks(false);
                    }
                }, 1500);
            }
        )
        .subscribe();
    
    console.log('✅ Écoute temps réel activée');
}

function updateRatingDisplay(trackId, newAverage, newCount) {
    const avgDisplay = document.querySelector(`[data-track-id="${trackId}"] .average-rating`);
    const countDisplay = document.querySelector(`[data-track-id="${trackId}"] .ratings-count`);
    
    if (avgDisplay) {
        avgDisplay.textContent = `⭐ ${(newAverage || 0).toFixed(1)}/10`;
        avgDisplay.classList.add('updated');
        setTimeout(() => avgDisplay.classList.remove('updated'), 400);
    }

    if (countDisplay) {
        countDisplay.textContent = `${newCount || 0} note${newCount > 1 ? 's' : ''}`;
    }
}

// ==========================================
// GÉNÉRATION RÉSEAUX SOCIAUX
// ==========================================
function generateSocialLinks(profile) {
    if (!profile) return '';
    
    const links = [];
    
    if (profile.social_instagram) {
        const username = profile.social_instagram.replace('@', '').split('/').pop();
        links.push(`
            <a href="https://instagram.com/${username}" target="_blank" class="social-link">
                <span class="social-icon">📸</span>
                <span>Instagram</span>
            </a>
        `);
    }
    
    if (profile.social_spotify) {
        let url = profile.social_spotify;
        if (!url.startsWith('http')) url = 'https://' + url;
        links.push(`
            <a href="${url}" target="_blank" class="social-link">
                <span class="social-icon">🎵</span>
                <span>Spotify</span>
            </a>
        `);
    }
    
    if (profile.social_youtube) {
        let url = profile.social_youtube;
        if (!url.startsWith('http')) url = 'https://' + url;
        links.push(`
            <a href="${url}" target="_blank" class="social-link">
                <span class="social-icon">▶️</span>
                <span>YouTube</span>
            </a>
        `);
    }
    
    if (profile.social_soundcloud) {
        let url = profile.social_soundcloud;
        if (!url.startsWith('http')) url = 'https://' + url;
        links.push(`
            <a href="${url}" target="_blank" class="social-link">
                <span class="social-icon">🎶</span>
                <span>SoundCloud</span>
            </a>
        `);
    }
    
    if (profile.social_tiktok) {
        const username = profile.social_tiktok.replace('@', '').split('/').pop();
        links.push(`
            <a href="https://tiktok.com/@${username}" target="_blank" class="social-link">
                <span class="social-icon">🎥</span>
                <span>TikTok</span>
            </a>
        `);
    }
    
    if (links.length === 0) return '';
    
    return `
        <div class="artist-socials" style="display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0;">
            ${links.join('')}
        </div>
    `;
}

function generateCompactSocials(profile) {
    if (!profile) return '';
    
    const icons = [];
    
    if (profile.social_instagram) {
        const username = profile.social_instagram.replace('@', '').split('/').pop();
        icons.push(`<a href="https://instagram.com/${username}" target="_blank" class="social-icon-mini" title="Instagram">📸</a>`);
    }
    
    if (profile.social_spotify) {
        let url = profile.social_spotify;
        if (!url.startsWith('http')) url = 'https://' + url;
        icons.push(`<a href="${url}" target="_blank" class="social-icon-mini" title="Spotify">🎵</a>`);
    }
    
    if (profile.social_youtube) {
        let url = profile.social_youtube;
        if (!url.startsWith('http')) url = 'https://' + url;
        icons.push(`<a href="${url}" target="_blank" class="social-icon-mini" title="YouTube">▶️</a>`);
    }
    
    if (profile.social_soundcloud) {
        let url = profile.social_soundcloud;
        if (!url.startsWith('http')) url = 'https://' + url;
        icons.push(`<a href="${url}" target="_blank" class="social-icon-mini" title="SoundCloud">🎶</a>`);
    }
    
    if (profile.social_tiktok) {
        const username = profile.social_tiktok.replace('@', '').split('/').pop();
        icons.push(`<a href="https://tiktok.com/@${username}" target="_blank" class="social-icon-mini" title="TikTok">🎥</a>`);
    }
    
    if (icons.length === 0) return '';
    
    return `
        <div class="social-icons-row" style="display: flex; gap: 8px; margin-top: 8px;">
            ${icons.join('')}
        </div>
    `;
}

// ==========================================
// RENDU HERO
// ==========================================
function renderHero(track) {
    const container = document.getElementById('heroPlayer');
    if (!container) return;

    let ratingSection;
    
    if (currentUserRole === 'artist') {
        ratingSection = `
            <div class="hero-rating-disabled">
                🔒 NOTATION RÉSERVÉE AU JURY
            </div>
        `;
    } else {
        ratingSection = `
            <div class="hero-rating-section">
                <div class="rating-bar-hero">
                    <label>Votre note :</label>
                    <input type="range" min="0" max="10" step="0.5" value="${track.userRating || 0}" 
                           class="rating-slider-hero" 
                           oninput="updateHeroRatingDisplay(this.value)"
                           onchange="rateTrack(${track.id}, '${track.artistId}', parseFloat(this.value))">
                    <span class="rating-display-hero">${track.userRating || 0}/10</span>
                </div>
            </div>
        `;
    }

    const socialLinks = generateSocialLinks(track.profile);

    const coverStyle = track.coverUrl 
        ? `background-image: url('${track.coverUrl}'); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, ${track.color}, #000);`;

    container.innerHTML = `
        <div class="hero-visual" style="${coverStyle}">
            ${!track.coverUrl ? '🎵' : ''}
        </div>
        <div class="hero-content">
            <div class="hero-meta">
                <span class="meta-tag">🏆 TOP TENDANCE</span>
            </div>
            <h1 class="hero-title">${escapeHtml(track.title)}</h1>
            <h3 class="hero-artist">${escapeHtml(track.artist)}</h3>
            
            ${socialLinks}
            
            <div class="hero-controls">
                <button class="btn-play-hero" onclick="playTrack('${track.file_url}', '${escapeHtml(track.title).replace(/'/g, "\\'")}', this, '${escapeHtml(track.artist).replace(/'/g, "\\'")}', ${track.coverUrl ? `'${track.coverUrl}'` : 'null'}, ${track.avatarUrl ? `'${track.avatarUrl}'` : 'null'})">
                    ▶ ÉCOUTER
                </button>
                <div class="hero-stats">
                    <div class="stat-big">
                        ⭐ ${track.averageRating.toFixed(1)}/10
                        <small>(${track.ratingsCount} note${track.ratingsCount > 1 ? 's' : ''})</small>
                    </div>
                </div>
            </div>
            ${ratingSection}
        </div>
    `;
    
    if (track.userRating) {
        const heroSlider = container.querySelector('.rating-slider-hero');
        if (heroSlider) updateSliderColor(heroSlider, track.userRating);
    }
}

window.updateHeroRatingDisplay = function(value) {
    const display = document.querySelector('.rating-display-hero');
    if (display) display.textContent = `${value}/10`;
    
    const slider = document.querySelector('.rating-slider-hero');
    if (slider) updateSliderColor(slider, parseFloat(value));
};

// ==========================================
// RENDU GRILLE + LISTE (OPTIMISÉ)
// ==========================================
function createTrackCard(track) {
    const safeTitle = escapeHtml(track.title).replace(/'/g, "\\'");
    const safeArtist = escapeHtml(track.artist).replace(/'/g, "\\'");
    
    // Mode liste compacte
    if (currentView === 'list') {
        return createListItem(track, safeTitle, safeArtist);
    }
    
    // Mode grille/covers (existant)
    return createGridCard(track, safeTitle, safeArtist);
}
window.updateRatingDisplay = function(slider, trackId) {
    const value = parseFloat(slider.value);
    const display = slider.parentElement.querySelector('.rating-display');
    if (display) display.textContent = `${value}/10`;
    updateSliderColor(slider, value);
};

// ==========================================
// UTILITAIRES
// ==========================================
function setupLogout() {
    const btn = document.getElementById('headerLogoutBtn');
    if (btn) {
        btn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            clearCache();
            window.location.href = 'index.html';
        });
    }
}

function setupFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage = 0;
            hasMoreData = true;
            loadTracks();
        });
    });
    
    // ✅ SIDEBAR FILTERS
    document.querySelectorAll('.sidebar-link[data-filter]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = link.getAttribute('data-filter');
            
            // Activer visuellement
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Appliquer le filtre
            currentFilter = filter;
            currentPage = 0;
            hasMoreData = true;
            loadTracks();
        });
    });
}

// ==========================================
// SETUP VIEW MODE SWITCHER
// ==========================================
function setupViewModeSwitcher() {
    const viewBtns = document.querySelectorAll('.view-btn');
    const container = document.getElementById('tracksGrid');
    
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            
            // Update active state
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update view
            currentView = view;
            
            // Update container class
            if (container) {
                container.className = `tracks-grid view-${view}`;
            }
            
            // Save preference
            localStorage.setItem('wrc_view_mode', view);
            
            console.log('🎨 Mode d\'affichage:', view);
        });
    });
    
    // Restore saved preference
    const savedView = localStorage.getItem('wrc_view_mode');
    if (savedView) {
        const btn = document.querySelector(`[data-view="${savedView}"]`);
        if (btn) btn.click();
    }
}

// ==========================================
// SETUP SORT
// ==========================================
function setupSort() {
    const sortSelect = document.getElementById('trackSort');
    if (!sortSelect) return;
    
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 0;
        hasMoreData = true;
        loadTracks(false);
    });
}

// ==========================================
// SETUP SEARCH
// ==========================================
function setupSearch() {
    const searchInput = document.getElementById('tracksSearchInput');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchQuery = e.target.value.trim().toLowerCase();
        
        searchTimeout = setTimeout(() => {
            if (searchQuery.length > 0) {
                performSearch(searchQuery);
            } else {
                // Reset to normal view
                currentPage = 0;
                hasMoreData = true;
                isSearching = false;
                loadTracks(false);
            }
        }, 300);
    });
}

// ==========================================
// RECHERCHE LOCALE (RAPIDE)
// ==========================================
function performSearch(query) {
    isSearching = true;
    const container = document.getElementById('tracksGrid');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-state">🔍 Recherche...</div>';
    
    setTimeout(() => {
        const results = allTracksCache.filter(track => {
            const titleMatch = track.title.toLowerCase().includes(query);
            const artistMatch = track.artist.toLowerCase().includes(query);
            return titleMatch || artistMatch;
        });
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    🔍 Aucun résultat pour "<strong>${escapeHtml(query)}</strong>"
                </div>
            `;
        } else {
            container.innerHTML = results.map(track => createTrackCard(track)).join('');
            updateTracksCount(results.length);
            lazyLoadImages();
        }
    }, 100);
}

function setupInfiniteScroll() {
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (ticking) return;
        
        ticking = true;
        requestAnimationFrame(() => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                loadTracks(true);
            }
            ticking = false;
        });
    });
}

function getRandomColor() {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function escapeHtml(text) {
    if (!text) return "";
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function confetti(element) {
    if (!element) return;
    
    for(let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed; width: 4px; height: 4px; 
            background: #4ade80; border-radius: 50%; 
            left: ${element.getBoundingClientRect().left + 20}px; 
            top: ${element.getBoundingClientRect().top}px; 
            pointer-events: none; z-index: 10000;
        `;
        document.body.appendChild(particle);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = 1 + Math.random() * 2;
        let x = 0, y = 0, opacity = 1;
        
        const animate = () => {
            x += Math.cos(angle) * velocity; 
            y += Math.sin(angle) * velocity + 0.5;
            opacity -= 0.02;
            particle.style.transform = `translate(${x}px, ${y}px)`;
            particle.style.opacity = opacity;
            if(opacity > 0) requestAnimationFrame(animate);
            else particle.remove();
        };
        animate();
    }
}

console.log

// ==========================================
// LAZY LOADING DES IMAGES
// ==========================================
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => imageObserver.observe(img));
}

// ==========================================
// UPDATE TRACKS COUNT
// ==========================================
function updateTracksCount(count) {
    const badge = document.getElementById('tracksCount');
    if (badge) badge.textContent = count;
}



// ==========================================
// MODE LISTE COMPACTE (HAUTE DENSITÉ)
// ==========================================
function createListItem(track, safeTitle, safeArtist) {
    let ratingBar;
    
    if (currentUserRole === 'artist') {
        ratingBar = `<span class="list-rating-disabled">🔒</span>`;
    } else {
        ratingBar = `
            <div class="list-rating-bar">
                <input type="range" min="0" max="10" step="0.5" value="${track.userRating || 0}" 
                       class="rating-slider-mini" 
                       oninput="updateRatingDisplay(this, ${track.id})"
                       onchange="rateTrack(${track.id}, '${track.artistId}', parseFloat(this.value))">
                <span class="rating-display-mini">${track.userRating || 0}</span>
            </div>
        `;
    }

    const coverThumb = track.coverUrl 
        ? `<img data-src="${track.coverUrl}" alt="${safeTitle}" class="list-cover-img lazy">`
        : '<span class="list-cover-icon">🎵</span>';

    const socialIcons = track.profile ? generateMicroSocials(track.profile) : '';

    return `
        <div class="track-list-item" data-track-id="${track.id}">
            <div class="list-cover">
                ${coverThumb}
            </div>
            
            <div class="list-info">
                <div class="list-title">${escapeHtml(track.title)}</div>
                <div class="list-meta">
                    <span class="list-artist">${escapeHtml(track.artist)}</span>
                    ${socialIcons}
                </div>
            </div>
            
            <div class="list-stats">
                <span class="list-stat">⭐ ${track.averageRating.toFixed(1)}</span>
                <span class="list-stat-count">${track.ratingsCount} votes</span>
            </div>
            
            <div class="list-rating">
                ${ratingBar}
            </div>
            
            <button class="list-play-btn" 
                onclick="playTrack('${track.file_url}', '${safeTitle}', this, '${safeArtist}', ${track.coverUrl ? `'${track.coverUrl}'` : 'null'}, ${track.avatarUrl ? `'${track.avatarUrl}'` : 'null'})" 
                aria-label="Jouer">
                ▶
            </button>
        </div>
    `;
}

// ==========================================
// MODE GRILLE (EXISTANT AMÉLIORÉ)
// ==========================================
function createGridCard(track, safeTitle, safeArtist) {
    let ratingBar;
    
    if (currentUserRole === 'artist') {
        ratingBar = `<div class="rating-disabled">🔒 Notation réservée au jury</div>`;
    } else {
        ratingBar = `
            <div class="rating-bar">
                <input type="range" min="0" max="10" step="0.5" value="${track.userRating || 0}" 
                       class="rating-slider" 
                       oninput="updateRatingDisplay(this, ${track.id})"
                       onchange="rateTrack(${track.id}, '${track.artistId}', parseFloat(this.value))">
                <span class="rating-display">${track.userRating || 0}/10</span>
            </div>
        `;
    }

    // ✅ LAZY LOADING pour les covers
    const coverElement = track.coverUrl 
        ? `<img data-src="${track.coverUrl}" alt="${safeTitle}" class="card-cover-img lazy">`
        : '<span class="card-cover-icon">🎵</span>';

    const coverStyle = track.coverUrl 
        ? ''
        : `background: linear-gradient(135deg, ${track.color}, rgba(0,0,0,0.8));`;

    const socialIcons = generateCompactSocials(track.profile);

    return `
        <div class="track-card" data-track-id="${track.id}">
            <div class="card-cover" style="${coverStyle}">
                ${coverElement}
                <button class="card-play-btn" 
                    onclick="playTrack('${track.file_url}', '${safeTitle}', this, '${safeArtist}', ${track.coverUrl ? `'${track.coverUrl}'` : 'null'}, ${track.avatarUrl ? `'${track.avatarUrl}'` : 'null'})" 
                    aria-label="Jouer">▶</button>
            </div>
            <div class="card-body">
                <div class="card-info">
                    <h4>${escapeHtml(track.title)}</h4>
                    <p>${escapeHtml(track.artist)}</p>
                    ${socialIcons}
                </div>
                <div class="card-stats">
                    <span class="average-rating">⭐ ${track.averageRating.toFixed(1)}/10</span>
                    <span class="ratings-count">${track.ratingsCount} note${track.ratingsCount > 1 ? 's' : ''}</span>
                </div>
                <div class="card-rating">
                    ${ratingBar}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// MICRO SOCIALS (LISTE)
// ==========================================
function generateMicroSocials(profile) {
    if (!profile) return '';
    
    const icons = [];
    
    if (profile.social_instagram) icons.push('📸');
    if (profile.social_spotify) icons.push('🎵');
    if (profile.social_youtube) icons.push('▶️');
    
    if (icons.length === 0) return '';
    
    return `<span class="micro-socials">${icons.join(' ')}</span>`;
}

// ==========================================
// SETUP COMPACT MODE
// ==========================================
function setupCompactMode() {
    const toggleBtn = document.getElementById('compactToggle');
    if (!toggleBtn) return;
    
    // Restaurer la préférence sauvegardée
    const savedMode = localStorage.getItem('wrc_compact_mode');
    if (savedMode === 'true') {
        document.body.classList.add('compact-mode');
    }
    
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('compact-mode');
        
        const isCompact = document.body.classList.contains('compact-mode');
        localStorage.setItem('wrc_compact_mode', isCompact);
        
        if (window.toast) {
            window.toast.info(
                'Mode d\'affichage', 
                isCompact ? 'Mode compact activé' : 'Mode normal activé'
            );
        }
        
        console.log('🎨 Mode compact:', isCompact ? 'ON' : 'OFF');
    });
}

console.log('✅ Dashboard Jury optimisé chargé');