// ==========================================
// PLAYER AUDIO GLOBAL - VERSION COMPLÈTE
// Avec gestion des covers + Navigation + Repeat + Raccourcis clavier
// ==========================================

class GlobalAudioPlayer {
    constructor() {
        console.log("🎛️ Player Global Initialisé (Anti-Sauts + Navigation)");

        this.audio = document.getElementById('globalAudioElement');
        this.playerContainer = document.getElementById('globalPlayer');
        
        if (!this.audio || !this.playerContainer) {
            console.warn("⚠️ Éléments audio non trouvés");
            return;
        }
        
        // Éléments UI
        this.btnPlay = document.getElementById('playerPlayPauseBtn');
        this.progressBar = document.getElementById('playerProgressBar');
        this.progressContainer = document.getElementById('playerProgressContainer');
        this.txtCurrent = document.getElementById('playerCurrentTime');
        this.txtTotal = document.getElementById('playerTotalTime');
        this.txtTitle = document.getElementById('playerTrackTitle');
        this.txtArtist = document.getElementById('playerTrackArtist');
        this.sliderVolume = document.getElementById('playerVolumeSlider');
        this.btnClose = document.getElementById('playerCloseBtn');
        this.btnNext = document.getElementById('playerNextBtn');
        this.btnPrev = document.getElementById('playerPrevBtn');
        this.trackArtwork = document.querySelector('.track-artwork');
        this.artworkIcon = document.querySelector('.artwork-icon');

        // État
        this.isPlaying = false;
        this.currentTrack = null;
        this.currentCover = null;
        this.playlist = [];
        this.currentIndex = -1;
        this.isRestoring = false;
        this.lastSavedTime = 0;
        this.repeatMode = 'off'; // 'off', 'all', 'one'
        
        // Identifiant unique pour synchronisation cross-tab
        this.playerId = 'wrc_player_' + Date.now();
        
        this.init();
        this.restoreState();
        this.setupCrossPersistence();
        this.createRepeatButton();
    }

    init() {
        this.bindEvents();
        this.initVolume();
        this.setupMediaSession();
    }

