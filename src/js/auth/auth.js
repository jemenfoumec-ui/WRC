/**
 * WRC 2026 - Authentication Module (ESM)
 * Modern ES module implementation
 */

import { supabase } from '../core/supabaseClient.js';
import { protectedPages, adminEmails, storageKeys, logger } from '../core/config.js';
import { showToast } from './toast.js';

// ==========================================
// AUTH STATE
// ==========================================
let currentUser = null;
let isAuthenticated = false;

// ==========================================
// EVENT DISPATCHER
// ==========================================
function dispatchAuthChange() {
    window.dispatchEvent(new CustomEvent('wrc-auth-change', {
        detail: { user: currentUser, isAuthenticated }
    }));
}

// ==========================================
// USER MANAGEMENT
// ==========================================
export function loadUser() {
    try {
        const data = localStorage.getItem(storageKeys.user) || 
                     sessionStorage.getItem(storageKeys.user);
        if (data) {
            currentUser = JSON.parse(data);
            isAuthenticated = !!currentUser;
        } else {
            currentUser = null;
            isAuthenticated = false;
        }
    } catch (e) {
        logger.error('Auth load error:', e);
        currentUser = null;
        isAuthenticated = false;
    }
    return { currentUser, isAuthenticated };
}

export function saveUser(user, remember = true) {
    currentUser = user;
    isAuthenticated = !!user;
    
    if (user) {
        const data = JSON.stringify(user);
        if (remember) {
            localStorage.setItem(storageKeys.user, data);
        } else {
            sessionStorage.setItem(storageKeys.user, data);
        }
    } else {
        localStorage.removeItem(storageKeys.user);
        sessionStorage.removeItem(storageKeys.user);
    }

    dispatchAuthChange();
}

export function getUser() {
    return currentUser;
}

export function getAuthState() {
    return { currentUser, isAuthenticated };
}

// ==========================================
// PAGE ACCESS CONTROL
// ==========================================
function getCurrentPage() {
    const path = window.location.pathname;
    return path.split('/').pop() || 'index.html';
}

function isProtectedPage() {
    const page = getCurrentPage();
    return protectedPages.some(p => page.includes(p));
}

function isAdminPage() {
    const page = getCurrentPage();
    return page.includes('dashboard-admin');
}

export function checkPageAccess() {
    if (!isProtectedPage()) return;

    if (!isAuthenticated) {
        logger.warn('Not authenticated - redirecting');
        sessionStorage.setItem('wrc_redirect_message', 'Connexion requise pour accéder à cette page');
        window.location.replace('index.html');
        return;
    }

    if (isAdminPage() && currentUser?.role !== 'admin') {
        logger.warn('Admin required - redirecting');
        sessionStorage.setItem('wrc_redirect_message', 'Cette page est réservée aux administrateurs');
        window.location.replace('dashboard-jury.html');
        return;
    }
}

// ==========================================
// LOGOUT
// ==========================================
export async function logout() {
    logger.info('Logging out...');
    
    localStorage.removeItem(storageKeys.user);
    sessionStorage.removeItem(storageKeys.user);
    currentUser = null;
    isAuthenticated = false;
    
    try {
        await supabase.auth.signOut();
    } catch (e) {
        logger.debug('Supabase signout error (ignored):', e.message);
    }
    
    window.location.href = 'index.html';
}

// ==========================================
// AUTH MODAL
// ==========================================
let authModal = null;

export function openAuthModal() {
    if (!authModal) {
        authModal = createAuthModal();
        document.body.appendChild(authModal);
    }
    
    authModal.classList.add('show');
    setTimeout(() => {
        authModal.querySelector('#authEmail')?.focus();
    }, 100);
}

export function closeAuthModal() {
    if (authModal) {
        authModal.classList.remove('show');
    }
}

function createAuthModal() {
    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'auth-modal-overlay';
    
    modal.innerHTML = `
        <div class="auth-modal">
            <button class="auth-modal-close" id="authModalClose" aria-label="Fermer">✕</button>
            
            <div class="auth-modal-header">
                <h2>🎤 REJOINDRE LE WRC</h2>
                <p>Connectez-vous ou créez un compte</p>
            </div>
            
            <form id="authForm" class="auth-form">
                <div class="auth-input-group">
                    <label for="authEmail">EMAIL</label>
                    <input type="email" id="authEmail" placeholder="votre@email.com" required autocomplete="email">
                </div>
                
                <div class="auth-input-group">
                    <label for="authPassword">MOT DE PASSE</label>
                    <input type="password" id="authPassword" placeholder="••••••••" minlength="6" required autocomplete="current-password">
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

    modal.querySelector('#authModalClose').addEventListener('click', closeAuthModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAuthModal();
        }
    });
    
    modal.querySelector('#authForm').addEventListener('submit', handleAuthSubmit);

    return modal;
}

// ==========================================
// AUTH SUBMIT HANDLER
// ==========================================
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
        const isAdminEmail = adminEmails.includes(email.toLowerCase());
        
        // Try sign in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (!signInError && signInData.user) {
            logger.info('Login successful');
            
            let { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', signInData.user.id)
                .single();

            let role = profile?.role || 'fan';
            
            if (isAdminEmail && role !== 'admin') {
                role = 'admin';
                await supabase
                    .from('profiles')
                    .update({ role: 'admin', is_admin: true })
                    .eq('id', signInData.user.id);
            }

            const userData = {
                id: signInData.user.id,
                email: signInData.user.email,
                role,
                username: profile?.username || profile?.stage_name || email.split('@')[0],
                is_admin: role === 'admin',
                avatar_url: profile?.avatar_url
            };

            saveUser(userData, true);
            showToast('Connexion réussie !', 'success');
            closeAuthModal();
            
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

        if (signInError) {
            logger.debug('Sign in error:', signInError.message);
            
            if (signInError.message.includes('Invalid login credentials') || 
                signInError.message.includes('Invalid login')) {
                
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
                    
                    setTimeout(() => {
                        window.location.href = role === 'admin' ? 'dashboard-admin.html' : 'dashboard-jury.html';
                    }, 800);
                }
            } else {
                throw signInError;
            }
        }

    } catch (err) {
        logger.error('Auth error:', err);
        showToast(err.message || 'Erreur de connexion', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// ==========================================
// INITIALIZATION
// ==========================================
export function initAuth() {
    logger.info('WRC Auth - Initializing...');
    
    loadUser();
    checkPageAccess();
    setupLogoutHandlers();
    showRedirectMessage();
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

function showRedirectMessage() {
    const message = sessionStorage.getItem('wrc_redirect_message');
    if (message) {
        sessionStorage.removeItem('wrc_redirect_message');
        setTimeout(() => showToast(message, 'info'), 500);
    }
}

// ==========================================
// GLOBAL EXPORTS (for compatibility)
// ==========================================
export const wrcAuth = {
    get user() { return currentUser; },
    get isAuthenticated() { return isAuthenticated; },
    openModal: openAuthModal,
    closeModal: closeAuthModal,
    logout,
    saveUser,
    loadUser,
    getUser
};

// Make available globally
window.openAuth = openAuthModal;
window.closeAuth = closeAuthModal;
window.logout = logout;
window.wrcAuth = wrcAuth;

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}