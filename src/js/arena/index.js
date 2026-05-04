/**
 * WRC 2026 - Tournament Arena Main Entry
 * Modular tournament arena controller
 */

import { supabase } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';
import { arenaAudio } from './ArenaAudio.js';
import { arenaVoting } from './ArenaVoting.js';
import { arenaRealtime } from './ArenaRealtime.js';
import { showToast } from '../auth/toast.js';

// ==========================================
// STATE
// ==========================================
let currentUser = null;
let currentMatch = null;
let currentPhase = 'WAITING';
let tournamentId = null;

// DOM Elements
let elements = {};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    logger.info('Tournament Arena initializing...');
    
    try {
        // Cache DOM elements
        cacheElements();
        
        // 1. Check authentication
        await checkAuth();
        
        // 2. Initialize audio
        initAudio();
        
        // 3. Load tournament and match
        await loadTournamentData();
        
        // 4. Setup realtime
        setupRealtime();
        
        // 5. Display match
        displayMatch();
        
        // 6. Setup event listeners
        setupEventListeners();
        
        // 7. Setup visibility handling
        setupVisibilityHandling();
        
        logger.info('Arena initialized successfully');
        
    } catch (error) {
        logger.error('Arena init error:', error);
        showError(error.message);
    }
});

// ==========================================
// CACHE DOM ELEMENTS
// ==========================================
function cacheElements() {
    elements = {
        audioA: document.getElementById('audioA'),
        audioB: document.getElementById('audioB'),
        volumeSlider: document.getElementById('volumeSlider'),
        muteBtn: document.getElementById('muteBtn'),
        volumeValue: document.getElementById('volumeValue'),
        progressBar: document.getElementById('progressBar'),
        currentTime: document.getElementById('currentTime'),
        totalTime: document.getElementById('totalTime'),
        avatarA: document.getElementById('avatarA'),
        avatarB: document.getElementById('avatarB'),
        fighterInfoA: document.getElementById('fighterInfoA'),
        fighterInfoB: document.getElementById('fighterInfoB'),
        matchId: document.getElementById('matchId'),
        btnA: document.getElementById('btnA'),
        btnB: document.getElementById('btnB'),
        voteBarA: document.getElementById('voteBarA'),
        voteBarB: document.getElementById('voteBarB'),
        countA: document.getElementById('countA'),
        countB: document.getElementById('countB'),
        votePercentA: document.getElementById('votePercentA'),
        votePercentB: document.getElementById('votePercentB'),
        currentTrackTitle: document.getElementById('currentTrackTitle'),
        statusPhase: document.querySelector('.status-phase'),
        statusTimer: document.querySelector('.status-timer'),
        winnerOverlay: document.getElementById('winnerOverlay'),
        winnerName: document.getElementById('winnerName'),
        winnerTrackTitle: document.getElementById('winnerTrackTitle'),
        winnerVotes: document.getElementById('winnerVotes'),
        winnerPercent: document.getElementById('winnerPercent'),
        btnNextMatch: document.getElementById('btnNextMatch'),
        btnOpenBracketTree: document.getElementById('btnOpenBracketTree')
    };
}

// ==========================================
// AUTH CHECK
// ==========================================
async function checkAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        logger.warn('Not authenticated, redirecting...');
        window.location.href = 'index.html';
        throw new Error('Auth required');
    }
    
    currentUser = user;
    logger.info('User connected:', user.id);
}

// ==========================================
// AUDIO INITIALIZATION
// ==========================================
function initAudio() {
    arenaAudio.init(elements.audioA, elements.audioB);
    
    arenaAudio.onProgressUpdate = updateProgress;
    arenaAudio.onEnded = handleAudioEnded;
    arenaAudio.onUnlockNeeded = showUnlockAudioButton;
}

// ==========================================
// LOAD TOURNAMENT DATA
// ==========================================
async function loadTournamentData() {
    // Load active tournament
    const { data: tournament, error: tourError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'active')
        .single();

    if (tourError || !tournament) {
        showWaitingState('Aucun tournoi actif');
        throw new Error('No active tournament');
    }

    tournamentId = tournament.id;
    currentPhase = tournament.current_phase || 'WAITING';

    // Load next match
    const { data: match, error: matchError } = await supabase
        .from('tournament_matches')
        .select(`
            *,
            participant_a:profiles!tournament_matches_participant_a_id_fkey(id, username, stage_name, avatar_url, country, track_url, track_title),
            participant_b:profiles!tournament_matches_participant_b_id_fkey(id, username, stage_name, avatar_url, country, track_url, track_title)
        `)
        .eq('tournament_id', tournamentId)
        .eq('status', 'pending')
        .order('match_number', { ascending: true })
        .limit(1)
        .single();

    if (matchError || !match) {
        showWaitingState('Aucun match disponible');
        throw new Error('No match available');
    }

    currentMatch = match;
    logger.info('Match loaded:', match.match_id);
}

