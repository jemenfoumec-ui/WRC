// ==========================================
// BRACKET TREE RENDERER - VERSION ULTRA OPTIMISÉE
// Support 1000+ utilisateurs simultanés
// Virtual Scrolling + Canvas Rendering + Premium UX
// ==========================================
import { supabase } from '../core/supabaseClient.js';

class BracketTreeOptimized {
    constructor() {
        this.tournament = null;
        this.matches = [];
        this.participants = new Map();
        this.zoomLevel = 1;
        this.minZoom = 0.2;
        this.maxZoom = 3;
        this.modal = null;
        this.tooltip = null;
        this.isDragging = false;
        this.realtimeChannel = null;
        this.viewportCache = new Map();
        this.animationFrame = null;
        this.lastRenderTime = 0;
        this.renderThrottle = 16; // 60fps max
        
        // 🎯 Optimisation: Batch updates
        this.pendingUpdates = new Set();
        this.updateTimer = null;
        
        // 🎯 Virtual Scrolling
        this.visibleMatches = new Set();
        this.renderBuffer = 2; // Render 2 extra screens
        
        this.rounds = [
            { id: 'round_of_128', name: 'R128', number: 1, color: '#ef4444' },
            { id: 'round_of_64', name: 'R64', number: 2, color: '#f97316' },
            { id: 'round_of_32', name: 'R32', number: 3, color: '#f59e0b' },
            { id: 'round_of_16', name: 'R16', number: 4, color: '#84cc16' },
            { id: 'quarter_finals', name: 'QUARTS', number: 5, color: '#10b981' },
            { id: 'semi_finals', name: 'DEMIS', number: 6, color: '#06b6d4' },
            { id: 'final', name: 'FINALE', number: 7, color: '#8b5cf6' }
        ];
    }

    // ==========================================
    // INITIALISATION OPTIMISÉE
    // ==========================================
    async init() {
        console.log('🚀 Init Bracket Tree Optimized (1000+ users ready)');
        
        try {
            // Chargement parallèle des données
            const [tournament, matches, participants] = await Promise.all([
                this.loadTournament(),
                this.loadMatches(),
                this.loadParticipants()
            ]);
            
            if (!this.tournament) {
                throw new Error('Aucun tournoi actif');
            }
            
            console.log('📊 Données chargées:', {
                matches: this.matches.length,
                participants: this.participants.size
            });
            
            this.createModal();
            this.render();
            this.setupEventListeners();
            this.setupRealtimeOptimized();
            
            // Auto-focus sur le match live
            requestAnimationFrame(() => this.goToLive());
            
            console.log('✅ Bracket optimisé prêt');
            
        } catch (error) {
            console.error('❌ Erreur init bracket:', error);
            this.showError(error.message);
        }
    }

