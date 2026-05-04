/**
 * WRC 2026 - Admin API Module
 * Supabase interactions for admin dashboard
 */

import { supabase, cacheManager, clearCache } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';

// ==========================================
// ADMIN API CLASS
// ==========================================
export class AdminApi {
    constructor() {
        this.channel = null;
    }

    // ==========================================
    // STATS
    // ==========================================
    async getGlobalStats() {
        try {
            const { data, error } = await supabase.rpc('get_global_stats');
            
            if (error) {
                return await this.getStatsFallback();
            }
            
            return data;
        } catch (err) {
            logger.error('getGlobalStats error:', err);
            return await this.getStatsFallback();
        }
    }

    async getStatsFallback() {
        const [usersRes, artistsRes, tracksRes, votesRes] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'artist'),
            supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('status', 'active'),
            supabase.from('profiles').select('votes_received').eq('role', 'artist')
        ]);

        return {
            total_users: usersRes.count || 0,
            total_artists: artistsRes.count || 0,
            total_tracks: tracksRes.count || 0,
            total_votes: votesRes.data?.reduce((sum, p) => sum + (p.votes_received || 0), 0) || 0
        };
    }

    // ==========================================
    // USERS
    // ==========================================
    async getUsers(limit = 20, offset = 0) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data;
    }

    async getRecentUsers(limit = 10) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, username, role, is_active, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }

    async getUserById(id) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async updateUser(id, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        clearCache();
        return data;
    }

    async deleteUser(id) {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;
        clearCache();
    }

    async setUserRole(id, role) {
        return await this.updateUser(id, { role, is_admin: role === 'admin' });
    }

    async toggleUserActive(id, isActive) {
        return await this.updateUser(id, { is_active: isActive });
    }

    // ==========================================
    // TRACKS
    // ==========================================
    async getTracks(limit = 50, offset = 0) {
        const { data, error } = await supabase
            .from('tracks')
            .select(`
                *,
                profiles:artist_id (id, username, stage_name, avatar_url)
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data;
    }

    async getTrackById(id) {
        const { data, error } = await supabase
            .from('tracks')
            .select(`
                *,
                profiles:artist_id (id, username, stage_name, avatar_url)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    async updateTrack(id, updates) {
        const { data, error } = await supabase
            .from('tracks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        clearCache();
        return data;
    }

    async deleteTrack(id) {
        const { error } = await supabase
            .from('tracks')
            .delete()
            .eq('id', id);

        if (error) throw error;
        clearCache();
    }

    async approveTrack(id) {
        return await this.updateTrack(id, { status: 'active', is_approved: true });
    }

    async rejectTrack(id, reason = '') {
        return await this.updateTrack(id, { status: 'rejected', rejection_reason: reason });
    }

    async featureTrack(id, featured = true) {
        return await this.updateTrack(id, { is_trending: featured });
    }

    // ==========================================
    // TOURNAMENTS
    // ==========================================
    async getTournaments() {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .order('start_date', { ascending: false });

        if (error) throw error;
        return data;
    }

    async getActiveTournament() {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('status', 'active')
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async createTournament(tournament) {
        const { data, error } = await supabase
            .from('tournaments')
            .insert(tournament)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateTournament(id, updates) {
        const { data, error } = await supabase
            .from('tournaments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ==========================================
    // MATCHES
    // ==========================================
    async getMatches(tournamentId) {
        const { data, error } = await supabase
            .from('tournament_matches')
            .select(`
                *,
                participant_a:profiles!tournament_matches_participant_a_id_fkey(id, username, stage_name, avatar_url),
                participant_b:profiles!tournament_matches_participant_b_id_fkey(id, username, stage_name, avatar_url)
            `)
            .eq('tournament_id', tournamentId)
            .order('match_number', { ascending: true });

        if (error) throw error;
        return data;
    }

    async updateMatch(id, updates) {
        const { data, error } = await supabase
            .from('tournament_matches')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ==========================================
    // REALTIME
    // ==========================================
    subscribeToUpdates(callback) {
        this.channel = supabase
            .channel('admin-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles'
            }, payload => {
                callback({ type: 'profiles', payload });
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tracks'
            }, payload => {
                callback({ type: 'tracks', payload });
            })
            .subscribe();

        return this.channel;
    }

    unsubscribe() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }

    // ==========================================
    // REPORTS
    // ==========================================
    async generateReport(type = 'full') {
        const stats = await this.getGlobalStats();
        const recentUsers = await this.getRecentUsers(50);
        const tracks = await this.getTracks(100);

        return {
            generated_at: new Date().toISOString(),
            type,
            stats,
            recent_users: recentUsers,
            tracks_count: tracks.length,
            data: { stats, recentUsers, tracks }
        };
    }
}

export const adminApi = new AdminApi();