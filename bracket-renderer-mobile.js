// ==========================================
// BRACKET TREE RENDERER - VERSION MOBILE-FIRST
// Optimisé tactile + Performance améliorée
// ==========================================
import { supabase } from './supabaseClient.js';

class BracketTreeRenderer {
    constructor() {
        this.tournament = null;
        this.matches = [];
        this.participants = new Map();
        this.zoomLevel = 0.4; // Plus petit par défaut sur mobile
        this.minZoom = 0.15;
        this.maxZoom = 1.5;
        
        // Drag state
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.scrollLeft = 0;
        this.scrollTop = 0;
        
        // Touch state
        this.touchStartDistance = 0;
        this.touchStartZoom = 0;
        this.lastTouchEnd = 0;
        
        // Performance
        this.rafId = null;
        this.pendingUpdate = false;
        
        // Structure des rounds
        this.rounds = [
            { id: 'round_of_128', name: 'R128', number: 1, matchCount: 64 },
            { id: 'round_of_64', name: 'R64', number: 2, matchCount: 32 },
            { id: 'round_of_32', name: 'R32', number: 3, matchCount: 16 },
            { id: 'round_of_16', name: 'R16', number: 4, matchCount: 8 },
            { id: 'quarter_finals', name: 'QUARTS', number: 5, matchCount: 4 },
            { id: 'semi_finals', name: 'DEMIS', number: 6, matchCount: 2 },
            { id: 'final', name: 'FINALE', number: 7, matchCount: 1 }
        ];
        
        this.realtimeSubscription = null;
        this.boundHandlers = {};
        
        // Detect mobile
        this.isMobile = window.innerWidth < 1024 || 'ontouchstart' in window;
    }

