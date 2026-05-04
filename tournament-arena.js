// ==========================================
// TOURNAMENT ARENA - MAIN CONTROLLER
// Version complète et fonctionnelle
// ==========================================

import { supabase } from './supabaseClient.js';
// TournamentSystem intégré
// RealtimeSyncSystem intégré
// TournamentViewerSystem intégré

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let currentUser = null;
let currentMatch = null;
let currentPhase = 'WAITING';
let phaseTimer = null;
let remainingSeconds = 0;

// Systèmes
let tournamentSystem = null;
let syncSystem = null;
let viewerSystem = null;
let realtimeChannel = null;

// Audio
let audioA = null;
let audioB = null;
let audioUnlocked = false;
let currentVolume = 0.8;
let isMuted = false;

// Vote tracking
let hasVoted = false;
let userVote = null;

// Optimisation
let voteUpdateQueue = [];
let voteUpdateTimer = null;
let lastAnimationFrame = 0;
const ANIMATION_THROTTLE = 150;

// ==========================================
// INITIALISATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎮 Initialisation Tournament Arena');
    
    try {
        // 1. Vérifier l'authentification
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.warn('⚠️ Non authentifié, redirection...');
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        console.log('✅ Utilisateur connecté:', user.id);
        
        // 2. Initialiser les éléments audio
        initAudioElements();
        
        // 3. Initialiser le système de tournoi
        tournamentSystem = new TournamentSystem();
        await tournamentSystem.loadActiveTournament();
        
        if (!tournamentSystem.currentTournament) {
            showError('Aucun tournoi actif');
            return;
        }
        
        console.log('🏆 Tournoi chargé:', tournamentSystem.currentTournament.name);
        
        // 4. Charger le prochain match
        currentMatch = await tournamentSystem.getNextMatch();
        
        if (!currentMatch) {
            showWaitingState('Aucun match disponible pour le moment');
            return;
        }
        
        console.log('⚔️ Match chargé:', currentMatch.match_id);
        
        // 5. Initialiser les systèmes temps réel
        await initRealtimeSystems();
        
        // 6. Afficher le match
        displayMatch(currentMatch);
        
        // 7. Setup event listeners
        setupEventListeners();
        
        // 8. Setup visibilité
        setupVisibilityHandling();
        
        console.log('✅ Arena initialisée avec succès');
        
    } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        showError(error.message);
    }
});

// ==========================================
// INITIALISATION AUDIO
// ==========================================
function initAudioElements() {
    audioA = document.getElementById('audioA');
    audioB = document.getElementById('audioB');
    
    if (!audioA || !audioB) {
        console.error('❌ Éléments audio manquants');
        return;
    }
    
    // Configuration audio
    [audioA, audioB].forEach(audio => {
        audio.volume = currentVolume;
        audio.preload = 'auto';
        
        // Events
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleAudioEnded);
        audio.addEventListener('error', (e) => {
            console.error('❌ Erreur audio:', e);
        });
    });
    
    console.log('✅ Audio initialisé');
}

// ==========================================
// SYSTÈMES TEMPS RÉEL
// ==========================================
async function initRealtimeSystems() {
    try {
        // 1. Sync System (phases)
        syncSystem = new RealtimeSyncSystem();
        await syncSystem.init(
            currentMatch.id,
            handleStateChange,
            handlePhaseChange,
            false // isAdmin = false pour les viewers
        );
        
        // 2. Viewer System (compteur spectateurs)
        viewerSystem = new TournamentViewerSystem();
        await viewerSystem.init(currentMatch.id, currentUser.id);
        
        // 3. Match Updates (votes en temps réel)
        setupRealtimeMatchUpdates();
        
        console.log('✅ Systèmes temps réel initialisés');
        
    } catch (error) {
        console.error('❌ Erreur init realtime:', error);
    }
}

