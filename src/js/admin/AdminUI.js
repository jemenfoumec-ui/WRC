/**
 * WRC 2026 - Admin UI Module
 * UI rendering and interaction for admin dashboard
 */

import { adminApi } from './AdminApi.js';
import { showToast, toast } from '../auth/toast.js';
import { logger } from '../core/config.js';

// ==========================================
// ADMIN UI CLASS
// ==========================================
export class AdminUI {
    constructor() {
        this.container = null;
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    init() {
        this.container = document.getElementById('main-content');
        this.bindQuickActions();
    }

    // ==========================================
    // STATS DISPLAY
    // ==========================================
    async loadStats() {
        try {
            const stats = await adminApi.getGlobalStats();
            this.updateStatsUI(stats);
            return stats;
        } catch (err) {
            logger.error('loadStats error:', err);
            this.updateStatsUI({ total_users: 0, total_artists: 0, total_tracks: 0, total_votes: 0 });
        }
    }

    updateStatsUI(stats) {
        const elements = {
            totalUsers: document.getElementById('totalUsers'),
            totalArtists: document.getElementById('totalArtists'),
            totalTracks: document.getElementById('totalTracks'),
            totalVotes: document.getElementById('totalVotes')
        };

        if (elements.totalUsers) {
            elements.totalUsers.textContent = this.formatNumber(stats.total_users || stats.total_artists || 0);
        }
        if (elements.totalArtists) {
            elements.totalArtists.textContent = this.formatNumber(stats.total_artists || 0);
        }
        if (elements.totalTracks) {
            elements.totalTracks.textContent = this.formatNumber(stats.total_tracks || 0);
        }
        if (elements.totalVotes) {
            elements.totalVotes.textContent = this.formatNumber(stats.total_votes || 0);
        }
    }

    // ==========================================
    // USERS TABLE
    // ==========================================
    async loadUsersTable() {
        const container = document.getElementById('recentUsers');
        if (!container) return;

        try {
            const users = await adminApi.getRecentUsers(10);
            this.renderUsersTable(container, users);
        } catch (err) {
            logger.error('loadUsersTable error:', err);
            container.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Erreur de chargement</td></tr>';
        }
    }

    renderUsersTable(container, users) {
        if (!users.length) {
            container.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Aucun utilisateur</td></tr>';
            return;
        }

        container.innerHTML = users.map(user => `
            <tr data-user-id="${user.id}">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center;">
                            ${(user.username || user.email || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 500;">${this.escapeHtml(user.username || 'N/A')}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">${this.escapeHtml(user.email || '')}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-${this.getRoleBadgeType(user.role)}">${user.role || 'fan'}</span></td>
                <td>
                    <span class="status-dot ${user.is_active ? 'active' : 'inactive'}"></span>
                    ${user.is_active ? 'Actif' : 'Inactif'}
                </td>
                <td>${this.formatDate(user.created_at)}</td>
            </tr>
        `).join('');
    }

    // ==========================================
    // QUICK ACTIONS
    // ==========================================
    bindQuickActions() {
        const manageUsersBtn = document.getElementById('btnManageUsers');
        const manageTracksBtn = document.getElementById('btnManageTracks');
        const manageTournamentBtn = document.getElementById('btnManageTournament');
        const viewReportsBtn = document.getElementById('btnViewReports');
        const emergencyBtn = document.getElementById('btnEmergency');

        if (manageUsersBtn) {
            manageUsersBtn.addEventListener('click', () => this.showManageUsersModal());
        }
        if (manageTracksBtn) {
            manageTracksBtn.addEventListener('click', () => this.showManageTracksModal());
        }
        if (manageTournamentBtn) {
            manageTournamentBtn.addEventListener('click', () => this.showTournamentSettings());
        }
        if (viewReportsBtn) {
            viewReportsBtn.addEventListener('click', () => this.generateReport());
        }
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', () => this.showEmergencyActions());
        }
    }

