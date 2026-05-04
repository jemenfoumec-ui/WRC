/**
 * WRC 2026 - Arena Audio Module
 * Audio playback and sync for tournament arena
 */

import { logger } from '../core/config.js';

// ==========================================
// ARENA AUDIO CLASS
// ==========================================
export class ArenaAudio {
    constructor() {
        this.audioA = null;
        this.audioB = null;
        this.currentAudio = null;
        this.currentPhase = 'WAITING';
        this.volume = 0.8;
        this.isMuted = false;
        this.isUnlocked = false;
        
        this.onProgressUpdate = null;
        this.onEnded = null;
        this.onUnlockNeeded = null;
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    init(audioA, audioB) {
        this.audioA = audioA;
        this.audioB = audioB;
        
        if (!this.audioA || !this.audioB) {
            logger.error('Audio elements not found');
            return;
        }

        [this.audioA, this.audioB].forEach(audio => {
            audio.volume = this.volume;
            audio.preload = 'auto';
            
            audio.addEventListener('timeupdate', () => this.handleTimeUpdate(audio));
            audio.addEventListener('ended', () => this.handleEnded());
            audio.addEventListener('error', (e) => logger.error('Audio error:', e));
        });

        logger.info('Arena audio initialized');
    }

    // ==========================================
    // PLAYBACK CONTROL
    // ==========================================
    playTrackA(trackUrl) {
        if (!this.audioA || !trackUrl) return;

        this.stopAll();
        this.currentPhase = 'TRACK_A';
        this.currentAudio = this.audioA;
        this.audioA.src = trackUrl;

        if (this.isUnlocked) {
            this.audioA.play().catch(e => {
                logger.warn('Autoplay blocked:', e.message);
                this.requestUnlock();
            });
        } else {
            this.requestUnlock();
        }
    }

    playTrackB(trackUrl) {
        if (!this.audioB || !trackUrl) return;

        this.stopAll();
        this.currentPhase = 'TRACK_B';
        this.currentAudio = this.audioB;
        this.audioB.src = trackUrl;

        if (this.isUnlocked) {
            this.audioB.play().catch(e => {
                logger.warn('Autoplay blocked:', e.message);
                this.requestUnlock();
            });
        } else {
            this.requestUnlock();
        }
    }

    stopAll() {
        if (this.audioA) {
            this.audioA.pause();
            this.audioA.currentTime = 0;
        }
        if (this.audioB) {
            this.audioB.pause();
            this.audioB.currentTime = 0;
        }
    }

    pause() {
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
    }

    resume() {
        if (this.currentAudio && this.isUnlocked) {
            this.currentAudio.play().catch(console.warn);
        }
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.audioA) this.audioA.volume = this.isMuted ? 0 : this.volume;
        if (this.audioB) this.audioB.volume = this.isMuted ? 0 : this.volume;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const vol = this.isMuted ? 0 : this.volume;
        if (this.audioA) this.audioA.volume = vol;
        if (this.audioB) this.audioB.volume = vol;
        return this.isMuted;
    }

    // ==========================================
    // UNLOCK HANDLING
    // ==========================================
    unlock() {
        this.isUnlocked = true;
        if (this.currentAudio) {
            this.currentAudio.play().catch(console.warn);
        }
    }

    requestUnlock() {
        if (this.onUnlockNeeded) {
            this.onUnlockNeeded();
        }
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    handleTimeUpdate(audio) {
        if (this.onProgressUpdate) {
            this.onProgressUpdate({
                currentTime: audio.currentTime,
                duration: audio.duration || 0,
                phase: this.currentPhase
            });
        }
    }

    handleEnded() {
        if (this.onEnded) {
            this.onEnded(this.currentPhase);
        }
    }

    // ==========================================
    // HELPERS
    // ==========================================
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getProgress() {
        if (!this.currentAudio) return { percent: 0, current: 0, duration: 0 };
        
        const current = this.currentAudio.currentTime;
        const duration = this.currentAudio.duration || 0;
        const percent = duration ? (current / duration) * 100 : 0;

        return { percent, current, duration };
    }

    destroy() {
        this.stopAll();
        if (this.audioA) {
            this.audioA.src = '';
            this.audioA.removeEventListener('timeupdate', this.handleTimeUpdate);
        }
        if (this.audioB) {
            this.audioB.src = '';
            this.audioB.removeEventListener('timeupdate', this.handleTimeUpdate);
        }
    }
}

export const arenaAudio = new ArenaAudio();