// ==========================================
// REALTIME MATCH UPDATES
// ==========================================
function setupRealtimeMatchUpdates() {
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }
    
    realtimeChannel = supabase
        .channel(`match_updates:${currentMatch.id}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'tournament_matches',
            filter: `id=eq.${currentMatch.id}`
        }, (payload) => {
            console.log('📨 Match update reçu:', payload.new);
            
            if (payload.new.votes_a !== undefined && payload.new.votes_b !== undefined) {
                currentMatch.votes_a = payload.new.votes_a;
                currentMatch.votes_b = payload.new.votes_b;
                updateVoteBar(payload.new.votes_a, payload.new.votes_b);
                animateVoteUpdate();
            }
            
            if (payload.new.status === 'completed' && currentMatch.status !== 'completed') {
                console.log('🏁 Match terminé détecté');
                currentMatch.status = 'completed';
                currentMatch.winner_id = payload.new.winner_id;
            }
        })
        .subscribe((status) => {
            console.log('📡 Realtime status:', status);
        });
}

// ==========================================
// GESTION CHANGEMENTS D'ÉTAT
// ==========================================
function handleStateChange(state) {
    if (!state) return;
    
    console.log('🔄 State change:', state.current_phase);
    
    // Calculer le temps restant
    const elapsed = syncSystem.getCurrentElapsedSeconds();
    const duration = state.phase_duration || 45;
    remainingSeconds = Math.max(0, duration - elapsed);
    
    updateTimer(remainingSeconds);
}

function handlePhaseChange(newPhase, state) {
    console.log('🔄 Phase change:', currentPhase, '->', newPhase);
    
    currentPhase = newPhase;
    updatePhaseDisplay(newPhase);
    
    // Gérer les transitions de phase
    switch (newPhase) {
        case 'TRACK_A':
            handleTrackAPhase();
            break;
        case 'TRACK_B':
            handleTrackBPhase();
            break;
        case 'VOTING':
            handleVotingPhase();
            break;
        case 'RESULTS':
            handleResultsPhase();
            break;
    }
}

// ==========================================
// GESTION DES PHASES
// ==========================================
function handleTrackAPhase() {
    console.log('🎵 Phase TRACK A');
    
    // Arrêter l'autre audio
    if (audioB) audioB.pause();
    
    // Charger et jouer Track A
    if (audioA && currentMatch.participant_a?.track_url) {
        audioA.src = currentMatch.participant_a.track_url;
        
        // Unlock audio sur interaction utilisateur
        if (audioUnlocked) {
            audioA.play().catch(e => {
                console.warn('⚠️ Autoplay bloqué:', e);
                showUnlockAudioButton();
            });
        } else {
            showUnlockAudioButton();
        }
    }
    
    // Mettre à jour l'UI
    updateFighterStatus('A', 'PLAYING');
    updateFighterStatus('B', 'WAITING');
    updateTrackTitle(currentMatch.participant_a?.track_title || 'Track A');
    
    // Désactiver les votes
    disableVoting();
}

function handleTrackBPhase() {
    console.log('🎵 Phase TRACK B');
    
    // Arrêter l'autre audio
    if (audioA) audioA.pause();
    
    // Charger et jouer Track B
    if (audioB && currentMatch.participant_b?.track_url) {
        audioB.src = currentMatch.participant_b.track_url;
        
        if (audioUnlocked) {
            audioB.play().catch(e => {
                console.warn('⚠️ Autoplay bloqué:', e);
                showUnlockAudioButton();
            });
        } else {
            showUnlockAudioButton();
        }
    }
    
    // Mettre à jour l'UI
    updateFighterStatus('A', 'WAITING');
    updateFighterStatus('B', 'PLAYING');
    updateTrackTitle(currentMatch.participant_b?.track_title || 'Track B');
    
    // Désactiver les votes
    disableVoting();
}

function handleVotingPhase() {
    console.log('🗳️ Phase VOTING');
    
    // Arrêter tous les audios
    if (audioA) audioA.pause();
    if (audioB) audioB.pause();
    
    // Mettre à jour l'UI
    updateFighterStatus('A', 'VOTING');
    updateFighterStatus('B', 'VOTING');
    updateTrackTitle('Vote pour ton favori !');
    
    // Activer les votes
    enableVoting();
}

function handleResultsPhase() {
    console.log('🏆 Phase RESULTS');
    
    // Désactiver les votes
    disableVoting();
    
    // Déterminer le gagnant
    const winner = currentMatch.votes_a > currentMatch.votes_b 
        ? currentMatch.participant_a 
        : currentMatch.participant_b;
    
    const winnerVotes = Math.max(currentMatch.votes_a, currentMatch.votes_b);
    const totalVotes = currentMatch.votes_a + currentMatch.votes_b;
    const winnerPercent = totalVotes > 0 
        ? Math.round((winnerVotes / totalVotes) * 100) 
        : 50;
    
    // Afficher l'overlay gagnant
    showWinnerOverlay(winner, winnerVotes, winnerPercent);
}

// ==========================================
// AFFICHAGE DU MATCH
// ==========================================
function displayMatch(match) {
    console.log('📺 Affichage du match');
    
    // Fighter A
    const avatarA = document.getElementById('avatarA');
    const fighterInfoA = document.getElementById('fighterInfoA');
    
    if (avatarA && match.participant_a) {
        if (match.participant_a.avatar_url) {
            avatarA.src = match.participant_a.avatar_url;
        }
    }
    
    if (fighterInfoA && match.participant_a) {
        fighterInfoA.innerHTML = `
            <div class="fighter-name">${escapeHtml(match.participant_a.username)}</div>
            <div class="fighter-country">${escapeHtml(match.participant_a.country || 'UNKNOWN')}</div>
        `;
    }
    
    // Fighter B
    const avatarB = document.getElementById('avatarB');
    const fighterInfoB = document.getElementById('fighterInfoB');
    
    if (avatarB && match.participant_b) {
        if (match.participant_b.avatar_url) {
            avatarB.src = match.participant_b.avatar_url;
        }
    }
    
    if (fighterInfoB && match.participant_b) {
        fighterInfoB.innerHTML = `
            <div class="fighter-name">${escapeHtml(match.participant_b.username)}</div>
            <div class="fighter-country">${escapeHtml(match.participant_b.country || 'UNKNOWN')}</div>
        `;
    }
    
    // Match ID
    const matchIdEl = document.getElementById('matchId');
    if (matchIdEl) {
        matchIdEl.textContent = '#' + match.match_id.toUpperCase();
    }
    
    // Votes initiaux
    updateVoteBar(match.votes_a || 0, match.votes_b || 0);
}

// ==========================================
// VOTE
// ==========================================
window.castVote = async function(choice) {
    if (hasVoted) {
        if (window.showToast) {
            window.showToast('Vote', 'Vous avez déjà voté !');
        } else {
            alert('Vous avez déjà voté !');
        }
        return;
    }
    
    if (!currentUser || !currentMatch) {
        console.error('❌ User ou match manquant');
        return;
    }
    
    try {
        console.log('🗳️ Vote:', choice);
        
        const participantId = choice === 'A' 
            ? currentMatch.participant_a_id 
            : currentMatch.participant_b_id;
        
        // Appel RPC pour voter
        const { data, error } = await supabase.rpc('cast_tournament_vote', {
            p_match_id: currentMatch.id,
            p_user_id: currentUser.id,
            p_participant_id: participantId
        });
        
        if (error) throw error;
        
        // Marquer comme voté
        hasVoted = true;
        userVote = choice;
        
        // Mettre à jour l'UI
        const btnA = document.getElementById('btnA');
        const btnB = document.getElementById('btnB');
        
        if (choice === 'A' && btnA) {
            btnA.classList.add('selected');
        } else if (choice === 'B' && btnB) {
            btnB.classList.add('selected');
        }
        
        if (window.showToast) {
            window.showToast('Vote', 'Votre vote a été enregistré !');
        } else {
            console.log('✅ Vote enregistré');
        }
        
        console.log('✅ Vote enregistré');
        
    } catch (error) {
        console.error('❌ Erreur vote:', error);
        if (window.showToast) {
            window.showToast('Erreur', error.message || 'Erreur lors du vote');
        } else {
            alert('Erreur: ' + (error.message || 'Erreur lors du vote'));
        }
    }
};

// ==========================================
// MISE À JOUR VOTE BAR (OPTIMISÉE)
// ==========================================
function updateVoteBar(votesA, votesB) {
    if (voteUpdateTimer) clearTimeout(voteUpdateTimer);
    
    voteUpdateQueue = [votesA, votesB];
    
    voteUpdateTimer = setTimeout(() => {
        renderVoteBarOptimized(voteUpdateQueue[0], voteUpdateQueue[1]);
    }, ANIMATION_THROTTLE);
}

function renderVoteBarOptimized(votesA, votesB) {
    const total = votesA + votesB;
    
    if (total === 0) {
        updateVoteBarDOM(50, 50, 0, 0);
        return;
    }
    
    const percentA = Math.round((votesA / total) * 100);
    const percentB = 100 - percentA;
    
    requestAnimationFrame(() => {
        updateVoteBarDOM(percentA, percentB, votesA, votesB);
    });
}

function updateVoteBarDOM(percentA, percentB, votesA, votesB) {
    const barA = document.getElementById('voteBarA');
    const barB = document.getElementById('voteBarB');
    const countA = document.getElementById('countA');
    const countB = document.getElementById('countB');
    const percAEl = document.getElementById('votePercentA');
    const percBEl = document.getElementById('votePercentB');
    
    if (barA) barA.style.width = `${percentA}%`;
    if (barB) barB.style.width = `${percentB}%`;
    if (countA) countA.textContent = votesA;
    if (countB) countB.textContent = votesB;
    if (percAEl) percAEl.textContent = `${percentA}%`;
    if (percBEl) percBEl.textContent = `${percentB}%`;
}

function animateVoteUpdate() {
    const now = Date.now();
    
    if (now - lastAnimationFrame < ANIMATION_THROTTLE) return;
    lastAnimationFrame = now;
    
    const countA = document.getElementById('countA');
    const countB = document.getElementById('countB');
    
    if (!countA || !countB) return;
    if (countA.classList.contains('animating')) return;
    
    [countA, countB].forEach(el => {
        el.classList.add('animating');
    });
    
    setTimeout(() => {
        countA.classList.remove('animating');
        countB.classList.remove('animating');
    }, 300);
}

// ==========================================
// UI HELPERS
// ==========================================
function updateTimer(seconds) {
    const formatted = formatTime(Math.max(0, seconds));
    const timerEl = document.querySelector('.status-timer');
    if (timerEl) timerEl.textContent = formatted;
}

function updatePhaseDisplay(phase) {
    const formatted = phase.replace('_', ' ');
    const phaseEl = document.querySelector('.status-phase');
    if (phaseEl) phaseEl.textContent = formatted;
}

function updateFighterStatus(fighter, status) {
    const statusEl = document.getElementById(`status${fighter}`);
    const containerEl = document.getElementById(`fighter${fighter}`);
    
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = 'fighter-status';
        if (status === 'PLAYING') {
            statusEl.classList.add('status-playing');
        }
    }
    
    if (containerEl) {
        containerEl.className = `fighter-container fighter-${fighter === 'A' ? 'left' : 'right'}`;
        if (status === 'PLAYING') {
            containerEl.classList.add('playing');
        }
    }
}

function updateTrackTitle(title) {
    const titleEl = document.getElementById('currentTrackTitle');
    if (titleEl) titleEl.textContent = title;
}

function enableVoting() {
    const btnA = document.getElementById('btnA');
    const btnB = document.getElementById('btnB');
    
    if (btnA) btnA.disabled = false;
    if (btnB) btnB.disabled = false;
}

function disableVoting() {
    const btnA = document.getElementById('btnA');
    const btnB = document.getElementById('btnB');
    
    if (btnA) btnA.disabled = true;
    if (btnB) btnB.disabled = true;
}

function showWinnerOverlay(winner, votes, percent) {
    const overlay = document.getElementById('winnerOverlay');
    const nameEl = document.getElementById('winnerName');
    const trackEl = document.getElementById('winnerTrackTitle');
    const votesEl = document.getElementById('winnerVotes');
    const percentEl = document.getElementById('winnerPercent');
    
    if (!overlay) return;
    
    if (nameEl) nameEl.textContent = winner?.username || 'WINNER';
    if (trackEl) trackEl.textContent = `"${winner?.track_title || 'Track'}"`;
    if (votesEl) votesEl.textContent = votes;
    if (percentEl) percentEl.textContent = `${percent}%`;
    
    overlay.classList.remove('hidden');
}

function showUnlockAudioButton() {
    // Créer un bouton pour débloquer l'audio
    const btn = document.createElement('button');
    btn.textContent = '🔊 Cliquez pour activer le son';
    btn.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
        padding: 20px 40px;
        background: #7b2cbf;
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1.2rem;
        cursor: pointer;
    `;
    
    btn.onclick = () => {
        audioUnlocked = true;
        btn.remove();
        
        // Rejouer l'audio actuel
        if (currentPhase === 'TRACK_A' && audioA) {
            audioA.play().catch(console.warn);
        } else if (currentPhase === 'TRACK_B' && audioB) {
            audioB.play().catch(console.warn);
        }
    };
    
    document.body.appendChild(btn);
}

