/**
 * WRC 2026 - Jury API Module
 * Supabase interactions for jury dashboard
 */

import { supabase, clearCache } from '../core/supabaseClient.js';
import { logger } from '../core/config.js';

export class JuryApi {
    constructor() {
        this.channel = null;
    }

    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    }

    async getUserStats(userId) {
        try {
            const { data: userRatings } = await supabase
                .from('ratings')
                .select('rating', { count: 'exact' })
                .eq('user_id', userId);
            
            const votesGiven = userRatings?.length || 0;
            const avgRating = userRatings?.length > 0 
                ? (userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length).toFixed(1)
                : '0.0';
            
            const { count: totalTracks } = await supabase
                .from('tracks')
                .select('*', { count: 'exact', head: true });
            
            return {
                votesGiven,
                avgRating,
                totalTracks: totalTracks || 0,
                tracksToVote: Math.max(0, (totalTracks || 0) - votesGiven)
            };
        } catch (error) {
            logger.error('getUserStats error:', error);
            throw error;
        }
    }

    async fetchTracks({ page = 0, itemsPerPage = 20, filter = 'all', sort = 'rating_desc', userId = null }) {
        let query = supabase
            .from('tracks')
            .select('id, title, duration, average_rating, ratings_count, created_at, file_url, artist_id, cover_url');

        // Apply filters
        if (filter === 'trending') {
            query = query.gte('ratings_count', 3).order('average_rating', { ascending: false });
        } else if (filter === 'voted' && userId) {
            const { data: ratedIds } = await supabase
                .from('ratings')
                .select('track_id')
                .eq('user_id', userId);
            
            const rated = ratedIds?.map(r => r.track_id) || [];
            if (rated.length > 0) {
                query = query.in('id', rated);
            } else {
                return [];
            }
        }

        // Apply sorting
        switch(sort) {
            case 'rating_desc':
                query = query.order('average_rating', { ascending: false })
                             .order('ratings_count', { ascending: false });
                break;
            case 'rating_asc':
                query = query.order('average_rating', { ascending: true });
                break;
            case 'recent':
                query = query.order('created_at', { ascending: false });
                break;
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'popular':
                query = query.order('ratings_count', { ascending: false });
                break;
            case 'alpha':
                query = query.order('title', { ascending: true });
                break;
            default:
                query = query.order('average_rating', { ascending: false });
        }

        query = query.range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async getProfiles(artistIds) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, social_spotify, social_youtube, social_instagram, social_tiktok, social_soundcloud')
            .in('id', artistIds);
        
        if (error) throw error;
        return data;
    }

    async getUserRating(userId, trackId) {
        const { data } = await supabase
            .from('ratings')
            .select('rating')
            .eq('user_id', userId)
            .eq('track_id', trackId)
            .maybeSingle();
        
        return data?.rating || null;
    }

    async rateTrack(trackId, userId, rating) {
        const { data, error } = await supabase.rpc('rate_track', {
            p_track_id: trackId,
            p_user_id: userId,
            p_rating: rating
        });

        if (error) throw error;
        clearCache();
        return data;
    }

    subscribeToTrackUpdates(callback) {
        this.channel = supabase
            .channel('public:tracks')
            .on('postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'tracks' 
                }, 
                payload => callback(payload)
            )
            .subscribe();
        
        return this.channel;
    }

    unsubscribe() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }
}

export const juryApi = new JuryApi();
