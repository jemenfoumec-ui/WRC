// ==========================================
// SUPABASE CLIENT - Version Sans Bundler
// ==========================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { supabaseConfig } from './config.js';

// Utilisation de la config
const supabaseUrl = supabaseConfig.url;
const supabaseKey = supabaseConfig.key;

// Vérification
if (!supabaseUrl || !supabaseKey) {
    throw new Error('❌ Configuration Supabase invalide');
}

console.log('✅ Supabase Client initialisé');

// ==========================================
// CRÉATION DU CLIENT
// ==========================================
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// ==========================================
// SYSTÈME DE CACHE
// ==========================================
class CacheManager {
    constructor(maxSize = 100, defaultTTL = 60000) {
        this.cache = new Map();
        this.timestamps = new Map();
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
        
        setInterval(() => this.cleanup(), 300000);
    }

    set(key, value, ttl = this.defaultTTL) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.timestamps.keys().next().value;
            this.delete(oldestKey);
        }
        
        this.cache.set(key, value);
        this.timestamps.set(key, { created: Date.now(), ttl });
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        
        const timestamp = this.timestamps.get(key);
        if (!timestamp) return null;
        
        if (Date.now() - timestamp.created > timestamp.ttl) {
            this.delete(key);
            return null;
        }
        
        return this.cache.get(key);
    }

    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
    }

    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, timestamp] of this.timestamps.entries()) {
            if (now - timestamp.created > timestamp.ttl) {
                this.delete(key);
            }
        }
    }
}

export const cacheManager = new CacheManager(100, 60000);

export async function getCachedData(key, fetchFunction, ttl) {
    const cached = cacheManager.get(key);
    if (cached) {
        console.log(`📦 Cache HIT: ${key}`);
        return cached;
    }
    
    console.log(`📄 Cache MISS: ${key}`);
    const result = await fetchFunction();
    cacheManager.set(key, result, ttl);
    return result;
}

export function clearCache(key = null) {
    if (key) {
        cacheManager.delete(key);
    } else {
        cacheManager.clear();
    }
}

// ==========================================
// FONCTIONS API
// ==========================================

export async function fetchTracks(page = 0, limit = 20, filter = 'all') {
    try {
        const from = page * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('tracks')
            .select('*', { count: 'exact' });

        if (filter === 'trending') {
            query = query.eq('is_trending', true);
        } else if (filter === 'new') {
            query = query.order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        return { data, error: null, count };
        
    } catch (error) {
        console.error('Erreur fetchTracks:', error);
        return { data: null, error, count: 0 };
    }
}

export async function fetchLeaderboard(limit = 5) {
    return await getCachedData(`leaderboard_${limit}`, async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, votes_received, country')
            .eq('role', 'artist')
            .order('votes_received', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    }, 30000);
}

export async function uploadTrack(file, userId, metadata) {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/x-m4a', 'audio/mp4'];
    const maxSize = 15 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
        throw new Error('Format non supporté. Utilisez MP3, WAV ou M4A.');
    }

    if (file.size > maxSize) {
        throw new Error('Fichier trop lourd (max 15MB)');
    }

    const sanitizedTitle = metadata.title.trim().substring(0, 100);
    const sanitizedDuration = metadata.duration.trim();
    
    if (sanitizedTitle.length < 2) {
        throw new Error('Titre trop court (min 2 caractères)');
    }
    
    if (!/^[0-5]?\d:[0-5]\d$/.test(sanitizedDuration)) {
        throw new Error('Format durée invalide (MM:SS)');
    }

    const fileExt = file.name.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${userId}/${timestamp}_${random}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tracks')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('tracks')
        .getPublicUrl(fileName);

    const { error: dbError } = await supabase.from('tracks').insert([{
        artist_id: userId,
        title: sanitizedTitle,
        duration: sanitizedDuration,
        file_url: publicUrl,
        votes_count: 0,
        is_trending: false
    }]);

    if (dbError) {
        await supabase.storage.from('tracks').remove([fileName]);
        throw dbError;
    }

    clearCache();
    return publicUrl;
}

export async function deleteTrack(trackId, userId) {
    const { data: track, error: fetchError } = await supabase
        .from('tracks')
        .select('file_url, artist_id')
        .eq('id', trackId)
        .single();

    if (fetchError) throw new Error('Track introuvable');
    if (!track) throw new Error('Track inexistante');
    if (track.artist_id !== userId) throw new Error('Non autorisé');

    const { error: dbError } = await supabase
        .from('tracks')
        .delete()
        .eq('id', trackId)
        .eq('artist_id', userId);

    if (dbError) throw dbError;

    if (track.file_url) {
        const filePath = track.file_url.split('/storage/v1/object/public/tracks/')[1];
        if (filePath) {
            await supabase.storage.from('tracks').remove([filePath]);
        }
    }

    clearCache();
}

export async function voteForTrackRPC(trackId, userId) {
    if (!trackId || !userId) {
        throw new Error('Paramètres manquants');
    }

    const { data, error } = await supabase.rpc('vote_for_track', {
        p_track_id: trackId,
        p_user_id: userId
    });

    if (error) throw error;
    
    clearCache();
    return data;
}

console.log('✅ Supabase Client prêt');

// Réutiliser le même client pour éviter les conflits GoTrueClient
export const supabaseOptimized = supabase;

// Cache intelligent avec TTL adaptatif
class SmartCache {
    constructor() {
        this.cache = new Map();
        this.hitCount = new Map();
        this.maxSize = 200;
        this.baseTTL = 30000;
    }
    
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            // LRU: Supprimer l'entrée la moins utilisée
            const leastUsed = [...this.hitCount.entries()]
                .sort((a, b) => a[1] - b[1])[0];
            if (leastUsed) {
                this.cache.delete(leastUsed[0]);
                this.hitCount.delete(leastUsed[0]);
            }
        }
        
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: this.calculateTTL(key)
        });
    }
    
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        // Incrémenter le compteur de hits
        this.hitCount.set(key, (this.hitCount.get(key) || 0) + 1);
        
        return entry.value;
    }
    
    calculateTTL(key) {
        // TTL adaptatif basé sur la fréquence d'accès
        const hits = this.hitCount.get(key) || 0;
        return this.baseTTL + (hits * 5000); // +5s par hit
    }
}

export const smartCache = new SmartCache();

// Batch fetching pour réduire les requêtes
export async function batchFetch(ids, table, batchSize = 50) {
    const results = [];
    
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .in('id', batch);
        
        if (!error && data) {
            results.push(...data);
        }
    }
    
    return results;
}

// Debounce pour les updates en temps réel
export function debounceUpdate(fn, delay = 100) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

console.log('✅ Supabase optimisé pour 1000+ users');