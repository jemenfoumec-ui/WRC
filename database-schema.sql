-- =============================================
-- WRC 2026 - RESET COMPLET BASE DE DONNÉES
-- ⚠️ ATTENTION: Supprime toutes les données !
-- Exécuter dans Supabase SQL Editor
-- =============================================

-- =============================================
-- 0. NETTOYAGE COMPLET
-- =============================================

-- Supprimer les triggers d'abord
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_track_change ON tracks;
DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
DROP TRIGGER IF EXISTS set_updated_at_tracks ON tracks;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_tracks_count() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS vote_for_track(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS vote_for_battle(UUID, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_global_stats() CASCADE;

-- Supprimer les vues
DROP VIEW IF EXISTS v_artists_ranking CASCADE;
DROP VIEW IF EXISTS v_tracks_with_artists CASCADE;
DROP VIEW IF EXISTS v_active_battles CASCADE;

-- Supprimer les index
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_country;
DROP INDEX IF EXISTS idx_profiles_votes;
DROP INDEX IF EXISTS idx_profiles_active;
DROP INDEX IF EXISTS idx_tracks_artist;
DROP INDEX IF EXISTS idx_tracks_votes;
DROP INDEX IF EXISTS idx_tracks_status;
DROP INDEX IF EXISTS idx_tracks_trending;
DROP INDEX IF EXISTS idx_votes_user;
DROP INDEX IF EXISTS idx_votes_track;
DROP INDEX IF EXISTS idx_votes_artist;
DROP INDEX IF EXISTS idx_battles_status;
DROP INDEX IF EXISTS idx_battles_tournament;
DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS votes_user_track_unique;

-- Supprimer les tables (ordre inverse des dépendances)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS tournament_registrations CASCADE;
DROP TABLE IF EXISTS battles CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS tracks CASCADE;
DROP TABLE IF EXISTS global_stats CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =============================================
-- 1. TABLES PRINCIPALES
-- =============================================

-- Table des profils utilisateurs
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    stage_name TEXT,
    role TEXT DEFAULT 'fan' CHECK (role IN ('fan', 'artist', 'jury', 'admin')),
    avatar_url TEXT,
    country TEXT DEFAULT 'FR',
    city TEXT,
    bio TEXT,
    social_links JSONB DEFAULT '{}',
    votes_received INTEGER DEFAULT 0,
    votes_given INTEGER DEFAULT 0,
    tracks_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    tournament_status TEXT DEFAULT 'pending' CHECK (tournament_status IN ('pending', 'registered', 'qualified', 'eliminated', 'champion')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des morceaux
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    duration TEXT,
    file_url TEXT NOT NULL,
    cover_url TEXT,
    votes_count INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    is_trending BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des votes
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    vote_type TEXT DEFAULT 'track' CHECK (vote_type IN ('track', 'battle', 'jury')),
    weight INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte unique séparée (plus flexible)
CREATE UNIQUE INDEX votes_user_track_unique ON votes(user_id, track_id) WHERE track_id IS NOT NULL;

-- Table des tournois
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    status TEXT DEFAULT 'registration' CHECK (status IN ('registration', 'qualification', 'battles', 'finals', 'completed')),
    current_round INTEGER DEFAULT 0,
    max_participants INTEGER DEFAULT 64,
    registration_start TIMESTAMPTZ,
    registration_end TIMESTAMPTZ,
    tournament_start TIMESTAMPTZ,
    tournament_end TIMESTAMPTZ,
    prize_pool DECIMAL(10,2) DEFAULT 0,
    rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des battles/matchups
CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    artist_1_id UUID REFERENCES profiles(id),
    artist_2_id UUID REFERENCES profiles(id),
    artist_1_score INTEGER DEFAULT 0,
    artist_2_score INTEGER DEFAULT 0,
    winner_id UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'voting', 'completed')),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des inscriptions tournoi
CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    qualification_score INTEGER DEFAULT 0,
    seed INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, artist_id)
);

-- Table des notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des stats globales
CREATE TABLE global_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_artists INTEGER DEFAULT 0,
    total_tracks INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    active_battles INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. INDEX POUR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_country ON profiles(country);
