/**
 * WRC 2026 - Arena Realtime Module
 * Supabase channel subscriptions for tournament arena
 */

import { supabase } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';

// ==========================================
// ARENA REALTIME CLASS
// ==========================================
export class ArenaRealtime {
    constructor() {
        this.channels = [];
        this.matchChannel = null;
        this.viewersChannel = null;
        this.syncChannel = null;
    }

    // ==========================================
    // MATCH UPDATES
    // ==========================================
    subscribeToMatchUpdates(matchId, onUpdate) {
        this.matchChannel = supabase
            .channel(`match_updates:${matchId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tournament_matches',
                filter: `id=eq.${matchId}`
            }, (payload) => {
                logger.debug('Match update received:', payload.new);
                if (onUpdate) onUpdate(payload.new);
            })
            .subscribe((status) => {
                logger.info(`Match channel status: ${status}`);
            });

        this.channels.push(this.matchChannel);
        return this.matchChannel;
    }

    // ==========================================
    // PHASE/SYNC UPDATES
    // ==========================================
    subscribeToPhaseUpdates(tournamentId, onPhaseChange) {
        this.syncChannel = supabase
            .channel(`phase_updates:${tournamentId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tournaments',
                filter: `id=eq.${tournamentId}`
            }, (payload) => {
                logger.debug('Phase update received:', payload.new);
                if (onPhaseChange) onPhaseChange(payload.new);
            })
            .subscribe();

        this.channels.push(this.syncChannel);
        return this.syncChannel;
    }

    // ==========================================
    // VIEWERS COUNT
    // ==========================================
    subscribeToViewers(matchId, onViewersUpdate) {
        this.viewersChannel = supabase
            .channel(`viewers:${matchId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'match_viewers'
            }, (payload) => {
                if (onViewersUpdate) onViewersUpdate(payload);
            })
            .subscribe();

        this.channels.push(this.viewersChannel);
        return this.viewersChannel;
    }

    // ==========================================
    // PRESENCE (for live viewer count)
    // ==========================================
    async trackPresence(matchId, userId) {
        const channel = supabase.channel(`presence:${matchId}`);
        
        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                logger.debug('Presence state:', state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                logger.info('User joined:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                logger.info('User left:', key, leftPresences);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: userId,
                        online_at: new Date().toISOString()
                    });
                }
            });

        this.channels.push(channel);
        return channel;
    }

    // ==========================================
    // CLEANUP
    // ==========================================
    unsubscribeAll() {
        this.channels.forEach(channel => {
            supabase.removeChannel(channel);
        });
        this.channels = [];
        this.matchChannel = null;
        this.viewersChannel = null;
        this.syncChannel = null;
    }

    unsubscribeMatch() {
        if (this.matchChannel) {
            supabase.removeChannel(this.matchChannel);
            this.matchChannel = null;
            this.channels = this.channels.filter(c => c !== this.matchChannel);
        }
    }

    unsubscribeViewers() {
        if (this.viewersChannel) {
            supabase.removeChannel(this.viewersChannel);
            this.viewersChannel = null;
        }
    }

    unsubscribeSync() {
        if (this.syncChannel) {
            supabase.removeChannel(this.syncChannel);
            this.syncChannel = null;
        }
    }
}

export const arenaRealtime = new ArenaRealtime();