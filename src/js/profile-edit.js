/**
 * WRC 2026 - Profile Edit
 * Version simplifiée et fonctionnelle
 */

(function() {
    'use strict';
    
    console.log('📝 Profile-edit.js chargé');
    
    let currentUser = null;
    let supabase = null;
    
    // ==========================================
    // INIT AU CHARGEMENT
    // ==========================================
    document.addEventListener('DOMContentLoaded', init);
    
    async function init() {
        console.log('🚀 Profile Edit - Init');
        
        // 1. Charger Supabase
        try {
            const module = await import('./supabaseClient.js');
            supabase = module.supabase;
            console.log('✅ Supabase chargé');
        } catch (e) {
            console.warn('⚠️ Supabase non disponible:', e);
        }
        
        // 2. Vérifier auth
        currentUser = await checkAuth();
        if (!currentUser) {
            console.warn('❌ Non connecté, redirection...');
            window.location.href = 'index.html';
            return;
        }
        console.log('✅ Utilisateur:', currentUser.email);
        
        // 3. Charger le profil
        await loadProfile();
        
        // 4. Setup handlers - IMPORTANT
        setupHandlers();
        
        console.log('✅ Profile Edit prêt');
    }
    
    // ==========================================
    // AUTH CHECK
    // ==========================================
    async function checkAuth() {
        // Essayer Supabase d'abord
        if (supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    return session.user;
                }
            } catch (e) {
                console.warn('Supabase session error:', e);
            }
        }
        
        // Fallback sur localStorage
        const stored = localStorage.getItem('wrc_user') || sessionStorage.getItem('wrc_user');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Parse error:', e);
            }
        }
        
        return null;
    }
    
    // ==========================================
    // LOAD PROFILE
    // ==========================================
    async function loadProfile() {
        let profile = null;
        
        // Essayer Supabase
        if (supabase && currentUser.id) {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .single();
                
                if (!error && data) {
                    profile = data;
                    console.log('✅ Profil chargé depuis Supabase');
                }
            } catch (e) {
                console.warn('Erreur chargement profil:', e);
            }
        }
        
        // Fallback sur données locales
        if (!profile) {
            profile = currentUser;
        }
        
        // Mettre à jour l'UI
        updateUI(profile);
    }
    
    function updateUI(profile) {
        // Display
        const nameDisplay = document.getElementById('nameDisplay');
        const roleDisplay = document.getElementById('roleDisplay');
        const statTracks = document.getElementById('statTracks');
        const statVotes = document.getElementById('statVotes');
        
        if (nameDisplay) nameDisplay.textContent = profile.stage_name || profile.username || 'Artiste';
        if (roleDisplay) {
            const roles = { artist: 'Artiste', jury: 'Jury', admin: 'Admin', fan: 'Fan' };
            roleDisplay.textContent = roles[profile.role] || 'Utilisateur';
        }
        if (statTracks) statTracks.textContent = profile.tracks_count || 0;
        if (statVotes) statVotes.textContent = profile.votes_received || 0;
        
        // Form fields
        const fields = {
            'stageName': profile.stage_name || profile.username || '',
            'email': profile.email || currentUser.email || '',
            'city': profile.city || '',
            'country': profile.country || 'FR',
            'bio': profile.bio || ''
        };
        
        for (const [id, value] of Object.entries(fields)) {
            const el = document.getElementById(id);
            if (el) {
                el.value = value;
                console.log(`📝 ${id} = "${value}"`);
            }
        }
    }
    
    // ==========================================
    // SETUP HANDLERS
    // ==========================================
    function setupHandlers() {
        console.log('🔧 Setup des handlers...');
        
        // FORM SUBMIT
        const form = document.getElementById('profileForm');
        if (form) {
            console.log('✅ Form trouvé');
            form.onsubmit = handleSave;
        } else {
            console.error('❌ Form #profileForm non trouvé!');
        }
        
        // CANCEL BUTTON
        const btnCancel = document.getElementById('btnCancel');
        if (btnCancel) {
            console.log('✅ Bouton Annuler trouvé');
            btnCancel.onclick = function() {
                console.log('🔄 Annulation...');
                loadProfile();
                showToast('Modifications annulées', 'info');
            };
        }
        
        // LOGOUT BUTTON
        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            console.log('✅ Bouton Logout trouvé');
            btnLogout.onclick = handleLogout;
        } else {
            console.error('❌ Bouton #btnLogout non trouvé!');
        }
    }
    
    // ==========================================
    // SAVE HANDLER
    // ==========================================
    async function handleSave(e) {
        e.preventDefault();
        console.log('💾 Sauvegarde...');
        
        const stageName = document.getElementById('stageName')?.value?.trim();
        const city = document.getElementById('city')?.value?.trim();
        const country = document.getElementById('country')?.value;
        const bio = document.getElementById('bio')?.value?.trim();
        
        console.log('📋 Données:', { stageName, city, country, bio });
        
        if (!stageName || stageName.length < 2) {
            showToast('Nom de scène requis (min 2 caractères)', 'error');
            return false;
        }
        
        // Bouton loading
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
            
            // Sauvegarder dans Supabase
            if (supabase && currentUser.id) {
                const { error } = await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', currentUser.id);
                
                if (error) {
                    console.error('Supabase error:', error);
                } else {
                    console.log('✅ Sauvé dans Supabase');
                }
            }
            
            // Sauvegarder dans localStorage
            const stored = JSON.parse(localStorage.getItem('wrc_user') || '{}');
            Object.assign(stored, updateData);
            localStorage.setItem('wrc_user', JSON.stringify(stored));
            console.log('✅ Sauvé dans localStorage');
            
            // Mettre à jour currentUser
            Object.assign(currentUser, updateData);
            
            // Mettre à jour l'UI
            updateUI(currentUser);
            
            showToast('Profil mis à jour !', 'success');
            
        } catch (err) {
            console.error('Erreur sauvegarde:', err);
            showToast(err.message || 'Erreur lors de la sauvegarde', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
        
        return false;
    }
    
    // ==========================================
    // LOGOUT HANDLER
    // ==========================================
    async function handleLogout() {
        console.log('🚪 Déconnexion...');
        
        // Clear storage
        localStorage.removeItem('wrc_user');
        sessionStorage.removeItem('wrc_user');
        
        // Supabase signout
        if (supabase) {
            try {
                await supabase.auth.signOut();
                console.log('✅ Supabase signout OK');
            } catch (e) {
                console.warn('Supabase signout error:', e);
            }
        }
        
        // Redirect
        showToast('Déconnexion...', 'info');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }
    
    // ==========================================
    // TOAST HELPER
    // ==========================================
    function showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            if (type === 'error') alert(message);
        }
    }
    
    // Exposer pour debug
    window.profileDebug = {
        currentUser: () => currentUser,
        supabase: () => supabase,
        save: handleSave,
        logout: handleLogout
    };
    
    console.log('✅ Profile-edit.js initialisé (debug: window.profileDebug)');
    
})();
