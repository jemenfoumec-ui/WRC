/**
 * WRC 2026 - Arena Voting Module
 * Real-time voting handlers for tournament arena
 */

import { supabase } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';
import { showToast } from '../auth/toast.js';

// ==========================================
// VOTE TRACKING CLASS
// ==========================================
class VoteTracker {
    constructor() {
        this.hasVoted = false;
        this.userVote = null;
        this.pendingVote = null;
    }

    reset() {
        this.hasVoted = false;
        this.userVote = null;
    }

    setVote(choice) {
        this.hasVoted = true;
        this.userVote = choice;
    }
}

// ==========================================
// ARENA VOTING CLASS
// ==========================================
export class ArenaVoting {
    constructor() {
        this.tracker = new VoteTracker();
        this.onVoteUpdate = null;
    }

    // ==========================================
    // CAST VOTE
    // ==========================================
    async castVote(matchId, userId, participantId, choice) {
        if (this.tracker.hasVoted) {
            showToast('Vote', 'Vous avez déjà voted !', 'warning');
            return { success: false, message: 'Already voted' };
        }

        try {
            logger.info('Casting vote:', choice);

            const { data, error } = await supabase.rpc('cast_tournament_vote', {
                p_match_id: matchId,
                p_user_id: userId,
                p_participant_id: participantId
            });

            if (error) throw error;

            this.tracker.setVote(choice);

            if (this.onVoteUpdate) {
                this.onVoteUpdate({ voted: true, choice });
            }

            showToast('Vote', 'Votre vote a été enregistré !', 'success');
            
            return { success: true, data };

        } catch (error) {
            logger.error('Vote error:', error);
            showToast('Erreur', error.message || 'Erreur lors du vote', 'error');
            return { success: false, error };
        }
    }

    // ==========================================
    // GETTERS
    // ==========================================
    hasUserVoted() {
        return this.tracker.hasVoted;
    }

    getUserVote() {
        return this.tracker.userVote;
    }

    reset() {
        this.tracker.reset();
        if (this.onVoteUpdate) {
            this.onVoteUpdate({ voted: false, choice: null });
        }
    }
}

export const arenaVoting = new ArenaVoting();