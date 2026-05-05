/**
 * WRC 2026 - Dashboard Module Index
 */

import { dashboardApi } from './DashboardApi.js';
import { dashboardUI } from './DashboardUI.js';
import { fetchLeaderboard, logger } from '../core/index.js';
import { showToast } from '../auth/toast.js';

class Dashboard {
    constructor() {
        this.currentUser = null;
        this.artists = [];
    }

    async init() {
        logger.info('🎤 Dashboard initializing...');
        
        await this.checkAuth();
        
        await Promise.all([
            this.loadStats(),
            this.loadArtists(),
            this.loadLeaderboard()
        ]);
        
        this.setupRealtime();
        
        logger.info('✅ Dashboard ready');
    }

    async checkAuth() {
        try {
            const session = await dashboardApi.getSession();
            if (session?.user) {
                this.currentUser = session.user;
                const profile = await dashboardApi.getProfile(this.currentUser.id);
                if (profile) {
                    this.currentUser = { ...this.currentUser, ...profile };
                }
            } else {
                const localUser = localStorage.getItem('wrc_user') || sessionStorage.getItem('wrc_user');
                if (localUser) {
                    this.currentUser = JSON.parse(localUser);
                }
            }
        } catch (err) {
            logger.error('Auth check error:', err);
        }
    }

    async loadStats() {
        try {
            const stats = await dashboardApi.getStats();
            dashboardUI.updateStats(stats);
        } catch (err) {
            logger.error('Load stats error:', err);
        }
    }

    async loadArtists() {
        const container = document.getElementById('artistsList');
        if (!container) return;
        
        try {
            this.artists = await dashboardApi.getArtists();
            dashboardUI.renderArtists(container, this.artists, this.currentUser);
            this.updatePlayerPlaylist();
        } catch (err) {
            logger.error('Load artists error:', err);
        }
    }

    async loadLeaderboard() {
        const container = document.getElementById('leaderboardList');
        if (!container) return;
        
        try {
            const data = await fetchLeaderboard(10);
            dashboardUI.renderLeaderboard(container, data);
        } catch (err) {
            logger.error('Load leaderboard error:', err);
        }
    }

    async handleVoteForArtist(artistId) {
        if (!this.currentUser) {
            showToast('Connectez-vous pour voter', 'error');
            if (window.openAuth) window.openAuth('fan');
            return;
        }
        
        try {
            const artist = this.artists.find(a => a.id === artistId);
            if (!artist?.tracks?.length) {
                showToast('Cet artiste n\'a pas de track à voter', 'error');
                return;
            }
            
            const trackId = artist.tracks[0].id;
            const data = await dashboardApi.voteForTrack(trackId, this.currentUser.id);
            
            if (data?.success) {
                showToast(data.message || 'Vote enregistré !', 'success');
                await Promise.all([
                    this.loadArtists(),
                    this.loadLeaderboard(),
                    this.loadStats()
                ]);
            } else {
                showToast(data?.message || 'Vote non enregistré', 'info');
            }
        } catch (err) {
            logger.error('Vote error:', err);
            showToast(err.message || 'Erreur lors du vote', 'error');
        }
    }

    handlePlayArtistTrack(artistId) {
        const artist = this.artists.find(a => a.id === artistId);
        if (!artist?.tracks?.length) return;
        
        const track = artist.tracks[0];
        if (window.globalPlayer && track.file_url) {
            window.globalPlayer.setPlaylist([{
                url: track.file_url,
                title: track.title || 'Sans titre',
                artist: artist.stage_name || artist.username,
                coverUrl: artist.avatar_url
            }], 0);
            window.globalPlayer.play();
        }
    }

    updatePlayerPlaylist() {
        if (!window.globalPlayer) return;
        
        const allTracks = this.artists.flatMap(artist => 
            (artist.tracks || []).map(track => ({
                url: track.file_url,
                title: track.title || 'Sans titre',
                artist: artist.stage_name || artist.username || 'Artiste',
                coverUrl: artist.avatar_url
            }))
        ).filter(t => t.url);
        
        if (allTracks.length) {
            window.globalPlayer.setPlaylist(allTracks);
        }
    }

    setupRealtime() {
        dashboardApi.subscribeToChanges((type) => {
            if (type === 'profile') {
                this.loadLeaderboard();
                this.loadStats();
            } else if (type === 'track') {
                this.loadArtists();
                this.loadStats();
            }
        });
    }
}

export const dashboard = new Dashboard();
window.dashboard = dashboard;

document.addEventListener('DOMContentLoaded', () => dashboard.init());
