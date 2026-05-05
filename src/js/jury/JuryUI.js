/**
 * WRC 2026 - Jury UI Module
 * Rendering logic for jury dashboard
 */

export class JuryUI {
    constructor() {
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        this.imageObserver.unobserve(img);
                    }
                }
            });
        }, { rootMargin: '50px' });
    }

    renderTracks(container, tracks, options = {}) {
        const { append = false, currentView = 'grid', currentUserRole = 'fan' } = options;
        
        if (!tracks || tracks.length === 0) {
            if (!append) {
                container.innerHTML = '<div class="empty-state">Aucun participant pour le moment</div>';
            }
            return;
        }

        const html = tracks.map(track => this.createTrackCard(track, currentView, currentUserRole)).join('');
        
        if (append) {
            container.innerHTML += html;
        } else {
            container.innerHTML = html;
        }

        this.lazyLoadImages();
    }

    createTrackCard(track, currentView, currentUserRole) {
        const safeTitle = this.escapeHtml(track.title).replace(/'/g, "\\'");
        const safeArtist = this.escapeHtml(track.artist).replace(/'/g, "\\'");
        
        if (currentView === 'list') {
            return this.createListItem(track, safeTitle, safeArtist, currentUserRole);
        }
        
        return this.createGridCard(track, safeTitle, safeArtist, currentUserRole);
    }

    createListItem(track, safeTitle, safeArtist, currentUserRole) {
        let ratingBar;
        
        if (currentUserRole === 'artist') {
            ratingBar = `<span class="list-rating-disabled">🔒</span>`;
        } else {
            ratingBar = `
                <div class="list-rating-bar">
                    <input type="range" min="0" max="10" step="0.5" value="${track.userRating || 0}" 
                           class="rating-slider-mini" 
                           data-track-id="${track.id}"
                           oninput="window.juryDashboard.updateRatingDisplay(this, ${track.id})"
                           onchange="window.juryDashboard.handleRateTrack(${track.id}, '${track.artistId}', parseFloat(this.value))">
                    <span class="rating-display-mini">${track.userRating || 0}</span>
                </div>
            `;
        }

        const coverThumb = track.coverUrl 
            ? `<img data-src="${track.coverUrl}" alt="${safeTitle}" class="list-cover-img lazy">`
            : '<span class="list-cover-icon">🎵</span>';

        const socialIcons = track.profile ? this.generateMicroSocials(track.profile) : '';

        return `
            <div class="track-list-item" data-track-id="${track.id}">
                <div class="list-cover">
                    ${coverThumb}
                </div>
                
                <div class="list-info">
                    <div class="list-title">${this.escapeHtml(track.title)}</div>
                    <div class="list-meta">
                        <span class="list-artist">${this.escapeHtml(track.artist)}</span>
                        ${socialIcons}
                    </div>
                </div>
                
                <div class="list-stats">
                    <span class="list-stat">⭐ ${track.averageRating.toFixed(1)}</span>
                    <span class="list-stat-count">${track.ratingsCount} votes</span>
                </div>
                
                <div class="list-rating">
                    ${ratingBar}
                </div>
                
                <button class="list-play-btn" 
                    onclick="window.juryDashboard.handlePlayTrack('${track.file_url}', '${safeTitle}', this, '${safeArtist}', ${track.coverUrl ? `'${track.coverUrl}'` : 'null'}, ${track.avatarUrl ? `'${track.avatarUrl}'` : 'null'})" 
                    aria-label="Jouer">
                    ▶
                </button>
            </div>
        `;
    }

    createGridCard(track, safeTitle, safeArtist, currentUserRole) {
        let ratingBar;
        
        if (currentUserRole === 'artist') {
            ratingBar = `<div class="rating-disabled">🔒 Notation réservée au jury</div>`;
        } else {
            ratingBar = `
                <div class="rating-bar">
                    <input type="range" min="0" max="10" step="0.5" value="${track.userRating || 0}" 
                           class="rating-slider" 
                           data-track-id="${track.id}"
                           oninput="window.juryDashboard.updateRatingDisplay(this, ${track.id})"
                           onchange="window.juryDashboard.handleRateTrack(${track.id}, '${track.artistId}', parseFloat(this.value))">
                    <span class="rating-display">${track.userRating || 0}/10</span>
                </div>
            `;
        }

        const coverElement = track.coverUrl 
            ? `<img data-src="${track.coverUrl}" alt="${safeTitle}" class="card-cover-img lazy">`
            : '<span class="card-cover-icon">🎵</span>';

        const coverStyle = track.coverUrl 
            ? ''
            : `background: linear-gradient(135deg, ${track.color || '#7b2cbf'}, rgba(0,0,0,0.8));`;

        const socialIcons = this.generateCompactSocials(track.profile);

        return `
            <div class="track-card" data-track-id="${track.id}">
                <div class="card-cover" style="${coverStyle}">
                    ${coverElement}
                    <button class="card-play-btn" 
                        onclick="window.juryDashboard.handlePlayTrack('${track.file_url}', '${safeTitle}', this, '${safeArtist}', ${track.coverUrl ? `'${track.coverUrl}'` : 'null'}, ${track.avatarUrl ? `'${track.avatarUrl}'` : 'null'})" 
                        aria-label="Jouer">▶</button>
                </div>
                <div class="card-body">
                    <div class="card-info">
                        <h4>${this.escapeHtml(track.title)}</h4>
                        <p>${this.escapeHtml(track.artist)}</p>
                        ${socialIcons}
                    </div>
                    <div class="card-stats">
                        <span class="average-rating">⭐ ${track.averageRating.toFixed(1)}/10</span>
                        <span class="ratings-count">${track.ratingsCount} note${track.ratingsCount > 1 ? 's' : ''}</span>
                    </div>
                    <div class="card-rating">
                        ${ratingBar}
                    </div>
                </div>
            </div>
        `;
    }

    renderHero(track, currentUserRole) {
        const container = document.getElementById('heroPlayer');
        if (!container) return;

        let ratingSection;
        
        if (currentUserRole === 'artist') {
            ratingSection = `
                <div class="hero-rating-disabled">
                    🔒 NOTATION RÉSERVÉE AU JURY
                </div>
            `;
        } else {
            ratingSection = `
                <div class="hero-rating-section">
                    <div class="rating-bar-hero">
                        <label>Votre note :</label>
                        <input type="range" min="0" max="10" step="0.5" value="${track.userRating || 0}" 
                               class="rating-slider-hero" 
                               oninput="window.juryDashboard.updateHeroRatingDisplay(this.value)"
                               onchange="window.juryDashboard.handleRateTrack(${track.id}, '${track.artistId}', parseFloat(this.value))">
                        <span class="rating-display-hero">${track.userRating || 0}/10</span>
                    </div>
                </div>
            `;
        }

        const socialLinks = this.generateSocialLinks(track.profile);

        const coverStyle = track.coverUrl 
            ? `background-image: url('${track.coverUrl}'); background-size: cover; background-position: center;`
            : `background: linear-gradient(135deg, ${track.color || '#7b2cbf'}, #000);`;

        const safeTitle = this.escapeHtml(track.title).replace(/'/g, "\\'");
        const safeArtist = this.escapeHtml(track.artist).replace(/'/g, "\\'");

        container.innerHTML = `
            <div class="hero-visual" style="${coverStyle}">
                ${!track.coverUrl ? '🎵' : ''}
            </div>
            <div class="hero-content">
                <div class="hero-meta">
                    <span class="meta-tag">🏆 TOP TENDANCE</span>
                </div>
                <h1 class="hero-title">${this.escapeHtml(track.title)}</h1>
                <h3 class="hero-artist">${this.escapeHtml(track.artist)}</h3>
                
                ${socialLinks}
                
                <div class="hero-controls">
                    <button class="btn-play-hero" onclick="window.juryDashboard.handlePlayTrack('${track.file_url}', '${safeTitle}', this, '${safeArtist}', ${track.coverUrl ? `'${track.coverUrl}'` : 'null'}, ${track.avatarUrl ? `'${track.avatarUrl}'` : 'null'})">
                        ▶ ÉCOUTER
                    </button>
                    <div class="hero-stats">
                        <div class="stat-big">
                            ⭐ ${track.averageRating.toFixed(1)}/10
                            <small>(${track.ratingsCount} note${track.ratingsCount > 1 ? 's' : ''})</small>
                        </div>
                    </div>
                </div>
                ${ratingSection}
            </div>
        `;
        
        if (track.userRating) {
            const heroSlider = container.querySelector('.rating-slider-hero');
            if (heroSlider) this.updateSliderColor(heroSlider, track.userRating);
        }
    }

    updateRatingUI(trackId, userRating, rpcData) {
        const ratingBar = document.querySelector(`[data-track-id="${trackId}"] .rating-bar, [data-track-id="${trackId}"] .list-rating-bar`);
        if (ratingBar) {
            const slider = ratingBar.querySelector('.rating-slider, .rating-slider-mini');
            const display = ratingBar.querySelector('.rating-display, .rating-display-mini');
            
            if (slider) slider.value = userRating;
            if (display) {
                display.textContent = slider.classList.contains('rating-slider-mini') ? userRating : `${userRating}/10`;
                display.classList.add('updated');
                setTimeout(() => display.classList.remove('updated'), 400);
            }
            
            this.updateSliderColor(slider, userRating);
        }

        if (rpcData) {
            const avgDisplay = document.querySelector(`[data-track-id="${trackId}"] .average-rating, [data-track-id="${trackId}"] .list-stat`);
            const countDisplay = document.querySelector(`[data-track-id="${trackId}"] .ratings-count, [data-track-id="${trackId}"] .list-stat-count`);
            
            if (avgDisplay && rpcData.new_average !== undefined) {
                avgDisplay.textContent = avgDisplay.classList.contains('list-stat') ? `⭐ ${rpcData.new_average.toFixed(1)}` : `⭐ ${rpcData.new_average.toFixed(1)}/10`;
                avgDisplay.classList.add('updated');
                setTimeout(() => avgDisplay.classList.remove('updated'), 400);
            }
            
            if (countDisplay && rpcData.new_count !== undefined) {
                countDisplay.textContent = countDisplay.classList.contains('list-stat-count') ? `${rpcData.new_count} votes` : `${rpcData.new_count} note${rpcData.new_count > 1 ? 's' : ''}`;
            }
        }

        this.confetti(ratingBar);
    }

    updateSliderColor(slider, value) {
        if (!slider) return;
        
        let color;
        if (value >= 8) {
            color = '#4ade80';
        } else if (value >= 5) {
            color = '#fbbf24';
        } else {
            color = '#ef4444';
        }
        
        const percentage = (value / 10) * 100;
        slider.style.background = `linear-gradient(90deg, ${color} ${percentage}%, rgba(255,255,255,0.1) ${percentage}%)`;
    }

    generateSocialLinks(profile) {
        if (!profile) return '';
        const links = [];
        const platforms = [
            { key: 'social_instagram', icon: '📸', label: 'Instagram', urlPrefix: 'https://instagram.com/' },
            { key: 'social_spotify', icon: '🎵', label: 'Spotify', urlPrefix: '' },
            { key: 'social_youtube', icon: '▶️', label: 'YouTube', urlPrefix: '' },
            { key: 'social_soundcloud', icon: '🎶', label: 'SoundCloud', urlPrefix: '' },
            { key: 'social_tiktok', icon: '🎥', label: 'TikTok', urlPrefix: 'https://tiktok.com/@' }
        ];

        platforms.forEach(p => {
            if (profile[p.key]) {
                let url = profile[p.key];
                if (p.key === 'social_instagram' || p.key === 'social_tiktok') {
                    url = p.urlPrefix + url.replace('@', '').split('/').pop();
                } else if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                links.push(`
                    <a href="${url}" target="_blank" class="social-link">
                        <span class="social-icon">${p.icon}</span>
                        <span>${p.label}</span>
                    </a>
                `);
            }
        });

        if (links.length === 0) return '';
        return `<div class="artist-socials" style="display: flex; gap: 10px; flex-wrap: wrap; margin: 15px 0;">${links.join('')}</div>`;
    }

    generateCompactSocials(profile) {
        if (!profile) return '';
        const icons = [];
        const platforms = [
            { key: 'social_instagram', icon: '📸', urlPrefix: 'https://instagram.com/' },
            { key: 'social_spotify', icon: '🎵', urlPrefix: '' },
            { key: 'social_youtube', icon: '▶️', urlPrefix: '' },
            { key: 'social_soundcloud', icon: '🎶', urlPrefix: '' },
            { key: 'social_tiktok', icon: '🎥', urlPrefix: 'https://tiktok.com/@' }
        ];

        platforms.forEach(p => {
            if (profile[p.key]) {
                let url = profile[p.key];
                if (p.key === 'social_instagram' || p.key === 'social_tiktok') {
                    url = p.urlPrefix + url.replace('@', '').split('/').pop();
                } else if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                icons.push(`<a href="${url}" target="_blank" class="social-icon-mini">${p.icon}</a>`);
            }
        });

        if (icons.length === 0) return '';
        return `<div class="social-icons-row" style="display: flex; gap: 8px; margin-top: 8px;">${icons.join('')}</div>`;
    }

    generateMicroSocials(profile) {
        if (!profile) return '';
        const icons = [];
        if (profile.social_instagram) icons.push('📸');
        if (profile.social_spotify) icons.push('🎵');
        if (profile.social_youtube) icons.push('▶️');
        if (icons.length === 0) return '';
        return `<span class="micro-socials">${icons.join(' ')}</span>`;
    }

    lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => this.imageObserver.observe(img));
    }

    confetti(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        for(let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed; width: 4px; height: 4px; 
                background: #4ade80; border-radius: 50%; 
                left: ${rect.left + 20}px; 
                top: ${rect.top}px; 
                pointer-events: none; z-index: 10000;
            `;
            document.body.appendChild(particle);
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 1 + Math.random() * 2;
            let x = 0, y = 0, opacity = 1;
            
            const animate = () => {
                x += Math.cos(angle) * velocity; 
                y += Math.sin(angle) * velocity + 0.5;
                opacity -= 0.02;
                particle.style.transform = `translate(${x}px, ${y}px)`;
                particle.style.opacity = opacity;
                if(opacity > 0) requestAnimationFrame(animate);
                else particle.remove();
            };
            animate();
        }
    }

    escapeHtml(text) {
        if (!text) return "";
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
}

export const juryUI = new JuryUI();