// ==========================================
// REALTIME SETUP
// ==========================================
function setupRealtime() {
    arenaRealtime.subscribeToMatchUpdates(currentMatch.id, handleMatchUpdate);
    arenaRealtime.subscribeToPhaseUpdates(tournamentId, handlePhaseUpdate);
    arenaRealtime.trackPresence(currentMatch.id, currentUser.id);
}

// ==========================================
// MATCH UPDATE HANDLER
// ==========================================
function handleMatchUpdate(data) {
    if (data.votes_a !== undefined && data.votes_b !== undefined) {
        currentMatch.votes_a = data.votes_a;
        currentMatch.votes_b = data.votes_b;
        updateVoteBar(data.votes_a, data.votes_b);
    }
    
    if (data.status === 'completed' && currentMatch.status !== 'completed') {
        logger.info('Match completed');
        currentMatch.status = 'completed';
        currentMatch.winner_id = data.winner_id;
        showWinner(currentMatch.winner_id);
    }
}

// ==========================================
// PHASE UPDATE HANDLER
// ==========================================
function handlePhaseUpdate(tournament) {
    if (tournament.current_phase !== currentPhase) {
        logger.info(`Phase change: ${currentPhase} -> ${tournament.current_phase}`);
        currentPhase = tournament.current_phase;
        handlePhaseTransition(currentPhase);
    }
}

// ==========================================
// PHASE TRANSITIONS
// ==========================================
function handlePhaseTransition(phase) {
    updatePhaseDisplay(phase);
    
    switch (phase) {
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
        case 'WAITING':
        default:
            handleWaitingPhase();
    }
}

function handleTrackAPhase() {
    if (elements.audioB) elements.audioB.pause();
    
    if (currentMatch.participant_a?.track_url) {
        arenaAudio.playTrackA(currentMatch.participant_a.track_url);
    }
    
    updateFighterStatus('A', 'PLAYING');
    updateFighterStatus('B', 'WAITING');
    updateTrackTitle(currentMatch.participant_a?.track_title || 'Track A');
    disableVoting();
}

function handleTrackBPhase() {
    if (elements.audioA) elements.audioA.pause();
    
    if (currentMatch.participant_b?.track_url) {
        arenaAudio.playTrackB(currentMatch.participant_b.track_url);
    }
    
    updateFighterStatus('A', 'WAITING');
    updateFighterStatus('B', 'PLAYING');
    updateTrackTitle(currentMatch.participant_b?.track_title || 'Track B');
    disableVoting();
}

function handleVotingPhase() {
    arenaAudio.stopAll();
    
    updateFighterStatus('A', 'VOTING');
    updateFighterStatus('B', 'VOTING');
    updateTrackTitle('Vote pour ton favori !');
    enableVoting();
}

function handleResultsPhase() {
    disableVoting();
    showWinner(currentMatch.votes_a > currentMatch.votes_b ? currentMatch.participant_a : currentMatch.participant_b);
}

function handleWaitingPhase() {
    arenaAudio.stopAll();
    disableVoting();
}

// ==========================================
// DISPLAY MATCH
// ==========================================
function displayMatch() {
    // Fighter A
    if (elements.avatarA && currentMatch.participant_a?.avatar_url) {
        elements.avatarA.src = currentMatch.participant_a.avatar_url;
    }
    
    if (elements.fighterInfoA) {
        elements.fighterInfoA.innerHTML = `
            <div class="fighter-name">${escapeHtml(currentMatch.participant_a?.username || 'Unknown')}</div>
            <div class="fighter-country">${escapeHtml(currentMatch.participant_a?.country || 'UNKNOWN')}</div>
        `;
    }
    
    // Fighter B
    if (elements.avatarB && currentMatch.participant_b?.avatar_url) {
        elements.avatarB.src = currentMatch.participant_b.avatar_url;
    }
    
    if (elements.fighterInfoB) {
        elements.fighterInfoB.innerHTML = `
            <div class="fighter-name">${escapeHtml(currentMatch.participant_b?.username || 'Unknown')}</div>
            <div class="fighter-country">${escapeHtml(currentMatch.participant_b?.country || 'UNKNOWN')}</div>
        `;
    }
    
    // Match ID
    if (elements.matchId) {
        elements.matchId.textContent = '#' + (currentMatch.match_id || '').toUpperCase();
    }
    
    // Initial votes
    updateVoteBar(currentMatch.votes_a || 0, currentMatch.votes_b || 0);
    
    // Handle current phase
    handlePhaseTransition(currentPhase);
}

