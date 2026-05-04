/**
 * WRC 2026 - Admin Stats Module
 * Calculation and display of admin statistics
 */

import { adminApi } from './AdminApi.js';
import { logger } from '../core/config.js';

export class AdminStats {
    constructor() {
        this.elements = {
            totalUsers: document.getElementById('totalUsers'),
            totalArtists: document.getElementById('totalArtists'),
            totalTracks: document.getElementById('totalTracks'),
            totalVotes: document.getElementById('totalVotes')
        };
    }

    async refresh() {
        try {
            const stats = await adminApi.getGlobalStats();
            this.updateUI(stats);
            return stats;
        } catch (err) {
            logger.error('AdminStats refresh error:', err);
            this.updateUI({ total_users: 0, total_artists: 0, total_tracks: 0, total_votes: 0 });
        }
    }

    updateUI(stats) {
        if (this.elements.totalUsers) {
            this.elements.totalUsers.textContent = this.formatNumber(stats.total_users || stats.total_artists || 0);
        }
        if (this.elements.totalArtists) {
            this.elements.totalArtists.textContent = this.formatNumber(stats.total_artists || 0);
        }
        if (this.elements.totalTracks) {
            this.elements.totalTracks.textContent = this.formatNumber(stats.total_tracks || 0);
        }
        if (this.elements.totalVotes) {
            this.elements.totalVotes.textContent = this.formatNumber(stats.total_votes || 0);
        }
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
}

export const adminStats = new AdminStats();