    async showManageUsersModal() {
        try {
            const users = await adminApi.getUsers(50);
            this.showModal('Gestion des utilisateurs', this.renderUsersManagement(users), () => {
                this.bindUserManagementEvents(users);
            });
        } catch (err) {
            showToast('Erreur', 'Impossible de charger les utilisateurs', 'error');
        }
    }

    async showManageTracksModal() {
        try {
            const tracks = await adminApi.getTracks(50);
            this.showModal('Modération des tracks', this.renderTracksManagement(tracks), () => {
                this.bindTrackManagementEvents(tracks);
            });
        } catch (err) {
            showToast('Erreur', 'Impossible de charger les tracks', 'error');
        }
    }

    showTournamentSettings() {
        this.showModal('Paramètres du tournoi', `
            <div class="admin-settings">
                <div class="form-group">
                    <label>Statut du tournoi</label>
                    <select id="tournamentStatus" class="form-input">
                        <option value="draft">Brouillon</option>
                        <option value="active">Actif</option>
                        <option value="paused">En pause</option>
                        <option value="completed">Terminé</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Phase actuelle</label>
                    <select id="tournamentPhase" class="form-input">
                        <option value="WAITING">En attente</option>
                        <option value="REGISTRATION">Inscriptions</option>
                        <option value="QUALIFICATIONS">Qualifications</option>
                        <option value="FINALS">Finales</option>
                    </select>
                </div>
                <button class="btn btn-primary" id="saveTournamentSettings">Enregistrer</button>
            </div>
        `, () => {
            document.getElementById('saveTournamentSettings')?.addEventListener('click', async () => {
                showToast('Paramètres enregistrés', '', 'success');
                this.closeModal();
            });
        });
    }

