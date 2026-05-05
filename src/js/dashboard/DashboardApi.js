/**
 * WRC 2026 - Dashboard API Module
 */

import { supabase, clearCache } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';

export class DashboardApi {
    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    }

    async getProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    }

    async getStats() {
        try {
            const { data, error } = await supabase.rpc('get_global_stats');
            if (error) throw error;
            return data;
        } catch (error) {
            // Fallback
            const [artistsRes, tracksRes, votesRes] = await Promise.all([
                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'artist'),
                supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('profiles').select('votes_received').eq('role', 'artist')
            ]);
            
            return {
                total_artists: artistsRes.count || 0,
                total_tracks: tracksRes.count || 0,
                total_votes: votesRes.data?.reduce((sum, p) => sum + (p.votes_received || 0), 0) || 0
            };
        }
    }

    async getArtists(limit = 20) {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                id,
                username,
                stage_name,
                avatar_url,
                country,
                city,
                votes_received,
                tracks_count,
                tracks (
                    id,
                    title,
                    file_url,
                    votes_count,
                    duration
                )
            `)
            .eq('role', 'artist')
            .eq('is_active', true)
            .order('votes_received', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    }

    async voteForTrack(trackId, userId) {
        const { data, error } = await supabase.rpc('vote_for_track', {
            p_track_id: trackId,
            p_user_id: userId
        });
        if (error) throw error;
        clearCache();
        return data;
    }

    subscribeToChanges(callback) {
        const profilesChannel = supabase
            .channel('profiles-changes')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: 'role=eq.artist'
            }, (payload) => callback('profile', payload))
            .subscribe();
        
        const tracksChannel = supabase
            .channel('tracks-changes')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'tracks'
            }, (payload) => callback('track', payload))
            .subscribe();

        return { profilesChannel, tracksChannel };
    }
}

export const dashboardApi = new DashboardApi();
