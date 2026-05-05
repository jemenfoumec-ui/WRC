/**
 * WRC 2026 - Jury Module Index
 */

import { juryApi } from './JuryApi.js';
import { juryUI } from './JuryUI.js';
import { logger } from '../core/config.js';
import { showToast } from '../auth/toast.js';

class JuryDashboard {
    constructor() {
        this.currentUser = null;
        this.currentUserRole = 'fan';
        this.currentPage = 0;
        this.currentFilter = 'all';
        this.currentSort = 'rating_desc';
        this.currentView = localStorage.getItem('wrc_view_mode') || 'grid';
        this.isLoading = false;
        this.hasMoreData = true;
        this.ITEMS_PER_PAGE = 20;
        this.allTracksCache = [];
        this.ratingCache = new Map();
        this.lastRatingTime = new Map();
    }

    async init() {
        logger.info('🎬 Initializing Jury Dashboard...');
        
        try {
            const session = await juryApi.getSession();
            if (!session) {
                window.location.replace('index.html');
                return;
            }
            
            this.currentUser = session.user;
            this.currentUserRole = this.currentUser.user_metadata?.role || 'fan';

            this.updateUserDisplay();
            this.setupEventListeners();
            this.setupRealtime();
            
            await this.loadInitialData();
            
            logger.info('✅ Jury Dashboard ready');
        } catch (error) {
            logger.error('Jury init error:', error);
            showToast('Erreur d\'initialisation', 'error');
        }
    }

    updateUserDisplay() {
        const username = this.currentUser.user_metadata?.username || this.currentUser.email.split('@')[0];
        const elements = {
            headerUsername: document.getElementById('headerUsername'),
            sidebarUsername: document.getElementById('sidebarUsername'),
            sidebarAvatarInitial: document.getElementById('sidebarAvatarInitial')
        };
        
        if (elements.headerUsername) elements.headerUsername.innerText = username.toUpperCase();
        if (elements.sidebarUsername) elements.sidebarUsername.innerText = username;
        if (elements.sidebarAvatarInitial) elements.sidebarAvatarInitial.innerText = username.charAt(0).toUpperCase();

        if (this.currentUserRole === 'artist') {
            this.showArtistWarning();
        }
    }

