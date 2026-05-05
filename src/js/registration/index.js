/**
 * WRC 2026 - Tournament Registration Module
 */

import { supabase } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';
import { showToast } from '../auth/toast.js';

class TournamentRegistration {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.activeTournament = null;
    }

    async init() {
        logger.info('📝 Tournament Registration - Init');
        
        await this.checkAuth();
        await this.loadTournament();
        await this.checkRegistrationStatus();
        this.setupForm();
        this.prefillForm();
        
        logger.info('✅ Registration page ready');
    }

    async checkAuth() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                this.currentUser = session.user;
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', this.currentUser.id).single();
                if (profile) {
                    this.userProfile = profile;
                    this.currentUser = { ...this.currentUser, ...profile };
                }
                return true;
            }
        } catch (err) {
            logger.error('Auth error:', err);
        }
        return true;
    }

    async loadTournament() {
        try {
            const { data, error } = await supabase
                .from('tournaments')
                .select('*')
                .eq('country', 'FR')
                .eq('status', 'registration')
                .single();
            
            if (data) this.activeTournament = data;
            else this.activeTournament = {
                name: 'WRC France 2026',
                country: 'FR',
                status: 'registration',
                registration_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };
        } catch (err) {
            logger.error('Load tournament error:', err);
        }
    }

    async checkRegistrationStatus() {
        if (!this.currentUser?.id || !this.activeTournament?.id) return;
        
        try {
            const { data } = await supabase
                .from('tournament_registrations')
                .select('*')
                .eq('tournament_id', this.activeTournament.id)
                .eq('artist_id', this.currentUser.id)
                .single();
            
            if (data) this.showAlreadyRegistered(data);
        } catch (err) {
            // Not registered is fine
        }
    }

    showAlreadyRegistered(registration) {
        const form = document.getElementById('registrationForm');
        if (!form) return;
        
        const container = form.closest('.glass-card') || form.parentElement;
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-8);">
                <div style="font-size: 4rem; margin-bottom: var(--space-4);">✅</div>
                <h2 style="font-family: var(--font-display); font-size: var(--text-3xl); margin-bottom: var(--space-4);">
                    VOUS ÊTES INSCRIT !
                </h2>
                <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
                    Statut: <span class="badge badge-${registration.status === 'approved' ? 'success' : 'warning'}">
                        ${registration.status === 'approved' ? 'Approuvé' : 'En attente'}
                    </span>
                </p>
                <a href="dashboard.html" class="btn btn-primary">
                    Voir mon Dashboard
                </a>
            </div>
        `;
    }

    setupForm() {
        const form = document.getElementById('registrationForm');
        if (!form) return;
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.populateCountries();
    }

    prefillForm() {
        if (!this.userProfile) return;
        const fields = {
            'stageName': this.userProfile.stage_name || this.userProfile.username,
            'email': this.userProfile.email || this.currentUser?.email,
            'city': this.userProfile.city,
            'country': this.userProfile.country,
            'bio': this.userProfile.bio
        };
        for (const [id, value] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el && value) el.value = value;
        }
    }

    populateCountries() {
        const select = document.getElementById('country');
        if (!select) return;
        const countries = [
            { code: 'FR', name: '🇫🇷 France' }, { code: 'BE', name: '🇧🇪 Belgique' },
            { code: 'CH', name: '🇨🇭 Suisse' }, { code: 'CA', name: '🇨🇦 Canada' },
            { code: 'SN', name: '🇸🇳 Sénégal' }, { code: 'CI', name: '🇨🇮 Côte d\'Ivoire' },
            { code: 'MA', name: '🇲🇦 Maroc' }, { code: 'DZ', name: '🇩🇿 Algérie' },
            { code: 'TN', name: '🇹🇳 Tunisie' }
        ];
        select.innerHTML = countries.map(c => `<option value="${c.code}" ${c.code === 'FR' ? 'selected' : ''}>${c.name}</option>`).join('');
    }

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent;

        const stageName = form.querySelector('#stageName')?.value?.trim();
        const email = form.querySelector('#email')?.value?.trim();
        const country = form.querySelector('#country')?.value;
        const city = form.querySelector('#city')?.value?.trim();
        const bio = form.querySelector('#bio')?.value?.trim();
        const acceptRules = form.querySelector('#acceptRules')?.checked;

        if (!stageName || stageName.length < 2) {
            showToast('Nom de scène requis (min 2 caractères)', 'error');
            return;
        }
        if (!email || !email.includes('@')) {
            showToast('Email valide requis', 'error');
            return;
        }
        if (!acceptRules) {
            showToast('Vous devez accepter le règlement', 'error');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'INSCRIPTION...';
        }

        try {
            if (!this.currentUser?.id) {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email,
                    password: this.generateTempPassword(),
                    options: { data: { username: stageName, stage_name: stageName, role: 'artist' } }
                });
                if (authError) throw authError;
                this.currentUser = authData.user;
                showToast('Un email de confirmation vous a été envoyé', 'info');
            }

            const profileData = {
                id: this.currentUser.id,
                email,
                username: stageName,
                stage_name: stageName,
                role: 'artist',
                country,
                city,
                bio,
                tournament_status: 'registered',
                is_active: true
            };

            const { error: profileError } = await supabase.from('profiles').upsert(profileData);
            if (profileError) throw profileError;

            if (this.activeTournament?.id) {
                const { error: regError } = await supabase.from('tournament_registrations').upsert({
                    tournament_id: this.activeTournament.id,
                    artist_id: this.currentUser.id,
                    status: 'pending'
                });
                if (regError && !regError.message.includes('duplicate')) throw regError;
            }

            const userData = { id: this.currentUser.id, email, role: 'artist', stage_name: stageName, username: stageName };
            localStorage.setItem('wrc_user', JSON.stringify(userData));
            
            window.dispatchEvent(new CustomEvent('wrc-auth-change', { detail: { user: userData, isAuthenticated: true } }));
            showToast('Inscription réussie ! 🎉', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        } catch (err) {
            logger.error('Registration error:', err);
            showToast(err.message || 'Erreur lors de l\'inscription', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }

    generateTempPassword() {
        return 'WRC2026_' + Math.random().toString(36).substring(2, 10) + '!';
    }
}

export const tournamentRegistration = new TournamentRegistration();
document.addEventListener('DOMContentLoaded', () => tournamentRegistration.init());
