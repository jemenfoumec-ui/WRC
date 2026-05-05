/**
 * WRC 2026 - Tournament Registration
 * Inscription au tournoi avec Supabase
 * @version 4.0
 */

import { supabase } from './supabaseClient.js';

// ==========================================
// STATE
// ==========================================
let currentUser = null;
let userProfile = null;
let activeTournament = null;
let isRegistered = false;

// Toast helper
const toast = {
    success: (msg) => window.showToast?.(msg, 'success') || console.log('✅', msg),
    error: (msg) => window.showToast?.(msg, 'error') || console.error('❌', msg),
    info: (msg) => window.showToast?.(msg, 'info') || console.log('ℹ️', msg)
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📝 Tournament Registration - Init');
    
    // Check auth
    const isAuthed = await checkAuth();
    if (!isAuthed) return;
    
    // Load tournament info
    await loadTournament();
    
    // Check registration status
    await checkRegistrationStatus();
    
    // Setup form
    setupForm();
    
    // Pre-fill form if profile exists
    prefillForm();
    
    console.log('✅ Registration page ready');
});

// ==========================================
// AUTH CHECK
// ==========================================
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            // Vérifier le localStorage
            const localUser = localStorage.getItem('wrc_user') || sessionStorage.getItem('wrc_user');
            if (localUser) {
                currentUser = JSON.parse(localUser);
                
                // Charger le profil
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('email', currentUser.email)
                    .single();
                
                if (profile) {
                    userProfile = profile;
                    currentUser = { ...currentUser, ...profile };
                }
                
                return true;
            }
            
            toast.info('Connectez-vous pour vous inscrire');
            return true; // Laisser la page se charger, l'utilisateur peut s'inscrire via le formulaire
        }
        
        currentUser = session.user;
        
        // Charger le profil complet
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (profile) {
            userProfile = profile;
            currentUser = { ...currentUser, ...profile };
        }
        
        console.log('✅ User:', currentUser.email);
        return true;
        
    } catch (err) {
        console.error('Auth error:', err);
        return true; // Continuer quand même
    }
}

// ==========================================
// LOAD TOURNAMENT
// ==========================================
async function loadTournament() {
    try {
        // Charger le tournoi actif pour la France
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('country', 'FR')
            .eq('status', 'registration')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
            activeTournament = data;
            updateTournamentUI(data);
        } else {
            // Pas de tournoi actif, créer un par défaut pour l'affichage
            activeTournament = {
                name: 'WRC France 2026',
                country: 'FR',
                status: 'registration',
                registration_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };
        }
        
    } catch (err) {
        console.error('Load tournament error:', err);
    }
}

function updateTournamentUI(tournament) {
    // Mettre à jour le countdown si présent
    const endDate = new Date(tournament.registration_end);
    const now = new Date();
    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // On pourrait mettre à jour un élément de countdown ici
    console.log(`📅 ${daysLeft} jours restants pour s'inscrire`);
}

// ==========================================
// CHECK REGISTRATION STATUS
// ==========================================
async function checkRegistrationStatus() {
    if (!currentUser?.id || !activeTournament?.id) return;
    
    try {
        const { data, error } = await supabase
            .from('tournament_registrations')
            .select('*')
            .eq('tournament_id', activeTournament.id)
            .eq('artist_id', currentUser.id)
            .single();
        
        if (data) {
            isRegistered = true;
            showAlreadyRegistered(data);
        }
        
    } catch (err) {
        // Pas inscrit = OK
    }
}

function showAlreadyRegistered(registration) {
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

// ==========================================
// FORM SETUP
// ==========================================
function setupForm() {
    const form = document.getElementById('registrationForm');
    if (!form) return;
    
    form.addEventListener('submit', handleSubmit);
    
    // Country select
    populateCountries();
}

function prefillForm() {
    if (!userProfile) return;
    
    const fields = {
        'stageName': userProfile.stage_name || userProfile.username,
        'email': userProfile.email || currentUser?.email,
        'city': userProfile.city,
        'country': userProfile.country,
        'bio': userProfile.bio
    };
    
    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    }
}

function populateCountries() {
    const select = document.getElementById('country');
    if (!select) return;
    
    const countries = [
        { code: 'FR', name: '🇫🇷 France' },
        { code: 'BE', name: '🇧🇪 Belgique' },
        { code: 'CH', name: '🇨🇭 Suisse' },
        { code: 'CA', name: '🇨🇦 Canada' },
        { code: 'SN', name: '🇸🇳 Sénégal' },
        { code: 'CI', name: '🇨🇮 Côte d\'Ivoire' },
        { code: 'MA', name: '🇲🇦 Maroc' },
        { code: 'DZ', name: '🇩🇿 Algérie' },
        { code: 'TN', name: '🇹🇳 Tunisie' }
    ];
    
    select.innerHTML = countries.map(c => 
        `<option value="${c.code}" ${c.code === 'FR' ? 'selected' : ''}>${c.name}</option>`
    ).join('');
}

// ==========================================
// FORM SUBMIT
// ==========================================
async function handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;
    
    // Validation
    const stageName = form.querySelector('#stageName')?.value?.trim();
    const email = form.querySelector('#email')?.value?.trim();
    const country = form.querySelector('#country')?.value;
    const city = form.querySelector('#city')?.value?.trim();
    const bio = form.querySelector('#bio')?.value?.trim();
    const acceptRules = form.querySelector('#acceptRules')?.checked;
    
    if (!stageName || stageName.length < 2) {
        toast.error('Nom de scène requis (min 2 caractères)');
        return;
    }
    
    if (!email || !email.includes('@')) {
        toast.error('Email valide requis');
        return;
    }
    
    if (!acceptRules) {
        toast.error('Vous devez accepter le règlement');
        return;
    }
    
    // Disable button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'INSCRIPTION...';
    }
    
    try {
        // Si pas connecté, créer un compte
        if (!currentUser?.id) {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password: generateTempPassword(), // Mot de passe temporaire
                options: {
                    data: {
                        username: stageName,
                        stage_name: stageName,
                        role: 'artist'
                    }
                }
            });
            
            if (authError) throw authError;
            
            currentUser = authData.user;
            toast.info('Un email de confirmation vous a été envoyé');
        }
        
        // Mettre à jour ou créer le profil
        const profileData = {
            id: currentUser.id,
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
        
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profileData);
        
        if (profileError) throw profileError;
        
        // Inscription au tournoi si un tournoi existe
        if (activeTournament?.id) {
            const { error: regError } = await supabase
                .from('tournament_registrations')
                .upsert({
                    tournament_id: activeTournament.id,
                    artist_id: currentUser.id,
                    status: 'pending'
                });
            
            if (regError && !regError.message.includes('duplicate')) throw regError;
        }
        
        // Sauvegarder en local
        const userData = {
            id: currentUser.id,
            email,
            role: 'artist',
            stage_name: stageName,
            username: stageName
        };
        localStorage.setItem('wrc_user', JSON.stringify(userData));
        
        // Dispatch auth event
        window.dispatchEvent(new CustomEvent('wrc-auth-change', {
            detail: { user: userData, isAuthenticated: true }
        }));
        
        toast.success('Inscription réussie ! 🎉');
        
        // Rediriger vers le dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (err) {
        console.error('Registration error:', err);
        toast.error(err.message || 'Erreur lors de l\'inscription');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

function generateTempPassword() {
    return 'WRC2026_' + Math.random().toString(36).substring(2, 10) + '!';
}

console.log('✅ Tournament Registration module loaded');