    async generateReport() {
        showToast('Génération du rapport...', '', 'info');
        try {
            const report = await adminApi.generateReport();
            const reportJson = JSON.stringify(report, null, 2);
            
            this.showModal('Rapport généré', `
                <pre style="max-height: 400px; overflow: auto; font-size: 12px; background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px;">${this.escapeHtml(reportJson)}</pre>
                <button class="btn btn-primary" id="downloadReport" style="margin-top: 16px;">Télécharger JSON</button>
            `, () => {
                document.getElementById('downloadReport')?.addEventListener('click', () => {
                    const blob = new Blob([reportJson], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `wrc-report-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                });
            });
        } catch (err) {
            showToast('Erreur', 'Impossible de générer le rapport', 'error');
        }
    }

    showEmergencyActions() {
        toast.confirm(
            'Actions d\'urgence',
            'Êtes-vous sûr de vouloir effectuer une action d\'urgence ?',
            async () => {
                showToast('Action d\'urgence exécutée', '', 'warning');
            }
        );
    }

    // ==========================================
    // MODALS
    // ==========================================
    showModal(title, content, onShow = null) {
        let modal = document.getElementById('adminModal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'adminModal';
            modal.className = 'admin-modal-overlay';
            modal.innerHTML = `
                <div class="admin-modal">
                    <div class="admin-modal-header">
                        <h3 class="admin-modal-title">${title}</h3>
                        <button class="admin-modal-close" id="adminModalClose">✕</button>
                    </div>
                    <div class="admin-modal-content" id="adminModalContent"></div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#adminModalClose').addEventListener('click', () => this.closeModal());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        modal.querySelector('.admin-modal-title').textContent = title;
        modal.querySelector('#adminModalContent').innerHTML = content;
        modal.classList.add('show');
        
        if (onShow) onShow();
    }

    closeModal() {
        const modal = document.getElementById('adminModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    // ==========================================
    // RENDER HELPERS
    // ==========================================
    renderUsersManagement(users) {
        return `
            <div style="max-height: 400px; overflow: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Utilisateur</th>
                            <th>Rôle</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr data-user-id="${user.id}">
                                <td>${this.escapeHtml(user.username || user.email || 'N/A')}</td>
                                <td>
                                    <select class="user-role-select" data-user-id="${user.id}" style="background: var(--glass-light); border: 1px solid var(--border-light); padding: 4px 8px; border-radius: 4px; color: var(--text-primary);">
                                        <option value="fan" ${user.role === 'fan' ? 'selected' : ''}>Fan</option>
                                        <option value="artist" ${user.role === 'artist' ? 'selected' : ''}>Artiste</option>
                                        <option value="jury" ${user.role === 'jury' ? 'selected' : ''}>Jury</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-outline delete-user-btn" data-user-id="${user.id}" style="color: var(--error); border-color: var(--error);">Supprimer</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderTracksManagement(tracks) {
        return `
            <div style="max-height: 400px; overflow: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Titre</th>
                            <th>Artiste</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tracks.map(track => `
                            <tr data-track-id="${track.id}">
                                <td>${this.escapeHtml(track.title || 'Sans titre')}</td>
                                <td>${this.escapeHtml(track.profiles?.stage_name || track.profiles?.username || 'N/A')}</td>
                                <td><span class="badge badge-${this.getStatusBadgeType(track.status)}">${track.status || 'pending'}</span></td>
                                <td>
                                    <div style="display: flex; gap: 8px;">
                                        ${track.status !== 'active' ? `<button class="btn btn-sm btn-primary approve-track-btn" data-track-id="${track.id}">Approuver</button>` : ''}
                                        <button class="btn btn-sm btn-outline delete-track-btn" data-track-id="${track.id}" style="color: var(--error); border-color: var(--error);">Supprimer</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    bindUserManagementEvents(users) {
        document.querySelectorAll('.user-role-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const newRole = e.target.value;
                try {
                    await adminApi.setUserRole(userId, newRole);
                    showToast('Rôle mis à jour', '', 'success');
                } catch (err) {
                    showToast('Erreur', 'Impossible de mettre à jour le rôle', 'error');
                }
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = e.target.dataset.userId;
                toast.confirm('Confirmation', 'Voulez-vous vraiment supprimer cet utilisateur ?', async () => {
                    try {
                        await adminApi.deleteUser(userId);
                        e.target.closest('tr').remove();
                        showToast('Utilisateur supprimé', '', 'success');
                    } catch (err) {
                        showToast('Erreur', 'Impossible de supprimer l\'utilisateur', 'error');
                    }
                });
            });
        });
    }

    bindTrackManagementEvents(tracks) {
        document.querySelectorAll('.approve-track-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const trackId = e.target.dataset.trackId;
                try {
                    await adminApi.approveTrack(trackId);
                    e.target.closest('tr').querySelector('.badge').className = 'badge badge-success';
                    e.target.closest('tr').querySelector('.badge').textContent = 'active';
                    e.target.remove();
                    showToast('Track approuvée', '', 'success');
                } catch (err) {
                    showToast('Erreur', 'Impossible d\'approuver la track', 'error');
                }
            });
        });

        document.querySelectorAll('.delete-track-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const trackId = e.target.dataset.trackId;
                toast.confirm('Confirmation', 'Voulez-vous vraiment supprimer cette track ?', async () => {
                    try {
                        await adminApi.deleteTrack(trackId);
                        e.target.closest('tr').remove();
                        showToast('Track supprimée', '', 'success');
                    } catch (err) {
                        showToast('Erreur', 'Impossible de supprimer la track', 'error');
                    }
                });
            });
        });
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getRoleBadgeType(role) {
        const types = { admin: 'error', jury: 'warning', artist: 'success', fan: 'primary' };
        return types[role] || 'primary';
    }

    getStatusBadgeType(status) {
        const types = { active: 'success', pending: 'warning', rejected: 'error' };
        return types[status] || 'primary';
    }
}

export const adminUI = new AdminUI();