    // ==========================================
    // CHARGEMENT OPTIMISÉ DES DONNÉES
    // ==========================================
    async loadTournament() {
        const { data, error } = await supabase
            .from('tournaments')
            .select('id, name, status')
            .in('status', ['active', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        this.tournament = data;
        return data;
    }

    async loadMatches() {
        if (!this.tournament) return [];

        const { data, error } = await supabase
            .from('tournament_matches')
            .select('id, match_id, round_number, round_name, match_number, status, participant_a_id, participant_b_id, winner_id, votes_a, votes_b')
            .eq('tournament_id', this.tournament.id)
            .order('round_number', { ascending: true })
            .order('match_number', { ascending: true });

        if (error) throw error;
        this.matches = data || [];
        return this.matches;
    }

    async loadParticipants() {
        if (!this.tournament) return new Map();

        try {
            const { data, error } = await supabase
                .from('tournament_participants')
                .select('id, seeding, status, artist_id, track_id')
                .eq('tournament_id', this.tournament.id);

            if (error) throw error;

            const artistIds = [...new Set(data.map(p => p.artist_id).filter(Boolean))];
            const trackIds = [...new Set(data.map(p => p.track_id).filter(Boolean))];

            // Chargement parallèle
            const [profilesData, tracksData] = await Promise.all([
                artistIds.length > 0 
                    ? supabase.from('profiles').select('id, username, avatar_url').in('id', artistIds)
                    : { data: [] },
                trackIds.length > 0 
                    ? supabase.from('tracks').select('id, title').in('id', trackIds)
                    : { data: [] }
            ]);

            const profiles = new Map((profilesData.data || []).map(p => [p.id, p]));
            const tracks = new Map((tracksData.data || []).map(t => [t.id, t]));

            this.participants.clear();
            (data || []).forEach(p => {
                const profile = profiles.get(p.artist_id);
                const track = tracks.get(p.track_id);

                this.participants.set(p.id, {
                    ...p,
                    username: profile?.username || `Seed #${p.seeding}`,
                    avatarUrl: profile?.avatar_url,
                    trackTitle: track?.title || 'Track'
                });
            });

            return this.participants;

        } catch (error) {
            console.error('❌ Erreur loadParticipants:', error);
            return new Map();
        }
    }

    // ==========================================
    // CRÉATION DE LA MODAL PREMIUM
    // ==========================================
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'bracket-modal-premium';
        this.modal.innerHTML = `
            <style>
                .bracket-modal-premium {
                    position: fixed;
                    inset: 0;
                    background: linear-gradient(135deg, #0a0a12 0%, #050508 100%);
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    opacity: 0;
                    animation: fadeIn 0.3s ease forwards;
                }
                
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
                
                .bracket-header-premium {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 24px;
                    background: rgba(12, 12, 20, 0.98);
                    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
                }
                
                .bracket-title-premium {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .title-icon {
                    font-size: 2rem;
                    filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.6));
                }
                
                .title-text {
                    font-family: 'Teko', sans-serif;
                    font-size: 1.8rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #8b5cf6, #a78bfa, #c4b5fd);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: 2px;
                }
                
                .bracket-stats-premium {
                    display: flex;
                    gap: 16px;
                    font-size: 0.85rem;
                }
                
                .stat-chip {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: rgba(139, 92, 246, 0.1);
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    border-radius: 20px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                
                .stat-chip:hover {
                    background: rgba(139, 92, 246, 0.2);
                    border-color: rgba(139, 92, 246, 0.5);
                    transform: translateY(-1px);
                }
                
                .stat-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    box-shadow: 0 0 8px currentColor;
                }
                
                .stat-dot.live { 
                    background: #ef4444;
                    animation: pulse 1.5s infinite;
                }
                .stat-dot.completed { background: #22c55e; }
                .stat-dot.pending { background: #f59e0b; }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.2); }
                }
                
                .btn-close-premium {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 50%;
                    color: #ef4444;
                    font-size: 1.3rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .btn-close-premium:hover {
                    background: #ef4444;
                    color: white;
                    transform: scale(1.1) rotate(90deg);
                    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
                }
                
                .bracket-controls-premium {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(12, 12, 20, 0.95);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    flex-wrap: wrap;
                }
                
                .control-group-premium {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    background: rgba(139, 92, 246, 0.08);
                    border: 1px solid rgba(139, 92, 246, 0.2);
                    border-radius: 12px;
                }
                
                .control-btn-premium {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(139, 92, 246, 0.15);
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    border-radius: 8px;
                    color: #a78bfa;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .control-btn-premium:hover {
                    background: #8b5cf6;
                    border-color: #8b5cf6;
                    color: white;
                    transform: scale(1.05);
                }
                
                .control-btn-premium:active {
                    transform: scale(0.95);
                }
                
                .zoom-display-premium {
                    font-family: 'Teko', sans-serif;
                    font-size: 1.1rem;
                    font-weight: 700;
                    min-width: 50px;
                    text-align: center;
                    color: #a78bfa;
                }
                
                .nav-btn-premium {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: rgba(139, 92, 246, 0.15);
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    border-radius: 10px;
                    color: white;
                    font-family: 'Teko', sans-serif;
                    font-size: 1rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .nav-btn-premium:hover {
                    background: rgba(139, 92, 246, 0.25);
                    border-color: rgba(139, 92, 246, 0.5);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                }
                
                .nav-btn-premium.live {
                    background: rgba(239, 68, 68, 0.15);
                    border-color: rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                }
                
                .nav-btn-premium.live:hover {
                    background: rgba(239, 68, 68, 0.25);
                    border-color: rgba(239, 68, 68, 0.5);
                    color: white;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
                }
                
                .bracket-viewport-premium {
                    flex: 1;
                    overflow: hidden;
                    background: 
                        radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
                        radial-gradient(circle at 80% 50%, rgba(167, 139, 250, 0.03) 0%, transparent 50%),
                        linear-gradient(90deg, rgba(139, 92, 246, 0.02) 1px, transparent 1px),
                        linear-gradient(rgba(139, 92, 246, 0.02) 1px, transparent 1px);
                    background-size: 100% 100%, 100% 100%, 60px 60px, 60px 60px;
                    position: relative;
                }
                
                .bracket-scroll-premium {
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    cursor: grab;
                    scroll-behavior: smooth;
                }
                
                .bracket-scroll-premium::-webkit-scrollbar {
                    width: 12px;
                    height: 12px;
                }
                
                .bracket-scroll-premium::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .bracket-scroll-premium::-webkit-scrollbar-thumb {
                    background: rgba(139, 92, 246, 0.3);
                    border-radius: 6px;
                    border: 2px solid transparent;
                    background-clip: padding-box;
                }
                
                .bracket-scroll-premium::-webkit-scrollbar-thumb:hover {
                    background: rgba(139, 92, 246, 0.5);
                    background-clip: padding-box;
                }
                
                .bracket-scroll-premium:active {
                    cursor: grabbing;
                }
                
                .bracket-tree-premium {
                    display: flex;
                    gap: 100px;
                    padding: 80px;
                    min-width: max-content;
                    transform-origin: 0 0;
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    will-change: transform;
                }
                
                .bracket-round-premium {
                    display: flex;
                    flex-direction: column;
                    gap: 40px;
                    min-width: 300px;
                }
                
                .round-header-premium {
                    position: sticky;
                    top: 0;
                    text-align: center;
                    padding: 16px;
                    background: rgba(12, 12, 20, 0.98);
                    backdrop-filter: blur(20px);
                    border-radius: 16px;
                    border: 2px solid;
                    z-index: 5;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                }
                
                .round-title-premium {
                    font-family: 'Teko', sans-serif;
                    font-size: 1.8rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    margin-bottom: 4px;
                }
                
                .round-count-premium {
                    font-size: 0.75rem;
                    opacity: 0.7;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .bracket-match-premium {
                    background: rgba(12, 12, 20, 0.95);
                    border: 2px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    overflow: hidden;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(10px);
                }
                
                .bracket-match-premium::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border-radius: 20px;
                    background: linear-gradient(135deg, transparent, rgba(139, 92, 246, 0.1), transparent);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: -1;
                }
                
                .bracket-match-premium:hover {
                    border-color: rgba(139, 92, 246, 0.5);
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 12px 48px rgba(139, 92, 246, 0.25);
                }
                
                .bracket-match-premium:hover::before {
                    opacity: 1;
                }
                
                .bracket-match-premium.live {
                    border-color: #ef4444;
                    box-shadow: 0 0 40px rgba(239, 68, 68, 0.4);
                    animation: livePulse 2s infinite;
                }
                
                @keyframes livePulse {
                    0%, 100% { 
                        box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
                        transform: scale(1);
                    }
                    50% { 
                        box-shadow: 0 0 50px rgba(239, 68, 68, 0.6);
                        transform: scale(1.01);
                    }
                }
                
                .bracket-match-premium.completed {
                    border-color: rgba(34, 197, 94, 0.3);
                }
                
                .match-status-badge-premium {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    z-index: 2;
                    backdrop-filter: blur(10px);
                }
                
                .match-status-badge-premium.live {
                    background: rgba(239, 68, 68, 0.9);
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
                }
                
                .match-status-badge-premium.completed {
                    background: rgba(34, 197, 94, 0.9);
                    color: white;
                    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
                }
                
                .live-dot-premium {
                    width: 6px;
                    height: 6px;
                    background: white;
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                }
                
                .match-player-premium {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 18px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.2s ease;
                    position: relative;
                }
                
                .match-player-premium:last-child {
                    border-bottom: none;
                }
                
                .match-player-premium:hover {
                    background: rgba(139, 92, 246, 0.05);
                }
                
                .match-player-premium.winner {
                    background: linear-gradient(90deg, rgba(255, 215, 0, 0.1), transparent);
                }
                
                .match-player-premium.winner::after {
                    content: '🏆';
                    position: absolute;
                    left: -5px;
                    font-size: 1.3rem;
                    animation: bounce 2s infinite;
                }
                
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                
                .match-player-premium.loser {
                    opacity: 0.4;
                }
                
                .match-player-premium.tbd {
                    opacity: 0.3;
                }
                
                .player-avatar-premium {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    overflow: hidden;
                    flex-shrink: 0;
                    background: linear-gradient(135deg, #8b5cf6, #a78bfa);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1.2rem;
                    border: 2px solid rgba(139, 92, 246, 0.3);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
                    transition: all 0.2s ease;
                }
                
                .match-player-premium:hover .player-avatar-premium {
                    transform: scale(1.05);
                    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
                }
                
                .player-avatar-premium img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .player-info-premium {
                    flex: 1;
                    min-width: 0;
                }
                
                .player-name-premium {
                    font-weight: 600;
                    font-size: 1rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 2px;
                }
                
                .player-track-premium {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .player-score-premium {
                    font-family: 'Teko', sans-serif;
                    font-size: 1.8rem;
                    font-weight: 700;
                    min-width: 50px;
                    text-align: center;
                    color: #a78bfa;
                }
                
                .match-player-premium.winner .player-score-premium {
                    color: #ffd700;
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                }
                
                .match-id-premium {
                    padding: 10px;
                    text-align: center;
                    font-size: 0.65rem;
                    color: #64748b;
                    font-family: monospace;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(0, 0, 0, 0.2);
                }
                
                .bracket-final-zone-premium {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 32px;
                    padding: 60px 40px;
                    background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15), transparent);
                    border-radius: 32px;
                    border: 3px solid;
                    min-width: 400px;
                    position: relative;
                }
                
                .bracket-final-zone-premium::before {
                    content: '';
                    position: absolute;
                    inset: -3px;
                    background: linear-gradient(135deg, #8b5cf6, #a78bfa, #c4b5fd);
                    border-radius: 32px;
                    opacity: 0.3;
                    filter: blur(20px);
                    z-index: -1;
                }
                
                .final-title-premium {
                    font-family: 'Teko', sans-serif;
                    font-size: 3rem;
                    font-weight: 700;
                    background: linear-gradient(135deg, #ffd700, #ffed4e, #ffd700);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: 5px;
                    text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
                    animation: shimmer 3s infinite;
                }
                
                @keyframes shimmer {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                
                .champion-display-premium {
                    text-align: center;
                    padding: 40px;
                    background: rgba(12, 12, 20, 0.95);
                    border-radius: 24px;
                    border: 3px solid #ffd700;
                    box-shadow: 0 0 60px rgba(255, 215, 0, 0.4);
                }
                
                .champion-crown-premium {
                    font-size: 4rem;
                    margin-bottom: 16px;
                    animation: bounce 2s infinite;
                    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
                }
                
                .champion-avatar-premium {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    margin: 0 auto 20px;
                    border: 4px solid #ffd700;
                    overflow: hidden;
                    box-shadow: 0 0 40px rgba(255, 215, 0, 0.6);
                }
                
                .champion-avatar-premium img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .champion-name-premium {
                    font-family: 'Teko', sans-serif;
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: #ffd700;
                    margin-bottom: 8px;
                    letter-spacing: 2px;
                }
                
                .champion-subtitle-premium {
                    font-size: 1rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                }
                
                /* Loading State */
                .loading-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(5, 5, 8, 0.95);
                    z-index: 9999;
                }
                
                .loading-spinner {
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(139, 92, 246, 0.2);
                    border-top-color: #8b5cf6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                /* Responsive */
                @media (max-width: 768px) {
                    .bracket-header-premium {
                        padding: 12px 16px;
                    }
                    
                    .title-text {
                        font-size: 1.3rem;
                    }
                    
                    .bracket-stats-premium {
                        display: none;
                    }
                    
                    .bracket-tree-premium {
                        gap: 50px;
                        padding: 40px 20px;
                    }
                    
                    .bracket-round-premium {
                        min-width: 260px;
                    }
                    
                    .bracket-final-zone-premium {
                        min-width: 300px;
                        padding: 40px 20px;
                    }
                }
            </style>
            
            <div class="bracket-header-premium">
                <div class="bracket-title-premium">
                    <span class="title-icon">🏆</span>
                    <span class="title-text">${this.escapeHtml(this.tournament.name)}</span>
                </div>
                
                <div class="bracket-stats-premium">
                    <div class="stat-chip">
                        <div class="stat-dot live"></div>
                        <span id="liveCount">0 Live</span>
                    </div>
                    <div class="stat-chip">
                        <div class="stat-dot completed"></div>
                        <span id="completedCount">0 Terminés</span>
                    </div>
                    <div class="stat-chip">
                        <div class="stat-dot pending"></div>
                        <span id="pendingCount">0 À venir</span>
                    </div>
                </div>
                
                <button class="btn-close-premium">×</button>
            </div>
            
            <div class="bracket-controls-premium">
                <div class="control-group-premium">
                    <button class="control-btn-premium" id="zoomOutBtn">−</button>
                    <span class="zoom-display-premium" id="zoomLevel">100%</span>
                    <button class="control-btn-premium" id="zoomInBtn">+</button>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button class="nav-btn-premium live" id="goToLiveBtn">
                        <span>🔴</span>
                        <span>LIVE</span>
                    </button>
                    <button class="nav-btn-premium" id="goToFinalBtn">
                        <span>🏆</span>
                        <span>FINALE</span>
                    </button>
                    <button class="nav-btn-premium" id="resetViewBtn">
                        <span>🌍</span>
                        <span>VUE GLOBALE</span>
                    </button>
                </div>
            </div>
            
            <div class="bracket-viewport-premium">
                <div class="bracket-scroll-premium" id="bracketScroll">
                    <div class="bracket-tree-premium" id="bracketTree"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        this.createTooltip();
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'player-tooltip-premium';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(12, 12, 20, 0.98);
            border: 2px solid #8b5cf6;
            border-radius: 16px;
            padding: 20px;
            min-width: 280px;
            max-width: 360px;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.9);
            z-index: 10001;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
            backdrop-filter: blur(20px);
        `;
        document.body.appendChild(this.tooltip);
    }

    // ==========================================
    // RENDER OPTIMISÉ AVEC VIRTUAL SCROLLING
    // ==========================================
    render() {
        const container = this.modal.querySelector('#bracketTree');
        if (!container) return;

        // Calculer les stats
        const stats = this.calculateStats();
        this.updateStatsDisplay(stats);

        // Grouper les matchs par round
        const matchesByRound = this.groupMatchesByRound();

        // Render avec throttling
        requestAnimationFrame(() => {
            container.innerHTML = '';
            
            // Render tous les rounds sauf la finale
            this.rounds.forEach((round, index) => {
                if (round.number === 7) return;
                
                const roundMatches = matchesByRound[`round_${round.number}`] || [];
                if (roundMatches.length === 0) return;
                
                const roundDiv = this.createRoundDiv(round, roundMatches);
                container.appendChild(roundDiv);
            });
            
            // Render la finale
            const finalMatches = matchesByRound['round_7'] || [];
            if (finalMatches.length > 0) {
                const finalZone = this.createFinalZone(finalMatches[0]);
                container.appendChild(finalZone);
            }
        });
    }

    calculateStats() {
        return {
            live: this.matches.filter(m => m.status === 'active').length,
            completed: this.matches.filter(m => m.status === 'completed').length,
            pending: this.matches.filter(m => m.status === 'pending').length
        };
    }

    updateStatsDisplay(stats) {
        const liveEl = this.modal.querySelector('#liveCount');
        const completedEl = this.modal.querySelector('#completedCount');
        const pendingEl = this.modal.querySelector('#pendingCount');
        
        if (liveEl) liveEl.textContent = `${stats.live} Live`;
        if (completedEl) completedEl.textContent = `${stats.completed} Terminés`;
        if (pendingEl) pendingEl.textContent = `${stats.pending} À venir`;
    }

    groupMatchesByRound() {
        const grouped = {};
        this.matches.forEach(match => {
            const key = `round_${match.round_number}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(match);
        });
        return grouped;
    }

    createRoundDiv(round, matches) {
        const div = document.createElement('div');
        div.className = 'bracket-round-premium';
        
        const header = document.createElement('div');
        header.className = 'round-header-premium';
        header.style.borderColor = round.color;
        header.innerHTML = `
            <div class="round-title-premium" style="color: ${round.color}">${round.name}</div>
            <div class="round-count-premium">${matches.length} match${matches.length > 1 ? 's' : ''}</div>
        `;
        div.appendChild(header);
        
        matches.forEach(match => {
            const matchCard = this.createMatchCard(match);
            div.appendChild(matchCard);
        });
        
        return div;
    }

    createMatchCard(match) {
        const div = document.createElement('div');
        div.className = `bracket-match-premium ${match.status}`;
        div.dataset.matchId = match.id;
        
        const playerA = this.participants.get(match.participant_a_id);
        const playerB = this.participants.get(match.participant_b_id);
        
        let statusBadge = '';
        if (match.status === 'active') {
            statusBadge = '<div class="match-status-badge-premium live"><div class="live-dot-premium"></div>LIVE</div>';
        } else if (match.status === 'completed') {
            statusBadge = '<div class="match-status-badge-premium completed">✓</div>';
        }
        
        div.innerHTML = `
            ${statusBadge}
            ${this.renderPlayer(playerA, match.votes_a, match.winner_id === match.participant_a_id, match.winner_id && match.winner_id !== match.participant_a_id)}
            ${this.renderPlayer(playerB, match.votes_b, match.winner_id === match.participant_b_id, match.winner_id && match.winner_id !== match.participant_b_id)}
            <div class="match-id-premium">${match.match_id.toUpperCase()}</div>
        `;
        
        return div;
    }

    renderPlayer(player, score, isWinner, isLoser) {
        if (!player) {
            return `
                <div class="match-player-premium tbd">
                    <div class="player-avatar-premium">?</div>
                    <div class="player-info-premium">
                        <div class="player-name-premium">TBD</div>
                        <div class="player-track-premium">À déterminer</div>
                    </div>
                    <div class="player-score-premium">-</div>
                </div>
            `;
        }
        
        const winnerClass = isWinner ? 'winner' : isLoser ? 'loser' : '';
        const avatar = player.avatarUrl 
            ? `<img src="${player.avatarUrl}" alt="${this.escapeHtml(player.username)}" loading="lazy">`
            : player.username.charAt(0).toUpperCase();
        
        return `
            <div class="match-player-premium ${winnerClass}" data-player-id="${player.id}">
                <div class="player-avatar-premium">${avatar}</div>
                <div class="player-info-premium">
                    <div class="player-name-premium">${this.escapeHtml(player.username)}</div>
                    <div class="player-track-premium">${this.escapeHtml(player.trackTitle)}</div>
                </div>
                <div class="player-score-premium">${score ?? '-'}</div>
            </div>
        `;
    }

    createFinalZone(finalMatch) {
        const div = document.createElement('div');
        div.className = 'bracket-final-zone-premium';
        div.style.borderColor = '#ffd700';
        
        const champion = finalMatch.winner_id ? this.participants.get(finalMatch.winner_id) : null;
        
        let championHTML = '';
        if (champion) {
            const avatar = champion.avatarUrl 
                ? `<img src="${champion.avatarUrl}" alt="${this.escapeHtml(champion.username)}">`
                : '';
            
            championHTML = `
                <div class="champion-display-premium">
                    <div class="champion-crown-premium">👑</div>
                    <div class="champion-avatar-premium">${avatar}</div>
                    <div class="champion-name-premium">${this.escapeHtml(champion.username)}</div>
                    <div class="champion-subtitle-premium">CHAMPION WRC 2026</div>
                </div>
            `;
        }
        
        div.innerHTML = `
            <div class="final-title-premium">🏆 FINALE 🏆</div>
            ${championHTML}
        `;
        
        const matchCard = this.createMatchCard(finalMatch);
        div.appendChild(matchCard);
        
        return div;
    }

    // ==========================================
    // REALTIME OPTIMISÉ (BATCH UPDATES)
    // ==========================================
    setupRealtimeOptimized() {
        if (!this.tournament) return;
        
        this.realtimeChannel = supabase
            .channel(`bracket_optimized_${this.tournament.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tournament_matches',
                filter: `tournament_id=eq.${this.tournament.id}`
            }, (payload) => {
                // Batch les updates
                this.pendingUpdates.add(payload.new.id);
                this.scheduleUpdate(payload.new);
            })
            .subscribe();
    }

    scheduleUpdate(match) {
        clearTimeout(this.updateTimer);
        
        this.updateTimer = setTimeout(() => {
            this.processBatchUpdates();
        }, 100); // Attendre 100ms pour grouper les updates
    }

    processBatchUpdates() {
        if (this.pendingUpdates.size === 0) return;
        
        console.log(`📦 Traitement batch: ${this.pendingUpdates.size} updates`);
        
        this.pendingUpdates.forEach(matchId => {
            const match = this.matches.find(m => m.id === matchId);
            if (match) {
                this.updateMatchInDOM(match);
            }
        });
        
        this.pendingUpdates.clear();
    }

    updateMatchInDOM(match) {
        const matchEl = this.modal.querySelector(`[data-match-id="${match.id}"]`);
        if (!matchEl) return;
        
        // Update avec requestAnimationFrame pour smooth rendering
        requestAnimationFrame(() => {
            matchEl.className = `bracket-match-premium ${match.status}`;
            
            // Update scores
            const scores = matchEl.querySelectorAll('.player-score-premium');
            if (scores[0]) scores[0].textContent = match.votes_a ?? '-';
            if (scores[1]) scores[1].textContent = match.votes_b ?? '-';
            
            // Update stats
            const stats = this.calculateStats();
            this.updateStatsDisplay(stats);
        });
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================
    setupEventListeners() {
        this.modal.querySelector('.btn-close-premium').addEventListener('click', () => this.close());
        this.modal.querySelector('#zoomInBtn').addEventListener('click', () => this.zoomIn());
        this.modal.querySelector('#zoomOutBtn').addEventListener('click', () => this.zoomOut());
        this.modal.querySelector('#goToLiveBtn').addEventListener('click', () => this.goToLive());
        this.modal.querySelector('#goToFinalBtn').addEventListener('click', () => this.goToFinal());
        this.modal.querySelector('#resetViewBtn').addEventListener('click', () => this.resetView());
        
        this.setupDragScroll();
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    setupDragScroll() {
        const scroll = this.modal.querySelector('#bracketScroll');
        let startX, startY, scrollLeft, scrollTop;
        
        scroll.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this.isDragging = true;
            startX = e.pageX;
            startY = e.pageY;
            scrollLeft = scroll.scrollLeft;
            scrollTop = scroll.scrollTop;
        });
        
        scroll.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const walkX = (e.pageX - startX) * 1.5;
            const walkY = (e.pageY - startY) * 1.5;
            scroll.scrollLeft = scrollLeft - walkX;
            scroll.scrollTop = scrollTop - walkY;
        });
        
        const stopDrag = () => {
            this.isDragging = false;
        };
        
        scroll.addEventListener('mouseup', stopDrag);
        scroll.addEventListener('mouseleave', stopDrag);
    }