// ==========================================
// VOTING
// ==========================================
window.castVote = async function(choice) {
    if (arenaVoting.hasUserVoted()) {
        showToast('Vote', 'Vous avez déjà voted !', 'warning');
        return;
    }

    if (!currentUser || !currentMatch) {
        logger.error('User or match missing');
        return;
    }

    const participantId = choice === 'A' 
        ? currentMatch.participant_a?.id 
        : currentMatch.participant_b?.id;

    const result = await arenaVoting.castVote(
        currentMatch.id,
        currentUser.id,
        participantId,
        choice
    );

    if (result.success) {
        highlightVoteButton(choice);
    }
};

function highlightVoteButton(choice) {
    const btn = choice === 'A' ? elements.btnA : elements.btnB;
    if (btn) {
        btn.classList.add('selected');
    }
}

// ==========================================
// UI UPDATES
// ==========================================
function updateProgress(data) {
    if (elements.progressBar && data.duration) {
        const percent = (data.currentTime / data.duration) * 100;
        elements.progressBar.style.width = `${percent}%`;
    }
    
    if (elements.currentTime) {
        elements.currentTime.textContent = formatTime(data.currentTime);
    }
    
    if (elements.totalTime) {
        elements.totalTime.textContent = formatTime(data.duration);
    }
}

function updateVoteBar(votesA, votesB) {
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
    if (elements.voteBarA) elements.voteBarA.style.width = `${percentA}%`;
    if (elements.voteBarB) elements.voteBarB.style.width = `${percentB}%`;
    if (elements.countA) elements.countA.textContent = votesA;
    if (elements.countB) elements.countB.textContent = votesB;
    if (elements.votePercentA) elements.votePercentA.textContent = `${percentA}%`;
    if (elements.votePercentB) elements.votePercentB.textContent = `${percentB}%`;
}

function updatePhaseDisplay(phase) {
    if (elements.statusPhase) {
        elements.statusPhase.textContent = phase.replace('_', ' ');
    }
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
        containerEl.classList.toggle('playing', status === 'PLAYING');
    }
}

function updateTrackTitle(title) {
    if (elements.currentTrackTitle) {
        elements.currentTrackTitle.textContent = title;
    }
}

function enableVoting() {
    if (elements.btnA) elements.btnA.disabled = false;
    if (elements.btnB) elements.btnB.disabled = false;
}

function disableVoting() {
    if (elements.btnA) elements.btnA.disabled = true;
    if (elements.btnB) elements.btnB.disabled = true;
}

function showWinner(winner) {
    if (!winner || !elements.winnerOverlay) return;
    
    const votes = winner.id === currentMatch.participant_a?.id 
        ? currentMatch.votes_a 
        : currentMatch.votes_b;
    const totalVotes = currentMatch.votes_a + currentMatch.votes_b;
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 50;
    
    if (elements.winnerName) elements.winnerName.textContent = winner.username || 'WINNER';
    if (elements.winnerTrackTitle) elements.winnerTrackTitle.textContent = `"${winner.track_title || 'Track'}"`;
    if (elements.winnerVotes) elements.winnerVotes.textContent = votes;
    if (elements.winnerPercent) elements.winnerPercent.textContent = `${percent}%`;
    
    elements.winnerOverlay.classList.remove('hidden');
}

function showUnlockAudioButton() {
    const existing = document.getElementById('unlockAudioBtn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'unlockAudioBtn';
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
        arenaAudio.unlock();
        btn.remove();
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
    showToast('Erreur', message, 'error');
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    // Volume
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', (e) => {
            const vol = e.target.value / 100;
            arenaAudio.setVolume(vol);
            if (elements.volumeValue) {
                elements.volumeValue.textContent = `${e.target.value}%`;
            }
        });
    }
    
    if (elements.muteBtn) {
        elements.muteBtn.addEventListener('click', () => {
            const muted = arenaAudio.toggleMute();
            elements.muteBtn.classList.toggle('muted', muted);
        });
    }
    
    // Next match
    if (elements.btnNextMatch) {
        elements.btnNextMatch.addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    // Bracket
    if (elements.btnOpenBracketTree) {
        elements.btnOpenBracketTree.addEventListener('click', () => {
            if (window.openBracketTree) {
                window.openBracketTree();
            }
        });
    }
}

// ==========================================
// VISIBILITY HANDLING
// ==========================================
function setupVisibilityHandling() {
    let wasHidden = false;
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            logger.debug('Page hidden');
            wasHidden = true;
            arenaAudio.pause();
        } else {
            logger.debug('Page visible');
            if (wasHidden) {
                arenaAudio.resume();
            }
            wasHidden = false;
        }
    });
}

// ==========================================
// HELPERS
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

function handleAudioEnded() {
    logger.info('Audio ended');
}

// ==========================================
// CLEANUP
// ==========================================
window.addEventListener('beforeunload', () => {
    logger.info('Arena cleanup...');
    arenaAudio.destroy();
    arenaRealtime.unsubscribeAll();
});

logger.info('Tournament Arena module loaded');