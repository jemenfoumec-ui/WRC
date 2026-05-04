// ==========================================
// DASHBOARD ADMIN V2 - VERSION ROBUSTE
// Gestion des AbortError et refresh automatique
// ==========================================
import { supabase } from './supabaseClient.js';

class AdminDashboardV2 {
    constructor() {
        this.currentUser = null;
        this.currentView = 'overview';
        this.realtimeSubscriptions = [];
        this.updateInterval = null;
        this.testLogs = [];
        this.systemLogs = [];
        this.currentTournament = null;
        this.currentMatch = null;
        this._trackUrlA = null;
        this._trackUrlB = null;
        this._isLoading = false;
        this._initComplete = false;
        
        // Mode DEV ou PROD
        this.mode = localStorage.getItem('wrc_admin_mode') || 'dev';
        
        // Attendre que tout soit chargé avant d'init
        if (document.readyState === 'complete') {
            setTimeout(() => this.init(), 200);
        } else {
            window.addEventListener('load', () => setTimeout(() => this.init(), 200));
        }
    }
    
    // Helper pour requêtes sécurisées avec retry
    async query(fn, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn();
            } catch (e) {
                if (e.name === 'AbortError' && i < retries) {
                    await this.wait(100 * (i + 1));
                    continue;
                }
                console.warn('Query error:', e.message);
                return { data: null, error: e, count: 0 };
            }
        }
    }
    
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    
    async init() {
        if (this._initComplete) return;
        console.log('🔧 Init Admin Dashboard V2...');
        
        try {
            // Session avec retry
            let session = null;
            for (let i = 0; i < 3; i++) {
                const result = await this.query(() => supabase.auth.getSession());
                session = result?.data?.session;
                if (session) break;
                await this.wait(200);
            }
            
            if (!session) { 
                console.warn('⛔ Pas de session');
                window.location.replace('index.html'); 
                return; 
            }
            
            this.currentUser = session.user;
            console.log('✅ User:', this.currentUser.email);
            
            // Vérifier admin
            const { data: profile } = await this.query(() => 
                supabase.from('profiles').select('is_admin, username, role').eq('id', this.currentUser.id).single()
            );
            
            if (!profile?.is_admin) {
                window.toast?.error('Accès refusé', 'Admin requis');
                setTimeout(() => window.location.href = 'index.html', 1500);
                return;
            }
            
            console.log('✅ Admin:', profile.username);
            this._initComplete = true;
            
            this.updateSidebarProfile(profile);
            this.setupSidebar();
            this.setupEventListeners();
            this.applyMode(); // Appliquer le mode DEV/PROD
            
            await this.loadAllData();
            this.startRealtimeUpdates();
            this.setupRealtimeSubscriptions();
            
            this.log('success', 'Dashboard initialisé en mode ' + this.mode.toUpperCase());
        } catch (e) {
            console.error('Init error:', e);
        }
    }
    
    // ==========================================
    // GESTION MODE DEV / PROD
    // ==========================================
    applyMode() {
        const isDev = this.mode === 'dev';
        
        // Mettre à jour le toggle
        const toggle = document.getElementById('modeToggle');
        if (toggle) toggle.checked = isDev;
        
        // Mettre à jour le label
        const label = document.getElementById('modeLabel');
        if (label) {
            label.textContent = isDev ? '🧪 MODE DEV' : '🚀 MODE PROD';
            label.className = 'mode-label ' + (isDev ? 'dev' : 'prod');
        }
        
        // Afficher/masquer les éléments selon le mode
        document.querySelectorAll('[data-mode="dev"]').forEach(el => {
            el.style.display = isDev ? '' : 'none';
        });
        document.querySelectorAll('[data-mode="prod"]').forEach(el => {
            el.style.display = isDev ? 'none' : '';
        });
        
        // Ajouter une classe au body
        document.body.classList.remove('mode-dev', 'mode-prod');
        document.body.classList.add('mode-' + this.mode);
        
        // Mettre à jour la sidebar
        const testLink = document.querySelector('.sidebar-link[data-view="test"]');
        if (testLink) testLink.style.display = isDev ? '' : 'none';
        
        console.log('🔧 Mode appliqué:', this.mode.toUpperCase());
        this.testLog('info', '🔧 Mode: ' + this.mode.toUpperCase());
    }
    
    toggleMode() {
        this.mode = this.mode === 'dev' ? 'prod' : 'dev';
        localStorage.setItem('wrc_admin_mode', this.mode);
        this.applyMode();
        
        window.toast?.info('Mode changé', this.mode === 'dev' ? '🧪 Mode DEV activé' : '🚀 Mode PROD activé');
        this.log('info', 'Mode changé: ' + this.mode.toUpperCase());
        
        // Si on passe en PROD et qu'on est sur la vue test, revenir à overview
        if (this.mode === 'prod' && this.currentView === 'test') {
            this.goToView('overview');
        }
    }
    
    // ==========================================
    // CRÉATION D'UTILISATEURS (MODE DEV)
    // ==========================================
    async createUser() {
        if (this.mode !== 'dev') {
            window.toast?.error('Erreur', 'Création d\'utilisateurs uniquement en mode DEV');
            return;
        }
        
        const email = document.getElementById('newUserEmail')?.value?.trim();
        const password = document.getElementById('newUserPassword')?.value;
        const username = document.getElementById('newUserUsername')?.value?.trim();
        const role = document.getElementById('newUserRole')?.value || 'fan';
        
        // Validations
        if (!email || !password || !username) {
            this.testLog('error', '❌ Tous les champs sont requis');
            window.toast?.error('Erreur', 'Remplissez tous les champs');
            return;
        }
        
        if (password.length < 6) {
            this.testLog('error', '❌ Mot de passe trop court (min 6 caractères)');
            window.toast?.error('Erreur', 'Mot de passe min 6 caractères');
            return;
        }
        
        if (!email.includes('@')) {
            this.testLog('error', '❌ Email invalide');
            window.toast?.error('Erreur', 'Email invalide');
            return;
        }
        
        this.testLog('info', '👤 Création utilisateur: ' + username + ' (' + role + ')');
        this.testLog('info', '   Email: ' + email);
        
        try {
            // Créer l'utilisateur via Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        role: role
                    }
                }
            });
            
            if (authError) {
                this.testLog('error', '❌ Erreur Auth: ' + authError.message);
                window.toast?.error('Erreur', authError.message);
                return;
            }
            
            if (!authData.user) {
                this.testLog('error', '❌ Utilisateur non créé');
                window.toast?.error('Erreur', 'Échec création utilisateur');
                return;
            }
            
            this.testLog('success', '✅ Utilisateur Auth créé: ' + authData.user.id);
            
            // Mettre à jour le profil avec le rôle
            const { error: profileError } = await this.query(() =>
                supabase.from('profiles').update({
                    username: username,
                    role: role,
                    is_admin: role === 'admin'
                }).eq('id', authData.user.id)
            );
            
            if (profileError) {
                this.testLog('warning', '⚠️ Erreur profil: ' + profileError.message);
            } else {
                this.testLog('success', '✅ Profil mis à jour');
            }
            
            // Clear les champs
            document.getElementById('newUserEmail').value = '';
            document.getElementById('newUserPassword').value = '';
            document.getElementById('newUserUsername').value = '';
            
            this.testLog('success', '🎉 Utilisateur "' + username + '" créé avec succès!');
            window.toast?.success('✅ Créé', 'Utilisateur ' + username + ' créé');
            
            // Rafraîchir les stats
            await this.loadStats();
            if (this.currentView === 'users') {
                await this.loadAllUsers();
            }
            
        } catch (e) {
            this.testLog('error', '❌ Exception: ' + e.message);
            window.toast?.error('Erreur', e.message);
        }
    }
    
    async createBulkUsers() {
        if (this.mode !== 'dev') {
            window.toast?.error('Erreur', 'Uniquement en mode DEV');
            return;
        }
        
        const count = parseInt(document.getElementById('bulkUserCount')?.value || 10);
        const role = document.getElementById('bulkUserRole')?.value || 'artist';
        
        this.testLog('info', '👥 === CRÉATION EN MASSE ===');
        this.testLog('info', '   Nombre: ' + count);
        this.testLog('info', '   Rôle: ' + role);
        
        let created = 0;
        let failed = 0;
        
        for (let i = 1; i <= count; i++) {
            const timestamp = Date.now();
            const email = 'test_' + role + '_' + i + '_' + timestamp + '@wrc-test.com';
            const username = 'Test' + role.charAt(0).toUpperCase() + role.slice(1) + '_' + i;
            const password = 'test123456';
            
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: { username: username, role: role }
                    }
                });
                
                if (error) {
                    failed++;
                    this.testLog('warning', '   ⚠️ #' + i + ': ' + error.message);
                } else if (data.user) {
                    // Mettre à jour le profil
                    await this.query(() =>
                        supabase.from('profiles').update({
                            username: username,
                            role: role
                        }).eq('id', data.user.id)
                    );
                    created++;
                    this.testLog('success', '   ✅ #' + i + ': ' + username);
                }
            } catch (e) {
                failed++;
                this.testLog('error', '   ❌ #' + i + ': ' + e.message);
            }
            
            // Petite pause pour éviter le rate limiting
            await this.wait(200);
        }
        
        this.testLog('success', '👥 === CRÉATION TERMINÉE ===');
        this.testLog('info', '   Créés: ' + created);
        this.testLog('info', '   Échecs: ' + failed);
        
        window.toast?.success('✅ Terminé', created + ' utilisateurs créés');
        
        await this.loadStats();
        if (this.currentView === 'users') {
            await this.loadAllUsers();
        }
    }
    
    // ==========================================
    // SIDEBAR & NAVIGATION
    // ==========================================
    updateSidebarProfile(profile) {
        const u = profile?.username || 'Admin';
        const el = id => document.getElementById(id);
        if (el('sidebarUsername')) el('sidebarUsername').textContent = u;
        if (el('sidebarAvatar')) el('sidebarAvatar').innerHTML = '<span>' + u.charAt(0).toUpperCase() + '</span>';
    }
    
    setupSidebar() {
        document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
            link.onclick = e => { e.preventDefault(); this.goToView(link.dataset.view); };
        });
    }
    
    setupEventListeners() {
        // Emergency stop
        document.getElementById('emergencyStop')?.addEventListener('click', () => {
            if (confirm('⚠️ ARRÊT D\'URGENCE - Stopper le tournoi ?')) {
                this.stopTournament();
            }
        });
        
        // Search inputs
        document.getElementById('userSearchInput')?.addEventListener('keyup', e => {
            if (e.key === 'Enter') this.searchUsers();
        });
        document.getElementById('trackSearchInput')?.addEventListener('keyup', e => {
            if (e.key === 'Enter') this.searchTracks();
        });
        
        // Bias slider
        const biasSlider = document.getElementById('testVoteBias');
        const biasValue = document.getElementById('testVoteBiasValue');
        if (biasSlider && biasValue) {
            biasSlider.addEventListener('input', () => {
                biasValue.textContent = biasSlider.value + '%';
            });
        }
        
        console.log('✅ Event listeners configurés');
    }
    
    goToView(view) {
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.sidebar-link[data-view="'+view+'"]')?.classList.add('active');
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        document.getElementById('view-'+view)?.classList.add('active');
        this.currentView = view;
        this.loadViewData(view);
    }
    
    loadViewData(view) {
        const actions = {
            overview: () => this.loadAllData(),
            realtime: () => this.loadRealtimeActivity(),
            users: () => this.loadAllUsers(),
            tracks: () => this.loadAllTracks(),
            tournament: () => this.loadTournamentFull(),
            test: () => this.initTestPanel(),
            logs: () => this.refreshLogs()
        };
        actions[view]?.();
    }
    
    // ==========================================
    // CHARGEMENT DES DONNÉES
    // ==========================================
    async loadAllData() {
        if (this._isLoading) return;
        this._isLoading = true;
        try {
            await Promise.allSettled([
                this.loadStats(),
                this.loadRecentActivity(),
                this.loadRecentUsers(),
                this.loadRecentTracks(),
                this.loadTournamentStatus(),
                this.loadSystemHealth()
            ]);
        } finally {
            this._isLoading = false;
        }
    }
    
    async loadStats() {
        const [u, a, t, v] = await Promise.all([
            this.query(() => supabase.from('profiles').select('*', { count: 'exact', head: true })),
            this.query(() => supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'artist')),
            this.query(() => supabase.from('tracks').select('*', { count: 'exact', head: true })),
            this.query(() => supabase.from('tournament_votes').select('*', { count: 'exact', head: true }))
        ]);
        this.updateEl('statTotalUsers', u.count || 0);
        this.updateEl('statTotalArtists', a.count || 0);
        this.updateEl('statTotalTracks', t.count || 0);
        this.updateEl('statTotalVotes', v.count || 0);
        this.updateEl('statOnlineNow', Math.floor(Math.random() * 30) + 5);
        this.updateEl('onlineCount', Math.floor(Math.random() * 30) + 5);
    }
    
    async loadRecentActivity() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        
        const [tr, us] = await Promise.all([
            this.query(() => supabase.from('tracks').select('id, title, created_at, profiles:artist_id(username)').order('created_at', { ascending: false }).limit(5)),
            this.query(() => supabase.from('profiles').select('id, username, created_at, role').order('created_at', { ascending: false }).limit(5))
        ]);
        
        const acts = [
            ...(tr.data?.map(t => ({ icon: '🎵', text: 'Track: ' + this.esc(t.title), time: this.ago(t.created_at), ts: new Date(t.created_at).getTime() })) || []),
            ...(us.data?.map(u => ({ icon: '👤', text: 'User: ' + this.esc(u.username), time: this.ago(u.created_at), ts: new Date(u.created_at).getTime() })) || [])
        ].sort((a, b) => b.ts - a.ts);
        
        feed.innerHTML = acts.length ? acts.slice(0, 8).map(a => 
            '<div class="activity-item"><span class="activity-icon">' + a.icon + '</span><div class="activity-content"><span class="activity-text">' + a.text + '</span><span class="activity-time">' + a.time + '</span></div></div>'
        ).join('') : '<div class="empty-state small"><p>Aucune activité</p></div>';
    }
    
    async loadRecentUsers() {
        const c = document.getElementById('recentUsers');
        if (!c) return;
        const { data } = await this.query(() => supabase.from('profiles').select('id, username, role, created_at').order('created_at', { ascending: false }).limit(5));
        c.innerHTML = data?.length ? data.map(u => 
            '<div class="user-item"><div class="user-avatar">' + (u.username || 'U').charAt(0).toUpperCase() + '</div><div class="user-info"><span class="user-name">' + this.esc(u.username) + '</span><span class="user-email">' + this.ago(u.created_at) + '</span></div><span class="badge badge-' + (u.role === 'artist' ? 'info' : 'warning') + '">' + (u.role || 'fan') + '</span></div>'
        ).join('') : '<div class="empty-state small"><p>Aucun</p></div>';
    }
    
    async loadRecentTracks() {
        const c = document.getElementById('recentTracks');
        if (!c) return;
        const { data } = await this.query(() => supabase.from('tracks').select('id, title, created_at, cover_url, profiles:artist_id(username)').order('created_at', { ascending: false }).limit(5));
        c.innerHTML = data?.length ? data.map(t => 
            '<div class="track-admin-item"><div class="track-cover-sm">' + (t.cover_url ? '<img src="' + t.cover_url + '">' : '🎵') + '</div><div class="track-info"><span class="track-title">' + this.esc(t.title) + '</span><span class="track-artist">' + this.esc(t.profiles?.username || '?') + '</span></div></div>'
        ).join('') : '<div class="empty-state small"><p>Aucun</p></div>';
    }
    
    async loadTournamentStatus() {
        // Chercher un tournoi actif, en inscription, ou en pause
        const { data: t, error } = await this.query(() => 
            supabase.from('tournaments')
                .select('*')
                .in('status', ['registration', 'active', 'paused'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
        );
        
        if (error) {
            console.warn('Tournament query error:', error.message);
            this.testLog('warning', '⚠️ Erreur chargement tournoi: ' + error.message);
        }
        
        this.currentTournament = t;
        const badge = document.getElementById('tournamentStatus');
        
        if (t?.id) {
            // Charger les stats du tournoi
            const [pRes, mRes] = await Promise.all([
                this.query(() => supabase.from('tournament_participants').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id)),
                this.query(() => supabase.from('tournament_matches').select('*').eq('tournament_id', t.id).eq('status', 'live').limit(1).maybeSingle())
            ]);
            
            this.currentMatch = mRes.data;
            
            // Mettre à jour le badge
            if (badge) {
                const statusMap = {
                    'active': { text: 'LIVE', class: 'danger' },
                    'registration': { text: 'INSCRIPTIONS', class: 'info' },
                    'paused': { text: 'PAUSE', class: 'warning' }
                };
                const s = statusMap[t.status] || { text: t.status.toUpperCase(), class: 'secondary' };
                badge.textContent = s.text;
                badge.className = 'badge badge-' + s.class;
            }
            
            this.updateEl('currentPhase', t.current_round || 'R1');
            this.updateEl('currentMatch', mRes.data ? '#' + mRes.data.match_number : '--');
            this.updateEl('participantCount', pRes.count || 0);
            
            console.log('✅ Tournoi chargé:', t.name, '(' + t.status + ')');
        } else {
            this.currentTournament = null;
            this.currentMatch = null;
            
            if (badge) { 
                badge.textContent = 'AUCUN'; 
                badge.className = 'badge badge-secondary'; 
            }
            this.updateEl('currentPhase', '--');
            this.updateEl('currentMatch', '--');
            this.updateEl('participantCount', '0');
        }
    }
    
    async loadSystemHealth() {
        const [p, t] = await Promise.all([
            this.query(() => supabase.from('profiles').select('*', { count: 'exact', head: true })),
            this.query(() => supabase.from('tracks').select('*', { count: 'exact', head: true }))
        ]);
        const db = Math.min(((p.count || 0) + (t.count || 0) * 5) / 5000 * 100, 100);
        const st = Math.min(((t.count || 0) * 5) / 1000 * 100, 100);
        this.updateEl('dbUsage', Math.round(db) + '%');
        this.updateEl('storageUsage', Math.round(st) + '%');
        const dbBar = document.getElementById('dbBar');
        const stBar = document.getElementById('storageBar');
        if (dbBar) dbBar.style.width = db + '%';
        if (stBar) stBar.style.width = st + '%';
        const h = document.getElementById('systemHealth');
        if (h) { h.textContent = (db < 80 && st < 80) ? 'OK' : 'ATTENTION'; h.className = 'badge badge-' + ((db < 80 && st < 80) ? 'success' : 'warning'); }
    }
    
    // ==========================================
    // TOURNAMENT CONTROL
    // ==========================================
    async loadTournamentFull() {
        await this.loadTournamentStatus();
        
        const sb = document.getElementById('tournamentStatusBig');
        const panel = document.getElementById('matchControlPanel');
        const display = document.getElementById('currentMatchDisplay');
        
        if (this.currentTournament?.id) {
            const tid = this.currentTournament.id;
            
            if (sb) {
                sb.textContent = this.currentTournament.status === 'active' ? 'LIVE' : this.currentTournament.status.toUpperCase();
                sb.className = 'badge badge-' + (this.currentTournament.status === 'active' ? 'danger' : 'info');
            }
            this.updateEl('tournamentName', this.currentTournament.name || 'Sans nom');
            this.updateEl('tournamentState', this.currentTournament.status);
            
            const [pRes, mcRes, mtRes] = await Promise.all([
                this.query(() => supabase.from('tournament_participants').select('*', { count: 'exact', head: true }).eq('tournament_id', tid)),
                this.query(() => supabase.from('tournament_matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tid).eq('status', 'completed')),
                this.query(() => supabase.from('tournament_matches').select('*', { count: 'exact', head: true }).eq('tournament_id', tid))
            ]);
            
            this.updateEl('tournamentParticipants', pRes.count || 0);
            this.updateEl('tournamentMatchesPlayed', (mcRes.count || 0) + '/' + (mtRes.count || 0));
            
            // Charger match en cours ou prochain
            if (this.currentMatch?.id) {
                await this.displayCurrentMatch(this.currentMatch);
            } else {
                const { data: next } = await this.query(() => 
                    supabase.from('tournament_matches').select('*')
                        .eq('tournament_id', tid).eq('status', 'pending')
                        .not('participant_a_id', 'is', null).not('participant_b_id', 'is', null)
                        .order('round_number').order('match_number').limit(1).maybeSingle()
                );
                if (next) {
                    this.currentMatch = next;
                    await this.displayCurrentMatch(next);
                } else if (display) {
                    display.innerHTML = '<div class="empty-state small"><p>Aucun match en attente</p></div>';
                    if (panel) panel.style.display = 'none';
                }
            }
        } else {
            if (sb) { sb.textContent = 'IDLE'; sb.className = 'badge badge-warning'; }
            this.updateEl('tournamentName', 'Aucun');
            this.updateEl('tournamentState', '--');
            this.updateEl('tournamentParticipants', '0');
            this.updateEl('tournamentMatchesPlayed', '0/0');
            if (panel) panel.style.display = 'none';
            if (display) display.innerHTML = '<div class="empty-state small"><p>Aucun tournoi actif</p></div>';
        }
    }
    
    async displayCurrentMatch(match) {
        const panel = document.getElementById('matchControlPanel');
        const display = document.getElementById('currentMatchDisplay');
        
        if (!match?.id) {
            if (panel) panel.style.display = 'none';
            if (display) display.innerHTML = '<div class="empty-state small"><p>Aucun match sélectionné</p><button class="btn btn-outline" onclick="adminDash.loadNextMatch()">📥 Charger un match</button></div>';
            return;
        }
        
        // Toujours afficher le panel si on a un match
        if (panel) panel.style.display = 'block';
        
        const [pA, pB] = await Promise.all([
            match.participant_a_id ? this.query(() => supabase.from('tournament_participants').select('*, profiles:artist_id(username, avatar_url), tracks:track_id(title, file_url)').eq('id', match.participant_a_id).single()) : { data: null },
            match.participant_b_id ? this.query(() => supabase.from('tournament_participants').select('*, profiles:artist_id(username, avatar_url), tracks:track_id(title, file_url)').eq('id', match.participant_b_id).single()) : { data: null }
        ]);
        
        const statusColor = match.status === 'live' ? '#ef4444' : match.status === 'pending' ? '#f59e0b' : '#10b981';
        const statusText = match.status === 'live' ? '🔴 LIVE' : match.status === 'pending' ? '⏳ EN ATTENTE' : '✅ TERMINÉ';
        
        if (display) {
            display.innerHTML = '<div style="text-align:center;padding:15px;">' +
                '<div style="font-family:Orbitron;color:#00fff0;font-size:1.4rem;margin-bottom:5px;">Match #' + match.match_number + '</div>' +
                '<div style="font-size:0.85rem;color:rgba(255,255,255,0.6);">' + (match.round_name || 'Round ' + match.round_number) + '</div>' +
                '<div style="font-size:0.9rem;color:' + statusColor + ';margin-top:8px;font-weight:600;">' + statusText + '</div>' +
            '</div>';
        }
        
        // Mettre à jour les infos fighters
        this.updateEl('fighterAName', pA.data?.profiles?.username || 'Fighter A');
        this.updateEl('fighterBName', pB.data?.profiles?.username || 'Fighter B');
        this.updateEl('fighterAVotes', match.votes_a || 0);
        this.updateEl('fighterBVotes', match.votes_b || 0);
        this._trackUrlA = pA.data?.tracks?.file_url;
        this._trackUrlB = pB.data?.tracks?.file_url;
        
        this.testLog('info', 'Match affiché: #' + match.match_number + ' (' + match.status + ')');
    }
    
    // ==========================================
    // GESTION USERS & TRACKS
    // ==========================================
    async loadAllUsers() {
        const container = document.getElementById('allUsersList');
        if (!container) return;
        
        container.innerHTML = '<div class="empty-state"><p>Chargement...</p></div>';
        
        const { data } = await this.query(() => 
            supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100)
        );
        
        if (!data?.length) {
            container.innerHTML = '<div class="empty-state"><p>Aucun utilisateur</p></div>';
            return;
        }
        
        container.innerHTML = data.map(u => 
            '<div class="user-item" data-id="' + u.id + '">' +
                '<div class="user-avatar">' + (u.username || 'U').charAt(0).toUpperCase() + '</div>' +
                '<div class="user-info">' +
                    '<span class="user-name">' + this.esc(u.username || 'Inconnu') + '</span>' +
                    '<span class="user-email">' + this.esc(u.email || '') + ' • ' + this.ago(u.created_at) + '</span>' +
                '</div>' +
                '<span class="badge badge-' + (u.is_admin ? 'danger' : u.role === 'artist' ? 'info' : 'warning') + '">' + (u.is_admin ? 'admin' : u.role || 'fan') + '</span>' +
                '<button class="btn-icon-sm" onclick="adminDash.editUser(\'' + u.id + '\')">✏️</button>' +
            '</div>'
        ).join('');
        
        this.log('info', data.length + ' utilisateurs chargés');
    }
    
    async loadAllTracks() {
        const container = document.getElementById('allTracksList');
        if (!container) return;
        
        container.innerHTML = '<div class="empty-state"><p>Chargement...</p></div>';
        
        const { data } = await this.query(() => 
            supabase.from('tracks').select('*, profiles:artist_id(username)').order('created_at', { ascending: false }).limit(100)
        );
        
        if (!data?.length) {
            container.innerHTML = '<div class="empty-state"><p>Aucun track</p></div>';
            return;
        }
        
        container.innerHTML = data.map(t => 
            '<div class="track-admin-item" data-id="' + t.id + '">' +
                '<div class="track-cover-sm">' + (t.cover_url ? '<img src="' + t.cover_url + '">' : '🎵') + '</div>' +
                '<div class="track-info">' +
                    '<span class="track-title">' + this.esc(t.title || 'Sans titre') + '</span>' +
                    '<span class="track-artist">' + this.esc(t.profiles?.username || '?') + ' • ' + (t.duration || '--:--') + ' • ' + this.ago(t.created_at) + '</span>' +
                '</div>' +
                '<button class="btn-icon-sm" onclick="adminDash.deleteTrack(\'' + t.id + '\')" title="Supprimer">🗑️</button>' +
            '</div>'
        ).join('');
        
        this.log('info', data.length + ' tracks chargés');
    }
    
    searchUsers() {
        const query = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
        document.querySelectorAll('#allUsersList .user-item').forEach(item => {
            const name = (item.querySelector('.user-name')?.textContent || '').toLowerCase();
            const email = (item.querySelector('.user-email')?.textContent || '').toLowerCase();
            item.style.display = (name.includes(query) || email.includes(query)) ? 'flex' : 'none';
        });
    }
    
    searchTracks() {
        const query = (document.getElementById('trackSearchInput')?.value || '').toLowerCase();
        document.querySelectorAll('#allTracksList .track-admin-item').forEach(item => {
            const title = (item.querySelector('.track-title')?.textContent || '').toLowerCase();
            const artist = (item.querySelector('.track-artist')?.textContent || '').toLowerCase();
            item.style.display = (title.includes(query) || artist.includes(query)) ? 'flex' : 'none';
        });
    }
    
    refreshUsers() { this.loadAllUsers(); window.toast?.info('🔄', 'Liste mise à jour'); }
    refreshTracks() { this.loadAllTracks(); window.toast?.info('🔄', 'Liste mise à jour'); }
    
    async editUser(userId) {
        const newRole = prompt('Nouveau rôle (fan, artist, jury):');
        if (!newRole || !['fan', 'artist', 'jury'].includes(newRole)) {
            window.toast?.error('Erreur', 'Rôle invalide');
            return;
        }
        await this.query(() => supabase.from('profiles').update({ role: newRole }).eq('id', userId));
        window.toast?.success('✅', 'Rôle modifié: ' + newRole);
        await this.loadAllUsers();
    }
    
    async deleteTrack(trackId) {
        if (!confirm('Supprimer ce track définitivement ?')) return;
        await this.query(() => supabase.from('tracks').delete().eq('id', trackId));
        window.toast?.success('🗑️', 'Track supprimé');
        await this.loadAllTracks();
        await this.loadStats();
    }
    
    async startTournament() {
        // Vérifier qu'un tournoi existe
        if (!this.currentTournament?.id) { 
            this.testLog('error', '❌ Aucun tournoi sélectionné');
            window.toast?.error('Erreur', 'Créez d\'abord un tournoi'); 
            return; 
        }
        
        const tid = this.currentTournament.id;
        const tname = this.currentTournament.name;
        this.testLog('info', '🚀 Démarrage du tournoi: ' + tname);
        
        // Vérifier les participants
        const { count, error: countErr } = await this.query(() => 
            supabase.from('tournament_participants')
                .select('*', { count: 'exact', head: true })
                .eq('tournament_id', tid)
        );
        
        if (countErr) {
            this.testLog('error', '❌ Erreur vérification participants: ' + countErr.message);
            return;
        }
        
        this.testLog('info', '   Participants inscrits: ' + (count || 0));
        
        if ((count || 0) < 2) { 
            this.testLog('error', '❌ Minimum 2 participants requis');
            window.toast?.error('Erreur', 'Min 2 participants requis'); 
            return; 
        }
        
        // Vérifier/générer le bracket
        const { count: mC } = await this.query(() => 
            supabase.from('tournament_matches')
                .select('*', { count: 'exact', head: true })
                .eq('tournament_id', tid)
        );
        
        if (!mC) {
            this.testLog('info', '📊 Génération du bracket...');
            try {
                await this.generateBracket();
            } catch (e) {
                this.testLog('error', '❌ Erreur bracket: ' + e.message);
                window.toast?.error('Erreur', e.message);
                return;
            }
        } else {
            this.testLog('info', '   Bracket existant: ' + mC + ' matchs');
        }
        
        // Activer le tournoi
        const { error } = await this.query(() => 
            supabase.from('tournaments')
                .update({ status: 'active', current_round: 'R1', started_at: new Date().toISOString() })
                .eq('id', tid)
        );
        
        if (error) { 
            this.testLog('error', '❌ Erreur activation: ' + error.message);
            window.toast?.error('Erreur', error.message); 
            return; 
        }
        
        this.testLog('success', '✅ Tournoi "' + tname + '" démarré!');
        this.log('success', 'Tournoi démarré: ' + tname);
        window.toast?.success('🚀 Démarré', 'Le tournoi est actif');
        await this.refreshAll();
    }
    
    async generateBracket() {
        if (!this.currentTournament?.id) return;
        const tid = this.currentTournament.id;
        
        const { data: parts } = await this.query(() => supabase.from('tournament_participants').select('id, seeding').eq('tournament_id', tid).order('seeding'));
        if (!parts?.length || parts.length < 2) throw new Error('Pas assez de participants');
        
        const size = Math.pow(2, Math.ceil(Math.log2(parts.length)));
        const rounds = Math.log2(size);
        const names = { 1: 'Finale', 2: 'Demi-Finales', 4: 'Quarts', 8: 'Huitièmes', 16: 'Seizièmes', 32: 'R32', 64: 'R64', 128: 'R128' };
        const matches = [];
        let mn = 1;
        
        this.testLog('info', parts.length + ' participants → ' + size + ' slots, ' + rounds + ' rounds');
        
        for (let r = 1; r <= rounds; r++) {
            const inR = size / Math.pow(2, r);
            const rn = names[inR * 2] || 'Round ' + r;
            for (let m = 0; m < inR; m++) {
                const md = { tournament_id: tid, match_id: 'R' + r + 'M' + (m + 1), round_number: r, round_name: rn, match_number: mn++, status: 'pending', votes_a: 0, votes_b: 0 };
                if (r === 1) {
                    const sA = m * 2, sB = m * 2 + 1;
                    if (sA < parts.length) md.participant_a_id = parts[sA].id;
                    if (sB < parts.length) md.participant_b_id = parts[sB].id;
                    if (md.participant_a_id && !md.participant_b_id) { md.winner_id = md.participant_a_id; md.status = 'completed'; }
                    else if (!md.participant_a_id && md.participant_b_id) { md.winner_id = md.participant_b_id; md.status = 'completed'; }
                }
                matches.push(md);
            }
        }
        
        await this.query(() => supabase.from('tournament_matches').insert(matches));
        this.testLog('success', matches.length + ' matchs créés');
    }
    
    async pauseTournament() {
        if (!this.currentTournament?.id) { 
            window.toast?.error('Erreur', 'Aucun tournoi actif'); 
            return; 
        }
        const { error } = await this.query(() => supabase.from('tournaments').update({ status: 'paused' }).eq('id', this.currentTournament.id));
        if (error) {
            this.testLog('error', '❌ Erreur pause: ' + error.message);
            window.toast?.error('Erreur', error.message);
            return;
        }
        this.testLog('success', '⏸️ Tournoi en pause');
        this.log('warning', 'Tournoi en pause');
        window.toast?.warning('⏸️ Pause', 'Tournoi suspendu');
        await this.refreshAll();
    }
    
    async stopTournament() {
        if (!this.currentTournament?.id) { 
            window.toast?.error('Erreur', 'Aucun tournoi actif'); 
            return; 
        }
        
        const tid = this.currentTournament.id;
        const tname = this.currentTournament.name;
        
        if (!confirm('⚠️ SUPPRIMER le tournoi "' + tname + '" ?\n\nCette action supprimera:\n- Tous les matchs\n- Tous les participants\n- Tous les votes\n- Le tournoi lui-même\n\nCette action est IRRÉVERSIBLE!')) return;
        
        this.testLog('info', '🗑️ Suppression du tournoi: ' + tname);
        
        try {
            // Supprimer dans l'ordre des dépendances FK
            this.testLog('info', '   → Suppression des votes...');
            const { error: e1 } = await this.query(() => supabase.from('tournament_votes').delete().eq('tournament_id', tid));
            if (e1) this.testLog('warning', '   ⚠️ Votes: ' + e1.message);
            else this.testLog('success', '   ✅ Votes supprimés');
            
            this.testLog('info', '   → Suppression des matchs...');
            const { error: e2 } = await this.query(() => supabase.from('tournament_matches').delete().eq('tournament_id', tid));
            if (e2) this.testLog('warning', '   ⚠️ Matchs: ' + e2.message);
            else this.testLog('success', '   ✅ Matchs supprimés');
            
            this.testLog('info', '   → Suppression des participants...');
            const { error: e3 } = await this.query(() => supabase.from('tournament_participants').delete().eq('tournament_id', tid));
            if (e3) this.testLog('warning', '   ⚠️ Participants: ' + e3.message);
            else this.testLog('success', '   ✅ Participants supprimés');
            
            this.testLog('info', '   → Suppression du tournoi...');
            const { error: e4 } = await this.query(() => supabase.from('tournaments').delete().eq('id', tid));
            if (e4) {
                this.testLog('error', '   ❌ Tournoi: ' + e4.message);
                window.toast?.error('Erreur', e4.message);
                return;
            }
            
            this.testLog('success', '🗑️ Tournoi "' + tname + '" supprimé!');
            this.log('error', 'Tournoi supprimé: ' + tname);
            window.toast?.success('🗑️ Supprimé', 'Tournoi supprimé définitivement');
            
            this.currentTournament = null;
            this.currentMatch = null;
            await this.refreshAll();
            
        } catch (e) {
            this.testLog('error', '❌ Exception: ' + e.message);
            window.toast?.error('Erreur', e.message);
        }
    }
    
    async refreshAll() {
        // Animation de chargement
        document.body.classList.add('loading');
        const startTime = Date.now();
        this.testLog('info', '🔄 Actualisation en cours...');
        
        try {
            // Recharger toutes les données de base
            await this.loadAllData();
            
            // Recharger la vue active spécifiquement
            switch (this.currentView) {
                case 'tournament': 
                    await this.loadTournamentFull(); 
                    break;
                case 'users': 
                    await this.loadAllUsers(); 
                    break;
                case 'tracks': 
                    await this.loadAllTracks(); 
                    break;
                case 'realtime': 
                    await this.loadRealtimeActivity(); 
                    break;
                case 'logs': 
                    this.refreshLogs(); 
                    break;
            }
            
            const duration = Date.now() - startTime;
            this.testLog('success', '✅ Dashboard actualisé (' + duration + 'ms)');
            this.log('info', 'Refresh complet en ' + duration + 'ms');
            
        } catch (e) {
            console.error('Refresh error:', e);
            this.testLog('error', '❌ Erreur refresh: ' + e.message);
            window.toast?.error('Erreur', 'Échec actualisation');
        } finally {
            // Délai minimum pour que l'utilisateur voie le loading
            const elapsed = Date.now() - startTime;
            if (elapsed < 300) {
                await this.wait(300 - elapsed);
            }
            document.body.classList.remove('loading');
        }
    }
    
    async refreshTournament() {
        document.body.classList.add('loading');
        try {
            await this.loadTournamentFull();
            await this.loadStats();
            window.toast?.info('🔄 Refresh', 'Données actualisées');
        } finally {
            document.body.classList.remove('loading');
        }
    }
    
    // Match controls
    playTrackA() { if (this._trackUrlA) { new Audio(this._trackUrlA).play(); window.toast?.info('🎵', 'Track A'); } }
    playTrackB() { if (this._trackUrlB) { new Audio(this._trackUrlB).play(); window.toast?.info('🎵', 'Track B'); } }
    
    async startMatch() {
        if (!this.currentMatch?.id) return;
        await this.query(() => supabase.from('tournament_matches').update({ status: 'live' }).eq('id', this.currentMatch.id));
        this.currentMatch.status = 'live';
        this.log('success', 'Match #' + this.currentMatch.match_number + ' lancé');
        window.toast?.success('▶️ LIVE', 'Match lancé');
        await this.refreshAll();
    }
    
    async resetVotes() {
        if (!this.currentMatch?.id || !confirm('Reset les votes ?')) return;
        await this.query(() => supabase.from('tournament_matches').update({ votes_a: 0, votes_b: 0 }).eq('id', this.currentMatch.id));
        await this.query(() => supabase.from('tournament_votes').delete().eq('match_id', this.currentMatch.id));
        this.currentMatch.votes_a = 0;
        this.currentMatch.votes_b = 0;
        this.log('warning', 'Votes réinitialisés pour match #' + this.currentMatch.match_number);
        window.toast?.warning('🔄 Reset', 'Votes réinitialisés');
        await this.refreshAll();
    }
    
    async endMatch() {
        if (!this.currentMatch?.id) return;
        const vA = this.currentMatch.votes_a || 0, vB = this.currentMatch.votes_b || 0;
        if (vA === vB) { window.toast?.warning('Égalité', 'Départage requis'); return; }
        
        const winner = vA > vB ? this.currentMatch.participant_a_id : this.currentMatch.participant_b_id;
        await this.query(() => supabase.from('tournament_matches').update({ status: 'completed', winner_id: winner, ended_at: new Date().toISOString() }).eq('id', this.currentMatch.id));
        await this.propagateWinner(this.currentMatch, winner);
        
        window.toast?.success('✅ Terminé', 'Match clôturé');
        this.currentMatch = null;
        await this.refreshAll();
    }
    
    async propagateWinner(match, winnerId) {
        const nr = match.round_number + 1;
        const { data: crm } = await this.query(() => supabase.from('tournament_matches').select('match_number').eq('tournament_id', match.tournament_id).eq('round_number', match.round_number).order('match_number'));
        if (!crm?.length) return;
        
        const first = crm[0].match_number;
        const rel = match.match_number - first;
        const nextRel = Math.floor(rel / 2);
        
        const { data: nrm } = await this.query(() => supabase.from('tournament_matches').select('*').eq('tournament_id', match.tournament_id).eq('round_number', nr).order('match_number'));
        if (!nrm?.length) return;
        
        const nm = nrm[nextRel];
        if (!nm) return;
        
        const isA = rel % 2 === 0;
        await this.query(() => supabase.from('tournament_matches').update(isA ? { participant_a_id: winnerId } : { participant_b_id: winnerId }).eq('id', nm.id));
        this.testLog('info', 'Gagnant propagé → Match #' + nm.match_number);
    }
    
    async skipMatch() {
        if (!this.currentMatch?.id || !confirm('Skip ce match ?')) return;
        const w = this.currentMatch.participant_a_id || this.currentMatch.participant_b_id;
        await this.query(() => supabase.from('tournament_matches').update({ status: 'completed', winner_id: w }).eq('id', this.currentMatch.id));
        if (w) await this.propagateWinner(this.currentMatch, w);
        window.toast?.warning('⏭️ Skip', 'Match ignoré');
        this.currentMatch = null;
        await this.refreshAll();
    }
    
    async loadNextMatch() {
        if (!this.currentTournament?.id) {
            window.toast?.error('Erreur', 'Aucun tournoi actif');
            return;
        }
        
        this.testLog('info', 'Chargement du prochain match...');
        
        // D'abord chercher un match live
        let { data: match } = await this.query(() => 
            supabase.from('tournament_matches').select('*')
                .eq('tournament_id', this.currentTournament.id)
                .eq('status', 'live')
                .limit(1).maybeSingle()
        );
        
        // Sinon chercher un match pending avec 2 participants
        if (!match) {
            const res = await this.query(() => 
                supabase.from('tournament_matches').select('*')
                    .eq('tournament_id', this.currentTournament.id)
                    .eq('status', 'pending')
                    .not('participant_a_id', 'is', null)
                    .not('participant_b_id', 'is', null)
                    .order('round_number').order('match_number')
                    .limit(1).maybeSingle()
            );
            match = res.data;
        }
        
        if (match) {
            this.currentMatch = match;
            await this.displayCurrentMatch(match);
            this.testLog('success', 'Match #' + match.match_number + ' chargé (' + match.status + ')');
            window.toast?.success('📥', 'Match #' + match.match_number + ' chargé');
        } else {
            this.testLog('warning', 'Aucun match disponible');
            window.toast?.warning('Info', 'Aucun match disponible');
        }
    }
    
    // ==========================================
    // TEST & SIMULATION
    // ==========================================
    initTestPanel() {
        // Setup du slider de biais
        const bs = document.getElementById('testVoteBias');
        const bv = document.getElementById('testVoteBiasValue');
        if (bs && bv) bs.oninput = () => bv.textContent = bs.value + '%';
        
        // Afficher le statut actuel
        this.testLog('info', '🧪 === PANEL TEST INITIALISÉ ===');
        
        if (this.currentTournament) {
            this.testLog('info', '🏆 Tournoi actif: ' + this.currentTournament.name);
            this.testLog('info', '   Status: ' + this.currentTournament.status);
            this.testLog('info', '   ID: ' + this.currentTournament.id.substring(0, 8) + '...');
        } else {
            this.testLog('info', '📭 Aucun tournoi actif');
            this.testLog('info', '   → Utilisez "🚀 Créer" pour créer un tournoi test');
        }
        
        if (this.currentMatch) {
            this.testLog('info', '⚔️ Match chargé: #' + this.currentMatch.match_number);
            this.testLog('info', '   Status: ' + this.currentMatch.status);
            this.testLog('info', '   Votes: ' + (this.currentMatch.votes_a || 0) + ' vs ' + (this.currentMatch.votes_b || 0));
        } else {
            this.testLog('info', '📭 Aucun match chargé');
        }
        
        this.testLog('success', '✅ Panel test prêt');
    }
    
    async createTestTournament() {
        const count = parseInt(document.getElementById('testParticipantCount')?.value || 32);
        const name = document.getElementById('testTournamentName')?.value || 'Test';
        this.testLog('info', '🆕 Création tournoi: ' + name + ' (' + count + ' participants)');
        
        try {
            // Vérifier s'il existe un tournoi actif
            const { data: ex } = await this.query(() => supabase.from('tournaments').select('id, name').in('status', ['registration', 'active']).limit(1).maybeSingle());
            if (ex) {
                this.testLog('error', '❌ Tournoi existant: ' + ex.name);
                window.toast?.error('Erreur', 'Un tournoi est déjà en cours');
                return;
            }
            
            // Créer le tournoi
            const { data: t, error: tErr } = await this.query(() => 
                supabase.from('tournaments').insert({ 
                    name: '[TEST] ' + name, 
                    status: 'registration', 
                    max_participants: count, 
                    min_participants: 2, 
                    created_by: this.currentUser.id 
                }).select().single()
            );
            
            if (tErr || !t) {
                this.testLog('error', '❌ Erreur création: ' + (tErr?.message || 'Pas de données'));
                window.toast?.error('Erreur', tErr?.message || 'Échec création');
                return;
            }
            
            this.testLog('success', '✅ Tournoi créé: ' + t.id);
            
            // Récupérer des artistes
            const { data: artists } = await this.query(() => 
                supabase.from('profiles').select('id').eq('role', 'artist').limit(count)
            );
            this.testLog('info', '👥 Artistes trouvés: ' + (artists?.length || 0));
            
            // Récupérer des tracks
            const { data: tracks } = await this.query(() => 
                supabase.from('tracks').select('id, artist_id').limit(count)
            );
            this.testLog('info', '🎵 Tracks trouvés: ' + (tracks?.length || 0));
            
            if (artists?.length && tracks?.length) {
                const parts = [];
                const used = new Set();
                
                for (let i = 0; i < Math.min(count, artists.length); i++) {
                    const a = artists[i];
                    if (used.has(a.id)) continue;
                    const tr = tracks.find(x => x.artist_id === a.id) || tracks[i % tracks.length];
                    if (tr) {
                        parts.push({ 
                            tournament_id: t.id, 
                            artist_id: a.id, 
                            track_id: tr.id, 
                            seeding: parts.length + 1, 
                            status: 'registered' 
                        });
                        used.add(a.id);
                    }
                }
                
                if (parts.length > 0) {
                    const { error: pErr } = await this.query(() => 
                        supabase.from('tournament_participants').insert(parts)
                    );
                    if (pErr) {
                        this.testLog('warning', '⚠️ Erreur participants: ' + pErr.message);
                    } else {
                        this.testLog('success', '✅ ' + parts.length + ' participants inscrits');
                    }
                }
            } else {
                this.testLog('warning', '⚠️ Pas assez d\'artistes/tracks - tournoi vide');
                this.testLog('info', '   → Ajoutez des artistes et tracks d\'abord');
            }
            
            // Mettre à jour l'état local
            this.currentTournament = t;
            this.currentMatch = null;
            
            this.testLog('success', '🎉 === TOURNOI CRÉÉ ===');
            this.testLog('info', '   Nom: ' + t.name);
            this.testLog('info', '   Status: ' + t.status);
            this.testLog('info', '   → Cliquez sur "▶️ Démarrer" pour lancer le tournoi');
            
            window.toast?.success('🎉 Créé', 'Tournoi "' + name + '" créé');
            await this.refreshAll();
            
        } catch (e) {
            this.testLog('error', '❌ Exception: ' + e.message);
            window.toast?.error('Erreur', e.message);
        }
    }
    
    async simulateVotes() {
        if (!this.currentMatch?.id) {
            this.testLog('error', '❌ Aucun match sélectionné');
            window.toast?.error('Erreur', 'Chargez d\'abord un match');
            return;
        }
        
        const count = parseInt(document.getElementById('testVoteCount')?.value || 50);
        const bias = parseInt(document.getElementById('testVoteBias')?.value || 50) / 100;
        
        this.testLog('info', '🗳️ Simulation de ' + count + ' votes (biais A: ' + Math.round(bias * 100) + '%)');
        
        // Générer les votes
        let vA = 0, vB = 0;
        for (let i = 0; i < count; i++) { 
            if (Math.random() < bias) vA++; 
            else vB++; 
        }
        
        const nA = (this.currentMatch.votes_a || 0) + vA;
        const nB = (this.currentMatch.votes_b || 0) + vB;
        
        this.testLog('info', '   → Votes générés: A+' + vA + ' / B+' + vB);
        
        // Mise à jour en base
        const { error } = await this.query(() => 
            supabase.from('tournament_matches')
                .update({ votes_a: nA, votes_b: nB })
                .eq('id', this.currentMatch.id)
        );
        
        if (error) {
            this.testLog('error', '❌ Erreur BDD: ' + error.message);
            window.toast?.error('Erreur', error.message);
            return;
        }
        
        // Mise à jour locale
        this.currentMatch.votes_a = nA;
        this.currentMatch.votes_b = nB;
        this.updateEl('fighterAVotes', nA);
        this.updateEl('fighterBVotes', nB);
        
        this.testLog('success', '✅ Votes enregistrés en BDD: ' + nA + ' vs ' + nB);
        window.toast?.success('🗳️ Votes', count + ' votes simulés');
    }
    
    async autoPlayMatch() {
        if (!this.currentMatch?.id) {
            this.testLog('error', '❌ Aucun match sélectionné');
            window.toast?.error('Erreur', 'Chargez d\'abord un match');
            return;
        }
        
        if (this.currentMatch.status === 'completed') {
            this.testLog('error', '❌ Ce match est déjà terminé');
            window.toast?.error('Erreur', 'Match déjà terminé');
            return;
        }
        
        const dur = parseInt(document.getElementById('testMatchDuration')?.value || 10);
        this.testLog('info', '⚡ Auto-play Match #' + this.currentMatch.match_number + ' (' + dur + ' secondes)');
        
        // Passer en LIVE
        const { error: liveErr } = await this.query(() => 
            supabase.from('tournament_matches')
                .update({ status: 'live', started_at: new Date().toISOString() })
                .eq('id', this.currentMatch.id)
        );
        
        if (liveErr) {
            this.testLog('error', '❌ Erreur passage LIVE: ' + liveErr.message);
            return;
        }
        
        this.currentMatch.status = 'live';
        this.testLog('success', '🔴 Match en LIVE');
        await this.displayCurrentMatch(this.currentMatch);
        window.toast?.info('▶️ Auto-play', dur + ' secondes');
        
        const mid = this.currentMatch.id;
        let elapsed = 0;
        
        const iv = setInterval(async () => {
            elapsed++;
            const remaining = dur - elapsed;
            
            // Générer des votes aléatoires
            const vA = Math.floor(Math.random() * 8) + 1;
            const vB = Math.floor(Math.random() * 8) + 1;
            
            // Récupérer les votes actuels et mettre à jour
            const { data: m } = await this.query(() => 
                supabase.from('tournament_matches')
                    .select('votes_a, votes_b')
                    .eq('id', mid)
                    .single()
            );
            
            if (m) {
                const nA = (m.votes_a || 0) + vA;
                const nB = (m.votes_b || 0) + vB;
                
                await this.query(() => 
                    supabase.from('tournament_matches')
                        .update({ votes_a: nA, votes_b: nB })
                        .eq('id', mid)
                );
                
                // Mise à jour UI en temps réel
                this.updateEl('fighterAVotes', nA);
                this.updateEl('fighterBVotes', nB);
                
                if (this.currentMatch) {
                    this.currentMatch.votes_a = nA;
                    this.currentMatch.votes_b = nB;
                }
                
                this.testLog('info', '⏱️ [' + elapsed + '/' + dur + '] A+' + vA + ' B+' + vB + ' → ' + nA + ' vs ' + nB);
            }
            
            if (elapsed >= dur) {
                clearInterval(iv);
                this.testLog('success', '⏱️ Timer terminé');
                this.testLog('info', '🏁 Fin du match...');
                await this.endMatch();
            }
        }, 1000);
    }
    
    async simulateFullTournament() {
        if (!this.currentTournament?.id) {
            this.testLog('error', '❌ Aucun tournoi actif');
            window.toast?.error('Erreur', 'Créez d\'abord un tournoi');
            return;
        }
        
        const sp = document.getElementById('testTournamentSpeed')?.value || 'normal';
        const delays = { fast: 500, normal: 1500, slow: 3000 };
        const dl = delays[sp] || 1500;
        
        this.testLog('info', '🏁 === SIMULATION TOURNOI COMPLET ===');
        this.testLog('info', '   Tournoi: ' + this.currentTournament.name);
        this.testLog('info', '   Vitesse: ' + sp + ' (' + dl + 'ms entre matchs)');
        
        const tid = this.currentTournament.id;
        
        // Vérifier/générer le bracket
        const { count: mc } = await this.query(() => 
            supabase.from('tournament_matches')
                .select('*', { count: 'exact', head: true })
                .eq('tournament_id', tid)
        );
        
        if (!mc) {
            this.testLog('info', '📊 Génération du bracket...');
            try {
                await this.generateBracket();
                this.testLog('success', '✅ Bracket généré');
            } catch (e) {
                this.testLog('error', '❌ Erreur bracket: ' + e.message);
                return;
            }
        } else {
            this.testLog('info', '📊 Bracket existant: ' + mc + ' matchs');
        }
        
        // Activer le tournoi
        await this.query(() => 
            supabase.from('tournaments')
                .update({ status: 'active', current_round: 'R1' })
                .eq('id', tid)
        );
        this.testLog('success', '🚀 Tournoi activé');
        
        // Jouer tous les matchs
        let processed = 0;
        let round = 0;
        
        while (true) {
            // Trouver le prochain match jouable
            const { data: match } = await this.query(() => 
                supabase.from('tournament_matches')
                    .select('*')
                    .eq('tournament_id', tid)
                    .eq('status', 'pending')
                    .not('participant_a_id', 'is', null)
                    .not('participant_b_id', 'is', null)
                    .order('round_number')
                    .order('match_number')
                    .limit(1)
                    .maybeSingle()
            );
            
            if (!match) {
                this.testLog('info', '🏁 Plus de matchs à jouer');
                break;
            }
            
            // Afficher le changement de round
            if (match.round_number !== round) {
                round = match.round_number;
                this.testLog('info', '📍 === ' + (match.round_name || 'Round ' + round) + ' ===');
            }
            
            // Générer des votes aléatoires
            const vA = Math.floor(Math.random() * 80) + 20;
            const vB = Math.floor(Math.random() * 80) + 20;
            const winnerId = vA >= vB ? match.participant_a_id : match.participant_b_id;
            
            // Mettre à jour en base
            const { error } = await this.query(() => 
                supabase.from('tournament_matches')
                    .update({
                        status: 'completed',
                        votes_a: vA,
                        votes_b: vB,
                        winner_id: winnerId,
                        started_at: new Date().toISOString(),
                        ended_at: new Date().toISOString()
                    })
                    .eq('id', match.id)
            );
            
            if (error) {
                this.testLog('error', '❌ Erreur match #' + match.match_number + ': ' + error.message);
                continue;
            }
            
            // Propager le gagnant
            await this.propagateWinner(match, winnerId);
            
            processed++;
            const winner = vA >= vB ? 'A' : 'B';
            this.testLog('success', '   Match #' + match.match_number + ': ' + vA + ' vs ' + vB + ' → ' + winner + ' gagne');
            
            // Attendre avant le prochain match
            await this.wait(dl);
        }
        
        // Terminer le tournoi
        await this.query(() => 
            supabase.from('tournaments')
                .update({ status: 'completed', ended_at: new Date().toISOString() })
                .eq('id', tid)
        );
        
        this.testLog('success', '🏆 === TOURNOI TERMINÉ ===');
        this.testLog('success', '   ' + processed + ' matchs joués');
        window.toast?.success('🏆 Terminé', processed + ' matchs simulés');
        
        await this.refreshAll();
    }
    
    async cleanTestData() {
        // Récupérer les options
        const cleanUsers = document.getElementById('testCleanUsers')?.checked || false;
        const cleanTournaments = document.getElementById('testCleanTournaments')?.checked || false;
        const cleanVotes = document.getElementById('testCleanVotes')?.checked || false;
        
        if (!cleanUsers && !cleanTournaments && !cleanVotes) {
            this.testLog('warning', '⚠️ Aucune option sélectionnée');
            window.toast?.warning('Info', 'Sélectionnez au moins une option');
            return;
        }
        
        const options = [];
        if (cleanUsers) options.push('utilisateurs test');
        if (cleanTournaments) options.push('tournois test');
        if (cleanVotes) options.push('votes');
        
        if (!confirm('🗑️ Supprimer:\n- ' + options.join('\n- ') + '\n\nContinuer?')) return;
        
        this.testLog('info', '🧹 === NETTOYAGE DES DONNÉES TEST ===');
        
        let deleted = { users: 0, tournaments: 0, matches: 0, participants: 0, votes: 0 };
        
        // Nettoyer les tournois test
        if (cleanTournaments) {
            this.testLog('info', '🏆 Recherche des tournois test...');
            
            const { data: tournois } = await this.query(() => 
                supabase.from('tournaments')
                    .select('id, name')
                    .ilike('name', '%[TEST]%')
            );
            
            if (tournois?.length) {
                const ids = tournois.map(t => t.id);
                this.testLog('info', '   Trouvé: ' + tournois.length + ' tournois test');
                
                // Supprimer les votes
                this.testLog('info', '   → Suppression des votes...');
                const { error: e1 } = await this.query(() => 
                    supabase.from('tournament_votes').delete().in('tournament_id', ids)
                );
                if (e1) this.testLog('warning', '   ⚠️ ' + e1.message);
                else this.testLog('success', '   ✅ Votes supprimés');
                
                // Supprimer les matchs
                this.testLog('info', '   → Suppression des matchs...');
                const { error: e2 } = await this.query(() => 
                    supabase.from('tournament_matches').delete().in('tournament_id', ids)
                );
                if (e2) this.testLog('warning', '   ⚠️ ' + e2.message);
                else this.testLog('success', '   ✅ Matchs supprimés');
                
                // Supprimer les participants
                this.testLog('info', '   → Suppression des participants...');
                const { error: e3 } = await this.query(() => 
                    supabase.from('tournament_participants').delete().in('tournament_id', ids)
                );
                if (e3) this.testLog('warning', '   ⚠️ ' + e3.message);
                else this.testLog('success', '   ✅ Participants supprimés');
                
                // Supprimer les tournois
                this.testLog('info', '   → Suppression des tournois...');
                const { error: e4 } = await this.query(() => 
                    supabase.from('tournaments').delete().in('id', ids)
                );
                if (e4) this.testLog('warning', '   ⚠️ ' + e4.message);
                else {
                    deleted.tournaments = tournois.length;
                    this.testLog('success', '   ✅ ' + tournois.length + ' tournois supprimés');
                }
            } else {
                this.testLog('info', '   Aucun tournoi test trouvé');
            }
        }
        
        // Nettoyer les utilisateurs test
        if (cleanUsers) {
            this.testLog('info', '👥 Recherche des utilisateurs test...');
            
            const { data: users } = await this.query(() => 
                supabase.from('profiles')
                    .select('id, username')
                    .or('username.ilike.%test%,username.ilike.%[TEST]%,email.ilike.%test%')
            );
            
            if (users?.length) {
                this.testLog('info', '   Trouvé: ' + users.length + ' utilisateurs test');
                this.testLog('warning', '   ⚠️ Suppression des profils uniquement (pas des auth users)');
                
                // Note: On ne peut pas supprimer les auth.users sans API admin
                // On peut seulement supprimer les profils
                const ids = users.map(u => u.id);
                const { error } = await this.query(() => 
                    supabase.from('profiles').delete().in('id', ids)
                );
                
                if (error) {
                    this.testLog('warning', '   ⚠️ ' + error.message);
                } else {
                    deleted.users = users.length;
                    this.testLog('success', '   ✅ ' + users.length + ' profils supprimés');
                }
            } else {
                this.testLog('info', '   Aucun utilisateur test trouvé');
            }
        }
        
        // Nettoyer tous les votes (optionnel)
        if (cleanVotes && !cleanTournaments) {
            this.testLog('info', '🗳️ Suppression de tous les votes...');
            this.testLog('warning', '   ⚠️ Cette action supprime TOUS les votes');
            
            // Compter d'abord
            const { count } = await this.query(() => 
                supabase.from('tournament_votes').select('*', { count: 'exact', head: true })
            );
            
            if (count > 0) {
                const { error } = await this.query(() => 
                    supabase.from('tournament_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                );
                
                if (error) {
                    this.testLog('warning', '   ⚠️ ' + error.message);
                } else {
                    deleted.votes = count;
                    this.testLog('success', '   ✅ ' + count + ' votes supprimés');
                }
            } else {
                this.testLog('info', '   Aucun vote à supprimer');
            }
        }
        
        // Résumé
        this.testLog('success', '🧹 === NETTOYAGE TERMINÉ ===');
        const summary = [];
        if (deleted.tournaments > 0) summary.push(deleted.tournaments + ' tournois');
        if (deleted.users > 0) summary.push(deleted.users + ' utilisateurs');
        if (deleted.votes > 0) summary.push(deleted.votes + ' votes');
        
        if (summary.length) {
            this.testLog('success', '   Supprimé: ' + summary.join(', '));
            window.toast?.success('🧹 Nettoyé', summary.join(', '));
        } else {
            this.testLog('info', '   Rien à supprimer');
            window.toast?.info('Info', 'Aucune donnée test trouvée');
        }
        
        // Reset state
        this.currentTournament = null;
        this.currentMatch = null;
        await this.refreshAll();
    }
    
    // ==========================================
    // UTILITAIRES
    // ==========================================
    updateEl(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
    esc(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, c => map[c]);
    }
    
    ago(dateString) {
        if (!dateString) return '';
        const diffMs = Date.now() - new Date(dateString);
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'À l\'instant';
        if (mins < 60) return 'Il y a ' + mins + ' min';
        const hours = Math.floor(mins / 60);
        if (hours < 24) return 'Il y a ' + hours + 'h';
        const days = Math.floor(hours / 24);
        return days < 30 ? 'Il y a ' + days + 'j' : new Date(dateString).toLocaleDateString('fr-FR');
    }
    
    log(type, message) {
        const entry = { time: new Date().toLocaleTimeString('fr-FR'), type, message };
        this.systemLogs.unshift(entry);
        if (this.systemLogs.length > 200) this.systemLogs.pop();
        console.log('[' + type.toUpperCase() + '] ' + message);
    }
    
    testLog(type, message) {
        const entry = { time: new Date().toLocaleTimeString('fr-FR'), type, message };
        this.testLogs.unshift(entry);
        if (this.testLogs.length > 100) this.testLogs.pop();
        
        const container = document.getElementById('testLogs');
        if (container) {
            container.innerHTML = this.testLogs.map(l => 
                '<div class="log-entry"><span class="log-time">' + l.time + '</span><span class="log-type ' + l.type + '">' + l.type.toUpperCase() + '</span><span class="log-message">' + l.message + '</span></div>'
            ).join('');
        }
        console.log('[TEST ' + type.toUpperCase() + '] ' + message);
    }
    
    refreshLogs() {
        const container = document.getElementById('systemLogs');
        if (container) {
            container.innerHTML = this.systemLogs.length 
                ? this.systemLogs.map(l => '<div class="log-entry"><span class="log-time">' + l.time + '</span><span class="log-type ' + l.type + '">' + l.type.toUpperCase() + '</span><span class="log-message">' + l.message + '</span></div>').join('')
                : '<div class="log-entry"><span class="log-message">Aucun log</span></div>';
        }
    }
    
    clearLogs() {
        this.systemLogs = [];
        this.refreshLogs();
        window.toast?.info('🗑️', 'Logs effacés');
    }
    
    clearTestLogs() {
        this.testLogs = [];
        const container = document.getElementById('testLogs');
        if (container) container.innerHTML = '<div class="log-entry"><span class="log-message">Logs effacés</span></div>';
        window.toast?.info('🗑️', 'Logs test effacés');
    }
    
    saveSettings() {
        const settings = {
            matchDuration: document.getElementById('settingMatchDuration')?.value || 45,
            notifyNewUser: document.getElementById('settingNotifyNewUser')?.checked ?? true,
            notifyNewTrack: document.getElementById('settingNotifyNewTrack')?.checked ?? true
        };
        localStorage.setItem('wrc_admin_settings', JSON.stringify(settings));
        this.log('success', 'Paramètres sauvegardés');
        window.toast?.success('💾', 'Paramètres sauvegardés');
    }
    
    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('wrc_admin_settings') || '{}');
            if (document.getElementById('settingMatchDuration')) document.getElementById('settingMatchDuration').value = saved.matchDuration || 45;
            if (document.getElementById('settingNotifyNewUser')) document.getElementById('settingNotifyNewUser').checked = saved.notifyNewUser ?? true;
            if (document.getElementById('settingNotifyNewTrack')) document.getElementById('settingNotifyNewTrack').checked = saved.notifyNewTrack ?? true;
        } catch (e) { console.warn('Erreur chargement settings:', e); }
    }
    
    exportLogs() {
        const data = JSON.stringify({ exported: new Date().toISOString(), systemLogs: this.systemLogs, testLogs: this.testLogs }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wrc-admin-logs-' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(a.href);
        window.toast?.success('📁', 'Logs exportés');
    }
    
    startRealtimeUpdates() {
        this.updateInterval = setInterval(() => {
            if (this.currentView === 'overview') this.loadStats();
        }, 30000);
    }
    
    setupRealtimeSubscriptions() {
        const channel = supabase.channel('admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                this.loadStats();
                if (this.currentView === 'users') this.loadAllUsers();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks' }, () => {
                this.loadStats();
                if (this.currentView === 'tracks') this.loadAllTracks();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => {
                if (this.currentView === 'tournament') this.loadTournamentFull();
            })
            .subscribe();
        
        this.realtimeSubscriptions.push(channel);
        console.log('✅ Realtime subscriptions actives');
    }
}

// ==========================================
// INITIALISATION GLOBALE
// ==========================================
const adminDash = new AdminDashboardV2();
window.adminDash = adminDash;

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (adminDash.updateInterval) clearInterval(adminDash.updateInterval);
    adminDash.realtimeSubscriptions.forEach(sub => supabase.removeChannel(sub));
});

console.log('✅ Dashboard Admin V2 loaded');