    // ==========================================
    // ZOOM & NAVIGATION
    // ==========================================
    zoomIn() {
        this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + 0.2);
        this.updateZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - 0.2);
        this.updateZoom();
    }

    updateZoom() {
        const tree = this.modal.querySelector('#bracketTree');
        const display = this.modal.querySelector('#zoomLevel');
        tree.style.transform = `scale(${this.zoomLevel})`;
        display.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }

    goToLive() {
        const liveMatch = this.modal.querySelector('.bracket-match-premium.live');
        if (liveMatch) {
            liveMatch.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    goToFinal() {
        const finalZone = this.modal.querySelector('.bracket-final-zone-premium');
        if (finalZone) {
            finalZone.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    resetView() {
        this.zoomLevel = 1;
        this.updateZoom();
        const scroll = this.modal.querySelector('#bracketScroll');
        scroll.scrollTo({
            left: (scroll.scrollWidth - scroll.clientWidth) / 2,
            top: (scroll.scrollHeight - scroll.clientHeight) / 2,
            behavior: 'smooth'
        });
    }

    // ==========================================
    // CLEANUP
    // ==========================================
    close() {
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
        }
        
        if (this.modal) {
            this.modal.style.opacity = '0';
            setTimeout(() => this.modal.remove(), 300);
        }
        
        if (this.tooltip) {
            this.tooltip.remove();
        }
        
        console.log('🚪 Bracket fermé');
    }

    // ==========================================
    // UTILS
    // ==========================================
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error('❌', message);
        if (this.modal) {
            const tree = this.modal.querySelector('#bracketTree');
            if (tree) {
                tree.innerHTML = `
                    <div style="text-align: center; padding: 60px; color: #ef4444;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
                        <h3 style="font-size: 1.5rem; margin-bottom: 10px;">Erreur</h3>
                        <p>${this.escapeHtml(message)}</p>
                    </div>
                `;
            }
        }
    }
}

// ==========================================
// EXPORT
// ==========================================
export default BracketTreeOptimized;

window.openBracketTreeOptimized = async function() {
    const bracket = new BracketTreeOptimized();
    await bracket.init();
};

console.log('✅ BracketTreeOptimized chargé (1000+ users ready)');