function showWaitingState(message) {
    const container = document.querySelector('.tournament-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #888;">
                <h2 style="font-size: 2rem; margin-bottom: 20px;">⏳</h2>
                <p style="font-size: 1.2rem;">${escapeHtml(message)}</p>
            </div>
        `;
    }
}

function showError(message) {
    if (window.showToast) {
        window.showToast('Erreur', message);
    } else {
        console.error('Erreur:', message);
        alert('Erreur: ' + message);
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Volume controls
    const volumeSlider = document.getElementById('volumeSlider');
    const muteBtn = document.getElementById('muteBtn');
    const volumeValue = document.getElementById('volumeValue');
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            currentVolume = e.target.value / 100;
            if (audioA) audioA.volume = currentVolume;
            if (audioB) audioB.volume = currentVolume;
            if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
            isMuted = false;
        });
    }
    
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            const vol = isMuted ? 0 : currentVolume;
            if (audioA) audioA.volume = vol;
            if (audioB) audioB.volume = vol;
            muteBtn.classList.toggle('muted', isMuted);
        });
    }
    
    // Next match button
    const btnNextMatch = document.getElementById('btnNextMatch');
    if (btnNextMatch) {
        btnNextMatch.addEventListener('click', async () => {
            const overlay = document.getElementById('winnerOverlay');
            if (overlay) overlay.classList.add('hidden');
            
            // Charger le prochain match
            window.location.reload();
        });
    }
    
    // Bracket button
    const btnBracket = document.getElementById('btnOpenBracketTree');
    if (btnBracket) {
        btnBracket.addEventListener('click', () => {
            if (window.openBracketTree) {
                window.openBracketTree();
            }
        });
    }
}

// ==========================================
// AUDIO EVENTS
// ==========================================
function updateProgress() {
    const audio = currentPhase === 'TRACK_A' ? audioA : audioB;
    if (!audio) return;
    
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    
    if (progressBar) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${percent}%`;
    }
    
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
    
    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(audio.duration);
    }
}