CREATE INDEX idx_profiles_votes ON profiles(votes_received DESC);
CREATE INDEX idx_profiles_active ON profiles(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_tracks_artist ON tracks(artist_id);
CREATE INDEX idx_tracks_votes ON tracks(votes_count DESC);
CREATE INDEX idx_tracks_status ON tracks(status);
CREATE INDEX idx_tracks_trending ON tracks(is_trending) WHERE is_trending = TRUE;

CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_track ON votes(track_id);
CREATE INDEX idx_votes_artist ON votes(artist_id);

CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_tournament ON battles(tournament_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- =============================================
-- 3. FONCTIONS RPC
-- =============================================

-- Fonction pour voter pour un track
CREATE OR REPLACE FUNCTION vote_for_track(p_track_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_artist_id UUID;
    v_existing_vote UUID;
BEGIN
    -- Vérifier si le vote existe déjà
    SELECT id INTO v_existing_vote
    FROM votes
    WHERE user_id = p_user_id AND track_id = p_track_id;
    
    IF v_existing_vote IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vous avez déjà voté pour ce track');
    END IF;
    
    -- Récupérer l'artiste du track
    SELECT artist_id INTO v_artist_id
    FROM tracks
    WHERE id = p_track_id;
    
    IF v_artist_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Track introuvable');
    END IF;
    
    -- Empêcher l'auto-vote
    IF v_artist_id = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vous ne pouvez pas voter pour votre propre track');
    END IF;
    
    -- Insérer le vote
    INSERT INTO votes (user_id, track_id, artist_id, vote_type)
    VALUES (p_user_id, p_track_id, v_artist_id, 'track');
    
    -- Mettre à jour le compteur du track
    UPDATE tracks
    SET votes_count = votes_count + 1, updated_at = NOW()
    WHERE id = p_track_id;
    
    -- Mettre à jour les stats de l'artiste
    UPDATE profiles
    SET votes_received = votes_received + 1, updated_at = NOW()
    WHERE id = v_artist_id;
    
    -- Mettre à jour les stats du votant
    UPDATE profiles
    SET votes_given = votes_given + 1, updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Mettre à jour les stats globales
    UPDATE global_stats
    SET total_votes = total_votes + 1, updated_at = NOW()
    WHERE id = 1;
    
    RETURN jsonb_build_object('success', true, 'message', 'Vote enregistré !');
END;
$$;

-- Fonction pour les stats globales
CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_artists', (SELECT COUNT(*) FROM profiles WHERE role = 'artist' AND is_active = TRUE),
        'total_tracks', (SELECT COUNT(*) FROM tracks WHERE status = 'active'),
        'total_votes', (SELECT COALESCE(SUM(votes_received), 0) FROM profiles),
        'total_users', (SELECT COUNT(*) FROM profiles WHERE is_active = TRUE),
        'active_battles', (SELECT COUNT(*) FROM battles WHERE status IN ('live', 'voting')),
        'countries_active', (SELECT COUNT(DISTINCT country) FROM profiles WHERE role = 'artist' AND is_active = TRUE)
    ) INTO v_stats;
    
    RETURN v_stats;
END;
$$;

-- Fonction pour récupérer le leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(p_country TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    username TEXT,
    stage_name TEXT,
    avatar_url TEXT,
    country TEXT,
    votes_received INTEGER,
    tracks_count INTEGER,
    rank BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.stage_name,
        p.avatar_url,
        p.country,
        p.votes_received,
        p.tracks_count,
        ROW_NUMBER() OVER (ORDER BY p.votes_received DESC) as rank
    FROM profiles p
    WHERE p.role = 'artist'
    AND p.is_active = TRUE
    AND (p_country IS NULL OR p.country = p_country)
    ORDER BY p.votes_received DESC
    LIMIT p_limit;
END;
$$;

-- =============================================
-- 4. TRIGGERS
-- =============================================

-- Trigger pour créer un profil après inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO profiles (id, email, username, role, stage_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'fan'),
        NEW.raw_user_meta_data->>'stage_name'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, profiles.username),
        updated_at = NOW();
    
    -- Mettre à jour les stats globales
    UPDATE global_stats SET total_users = total_users + 1, updated_at = NOW() WHERE id = 1;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger pour mettre à jour tracks_count
CREATE OR REPLACE FUNCTION update_tracks_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles SET tracks_count = tracks_count + 1, updated_at = NOW() WHERE id = NEW.artist_id;
        UPDATE global_stats SET total_tracks = total_tracks + 1, updated_at = NOW() WHERE id = 1;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles SET tracks_count = GREATEST(tracks_count - 1, 0), updated_at = NOW() WHERE id = OLD.artist_id;
        UPDATE global_stats SET total_tracks = GREATEST(total_tracks - 1, 0), updated_at = NOW() WHERE id = 1;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER on_track_change
    AFTER INSERT OR DELETE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_tracks_count();

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_tracks
    BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: lecture publique, modification par propriétaire
CREATE POLICY "Profiles: lecture publique" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: insert par auth" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update par propriétaire" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tracks: lecture publique des actifs, CRUD par artiste
CREATE POLICY "Tracks: lecture publique" ON tracks FOR SELECT USING (status = 'active' OR artist_id = auth.uid());
CREATE POLICY "Tracks: insert par artiste" ON tracks FOR INSERT WITH CHECK (artist_id = auth.uid());
CREATE POLICY "Tracks: update par artiste" ON tracks FOR UPDATE USING (artist_id = auth.uid());
CREATE POLICY "Tracks: delete par artiste" ON tracks FOR DELETE USING (artist_id = auth.uid());

-- Votes: lecture par votant, insert par auth
CREATE POLICY "Votes: lecture par votant" ON votes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Votes: insert par auth" ON votes FOR INSERT WITH CHECK (user_id = auth.uid());

-- Battles: lecture publique
CREATE POLICY "Battles: lecture publique" ON battles FOR SELECT USING (true);

-- Tournaments: lecture publique
CREATE POLICY "Tournaments: lecture publique" ON tournaments FOR SELECT USING (true);

-- Tournament registrations: lecture publique, insert par auth
CREATE POLICY "Registrations: lecture publique" ON tournament_registrations FOR SELECT USING (true);
CREATE POLICY "Registrations: insert par auth" ON tournament_registrations FOR INSERT WITH CHECK (artist_id = auth.uid());

-- Notifications: lecture/update par destinataire
CREATE POLICY "Notifications: lecture par destinataire" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Notifications: update par destinataire" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Global stats: lecture publique
CREATE POLICY "Stats: lecture publique" ON global_stats FOR SELECT USING (true);

-- =============================================
-- 6. DONNÉES INITIALES
-- =============================================

-- Initialiser les stats globales
INSERT INTO global_stats (id, total_artists, total_tracks, total_votes, total_users)
VALUES (1, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Créer le tournoi France 2026
INSERT INTO tournaments (name, country, status, registration_start, registration_end, tournament_start, prize_pool)
VALUES (
    'WRC France 2026',
    'FR',
    'registration',
    NOW(),
    NOW() + INTERVAL '60 days',
    NOW() + INTERVAL '90 days',
    50000.00
);

-- =============================================
-- 7. VUES UTILES
-- =============================================

CREATE OR REPLACE VIEW v_artists_ranking AS
SELECT 
    p.id,
    p.username,
    p.stage_name,
    p.avatar_url,
    p.country,
    p.city,
    p.votes_received,
    p.tracks_count,
    p.tournament_status,
    ROW_NUMBER() OVER (ORDER BY p.votes_received DESC) as global_rank,
    ROW_NUMBER() OVER (PARTITION BY p.country ORDER BY p.votes_received DESC) as country_rank
FROM profiles p
WHERE p.role = 'artist' AND p.is_active = TRUE;

CREATE OR REPLACE VIEW v_tracks_with_artists AS
SELECT 
    t.*,
    p.username as artist_username,
    p.stage_name as artist_stage_name,
    p.avatar_url as artist_avatar,
    p.country as artist_country
FROM tracks t
JOIN profiles p ON t.artist_id = p.id
WHERE t.status = 'active';

-- =============================================
-- ✅ TERMINÉ !
-- =============================================
SELECT 'Base de données WRC 2026 initialisée avec succès !' as status;