    // ==========================================
    // CRÉATION DU BOUTON REPEAT
    // ==========================================
    createRepeatButton() {
        const actionsDiv = document.querySelector('.player-actions');
        if (!actionsDiv) return;

        const repeatBtn = document.createElement('button');
        repeatBtn.className = 'control-btn btn-repeat';
        repeatBtn.id = 'playerRepeatBtn';
        repeatBtn.title = 'Mode répétition';
        repeatBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            <span class="repeat-badge" style="display: none; position: absolute; top: 2px; right: 2px; background: var(--primary); color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; display: flex; align-items: center; justify-content: center; font-weight: bold;">1</span>
        `;

        // Insérer avant le bouton volume
        const volumeDiv = actionsDiv.querySelector('.player-volume');
        if (volumeDiv) {
            actionsDiv.insertBefore(repeatBtn, volumeDiv);
        } else {
            actionsDiv.insertBefore(repeatBtn, actionsDiv.firstChild);
        }

        repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.btnRepeat = repeatBtn;

        console.log('✅ Bouton repeat créé');
    }

    // ==========================================
    // GESTION DU MODE REPEAT
    // ==========================================
    toggleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIdx = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIdx + 1) % modes.length];
        
        this.updateRepeatUI();
        this.saveState();
        
        const messages = {
            'off': 'Répétition désactivée',
            'all': 'Répéter la playlist',
            'one': 'Répéter la track actuelle'
        };
        
        if (window.toast) {
            window.toast.info('Mode répétition', messages[this.repeatMode]);
        }
        
        console.log('🔁 Mode repeat:', this.repeatMode);
    }

    updateRepeatUI() {
        if (!this.btnRepeat) return;

        const badge = this.btnRepeat.querySelector('.repeat-badge');
        
        if (this.repeatMode === 'off') {
            this.btnRepeat.style.opacity = '0.5';
            this.btnRepeat.style.color = 'white';
            if (badge) badge.style.display = 'none';
        } else if (this.repeatMode === 'all') {
            this.btnRepeat.style.opacity = '1';
            this.btnRepeat.style.color = 'var(--primary-glow)';
            if (badge) badge.style.display = 'none';
        } else if (this.repeatMode === 'one') {
            this.btnRepeat.style.opacity = '1';
            this.btnRepeat.style.color = 'var(--primary-glow)';
            if (badge) badge.style.display = 'flex';
        }
    }

    // ==========================================
    // SYSTÈME DE PERSISTANCE
    // ==========================================
    
    saveState() {
        if (!this.currentTrack || this.isRestoring) return;
        
        const now = Date.now();
        if (now - this.lastSavedTime < 1000) return;
        this.lastSavedTime = now;
        
        const state = {
            url: this.currentTrack,
            title: this.txtTitle?.innerText || 'Titre',
            artist: this.txtArtist?.innerText || 'Artiste',
            coverUrl: this.currentCover,
            currentTime: this.audio.currentTime,
            duration: this.audio.duration,
            isPlaying: this.isPlaying && !this.audio.paused,
            volume: this.audio.volume,
            timestamp: Date.now(),
            playerId: this.playerId,
            readyState: this.audio.readyState,
            buffered: this.audio.buffered.length > 0 ? this.audio.buffered.end(0) : 0,
            repeatMode: this.repeatMode,
            playlist: this.playlist,
            currentIndex: this.currentIndex
        };
        
        try {
            sessionStorage.setItem('wrc_player_state', JSON.stringify(state));
            localStorage.setItem('wrc_player_backup', JSON.stringify(state));
        } catch (e) {
            console.warn('Impossible de sauvegarder l\'état du player:', e);
        }
    }

    restoreState() {
        try {
            let saved = sessionStorage.getItem('wrc_player_state');
            if (!saved) {
                saved = localStorage.getItem('wrc_player_backup');
                if (saved) {
                    console.log('📦 Restauration depuis le backup localStorage');
                }
            }
            
            if (!saved) return;

            const state = JSON.parse(saved);
            
            // Ne restaurer que si récent (< 30 minutes)
            if (Date.now() - state.timestamp > 1800000) {
                console.log('⏰ État trop ancien, ignoré');
                sessionStorage.removeItem('wrc_player_state');
                localStorage.removeItem('wrc_player_backup');
                return;
            }

            if (state.playerId === this.playerId) {
                console.log('🔄 Même instance, pas de restauration nécessaire');
                return;
            }

            console.log('🔄 Restauration de l\'état du player:', {
                title: state.title,
                time: state.currentTime?.toFixed(2),
                playing: state.isPlaying,
                cover: state.coverUrl
            });

            this.isRestoring = true;

            // Restaurer la track
            this.currentTrack = state.url;
            this.currentCover = state.coverUrl;
            this.audio.src = state.url;
            
            if (this.txtTitle) this.txtTitle.innerText = state.title;
            if (this.txtArtist) this.txtArtist.innerText = state.artist;
            
            // ✅ Restaurer la cover
            this.updateArtwork(state.coverUrl);
            
            // ✅ Restaurer la playlist et le mode repeat
            if (state.playlist && Array.isArray(state.playlist)) {
                this.playlist = state.playlist;
                this.currentIndex = state.currentIndex || 0;
                console.log('📂 Playlist restaurée:', this.playlist.length, 'tracks');
            }
            
            if (state.repeatMode) {
                this.repeatMode = state.repeatMode;
                this.updateRepeatUI();
                console.log('🔁 Mode repeat restauré:', this.repeatMode);
            }
            
            this.updateNavigationButtons();
            
            // Restaurer le volume
            this.audio.volume = state.volume || 0.8;
            if (this.sliderVolume) this.sliderVolume.value = (state.volume || 0.8) * 100;
            
            this.show();
            this.restorePositionPrecise(state);

        } catch (e) {
            console.warn('Erreur restauration:', e);
            sessionStorage.removeItem('wrc_player_state');
            localStorage.removeItem('wrc_player_backup');
        }
    }

    // ==========================================
    // RESTAURATION PRÉCISE DE LA POSITION
    // ==========================================
    async restorePositionPrecise(state) {
        return new Promise((resolve) => {
            const events = ['loadedmetadata', 'canplay', 'canplaythrough'];
            let restored = false;

            const restorePosition = () => {
                if (restored) return;
                restored = true;

                const targetTime = Math.max(0, state.currentTime - 0.1);
                console.log(`⏱️ Restauration position: ${targetTime.toFixed(2)}s`);

                this.audio.currentTime = targetTime;

                const checkPosition = setInterval(() => {
                    const diff = Math.abs(this.audio.currentTime - targetTime);
                    if (diff > 0.5) {
                        console.log('🔧 Correction position:', this.audio.currentTime, '→', targetTime);
                        this.audio.currentTime = targetTime;
                    } else {
                        clearInterval(checkPosition);
                    }
                }, 100);

                setTimeout(() => clearInterval(checkPosition), 1000);

                if (state.isPlaying) {
                    setTimeout(() => {
                        const playPromise = this.audio.play();
                        if (playPromise !== undefined) {
                            playPromise
                                .then(() => {
                                    console.log('✅ Lecture reprise avec succès');
                                    this.isPlaying = true;
                                    this.updateIcon();
                                })
                                .catch(err => {
                                    console.log('⚠️ Lecture automatique bloquée:', err.message);
                                    this.isPlaying = false;
                                    this.updateIcon();
                                });
                        }
                    }, 100);
                }

                this.isRestoring = false;
                resolve();
            };

            events.forEach(event => {
                this.audio.addEventListener(event, restorePosition, { once: true });
            });

            setTimeout(() => {
                if (!restored) {
                    console.warn('⏰ Timeout restauration, fallback');
                    restorePosition();
                }
            }, 3000);
        });
    }

    // ==========================================
    // SYNCHRONISATION CROSS-TAB
    // ==========================================
    setupCrossPersistence() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'wrc_player_sync' && e.newValue) {
                try {
                    const state = JSON.parse(e.newValue);
                    
                    if (state.playerId === this.playerId) return;
                    
                    console.log('🔄 Sync depuis un autre onglet');
                    
                    if (state.url !== this.currentTrack && state.isPlaying) {
                        this.audio.pause();
                        this.isPlaying = false;
                        this.updateIcon();
                    }
                } catch (e) {
                    console.warn('Erreur sync cross-tab:', e);
                }
            }
        });
    }

    // ==========================================
    // SAUVEGARDE AVANT NAVIGATION
    // ==========================================
    setupNavigationPersistence() {
        window.addEventListener('beforeunload', () => {
            if (!this.isRestoring) {
                this.saveState();
            }
        });

        window.addEventListener('pagehide', () => {
            if (!this.isRestoring) {
                this.saveState();
            }
        });

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && !this.isRestoring) {
                this.saveState();
            }
        });
    }

    bindEvents() {
        if (this.btnPlay) {
            this.btnPlay.addEventListener('click', () => this.togglePlay());
        }

        if (this.btnNext) {
            this.btnNext.addEventListener('click', () => this.playNext());
        }
        if (this.btnPrev) {
            this.btnPrev.addEventListener('click', () => this.playPrev());
        }

        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
            
            if (Math.floor(this.audio.currentTime) % 3 === 0 && !this.isRestoring) {
                this.saveState();
            }
        });
        
        this.audio.addEventListener('loadedmetadata', () => {
            if (this.txtTotal) {
                this.txtTotal.textContent = this.formatTime(this.audio.duration);
            }
        });

        if (this.progressContainer) {
            this.progressContainer.addEventListener('click', (e) => this.seek(e));
        }

        if (this.sliderVolume) {
            this.sliderVolume.addEventListener('input', (e) => {
                this.audio.volume = e.target.value / 100;
                localStorage.setItem('wrc_volume', e.target.value);
                this.saveState();
            });
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => {
                this.hide();
                sessionStorage.removeItem('wrc_player_state');
                localStorage.removeItem('wrc_player_backup');
            });
        }

        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updateIcon();
            
            if (this.repeatMode === 'one') {
                // Répéter la track actuelle
                this.audio.currentTime = 0;
                this.audio.play()
                    .then(() => {
                        this.isPlaying = true;
                        this.updateIcon();
                    })
                    .catch(err => console.error('Erreur repeat:', err));
            } else if (this.repeatMode === 'all' && this.playlist.length > 0) {
                // Passer au suivant, ou recommencer la playlist
                if (this.currentIndex < this.playlist.length - 1) {
                    this.playNext();
                } else {
                    // Recommencer depuis le début
                    this.currentIndex = 0;
                    const first = this.playlist[0];
                    this.play(first.url, first.title, first.artist, first.coverUrl);
                }
            } else if (this.repeatMode === 'off' && this.playlist.length > 0 && this.currentIndex < this.playlist.length - 1) {
                // Mode normal: passer au suivant s'il existe
                this.playNext();
            } else {
                // Fin de la playlist
                if (this.progressBar) this.progressBar.style.width = '0%';
            }
        });

        this.audio.addEventListener('error', (e) => {
            console.error("Erreur audio:", e);
            this.isPlaying = false;
            this.updateIcon();
            if (window.toast) {
                toast.error("Erreur lecture", "Fichier audio introuvable");
            }
        });

        document.addEventListener('keydown', (e) => {
            // Ignorer si on est dans un champ de saisie
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.playPrev();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.playNext();
            }
        });

        setInterval(() => {
            if (this.isPlaying && !this.isRestoring) {
                this.saveState();
            }
        }, 5000);

        this.setupNavigationPersistence();
    }

    initVolume() {
        const savedVolume = localStorage.getItem('wrc_volume') || '80';
        if (this.sliderVolume) this.sliderVolume.value = savedVolume;
        this.audio.volume = savedVolume / 100;
    }

    setupMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.playPrev());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.playNext());
        }
    }

    // ==========================================
    // ✅ MÉTHODE PLAY AVEC GESTION DE COVER ET PLAYLIST AUTO
    // ==========================================
    play(url, title = 'Titre inconnu', artist = 'Artiste inconnu', coverUrl = null) {
        // ✅ NOUVEAU : Vérifier le verrouillage (arène de tournoi)
        if (this._isLocked) {
            console.log('⚠️ Lecture bloquée - player verrouillé (arène active)');
            return;
        }
        
        if (this.currentTrack === url && this.audio.src) {
            this.togglePlay();
            return;
        }

        console.log('🎵 Play:', { title, artist, coverUrl });

        this.currentTrack = url;
        this.currentCover = coverUrl;
        this.audio.src = url;
        
        // ✅ Mettre à jour l'index dans la playlist si la track existe
        const trackInPlaylist = this.playlist.findIndex(t => t.url === url);
        if (trackInPlaylist !== -1) {
            this.currentIndex = trackInPlaylist;
            console.log('📍 Position dans la playlist:', this.currentIndex + 1, '/', this.playlist.length);
        } else {
            // Si la track n'est pas dans la playlist, l'ajouter
            this.playlist.push({ url, title, artist, coverUrl });
            this.currentIndex = this.playlist.length - 1;
            console.log('➕ Track ajoutée à la playlist');
        }
        
        this.updateNavigationButtons();
        
        if (this.progressBar) this.progressBar.style.width = '0%';
        if (this.txtCurrent) this.txtCurrent.textContent = '0:00';
        if (this.txtTotal) this.txtTotal.textContent = '0:00';
        
        if (this.txtTitle) this.txtTitle.textContent = title;
        if (this.txtArtist) this.txtArtist.textContent = artist;
        
        // ✅ Mettre à jour l'artwork
        this.updateArtwork(coverUrl);
        
        // ✅ Media Session avec cover
        if ('mediaSession' in navigator) {
            const artworkArray = coverUrl 
                ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }]
                : [{ src: 'https://via.placeholder.com/512x512/7b2cbf/ffffff?text=WRC', sizes: '512x512', type: 'image/png' }];
            
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                album: 'WRC 2026',
                artwork: artworkArray
            });
        }

        this.show();

        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.isPlaying = true;
                    this.updateIcon();
                    this.saveState();
                })
                .catch(err => {
                    console.error("Erreur lecture:", err);
                    this.isPlaying = false;
                    this.updateIcon();
                });
        }
    }

    // ==========================================
    // ✅ MISE À JOUR DE L'ARTWORK
    // ==========================================
    updateArtwork(coverUrl) {
        if (!this.trackArtwork || !this.artworkIcon) return;

        if (coverUrl) {
            // Afficher la cover
            this.trackArtwork.style.backgroundImage = `url('${coverUrl}')`;
            this.trackArtwork.style.backgroundSize = 'cover';
            this.trackArtwork.style.backgroundPosition = 'center';
            this.trackArtwork.classList.add('has-cover');
            
            if (this.artworkIcon) {
                this.artworkIcon.style.display = 'none';
            }
            
            console.log('🎨 Cover appliquée au player:', coverUrl);
        } else {
            // Afficher l'icône par défaut
            this.trackArtwork.style.backgroundImage = '';
            this.trackArtwork.style.backgroundSize = '';
            this.trackArtwork.style.backgroundPosition = '';
            this.trackArtwork.classList.remove('has-cover');
            
            if (this.artworkIcon) {
                this.artworkIcon.style.display = 'flex';
                this.artworkIcon.textContent = '🎵';
            }
            
            console.log('🎵 Cover par défaut appliquée');
        }
    }

    // ==========================================
    // ✅ NOUVELLES MÉTHODES DE CONTRÔLE EXTERNE
    // Pour intégration avec tournament-arena.js
    // ==========================================

    /**
     * Pause avec fade-out progressif
     * @param {number} duration - Durée du fade en ms (défaut: 500ms)
     * @returns {Promise} - Résolu quand la pause est effective
     */
    async pauseWithFade(duration = 500) {
        if (!this.isPlaying || !this.audio) return;
        
        const startVolume = this.audio.volume;
        const steps = 20;
        const stepDuration = duration / steps;
        const volumeStep = startVolume / steps;
        
        for (let i = 0; i < steps; i++) {
            await new Promise(r => setTimeout(r, stepDuration));
            this.audio.volume = Math.max(0, startVolume - (volumeStep * (i + 1)));
        }
        
        this.audio.pause();
        this.audio.volume = startVolume; // Restaurer pour la reprise
        this.isPlaying = false;
        this.updateIcon();
        
        console.log('🔇 Player pausé avec fade-out');
    }

    /**
     * Reprise avec fade-in progressif
     * @param {number} duration - Durée du fade en ms (défaut: 500ms)
     */
    async resumeWithFade(duration = 500) {
        if (!this.audio || !this.audio.src || this._isLocked) return;
        
        const targetVolume = this.audio.volume || 0.8;
        this.audio.volume = 0;
        
        try {
            await this.audio.play();
            this.isPlaying = true;
            this.updateIcon();
            
            const steps = 20;
            const stepDuration = duration / steps;
            const volumeStep = targetVolume / steps;
            
            for (let i = 0; i < steps; i++) {
                await new Promise(r => setTimeout(r, stepDuration));
                this.audio.volume = Math.min(targetVolume, volumeStep * (i + 1));
            }
            
            console.log('🔊 Player repris avec fade-in');
        } catch (error) {
            console.warn('⚠️ Reprise bloquée par autoplay:', error);
        }
    }

    /**
     * Verrouille le player pour empêcher la lecture automatique
     * Utilisé quand l'utilisateur entre dans l'arène de tournoi
     * @param {boolean} locked - État de verrouillage
     */
    setLocked(locked) {
        this._isLocked = locked;
        console.log(locked ? '🔒 Player verrouillé' : '🔓 Player déverrouillé');
    }

    /**
     * Vérifie si le player est verrouillé
     * @returns {boolean}
     */
    isLocked() {
        return this._isLocked === true;
    }

    /**
     * Pause immédiate sans fade (pour cas urgents)
     */
    pauseImmediate() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            this.updateIcon();
        }
    }

    togglePlay() {
        if (!this.audio.src) return;
        
        if (this.audio.paused) {
            this.audio.play()
                .then(() => {
                    this.isPlaying = true;
                    this.saveState();
                })
                .catch(err => {
                    console.error("Erreur play:", err);
                    this.isPlaying = false;
                })
                .finally(() => this.updateIcon());
        } else {
            this.audio.pause();
            this.isPlaying = false;
            this.updateIcon();
            this.saveState();
        }
    }

    seek(e) {
        if (!this.audio.duration || !this.progressContainer) return;
        const rect = this.progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(clickX / rect.width, 1));
        this.audio.currentTime = percentage * this.audio.duration;
        this.saveState();
    }

    updateProgress() {
        if (!this.audio.duration || isNaN(this.audio.duration)) return;
        
        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        if (this.progressBar) this.progressBar.style.width = `${percent}%`;
        if (this.txtCurrent) this.txtCurrent.textContent = this.formatTime(this.audio.currentTime);
    }

    updateIcon() {
        if (!this.btnPlay) return;
        
        const playIcon = this.btnPlay.querySelector('.play-icon');
        const pauseIcon = this.btnPlay.querySelector('.pause-icon');
        
        if (this.isPlaying) {
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
        } else {
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
        }
    }

    show() {
        if (this.playerContainer) {
            this.playerContainer.classList.remove('hidden');
            this.playerContainer.style.display = 'flex';
            
            setTimeout(() => {
                this.playerContainer.style.transform = 'translateY(0)';
                this.playerContainer.style.opacity = '1';
            }, 10);
        }
    }

    hide() {
        if (this.playerContainer) {
            this.playerContainer.style.transform = 'translateY(100%)';
            this.playerContainer.style.opacity = '0';
            
            setTimeout(() => {
                this.playerContainer.classList.add('hidden');
                this.audio.pause();
                this.isPlaying = false;
                this.updateIcon();
            }, 300);
        }
    }

    // ==========================================
    // NAVIGATION DANS LA PLAYLIST
    // ==========================================
    playNext() {
        if (this.playlist.length === 0) {
            console.log('⚠️ Playlist vide');
            return;
        }

        if (this.repeatMode === 'one') {
            // En mode repeat one, recommencer la track
            this.audio.currentTime = 0;
            this.audio.play();
            return;
        }

        let nextIndex;
        
        if (this.repeatMode === 'all') {
            // En mode repeat all, boucler au début si on est à la fin
            nextIndex = (this.currentIndex + 1) % this.playlist.length;
        } else {
            // Mode normal
            nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.playlist.length) {
                console.log('🏁 Fin de la playlist atteinte');
                if (window.toast) {
                    window.toast.info('Playlist', 'Fin de la playlist');
                }
                return;
            }
        }

        this.currentIndex = nextIndex;
        const next = this.playlist[this.currentIndex];
        
        console.log('⏭️ Lecture suivante:', next.title, `(${this.currentIndex + 1}/${this.playlist.length})`);
        
        this.currentTrack = next.url;
        this.currentCover = next.coverUrl;
        this.audio.src = next.url;
        
        if (this.txtTitle) this.txtTitle.textContent = next.title;
        if (this.txtArtist) this.txtArtist.textContent = next.artist;
        
        this.updateArtwork(next.coverUrl);
        this.updateNavigationButtons();
        
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                this.updateIcon();
            })
            .catch(err => console.error('Erreur playNext:', err));
    }

    playPrev() {
        if (this.playlist.length === 0) {
            console.log('⚠️ Playlist vide');
            return;
        }

        // Si on est au début de la track (< 3s), aller à la précédente
        // Sinon, recommencer la track actuelle
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            console.log('⏮️ Redémarrage de la track');
            return;
        }

        let prevIndex;
        
        if (this.repeatMode === 'all') {
            // En mode repeat all, boucler à la fin si on est au début
            prevIndex = this.currentIndex === 0 
                ? this.playlist.length - 1 
                : this.currentIndex - 1;
        } else {
            // Mode normal
            prevIndex = this.currentIndex - 1;
            if (prevIndex < 0) {
                console.log('🏁 Début de la playlist atteint');
                this.audio.currentTime = 0;
                if (window.toast) {
                    window.toast.info('Playlist', 'Début de la playlist');
                }
                return;
            }
        }

        this.currentIndex = prevIndex;
        const prev = this.playlist[this.currentIndex];
        
        console.log('⏮️ Lecture précédente:', prev.title, `(${this.currentIndex + 1}/${this.playlist.length})`);
        
        this.currentTrack = prev.url;
        this.currentCover = prev.coverUrl;
        this.audio.src = prev.url;
        
        if (this.txtTitle) this.txtTitle.textContent = prev.title;
        if (this.txtArtist) this.txtArtist.textContent = prev.artist;
        
        this.updateArtwork(prev.coverUrl);
        this.updateNavigationButtons();
        
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                this.updateIcon();
            })
            .catch(err => console.error('Erreur playPrev:', err));
    }

    // ==========================================
    // MISE À JOUR DES BOUTONS DE NAVIGATION
    // ==========================================
    updateNavigationButtons() {
        if (!this.btnNext || !this.btnPrev) return;

        // Désactiver les boutons si playlist vide
        if (this.playlist.length === 0) {
            this.btnNext.style.opacity = '0.3';
            this.btnNext.style.cursor = 'not-allowed';
            this.btnPrev.style.opacity = '0.3';
            this.btnPrev.style.cursor = 'not-allowed';
            return;
        }

        // En mode repeat all, toujours actif
        if (this.repeatMode === 'all') {
            this.btnNext.style.opacity = '1';
            this.btnNext.style.cursor = 'pointer';
            this.btnPrev.style.opacity = '1';
            this.btnPrev.style.cursor = 'pointer';
            return;
        }

        // Mode normal
        if (this.currentIndex >= this.playlist.length - 1) {
            this.btnNext.style.opacity = '0.3';
            this.btnNext.style.cursor = 'not-allowed';
        } else {
            this.btnNext.style.opacity = '1';
            this.btnNext.style.cursor = 'pointer';
        }

          if (this.currentIndex <= 0) {
            this.btnPrev.style.opacity = '0.3';
            this.btnPrev.style.cursor = 'not-allowed';
        } else {
            this.btnPrev.style.opacity = '1';
            this.btnPrev.style.cursor = 'pointer';
        }
    }

    setPlaylist(tracks, startIndex = 0) {
        this.playlist = tracks;
        this.currentIndex = startIndex;
        this.updateNavigationButtons();
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

// ==========================================
// ✅ FONCTION GLOBALE PLAY TRACK (MISE À JOUR)
// ==========================================
window.playTrack = function(url, title, btnOrElement, artist = "Artiste WRC", coverUrl = null, avatarUrl = null) {
    if (!window.globalPlayer) {
        console.error("Player non initialisé");
        initPlayer();
        setTimeout(() => window.playTrack(url, title, btnOrElement, artist, coverUrl, avatarUrl), 100);
        return;
    }
    
    console.log('🎵 Lecture demandée:', {
        title,
        artist,
        coverUrl,
        avatarUrl
    });
    
    // Détection automatique de l'artiste si non fourni
    if (!artist || artist === "Artiste WRC") {
        if (btnOrElement) {
            const card = btnOrElement.closest?.('.track-card') || 
                         btnOrElement.closest?.('.audio-card') || 
                         btnOrElement.closest?.('.track-item') ||
                         btnOrElement.closest?.('.row') ||
                         btnOrElement.parentElement;
            
            if (card) {
                const artEl = card.querySelector('.artist-name') || 
                             card.querySelector('.name') || 
                             card.querySelector('.track-artist') || 
                             card.querySelector('p');
                
                if (artEl) artist = artEl.textContent?.trim() || artist;
            }
        }
    }
    
    // ✅ Construire automatiquement la playlist depuis les tracks visibles
    buildPlaylistFromPage();
    
    // ✅ Appeler play() avec la cover
    window.globalPlayer.play(url, title, artist, coverUrl);
};

// ==========================================
// ✅ CONSTRUCTION AUTOMATIQUE DE LA PLAYLIST
// ==========================================
function buildPlaylistFromPage() {
    if (!window.globalPlayer) return;
    
    const tracks = [];
    
    // Chercher toutes les tracks sur la page (différents sélecteurs selon la page)
    const selectors = [
        '.track-card',           // Dashboard Jury (mode grille)
        '.track-list-item',      // Dashboard Jury (mode liste) ✅ AJOUTÉ
        '.track-item',           // Dashboard Artiste
        '.audio-card',           // Autres pages
        '[data-track-id]'        // Fallback universel ✅ AJOUTÉ
    ];
    
    let trackElements = [];
    for (const selector of selectors) {
        trackElements = document.querySelectorAll(selector);
        if (trackElements.length > 0) {
            console.log(`✅ Trouvé ${trackElements.length} tracks avec sélecteur: ${selector}`);
            break;
        }
    }
    
    if (trackElements.length === 0) {
        console.log('⚠️ Aucune track trouvée sur la page');
        return;
    }
    
    trackElements.forEach((el, index) => {
        let url, title, artist, coverUrl;
        
        // Méthode 1: Bouton avec onclick contenant playTrack()
        const playBtn = el.querySelector('[onclick*="playTrack"]') || 
                       el.querySelector('.btn-play-hero') ||
                       el.querySelector('.card-play-btn') ||
                       el.querySelector('.list-play-btn') ||  // ✅ AJOUTÉ
                       el.querySelector('[data-file-url]');
        
        if (playBtn) {
            // data attributes
            url = playBtn.getAttribute('data-file-url') || 
                  el.getAttribute('data-file-url');
            title = playBtn.getAttribute('data-title') || 
                   el.querySelector('h4, .track-title, .list-title, .hero-title')?.textContent || 
                   `Track ${index + 1}`;
            artist = playBtn.getAttribute('data-artist') || 
                    el.querySelector('.track-artist, .list-artist, .hero-artist, p')?.textContent || 
                    'Artiste';
            coverUrl = playBtn.getAttribute('data-cover') || 
                      el.getAttribute('data-cover') ||
                      null;
            
            // Extraction depuis onclick si pas de data attributes
            if (!url) {
                const onclick = playBtn.getAttribute('onclick');
                if (onclick) {
                    // Extraire URL: playTrack('URL', ...)
                    const match = onclick.match(/playTrack\(['"]([^'"]+)['"]/);
                    if (match) url = match[1];
                    
                    // Extraire titre: playTrack('...', 'TITRE', ...)
                    const titleMatch = onclick.match(/['"]([^'"]+)['"],\s*this/);
                    if (titleMatch) title = titleMatch[1];
                }
            }
        }
        
        if (url && title) {
            // Nettoyer les valeurs
            if (coverUrl === '' || coverUrl === 'null' || coverUrl === 'undefined') {
                coverUrl = null;
            }
            
            tracks.push({
                url: url,
                title: title.trim(),
                artist: artist.trim(),
                coverUrl: coverUrl
            });
        }
    });
    
    if (tracks.length > 0) {
        console.log(`📂 Playlist construite: ${tracks.length} tracks`);
        // Ne pas écraser la playlist, juste la mettre à jour si elle est vide ou différente
        if (window.globalPlayer.playlist.length === 0 || 
            JSON.stringify(window.globalPlayer.playlist) !== JSON.stringify(tracks)) {
            window.globalPlayer.setPlaylist(tracks, 0);
        }
    } else {
        console.warn('⚠️ Aucune track valide trouvée (URL ou titre manquant)');
    }
}

// ==========================================
// INITIALISATION
// ==========================================
let playerInitialized = false;

function initPlayer() {
    if (playerInitialized) return;
    
    try {
        window.globalPlayer = new GlobalAudioPlayer();
        playerInitialized = true;
        console.log("✅ Player initialisé avec support des covers + navigation + raccourcis clavier");
    } catch (error) {
        console.error("❌ Erreur initialisation player:", error);
    }
}

// Double initialisation pour compatibilité
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlayer);
} else {
    initPlayer();
}

window.addEventListener('load', () => {
    const state = sessionStorage.getItem('wrc_player_state');
    if (state) {
        console.log('🎵 Continuité de lecture activée');
    }
});

console.log("✅ Module Player avec Covers + Navigation + Raccourcis Clavier chargé");