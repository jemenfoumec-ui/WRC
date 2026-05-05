/**
 * WRC 2026 - Profile Module
 */

import { supabase } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';
import { showToast } from '../auth/toast.js';

class ProfileEdit {
    constructor() {
        this.currentUser = null;
    }

    async init() {
        logger.info('🚀 Profile Edit - Init');
        
        this.currentUser = await this.checkAuth();
        if (!this.currentUser) {
            logger.warn('❌ Not authenticated, redirecting...');
            window.location.href = 'index.html';
            return;
        }
        
        await this.loadProfile();
        this.setupHandlers();
        
        logger.info('✅ Profile Edit ready');
    }

    async checkAuth() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) return session.user;
        } catch (e) {
            logger.warn('Supabase session error:', e);
        }
        
        const stored = localStorage.getItem('wrc_user') || sessionStorage.getItem('wrc_user');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                logger.error('Parse error:', e);
            }
        }
        return null;
    }

    async loadProfile() {
        let profile = null;
        if (this.currentUser.id) {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', this.currentUser.id)
                    .single();
                
                if (!error && data) profile = data;
            } catch (e) {
                logger.warn('Load profile error:', e);
            }
        }
        
        if (!profile) profile = this.currentUser;
        this.updateUI(profile);
    }

    updateUI(profile) {
        const elements = {
            nameDisplay: document.getElementById('nameDisplay'),
            roleDisplay: document.getElementById('roleDisplay'),
            statTracks: document.getElementById('statTracks'),
            statVotes: document.getElementById('statVotes')
        };
        
        if (elements.nameDisplay) elements.nameDisplay.textContent = profile.stage_name || profile.username || 'Artiste';
        if (elements.roleDisplay) {
            const roles = { artist: 'Artiste', jury: 'Jury', admin: 'Admin', fan: 'Fan' };
            elements.roleDisplay.textContent = roles[profile.role] || 'Utilisateur';
        }
        if (elements.statTracks) elements.statTracks.textContent = profile.tracks_count || 0;
        if (elements.statVotes) elements.statVotes.textContent = profile.votes_received || 0;
        
        const fields = {
            'stageName': profile.stage_name || profile.username || '',
            'email': profile.email || this.currentUser.email || '',
            'city': profile.city || '',
            'country': profile.country || 'FR',
            'bio': profile.bio || ''
        };
        
        for (const [id, value] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        }
    }

    setupHandlers() {
        const form = document.getElementById('profileForm');
        if (form) form.onsubmit = (e) => this.handleSave(e);
        
        const btnCancel = document.getElementById('btnCancel');
        if (btnCancel) {
            btnCancel.onclick = () => {
                this.loadProfile();
                showToast('Modifications annulées', 'info');
            };
        }
        
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.onclick = () => this.handleLogout();
    }

    async handleSave(e) {
        e.preventDefault();
        
        const stageName = document.getElementById('stageName')?.value?.trim();
        const city = document.getElementById('city')?.value?.trim();
        const country = document.getElementById('country')?.value;
        const bio = document.getElementById('bio')?.value?.trim();
        
        if (!stageName || stageName.length < 2) {
            showToast('Nom de scène requis (min 2 caractères)', 'error');
            return;
        }
        
        const btn = document.querySelector('#profileForm button[type="submit"]');
        const originalText = btn?.textContent;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'SAUVEGARDE...';
        }
        
        try {
            const updateData = {
                stage_name: stageName,
                username: stageName,
                city: city || null,
                country: country || 'FR',
                bio: bio || null,
                updated_at: new Date().toISOString()
            };
            
            if (this.currentUser.id) {
                const { error } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', this.currentUser.id);
                
                if (error) throw error;
            }
            
            const stored = JSON.parse(localStorage.getItem('wrc_user') || '{}');
            Object.assign(stored, updateData);
            localStorage.setItem('wrc_user', JSON.stringify(stored));
            
            Object.assign(this.currentUser, updateData);
            this.updateUI(this.currentUser);
            
            showToast('Profil mis à jour !', 'success');
        } catch (err) {
            logger.error('Save error:', err);
            showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }

    async handleLogout() {
        localStorage.removeItem('wrc_user');
        sessionStorage.removeItem('wrc_user');
        try {
            await supabase.auth.signOut();
        } catch (e) {
            logger.warn('Signout error:', e);
        }
        showToast('Déconnexion...', 'info');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }
}

export const profileEdit = new ProfileEdit();
document.addEventListener('DOMContentLoaded', () => profileEdit.init());
