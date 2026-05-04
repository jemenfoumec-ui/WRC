/**
 * WRC 2026 - Core Module Index
 * Barrel export for core modules
 */

export { supabaseConfig, appConfig, cacheConfig, rateLimits, protectedPages, adminEmails, storageKeys, logger } from './config.js';
export { supabase, cacheManager, smartCache, getCachedData, clearCache, fetchTracks, fetchLeaderboard, uploadTrack, deleteTrack, voteForTrackRPC, batchFetch, debounce, throttle } from './supabaseClient.js';

export default {
    config: {
        supabase: supabaseConfig,
        app: appConfig,
        cache: cacheConfig,
        rates: rateLimits,
        protectedPages,
        adminEmails,
        storageKeys,
        logger
    },
    supabase,
    cacheManager,
    smartCache,
    api: {
        fetchTracks,
        fetchLeaderboard,
        uploadTrack,
        deleteTrack,
        voteForTrackRPC,
        batchFetch
    },
    utils: {
        getCachedData,
        clearCache,
        debounce,
        throttle
    }
};