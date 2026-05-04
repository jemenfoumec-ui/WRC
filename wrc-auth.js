/**
 * WRC 2026 - Auth System
 * Version 5.0 - Simplifiée et fonctionnelle
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════
    
    const CONFIG = {
        protectedPages: [
            'dashboard.html',
            'dashboard-admin.html', 
            'dashboard-jury.html',
            'tournament-arena.html',
            'profile-edit.html'
        ],
        adminPages: ['dashboard-admin.html'],
        juryPages: ['dashboard-jury.html'],
        adminEmails: ['admin@wrc.com', 'admin@wrc.fr'],
        storageKey: 'wrc_user',
        loginRedirect: 'index.html'
    };

    // ═══════════════════════════════════════════
    // AUTH STATE
    // ═══════════════════════════════════════════
    
    let currentUser = null;
    let isAuthenticated = false;

    // ═══════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════

    function init() {
        console.log('🔐 WRC Auth - Initializing...');
        
        // Charger l'utilisateur
        loadUser();
        
        // Vérifier l'accès aux pages protégées
        checkPageAccess();
        
        // Setup logout handlers
        setupLogoutHandlers();
        
        // Injecter les styles
        injectStyles();
        
        console.log('🔐 Auth ready:', isAuthenticated ? `Connected as ${currentUser?.email}` : 'Not connected');
    }

    // ═══════════════════════════════════════════
    // USER MANAGEMENT
    // ═══════════════════════════════════════════

    function loadUser() {
        try {
            const data = localStorage.getItem(CONFIG.storageKey) || 
                         sessionStorage.getItem(CONFIG.storageKey);
            if (data) {
                currentUser = JSON.parse(data);
                isAuthenticated = true;
            }
        } catch (e) {
            console.error('Auth load error:', e);
            currentUser = null;
            isAuthenticated = false;
        }
    }

    function saveUser(user, remember = true) {
        currentUser = user;
        isAuthenticated = !!user;
        
        if (user) {
            const data = JSON.stringify(user);
            if (remember) {
                localStorage.setItem(CONFIG.storageKey, data);
            } else {
                sessionStorage.setItem(CONFIG.storageKey, data);
            }
        } else {
            localStorage.removeItem(CONFIG.storageKey);
            sessionStorage.removeItem(CONFIG.storageKey);
        }

        // Dispatch event
        window.dispatchEvent(new CustomEvent('wrc-auth-change', {
            detail: { user: currentUser, isAuthenticated }
        }));
    }

    // ═══════════════════════════════════════════
    // PAGE ACCESS CONTROL
    // ═══════════════════════════════════════════

    function getCurrentPage() {
        const path = window.location.pathname;
        return path.split('/').pop() || 'index.html';
    }

    function isProtectedPage() {
        const page = getCurrentPage();
        return CONFIG.protectedPages.some(p => page.includes(p));
    }

    function isAdminPage() {
        const page = getCurrentPage();
        return CONFIG.adminPages.some(p => page.includes(p));
    }

    function checkPageAccess() {
        if (!isProtectedPage()) return;

        // Pas connecté → Redirection
        if (!isAuthenticated) {
            console.warn('⛔ Not authenticated - redirecting');
            sessionStorage.setItem('wrc_redirect_message', 'Connexion requise pour accéder à cette page');
            window.location.replace(CONFIG.loginRedirect);
            return;
        }

        // Page admin mais pas admin → Redirection
        if (isAdminPage() && currentUser?.role !== 'admin') {
            console.warn('⛔ Admin required - redirecting');
            sessionStorage.setItem('wrc_redirect_message', 'Cette page est réservée aux administrateurs');
            window.location.replace('dashboard-jury.html');
            return;
        }
    }

    // ═══════════════════════════════════════════
    // LOGOUT
    // ═══════════════════════════════════════════

    async function logout() {
        console.log('🚪 Logging out...');
        
        // Clear storage
        localStorage.removeItem(CONFIG.storageKey);
        sessionStorage.removeItem(CONFIG.storageKey);
        currentUser = null;
        isAuthenticated = false;
        
        // Supabase signout
        try {
            const { supabase } = await import('./supabaseClient.js');
            if (supabase) {
                await supabase.auth.signOut();
            }
        } catch (e) {
            // Ignore
        }
        
        // Redirect
        window.location.href = CONFIG.loginRedirect;
    }

    function setupLogoutHandlers() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#btnLogout, .btn-logout, [data-logout], #sidebarLogout');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                logout();
            }
        });
    }

    // ═══════════════════════════════════════════
    // AUTH MODAL
    // ═══════════════════════════════════════════

    function openAuthModal() {
        let modal = document.getElementById('authModal');
        
        if (!modal) {
            modal = createAuthModal();
            document.body.appendChild(modal);
        }

        modal.classList.add('show');
        
        // Focus sur email
        setTimeout(() => {
            modal.querySelector('#authEmail')?.focus();
        }, 100);
    }

    function closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    function createAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'authModal';
        modal.className = 'auth-modal-overlay';
        
        modal.innerHTML = `
            <div class="auth-modal">
                <button class="auth-modal-close" id="authModalClose">✕</button>
                
                <div class="auth-modal-header">
                    <h2>🎤 REJOINDRE LE WRC</h2>
                    <p>Connectez-vous ou créez un compte</p>
                </div>
                
                <form id="authForm" class="auth-form">
                    <div class="auth-input-group">
                        <label>EMAIL</label>
                        <input type="email" id="authEmail" placeholder="votre@email.com" required>
                    </div>
                    
                    <div class="auth-input-group">
                        <label>MOT DE PASSE</label>
                        <input type="password" id="authPassword" placeholder="••••••••" minlength="6" required>
                    </div>
                    
                    <button type="submit" class="auth-submit-btn" id="authSubmitBtn">
                        CONTINUER
                    </button>
                    
                    <p class="auth-hint">
                        Si votre email n'existe pas, un compte sera créé automatiquement.
                    </p>
                </form>
            </div>
        `;

        // Event listeners
        modal.querySelector('#authModalClose').addEventListener('click', closeAuthModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAuthModal();
            }
        });
        
        modal.querySelector('#authForm').addEventListener('submit', handleAuthSubmit);

        return modal;
    }

    // ═══════════════════════════════════════════
    // AUTH SUBMIT HANDLER
    // ═══════════════════════════════════════════

    async function handleAuthSubmit(e) {
        e.preventDefault();
        
        const email = document.getElementById('authEmail')?.value?.trim();
        const password = document.getElementById('authPassword')?.value;

        if (!email || !password) {
            showToast('Email et mot de passe requis', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Mot de passe trop court (6 caractères min)', 'error');
            return;
        }

        const submitBtn = document.getElementById('authSubmitBtn');
        const originalText = submitBtn?.textContent;
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Chargement...';
        }

        try {
            const { supabase } = await import('./supabaseClient.js');
            
            // Vérifier si c'est un email admin
            const isAdminEmail = CONFIG.adminEmails.includes(email.toLowerCase());
            
            // 1. Essayer de se connecter
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (!signInError && signInData.user) {
                // CONNEXION RÉUSSIE
                console.log('✅ Login successful');
                
                // Récupérer le profil
                let { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', signInData.user.id)
                    .single();

                // Déterminer le rôle
                let role = profile?.role || 'fan';
                
                // Si email admin, forcer le rôle admin
                if (isAdminEmail) {
                    role = 'admin';
                    // Mettre à jour le profil en admin
                    await supabase
                        .from('profiles')
                        .update({ role: 'admin', is_admin: true })
                        .eq('id', signInData.user.id);
                }

                const userData = {
                    id: signInData.user.id,
                    email: signInData.user.email,
                    role: role,
                    username: profile?.username || profile?.stage_name || email.split('@')[0],
                    is_admin: role === 'admin'
                };

                saveUser(userData, true);
                showToast('Connexion réussie !', 'success');
                closeAuthModal();
                
                // Redirection selon le rôle
                console.log('🔄 Redirecting for role:', role);
                setTimeout(() => {
                    if (role === 'admin') {
                        window.location.href = 'dashboard-admin.html';
                    } else if (role === 'artist') {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'dashboard-jury.html';
                    }
                }, 800);
                
                return;
            }

            // 2. Si erreur = "Invalid login credentials", le compte n'existe pas ou mdp incorrect
            if (signInError) {
                console.log('Sign in error:', signInError.message);
                
                // Vérifier si le compte existe déjà
                if (signInError.message.includes('Invalid login')) {
                    // Essayer de créer un compte
                    const role = isAdminEmail ? 'admin' : 'fan';
                    const username = email.split('@')[0];

                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            data: { username, role }
                        }
                    });

                    if (signUpError) {
                        if (signUpError.message.includes('already registered')) {
                            throw new Error('Mot de passe incorrect');
                        }
                        throw signUpError;
                    }

                    if (signUpData.user) {
                        // Créer le profil
                        await supabase.from('profiles').upsert({
                            id: signUpData.user.id,
                            email,
                            username,
                            role,
                            is_admin: role === 'admin'
                        });

                        const userData = {
                            id: signUpData.user.id,
                            email,
                            role,
                            username,
                            is_admin: role === 'admin'
                        };

                        saveUser(userData, true);
                        showToast('Compte créé avec succès !', 'success');
                        closeAuthModal();
                        
                        // Redirection
                        setTimeout(() => {
                            if (role === 'admin') {
                                window.location.href = 'dashboard-admin.html';
                            } else {
                                window.location.href = 'dashboard-jury.html';
                            }
                        }, 800);
                    }
                } else {
                    throw signInError;
                }
            }

        } catch (err) {
            console.error('Auth error:', err);
            showToast(err.message || 'Erreur de connexion', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }

    // ═══════════════════════════════════════════
    // TOAST HELPER
    // ═══════════════════════════════════════════

    function showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    // ═══════════════════════════════════════════
    // STYLES
    // ═══════════════════════════════════════════

    function injectStyles() {
        if (document.getElementById('wrc-auth-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'wrc-auth-styles';
        style.textContent = `
            .auth-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .auth-modal-overlay.show {
                opacity: 1;
                visibility: visible;
            }
            
            .auth-modal {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 1px solid rgba(168, 85, 247, 0.3);
                border-radius: 20px;
                padding: 40px;
                width: 90%;
                max-width: 400px;
                position: relative;
                transform: translateY(20px) scale(0.95);
                transition: transform 0.3s ease;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(168, 85, 247, 0.1);
            }
            
            .auth-modal-overlay.show .auth-modal {
                transform: translateY(0) scale(1);
            }
            
            .auth-modal-close {
                position: absolute;
                top: 15px;
                right: 15px;
                background: transparent;
                border: none;
                color: #888;
                font-size: 24px;
                cursor: pointer;
                padding: 5px;
                line-height: 1;
                transition: color 0.2s;
            }
            
            .auth-modal-close:hover {
                color: #fff;
            }
            
            .auth-modal-header {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .auth-modal-header h2 {
                font-size: 1.8rem;
                font-weight: 800;
                margin: 0 0 10px 0;
                background: linear-gradient(90deg, #a855f7, #ec4899);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .auth-modal-header p {
                color: #888;
                margin: 0;
                font-size: 0.95rem;
            }
            
            .auth-form {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            .auth-input-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .auth-input-group label {
                font-size: 0.75rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: #888;
            }
            
            .auth-input-group input {
                padding: 14px 18px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                color: #fff;
                font-size: 1rem;
                outline: none;
                transition: all 0.2s ease;
            }
            
            .auth-input-group input:focus {
                border-color: #a855f7;
                box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.2);
            }
            
            .auth-input-group input::placeholder {
                color: #555;
            }
            
            .auth-submit-btn {
                padding: 16px;
                background: linear-gradient(90deg, #a855f7, #ec4899);
                border: none;
                border-radius: 12px;
                color: #fff;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s ease;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .auth-submit-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 10px 30px rgba(168, 85, 247, 0.4);
            }
            
            .auth-submit-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            .auth-hint {
                text-align: center;
                color: #666;
                font-size: 0.85rem;
                margin: 0;
            }
        `;
        document.head.appendChild(style);
        
        // Afficher message de redirection si présent
        const message = sessionStorage.getItem('wrc_redirect_message');
        if (message) {
            sessionStorage.removeItem('wrc_redirect_message');
            setTimeout(() => showToast(message, 'info'), 500);
        }
    }

    // ═══════════════════════════════════════════
    // GLOBAL EXPORTS
    // ═══════════════════════════════════════════

    // Exposer les fonctions globalement
    window.openAuth = openAuthModal;
    window.closeAuth = closeAuthModal;
    window.logout = logout;
    
    window.wrcAuth = {
        get user() { return currentUser; },
        get isAuthenticated() { return isAuthenticated; },
        openModal: openAuthModal,
        closeModal: closeAuthModal,
        logout: logout,
        saveUser: saveUser
    };

    // ═══════════════════════════════════════════
    // RUN
    // ═══════════════════════════════════════════

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