    showArtistWarning() {
        const hero = document.querySelector('.hero-player-section');
        if (!hero) return;
        
        const infoBar = document.createElement('div');
        infoBar.className = 'artist-mode-warning';
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

    async loadInitialData() {
        await Promise.all([
            this.loadTracks(),
            this.loadStats()
        ]);
    }

    async loadTracks(append = false) {
        if (this.isLoading || (!append && !this.hasMoreData && this.currentPage > 0)) return;
        
        this.isLoading = true;
        const container = document.getElementById('tracksGrid');
        if (!container) return;

        if (!append) {
            container.innerHTML = '<div class="loading-state">🎵 Chargement des tracks...</div>';
            this.currentPage = 0;
            this.hasMoreData = true;
        }

        try {
            const tracks = await juryApi.fetchTracks({
                page: this.currentPage,
                itemsPerPage: this.ITEMS_PER_PAGE,
                filter: this.currentFilter,
                sort: this.currentSort,
                userId: this.currentUser.id
            });

            if (!tracks || tracks.length === 0) {
                if (this.currentPage === 0) {
                    container.innerHTML = '<div class="empty-state">Aucun participant pour le moment</div>';
                }
                this.hasMoreData = false;
                return;
            }

            const artistIds = [...new Set(tracks.map(t => t.artist_id))];
            const profiles = await juryApi.getProfiles(artistIds);
            const profilesMap = new Map(profiles.map(p => [p.id, p]));

            const enrichedTracks = await Promise.all(tracks.map(async (track) => {
                const userRating = this.currentUserRole === 'fan' ? await this.getCachedUserRating(track.id) : null;
                const profile = profilesMap.get(track.artist_id);
                
                return {
                    ...track,
                    artist: profile?.username || 'Artiste Anonyme',
                    userRating,
                    avatarUrl: profile?.avatar_url || null,
                    profile: profile || null,
                    averageRating: track.average_rating || 0,
                    ratingsCount: track.ratings_count || 0
                };
            }));

            if (this.currentPage === 0) {
                this.allTracksCache = enrichedTracks;
                if (enrichedTracks.length > 0) {
                    juryUI.renderHero(enrichedTracks[0], this.currentUserRole);
                    this.updateGlobalPlaylist(enrichedTracks);
                }
            } else {
                this.allTracksCache = [...this.allTracksCache, ...enrichedTracks];
            }

            this.updateTracksCount(this.allTracksCache.length);

            juryUI.renderTracks(container, enrichedTracks, {
                append,
                currentView: this.currentView,
                currentUserRole: this.currentUserRole
            });

            this.currentPage++;
            this.hasMoreData = tracks.length === this.ITEMS_PER_PAGE;

        } catch (error) {
            logger.error('Load tracks error:', error);
            container.innerHTML = `<div class="error-state">❌ Erreur de chargement</div>`;
        } finally {
            this.isLoading = false;
        }
    }

    async getCachedUserRating(trackId) {
        const cacheKey = `${this.currentUser.id}-${trackId}`;
        if (this.ratingCache.has(cacheKey)) return this.ratingCache.get(cacheKey);
        
        const rating = await juryApi.getUserRating(this.currentUser.id, trackId);
        this.ratingCache.set(cacheKey, rating);
        return rating;
    }

    async loadStats() {
        try {
            const stats = await juryApi.getUserStats(this.currentUser.id);
            this.updateStatsUI(stats);
        } catch (error) {
            logger.error('Load stats error:', error);
        }
    }

    updateStatsUI(stats) {
        const map = {
            'statTracksToVote': stats.tracksToVote,
            'statVotesGiven': stats.votesGiven,
            'statAvgRating': stats.avgRating,
            'sidebarVotesGiven': stats.votesGiven,
            'sidebarTracksListened': stats.votesGiven
        };

        for (const [id, value] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }

    updateTracksCount(count) {
        const el = document.getElementById('tracksCount');
        if (el) el.textContent = count;
    }

    updateGlobalPlaylist(tracks) {
        if (!window.globalPlayer) return;
        const playlist = tracks
            .filter(t => t.file_url)
            .map(t => ({
                url: t.file_url,
                title: t.title,
                artist: t.artist,
                coverUrl: t.cover_url
            }));
        window.globalPlayer.setPlaylist(playlist, 0);
    }

    setupEventListeners() {
        // Filters
        document.querySelectorAll('.filter-btn, .sidebar-link[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = btn.dataset.filter || btn.getAttribute('data-filter');
                this.currentFilter = filter;
                
                document.querySelectorAll('.filter-btn, .sidebar-link[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.loadTracks();
            });
        });

        // View mode
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.currentView = view;
                localStorage.setItem('wrc_view_mode', view);
                
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const container = document.getElementById('tracksGrid');
                if (container) container.className = `tracks-grid view-${view}`;
                
                this.loadTracks();
            });
        });

        // Sort
        const sortSelect = document.getElementById('trackSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.loadTracks();
            });
        }

        // Search
        const searchInput = document.getElementById('tracksSearchInput');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                const query = e.target.value.trim().toLowerCase();
                timeout = setTimeout(() => this.handleSearch(query), 300);
            });
        }

        // Infinite Scroll
        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                this.loadTracks(true);
            }
        });

        // Compact Mode
        const compactToggle = document.getElementById('compactToggle');
        if (compactToggle) {
            compactToggle.addEventListener('click', () => {
                document.body.classList.toggle('compact-mode');
                const isCompact = document.body.classList.contains('compact-mode');
                localStorage.setItem('wrc_compact_mode', isCompact);
            });
        }
        
        if (localStorage.getItem('wrc_compact_mode') === 'true') {
            document.body.classList.add('compact-mode');
        }
    }

    handleSearch(query) {
        if (!query) {
            this.loadTracks();
            return;
        }

        const container = document.getElementById('tracksGrid');
        const results = this.allTracksCache.filter(t => 
            t.title.toLowerCase().includes(query) || 
            t.artist.toLowerCase().includes(query)
        );

        if (results.length === 0) {
            container.innerHTML = `<div class="empty-state">🔍 Aucun résultat pour "${query}"</div>`;
        } else {
            juryUI.renderTracks(container, results, {
                currentView: this.currentView,
                currentUserRole: this.currentUserRole
            });
        }
    }

    async handleRateTrack(trackId, artistId, rating) {
        if (this.currentUserRole === 'artist') {
            showToast('Les artistes ne peuvent pas noter', 'warning');
            return;
        }

        const now = Date.now();
        const lastRating = this.lastRatingTime.get(this.currentUser.id) || 0;
        if (now - lastRating < 1000) {
            showToast('Trop rapide !', 'warning');
            return;
        }

        try {
            const data = await juryApi.rateTrack(trackId, this.currentUser.id, rating);
            this.lastRatingTime.set(this.currentUser.id, now);
            this.ratingCache.set(`${this.currentUser.id}-${trackId}`, rating);
            
            juryUI.updateRatingUI(trackId, rating, data);
            showToast(`Note de ${rating}/10 enregistrée`, 'success');
            
            this.loadStats();
        } catch (error) {
            logger.error('Rate track error:', error);
            showToast('Erreur lors de la notation', 'error');
        }
    }

    handlePlayTrack(url, title, el, artist, cover, avatar) {
        if (!window.globalPlayer) return;
        window.globalPlayer.setPlaylist([{ url, title, artist, coverUrl: cover }], 0);
        window.globalPlayer.play();
    }

    updateRatingDisplay(slider, trackId) {
        const value = parseFloat(slider.value);
        const display = slider.parentElement.querySelector('.rating-display, .rating-display-mini');
        if (display) {
            display.textContent = slider.classList.contains('rating-slider-mini') ? value : `${value}/10`;
        }
        juryUI.updateSliderColor(slider, value);
    }

    updateHeroRatingDisplay(value) {
        const display = document.querySelector('.rating-display-hero');
        if (display) display.textContent = `${value}/10`;
        const slider = document.querySelector('.rating-slider-hero');
        if (slider) juryUI.updateSliderColor(slider, parseFloat(value));
    }

    setupRealtime() {
        juryApi.subscribeToTrackUpdates((payload) => {
            logger.debug('Realtime track update:', payload);
            const { id, average_rating, ratings_count } = payload.new;
            juryUI.updateRatingUI(id, null, {
                new_average: average_rating,
                new_count: ratings_count
            });
        });
    }
}

export const juryDashboard = new JuryDashboard();
window.juryDashboard = juryDashboard;

document.addEventListener('DOMContentLoaded', () => juryDashboard.init());