function handleAudioEnded() {
    console.log('🎵 Audio terminé');
}

// ==========================================
// VISIBILITÉ
// ==========================================
function setupVisibilityHandling() {
    let wasHidden = false;
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('⏸️ Page cachée');
            wasHidden = true;
            if (audioA) audioA.pause();
            if (audioB) audioB.pause();
        } else {
            console.log('▶️ Page visible');
            if (wasHidden && audioUnlocked) {
                if (currentPhase === 'TRACK_A' && audioA) {
                    audioA.play().catch(console.warn);
                } else if (currentPhase === 'TRACK_B' && audioB) {
                    audioB.play().catch(console.warn);
                }
            }
            wasHidden = false;
        }
    });
}

// ==========================================
// UTILS
// ==========================================
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==========================================
// CLEANUP
// ==========================================
window.addEventListener('beforeunload', async () => {
    console.log('🧹 Cleanup arena...');
    
    if (phaseTimer) clearInterval(phaseTimer);
    if (voteUpdateTimer) clearTimeout(voteUpdateTimer);
    
    if (audioA) {
        audioA.pause();
        audioA.src = '';
    }
    if (audioB) {
        audioB.pause();
        audioB.src = '';
    }
    
    if (viewerSystem) await viewerSystem.destroy().catch(console.error);
    if (syncSystem) await syncSystem.destroy().catch(console.error);
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
});

console.log('✅ Tournament Arena loaded');