    async init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Container non trouvé:', containerId);
            return;
        }

        try {
            this.showLoading(container);
            
            // Adapter le zoom initial selon l'appareil
            this.zoomLevel = this.isMobile ? 0.35 : 0.5;
            
            await this.loadTournament();
            if (!this.tournament) {
                container.innerHTML = this.renderEmptyState();
                return;
            }
            
            await this.loadMatches();
            await this.loadParticipants();
            
            console.log('📊 Matchs total:', this.matches.length);
            console.log('👥 Participants:', this.participants.size);
            
            this.render(container);
            this.setupRealtimeUpdates();
            
            // Enregistrer pour destruction automatique
            if (window.smoothNavigation?.registerModule) {
                window.smoothNavigation.registerModule('BracketTreeRenderer', () => this.destroy());
            }
            
            console.log('✅ Bracket tree initialisé (Mobile-First)');
            
        } catch (error) {
            console.error('❌ Erreur init bracket:', error);
            container.innerHTML = this.renderErrorState(error.message);
        }
    }

    // ==========================================
    // DATA LOADING
    // ==========================================
    
    async loadTournament() {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .in('status', ['active', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        this.tournament = data;
    }

    async loadMatches() {
        if (!this.tournament) return;

        const { data, error } = await supabase
            .from('tournament_matches')
            .select('*')
            .eq('tournament_id', this.tournament.id)
            .order('round_number', { ascending: true })
            .order('match_number', { ascending: true });

        if (error) throw error;
        this.matches = data || [];
    }

    async loadParticipants() {
        if (!this.tournament) return;

        const { data, error } = await supabase
            .from('tournament_participants')
            .select(`
                id, seed, status,
                profiles:user_id (id, username, avatar_url),
                tracks:track_id (id, title, file_url)
            `)
            .eq('tournament_id', this.tournament.id);

        if (error) throw error;

        this.participants.clear();
        (data || []).forEach(p => {
            this.participants.set(p.id, {
                ...p,
                username: p.profiles?.username || `Seed #${p.seed}`,
                avatarUrl: p.profiles?.avatar_url,
                trackTitle: p.tracks?.title || 'Track'
            });
        });
    }

    // ==========================================
    // RENDERING
    // ==========================================
    
    showLoading(container) {
        container.innerHTML = `
            <div class="bracket-loading">
                <div class="bracket-spinner"></div>
                <span>Chargement du bracket...</span>
            </div>
        `;
    }
    
    renderEmptyState() {
        return `
            <div class="bracket-empty">
                <span class="bracket-empty-icon">🏆</span>
                <h3>Aucun tournoi actif</h3>
                <p>Le bracket sera disponible quand le tournoi commencera.</p>
            </div>
        `;
    }
    
    renderErrorState(message) {
        return `
            <div class="bracket-error">
                <span class="bracket-error-icon">⚠️</span>
                <h3>Erreur de chargement</h3>
                <p>${message}</p>
                <button class="btn btn-outline" onclick="location.reload()">Réessayer</button>
            </div>
        `;
    }

    render(container) {
        // Compter les stats
        const liveCount = this.matches.filter(m => m.status === 'active').length;
        const completedCount = this.matches.filter(m => m.status === 'completed').length;
        const pendingCount = this.matches.filter(m => m.status === 'pending').length;
        
        container.innerHTML = `
            <div class="bracket-viewport">
                ${this.renderControls(liveCount, completedCount, pendingCount)}
                
                <div class="bracket-scroll-container" id="bracketScroll">
                    <div class="bracket-tree-container" style="--zoom-level: ${this.zoomLevel}">
                        <div class="bracket-side left">
                            ${this.renderRounds('left')}
                        </div>
                        
                        <div class="bracket-final-zone">
                            ${this.renderFinalZone()}
                        </div>
                        
                        <div class="bracket-side right">
                            ${this.renderRounds('right')}
                        </div>
                    </div>
                </div>
                
                ${this.renderNavigationHints()}
            </div>
        `;

        this.initializeControls(container);
    }

    renderControls(liveCount, completedCount, pendingCount) {
        return `
            <div class="bracket-controls" id="bracketControls">
                <div class="bracket-controls-row">
                    <button class="bracket-control-btn" id="zoomOut" aria-label="Zoom arrière">
                        <span aria-hidden="true">−</span>
                    </button>
                    <span class="bracket-zoom-display" id="zoomLevel">${Math.round(this.zoomLevel * 100)}%</span>
                    <button class="bracket-control-btn" id="zoomIn" aria-label="Zoom avant">
                        <span aria-hidden="true">+</span>
                    </button>
                </div>
                
                <div class="bracket-controls-row">
                    <button class="bracket-control-btn live" id="centerLive" aria-label="Centrer sur le match en direct" ${liveCount === 0 ? 'disabled' : ''}>
                        <span aria-hidden="true">🔴</span>
                        <span class="btn-label">LIVE</span>
                        ${liveCount > 0 ? `<span class="badge">${liveCount}</span>` : ''}
                    </button>
                    <button class="bracket-control-btn" id="centerFinal" aria-label="Voir la finale">
                        <span aria-hidden="true">🏆</span>
                        <span class="btn-label">FINALE</span>
                    </button>
                    <button class="bracket-control-btn" id="resetView" aria-label="Vue globale">
                        <span aria-hidden="true">🌍</span>
                        <span class="btn-label">GLOBAL</span>
                    </button>
                </div>
                
                <div class="bracket-legend">
                    <div class="legend-item">
                        <span class="legend-dot live"></span>
                        <span>En cours (${liveCount})</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-dot completed"></span>
                        <span>Terminé (${completedCount})</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-dot pending"></span>
                        <span>À venir (${pendingCount})</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderNavigationHints() {
        if (this.isMobile) {
            return `
                <div class="bracket-nav-hints mobile">
                    <span>👆 Glisser pour naviguer</span>
                    <span>🤏 Pincer pour zoomer</span>
                </div>
            `;
        }
        return `
            <div class="bracket-nav-hints desktop">
                <span><kbd>Clic + Glisser</kbd> Naviguer</span>
                <span><kbd>Ctrl + Molette</kbd> Zoom</span>
                <span><kbd>Espace</kbd> Match LIVE</span>
            </div>
        `;
    }

    renderRounds(side) {
        const roundsToRender = this.rounds.filter(r => r.number < 7); // Exclure finale
        const orderedRounds = side === 'left' ? roundsToRender : [...roundsToRender].reverse();
        
        return orderedRounds.map(round => {
            const roundMatches = this.matches.filter(m => 
                m.round_number === round.number && 
                m.bracket_side === side
            );
            
            return `
                <div class="bracket-round" data-round="${round.number}">
                    <div class="bracket-round-title">${round.name}</div>
                    <div class="bracket-matches">
                        ${roundMatches.map(match => this.renderMatch(match)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderMatch(match) {
        const player1 = this.participants.get(match.player1_id);
        const player2 = this.participants.get(match.player2_id);
        
        const statusClass = match.status === 'active' ? 'active' : 
                           match.status === 'completed' ? 'completed' : 'pending';
        
        const isWinner1 = match.winner_id && match.winner_id === match.player1_id;
        const isWinner2 = match.winner_id && match.winner_id === match.player2_id;
        
        return `
            <div class="bracket-match-container">
                <div class="bracket-match ${statusClass}" data-match-id="${match.id}">
                    ${this.renderStatusBadge(match.status)}
                    ${this.renderPlayer(player1, match.player1_score, isWinner1, !isWinner1 && match.winner_id)}
                    <div class="match-vs">VS</div>
                    ${this.renderPlayer(player2, match.player2_score, isWinner2, !isWinner2 && match.winner_id)}
                </div>
            </div>
        `;
    }
    
    renderStatusBadge(status) {
        const badges = {
            active: '<div class="match-status-badge live"><span class="pulse-dot"></span> LIVE</div>',
            completed: '<div class="match-status-badge done">✓</div>',
            pending: ''
        };
        return badges[status] || '';
    }

    renderPlayer(player, score, isWinner, isLoser) {
        if (!player) {
            return `
                <div class="match-player tbd">
                    <div class="player-avatar">?</div>
                    <div class="player-info">
                        <span class="player-name">TBD</span>
                        <span class="player-track">En attente</span>
                    </div>
                    <span class="player-score">-</span>
                </div>
            `;
        }
        
        const winnerClass = isWinner ? 'winner' : isLoser ? 'loser' : '';
        const avatar = player.avatarUrl 
            ? `<img src="${player.avatarUrl}" alt="${player.username}" loading="lazy">`
            : player.username.charAt(0).toUpperCase();
        
        return `
            <div class="match-player ${winnerClass}">
                <div class="player-avatar">${avatar}</div>
                <div class="player-info">
                    <span class="player-name">${this.escapeHtml(player.username)}</span>
                    <span class="player-track">${this.escapeHtml(player.trackTitle)}</span>
                </div>
                <span class="player-score">${score ?? '-'}</span>
            </div>
        `;
    }

    renderFinalZone() {
        const finalMatch = this.matches.find(m => m.round_number === 7);
        const champion = finalMatch?.winner_id ? this.participants.get(finalMatch.winner_id) : null;
        
        let finalContent = '';
        
        if (champion) {
            finalContent = `
                <div class="champion-display">
                    <div class="champion-crown">👑</div>
                    <div class="champion-name">${this.escapeHtml(champion.username)}</div>
                    <div class="champion-subtitle">CHAMPION WRC 2026</div>
                </div>
            `;
        }
        
        if (finalMatch) {
            finalContent += this.renderMatch(finalMatch);
        } else {
            finalContent += `
                <div class="final-placeholder">
                    <span>🏆</span>
                    <span>Finale à venir</span>
                </div>
            `;
        }
        
        return `
            <div class="bracket-final-title">🏆 FINALE 🏆</div>
            ${finalContent}
        `;
    }

    // ==========================================
    // CONTROLS & INTERACTIONS
    // ==========================================
    
    initializeControls(container) {
        const scroll = container.querySelector('#bracketScroll');
        if (!scroll) return;
        
        // Clean up old handlers
        this.removeEventListeners();
        
        // Zoom buttons
        this.addHandler('zoomIn', 'click', () => this.zoom(0.1));
        this.addHandler('zoomOut', 'click', () => this.zoom(-0.1));
        this.addHandler('centerLive', 'click', () => this.centerOnActiveMatch(scroll));
        this.addHandler('centerFinal', 'click', () => this.centerOnFinal(scroll));
        this.addHandler('resetView', 'click', () => this.resetView(scroll));
        
        // Keyboard
        this.boundHandlers.keydown = (e) => {
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this.centerOnActiveMatch(scroll);
            }
        };
        document.addEventListener('keydown', this.boundHandlers.keydown);
        
        // Mouse drag
        this.setupMouseDrag(scroll);
        
        // Touch support
        this.setupTouchControls(scroll);
        
        // Mouse wheel zoom
        this.boundHandlers.wheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                this.zoom(e.deltaY > 0 ? -0.05 : 0.05);
            }
        };
        scroll.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        
        // Initial centering
        setTimeout(() => this.centerOnActiveMatch(scroll), 300);
    }
    
    addHandler(id, event, handler) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, handler);
            this.boundHandlers[`${id}_${event}`] = { el, event, handler };
        }
    }
    
    setupMouseDrag(scroll) {
        const onMouseDown = (e) => {
            if (e.button !== 0) return; // Left click only
            this.isDragging = true;
            scroll.style.cursor = 'grabbing';
            this.startX = e.pageX;
            this.startY = e.pageY;
            this.scrollLeft = scroll.scrollLeft;
            this.scrollTop = scroll.scrollTop;
        };
        
        const onMouseMove = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            
            const walkX = (e.pageX - this.startX) * 1.5;
            const walkY = (e.pageY - this.startY) * 1.5;
            
            scroll.scrollLeft = this.scrollLeft - walkX;
            scroll.scrollTop = this.scrollTop - walkY;
        };
        
        const onMouseUp = () => {
            this.isDragging = false;
            scroll.style.cursor = 'grab';
        };
        
        scroll.addEventListener('mousedown', onMouseDown);
        scroll.addEventListener('mousemove', onMouseMove);
        scroll.addEventListener('mouseup', onMouseUp);
        scroll.addEventListener('mouseleave', onMouseUp);
        
        this.boundHandlers.mousedown = onMouseDown;
        this.boundHandlers.mousemove = onMouseMove;
        this.boundHandlers.mouseup = onMouseUp;
    }
    
    setupTouchControls(scroll) {
        let lastTouchX = 0;
        let lastTouchY = 0;
        
        const onTouchStart = (e) => {
            if (e.touches.length === 1) {
                // Single finger - pan
                this.isDragging = true;
                lastTouchX = e.touches[0].pageX;
                lastTouchY = e.touches[0].pageY;
                this.scrollLeft = scroll.scrollLeft;
                this.scrollTop = scroll.scrollTop;
            } else if (e.touches.length === 2) {
                // Two fingers - pinch zoom
                this.isDragging = false;
                this.touchStartDistance = this.getTouchDistance(e.touches);
                this.touchStartZoom = this.zoomLevel;
            }
        };
        
        const onTouchMove = (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                // Pan
                const touchX = e.touches[0].pageX;
                const touchY = e.touches[0].pageY;
                
                const deltaX = lastTouchX - touchX;
                const deltaY = lastTouchY - touchY;
                
                scroll.scrollLeft += deltaX;
                scroll.scrollTop += deltaY;
                
                lastTouchX = touchX;
                lastTouchY = touchY;
            } else if (e.touches.length === 2) {
                // Pinch zoom
                e.preventDefault();
                const currentDistance = this.getTouchDistance(e.touches);
                const scale = currentDistance / this.touchStartDistance;
                const newZoom = this.touchStartZoom * scale;
                this.setZoom(newZoom);
            }
        };
        
        const onTouchEnd = (e) => {
            this.isDragging = false;
            
            // Double tap to zoom
            const now = Date.now();
            if (now - this.lastTouchEnd < 300 && e.changedTouches.length === 1) {
                this.handleDoubleTap(e.changedTouches[0], scroll);
            }
            this.lastTouchEnd = now;
        };
        
        scroll.addEventListener('touchstart', onTouchStart, { passive: true });
        scroll.addEventListener('touchmove', onTouchMove, { passive: false });
        scroll.addEventListener('touchend', onTouchEnd, { passive: true });
        
        this.boundHandlers.touchstart = onTouchStart;
        this.boundHandlers.touchmove = onTouchMove;
        this.boundHandlers.touchend = onTouchEnd;
    }
    
    getTouchDistance(touches) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    handleDoubleTap(touch, scroll) {
        // Toggle between zoomed and overview
        if (this.zoomLevel > 0.5) {
            this.setZoom(0.35);
        } else {
            this.setZoom(0.8);
            // Center on tap position
            const rect = scroll.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            scroll.scrollTo({
                left: scroll.scrollLeft + x - scroll.clientWidth / 2,
                top: scroll.scrollTop + y - scroll.clientHeight / 2,
                behavior: 'smooth'
            });
        }
    }

    // ==========================================
    // ZOOM & NAVIGATION
    // ==========================================
    
    zoom(delta) {
        this.setZoom(this.zoomLevel + delta);
    }

    setZoom(newZoom) {
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        const container = document.querySelector('.bracket-tree-container');
        const levelDisplay = document.getElementById('zoomLevel');
        
        if (container) {
            container.style.setProperty('--zoom-level', this.zoomLevel);
        }
        
        if (levelDisplay) {
            levelDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }
    
    resetView(scroll) {
        this.setZoom(this.isMobile ? 0.35 : 0.5);
        scroll.scrollTo({
            left: (scroll.scrollWidth - scroll.clientWidth) / 2,
            top: (scroll.scrollHeight - scroll.clientHeight) / 2,
            behavior: 'smooth'
        });
    }

    centerOnActiveMatch(scroll) {
        const activeMatch = document.querySelector('.bracket-match.active');
        
        if (activeMatch) {
            this.centerOnElement(activeMatch, scroll);
            activeMatch.classList.add('highlighted');
            setTimeout(() => activeMatch.classList.remove('highlighted'), 2000);
            console.log('🎯 Centré sur match actif');
        } else {
            console.log('ℹ️ Aucun match actif, centrage sur finale');
            this.centerOnFinal(scroll);
        }
    }

    centerOnFinal(scroll) {
        const finalZone = document.querySelector('.bracket-final-zone');
        if (finalZone) {
            this.centerOnElement(finalZone, scroll);
        }
    }
    
    centerOnElement(element, scroll) {
        const rect = element.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        
        const elementCenterX = element.offsetLeft + element.offsetWidth / 2;
        const elementCenterY = element.offsetTop + element.offsetHeight / 2;
        
        const targetScrollLeft = elementCenterX * this.zoomLevel - scroll.clientWidth / 2;
        const targetScrollTop = elementCenterY * this.zoomLevel - scroll.clientHeight / 2;
        
        scroll.scrollTo({
            left: targetScrollLeft,
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }

    // ==========================================
    // REALTIME UPDATES
    // ==========================================
    
    setupRealtimeUpdates() {
        if (!this.tournament) return;
        
        this.realtimeSubscription = supabase
            .channel(`bracket_${this.tournament.id}`)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'tournament_matches',
                    filter: `tournament_id=eq.${this.tournament.id}`
                }, 
                (payload) => {
                    console.log('🔄 Match update:', payload);
                    this.handleMatchUpdate(payload);
                }
            )
            .subscribe();
    }

    handleMatchUpdate(payload) {
        const { eventType, new: newMatch, old: oldMatch } = payload;
        
        if (eventType === 'UPDATE' || eventType === 'INSERT') {
            // Update local data
            const index = this.matches.findIndex(m => m.id === newMatch.id);
            if (index >= 0) {
                this.matches[index] = newMatch;
            } else {
                this.matches.push(newMatch);
            }
            
            // Update DOM efficiently
            this.updateMatchInDOM(newMatch);
        }
    }
    
    updateMatchInDOM(match) {
        const matchEl = document.querySelector(`[data-match-id="${match.id}"]`);
        if (!matchEl) return;
        
        // Update status
        matchEl.className = `bracket-match ${match.status}`;
        
        // Update scores
        const scores = matchEl.querySelectorAll('.player-score');
        if (scores[0]) scores[0].textContent = match.player1_score ?? '-';
        if (scores[1]) scores[1].textContent = match.player2_score ?? '-';
        
        // Update winner styling
        if (match.winner_id) {
            const players = matchEl.querySelectorAll('.match-player');
            players.forEach((p, i) => {
                const playerId = i === 0 ? match.player1_id : match.player2_id;
                p.classList.toggle('winner', playerId === match.winner_id);
                p.classList.toggle('loser', playerId !== match.winner_id);
            });
        }
        
        // Update status badge
        const badge = matchEl.querySelector('.match-status-badge');
        if (badge) {
            if (match.status === 'active') {
                badge.className = 'match-status-badge live';
                badge.innerHTML = '<span class="pulse-dot"></span> LIVE';
            } else if (match.status === 'completed') {
                badge.className = 'match-status-badge done';
                badge.innerHTML = '✓';
            } else {
                badge.remove();
            }
        }
    }

    // ==========================================
    // CLEANUP
    // ==========================================
    
    removeEventListeners() {
        Object.entries(this.boundHandlers).forEach(([key, value]) => {
            if (value.el) {
                value.el.removeEventListener(value.event, value.handler);
            } else if (typeof value === 'function') {
                document.removeEventListener('keydown', value);
            }
        });
        this.boundHandlers = {};
    }

    destroy() {
        console.log('🧹 Destruction BracketTreeRenderer');
        
        this.removeEventListeners();
        
        if (this.realtimeSubscription) {
            supabase.removeChannel(this.realtimeSubscription);
            this.realtimeSubscription = null;
        }
        
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        this.matches = [];
        this.participants.clear();
        this.tournament = null;
    }
    
    // ==========================================
    // UTILITIES
    // ==========================================
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export
export default BracketTreeRenderer;

// Global access
window.BracketTreeRenderer = BracketTreeRenderer;

console.log('✅ BracketTreeRenderer Mobile-First chargé');
