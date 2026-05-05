/**
 * WRC 2026 - Dashboard UI Module
 */

export class DashboardUI {
    updateStats(stats) {
        const elements = {
            totalArtists: document.getElementById('totalArtists'),
            totalTracks: document.getElementById('totalTracks'),
            totalVotes: document.getElementById('totalVotes'),
            remainingTime: document.getElementById('remainingTime')
        };
        
        if (elements.totalArtists) elements.totalArtists.textContent = this.formatNumber(stats.total_artists || 0);
        if (elements.totalTracks) elements.totalTracks.textContent = this.formatNumber(stats.total_tracks || 0);
        if (elements.totalVotes) elements.totalVotes.textContent = this.formatNumber(stats.total_votes || 0);
        if (elements.remainingTime) {
            const endDate = new Date('2026-06-01');
            const now = new Date();
            const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            elements.remainingTime.textContent = diff > 0 ? diff : 0;
        }
    }

    renderArtists(container, artists, currentUser) {
        if (!artists || !artists.length) {
            container.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">Aucun artiste inscrit pour le moment</div>`;
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
                    <div class="artist-meta">${artist.city || ''} ${artist.country ? this.getFlag(artist.country) : ''} • ${artist.tracks_count || 0} tracks</div>
                </div>
                <div class="artist-stats">
                    <span class="artist-votes">${this.formatNumber(artist.votes_received || 0)}</span>
                    <span class="artist-votes-label">votes</span>
                </div>
                ${artist.tracks?.length ? `
                    <button class="btn btn-sm btn-primary artist-play" onclick="window.dashboard.handlePlayArtistTrack('${artist.id}')">
                        ▶
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-outline artist-vote" onclick="window.dashboard.handleVoteForArtist('${artist.id}')" ${!currentUser ? 'disabled title="Connectez-vous pour voter"' : ''}>
                    ⚖️ Voter
                </button>
            </div>
        `).join('');
        
        this.ensureStyles();
    }

    renderLeaderboard(container, data) {
        if (!data || !data.length) {
            container.innerHTML = `<div style="padding: var(--space-8); text-align: center; color: var(--text-muted);">Aucun classement disponible</div>`;
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
                    <div class="leaderboard-meta">${this.getFlag(artist.country)} ${artist.country || ''}</div>
                </div>
                <div class="leaderboard-score">${this.formatNumber(artist.votes_received || 0)}</div>
            </div>
        `).join('');
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    getFlag(countryCode) {
        if (!countryCode) return '';
        const flags = {
            'FR': '🇫🇷', 'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'ES': '🇪🇸',
            'IT': '🇮🇹', 'BE': '🇧🇪', 'CH': '🇨🇭', 'CA': '🇨🇦', 'BR': '🇧🇷',
            'JP': '🇯🇵', 'KR': '🇰🇷', 'AU': '🇦🇺', 'NL': '🇳🇱', 'PT': '🇵🇹'
        };
        return flags[countryCode.toUpperCase()] || `[${countryCode}]`;
    }

    ensureStyles() {
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
}

export const dashboardUI = new DashboardUI();
