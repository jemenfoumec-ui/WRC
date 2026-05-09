import * as THREE from 'three';

/**
 * WRC 2026 - 3D Globe Component
 * Maps artist distributions by country/city with glowing hotspots
 */
export class Globe3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn(`Canvas with id ${canvasId} not found`);
            return;
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });

        this.mouse = new THREE.Vector2();
        this.targetRotation = new THREE.Vector2();
        this.autoRotateSpeed = 0.0008;
        this.parallaxStrength = 0.3;
        
        // Globe settings
        this.globeRadius = 5;
        this.hotspots = [];
        this.hotspotData = [];
        
        // Performance settings
        this.isMobile = window.innerWidth < 768;
        this.particleCount = this.isMobile ? 1500 : 3000;
        
        // Animation state
        this.scrollProgress = 0;
        this.targetScrollProgress = 0;
        
        this.init();
    }

    init() {
        this.setupRenderer();
        this.setupCamera();
        this.createGlobe();
        this.createGridLines();
        this.addParticles();
        this.setupLights();
        this.setupEvents();
        this.animate();
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.sortObjects = true;
    }

    setupCamera() {
        this.camera.position.z = 12;
        this.camera.position.y = 0;
    }

    createGlobe() {
        // Main globe sphere with wireframe
        const globeGeometry = new THREE.SphereGeometry(this.globeRadius, 64, 64);
        
        // Custom shader material for digital/glitch look
        const globeMaterial = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6,
            wireframe: true,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });

        this.globe = new THREE.Mesh(globeGeometry, globeMaterial);
        this.scene.add(this.globe);

        // Inner glow sphere
        const innerGlowGeometry = new THREE.SphereGeometry(this.globeRadius * 0.98, 32, 32);
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x050510,
            transparent: true,
            opacity: 0.8
        });
        this.innerGlobe = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        this.scene.add(this.innerGlobe);

        // Outer atmosphere glow
        const atmosphereGeometry = new THREE.SphereGeometry(this.globeRadius * 1.02, 32, 32);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(0x8b5cf6) },
                intensity: { value: 0.3 }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                uniform vec3 glowColor;
                uniform float intensity;
                void main() {
                    float glow = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(glowColor, glow * intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(this.atmosphere);

        this.globeGroup = new THREE.Group();
        this.globeGroup.add(this.globe);
        this.globeGroup.add(this.innerGlobe);
        this.globeGroup.add(this.atmosphere);
        this.scene.add(this.globeGroup);
    }

    createGridLines() {
        // Latitude lines
        const latLines = new THREE.Group();
        const latMaterial = new THREE.LineBasicMaterial({
            color: 0x8b5cf6,
            transparent: true,
            opacity: 0.1
        });

        for (let lat = -60; lat <= 60; lat += 30) {
            const points = [];
            for (let lon = 0; lon <= 360; lon += 5) {
                const phi = (90 - lat) * Math.PI / 180;
                const theta = lon * Math.PI / 180;
                const x = this.globeRadius * Math.sin(phi) * Math.cos(theta);
                const y = this.globeRadius * Math.cos(phi);
                const z = this.globeRadius * Math.sin(phi) * Math.sin(theta);
                points.push(new THREE.Vector3(x, y, z));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, latMaterial);
            latLines.add(line);
        }

        // Longitude lines
        const lonMaterial = new THREE.LineBasicMaterial({
            color: 0x6d28d9,
            transparent: true,
            opacity: 0.08
        });

        for (let lon = 0; lon < 360; lon += 30) {
            const points = [];
            for (let lat = -90; lat <= 90; lat += 5) {
                const phi = (90 - lat) * Math.PI / 180;
                const theta = lon * Math.PI / 180;
                const x = this.globeRadius * Math.sin(phi) * Math.cos(theta);
                const y = this.globeRadius * Math.cos(phi);
                const z = this.globeRadius * Math.sin(phi) * Math.sin(theta);
                points.push(new THREE.Vector3(x, y, z));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lonMaterial);
            latLines.add(line);
        }

        this.globeGroup.add(latLines);
        this.gridLines = latLines;
    }

    addParticles() {
        // Background star particles
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);

        for (let i = 0; i < this.particleCount * 3; i += 3) {
            const radius = 15 + Math.random() * 25;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.03,
            color: 0x8888aa,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x8b5cf6, 2, 50);
        pointLight1.position.set(10, 5, 10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x22d3ee, 1, 40);
        pointLight2.position.set(-10, -5, 5);
        this.scene.add(pointLight2);
    }

    setupEvents() {
        this.handleResize = () => this.onResize();
        this.handleMouseMove = (e) => this.onMouseMove(e);
        
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('mousemove', this.handleMouseMove);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update mobile detection
        this.isMobile = window.innerWidth < 768;
    }

    onMouseMove(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        // Smooth rotation based on mouse (parallax effect)
        this.targetRotation.x += (this.mouse.y * this.parallaxStrength - this.targetRotation.x) * 0.02;
        this.targetRotation.y += (this.mouse.x * this.parallaxStrength - this.targetRotation.y) * 0.02;

        // Auto rotation
        this.globeGroup.rotation.y += this.autoRotateSpeed;
        
        // Apply parallax on top of auto rotation
        this.globeGroup.rotation.x = this.targetRotation.x * 0.3;
        this.globeGroup.rotation.z = this.targetRotation.y * 0.1;

        // Pulse atmosphere
        if (this.atmosphere.material.uniforms) {
            this.atmosphere.material.uniforms.intensity.value = 0.25 + Math.sin(time * 0.5) * 0.1;
        }

        // Animate hotspots
        this.animateHotspots(time);

        // Slow rotation for particles
        this.particles.rotation.y += 0.0002;
        this.particles.rotation.x += 0.0001;

        // Scroll-linked camera movement
        this.camera.position.z = 12 - this.scrollProgress * 8;
        this.camera.position.y = this.scrollProgress * 2;
        
        // Slight camera rotation on scroll
        this.camera.rotation.z = this.scrollProgress * 0.2;

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Convert Lat/Lon to 3D position on globe
     */
    latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lon + 180) * Math.PI / 180;
        
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        return new THREE.Vector3(x, y, z);
    }

    /**
     * Add glowing hotspot at coordinates
     */
    addHotspot(lat, lon, size = 1, label = '') {
        const position = this.latLonToVector3(lat, lon, this.globeRadius + 0.1);
        
        // Sprite-based hotspot with glow
        const spriteMaterial = new THREE.SpriteMaterial({
            map: this.createHotspotTexture(),
            color: 0x8b5cf6,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(size * 0.5, size * 0.5, 1);
        
        // Pulse animation data
        sprite.userData = {
            baseScale: size * 0.5,
            phase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.5 + Math.random() * 0.5,
            lat,
            lon,
            label
        };

        this.globeGroup.add(sprite);
        this.hotspots.push(sprite);
        
        return sprite;
    }

    /**
     * Create glowing texture for hotspots
     */
    createHotspotTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Radial gradient for glow effect
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(139, 92, 246, 0.8)');
        gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    /**
     * Animate hotspots with pulsing effect
     */
    animateHotspots(time) {
        this.hotspots.forEach(hotspot => {
            const data = hotspot.userData;
            const pulse = Math.sin(time * data.pulseSpeed + data.phase) * 0.3 + 1;
            const scale = data.baseScale * pulse;
            hotspot.scale.set(scale, scale, 1);
            
            // Subtle opacity variation
            hotspot.material.opacity = 0.7 + Math.sin(time * 0.8 + data.phase) * 0.3;
        });
    }

    /**
     * Load artist distribution data from Supabase
     */
    async loadArtistDistribution(supabase) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('country, city, votes_received')
                .eq('role', 'artist')
                .eq('is_active', true);

            if (error) throw error;

            // Aggregate by city
            const cityCounts = {};
            data.forEach(profile => {
                const city = profile.city || profile.country || 'Unknown';
                const key = city.toLowerCase();
                if (!cityCounts[key]) {
                    cityCounts[key] = {
                        count: 0,
                        votes: 0,
                        city,
                        country: profile.country
                    };
                }
                cityCounts[key].count++;
                cityCounts[key].votes += profile.votes_received || 0;
            });

            // Convert to hotspot data with coordinates
            this.hotspotData = Object.values(cityCounts).map(cityData => {
                const coords = this.getCityCoordinates(cityData.city, cityData.country);
                return {
                    ...coords,
                    ...cityData
                };
            }).filter(h => h.lat !== null && h.lon !== null);

            // Clear existing hotspots
            this.clearHotspots();

            // Add new hotspots
            this.hotspotData.forEach(hotspot => {
                const size = Math.min(3, 0.5 + Math.log(hotspot.count + 1) * 0.5);
                this.addHotspot(hotspot.lat, hotspot.lon, size, hotspot.city);
            });

        } catch (err) {
            console.error('Error loading artist distribution:', err);
        }
    }

    /**
     * Predefined city coordinates (subset)
     */
    getCityCoordinates(city, country) {
        const cities = {
            // France
            'paris': { lat: 48.8566, lon: 2.3522 },
            'lyon': { lat: 45.7640, lon: 4.8357 },
            'marseille': { lat: 43.2965, lon: 5.3698 },
            'toulouse': { lat: 43.6047, lon: 1.4442 },
            'nice': { lat: 43.7102, lon: 7.2620 },
            // USA
            'new york': { lat: 40.7128, lon: -74.0060 },
            'los angeles': { lat: 34.0522, lon: -118.2437 },
            'chicago': { lat: 41.8781, lon: -87.6298 },
            'houston': { lat: 29.7604, lon: -95.3698 },
            'miami': { lat: 25.7617, lon: -80.1918 },
            'atlanta': { lat: 33.7490, lon: -84.3880 },
            // UK
            'london': { lat: 51.5074, lon: -0.1278 },
            'manchester': { lat: 53.4808, lon: -2.2426 },
            'birmingham': { lat: 52.4862, lon: -1.8904 },
            // Germany
            'berlin': { lat: 52.5200, lon: 13.4050 },
            'munich': { lat: 48.1351, lon: 11.5820 },
            'hamburg': { lat: 53.5511, lon: 9.9937 },
            // Spain
            'madrid': { lat: 40.4168, lon: -3.7038 },
            'barcelona': { lat: 41.3851, lon: 2.1734 },
            // Italy
            'rome': { lat: 41.9028, lon: 12.4964 },
            'milan': { lat: 45.4642, lon: 9.1900 },
            // Belgium
            'brussels': { lat: 50.8503, lon: 4.3517 },
            // Switzerland
            'zurich': { lat: 47.3769, lon: 8.5417 },
            // Canada
            'toronto': { lat: 43.6532, lon: -79.3832 },
            'montreal': { lat: 45.5017, lon: -73.5673 },
            'vancouver': { lat: 49.2827, lon: -123.1207 },
            // Brazil
            'sao paulo': { lat: -23.5505, lon: -46.6333 },
            'rio de janeiro': { lat: -22.9068, lon: -43.1729 },
            // Japan
            'tokyo': { lat: 35.6762, lon: 139.6503 },
            'osaka': { lat: 34.6937, lon: 135.5023 },
            // South Korea
            'seoul': { lat: 37.5665, lon: 126.9780 },
            // Mexico
            'mexico city': { lat: 19.4326, lon: -99.1332 },
            // Africa
            'lagos': { lat: 6.5244, lon: 3.3792 },
            'cairo': { lat: 30.0444, lon: 31.2357 },
            'johannesburg': { lat: -26.2041, lon: 28.0473 },
            // Middle East
            'dubai': { lat: 25.2048, lon: 55.2708 },
            // Australia
            'sydney': { lat: -33.8688, lon: 151.2093 },
            'melbourne': { lat: -37.8136, lon: 144.9631 },
        };

        const key = (city || '').toLowerCase();
        const coords = cities[key];
        
        if (coords) return coords;
        
        // Fallback to country-level coordinates
        const countries = {
            'FR': { lat: 46.2276, lon: 2.2137 },
            'US': { lat: 37.0902, lon: -95.7129 },
            'GB': { lat: 55.3781, lon: -3.4360 },
            'DE': { lat: 51.1657, lon: 10.4515 },
            'ES': { lat: 40.4637, lon: -3.7492 },
            'IT': { lat: 41.8719, lon: 12.5674 },
            'BE': { lat: 50.5039, lon: 4.4699 },
            'CH': { lat: 46.8182, lon: 8.2275 },
            'CA': { lat: 56.1304, lon: -106.3468 },
            'BR': { lat: -14.2350, lon: -51.9253 },
            'JP': { lat: 36.2048, lon: 138.2529 },
            'KR': { lat: 35.9078, lon: 127.7669 },
            'MX': { lat: 23.6345, lon: -102.5528 },
            'NG': { lat: 9.0820, lon: 8.6753 },
            'EG': { lat: 26.8206, lon: 30.8025 },
            'ZA': { lat: -30.5595, lon: 22.9375 },
            'AE': { lat: 23.4241, lon: 53.8478 },
            'AU': { lat: -25.2744, lon: 133.7751 },
        };

        return countries[country?.toUpperCase()] || { lat: null, lon: null };
    }

    clearHotspots() {
        this.hotspots.forEach(hotspot => {
            this.globeGroup.remove(hotspot);
            if (hotspot.material.map) {
                hotspot.material.map.dispose();
            }
            hotspot.material.dispose();
        });
        this.hotspots = [];
    }

    /**
     * Update camera based on scroll progress
     */
    updateCameraOnScroll(progress) {
        this.targetScrollProgress = Math.min(1, Math.max(0, progress));
        
        // Smooth interpolation
        this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.05;
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.handleMouseMove);

        // Clear hotspots
        this.clearHotspots();

        // Dispose geometries and materials
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        this.renderer.dispose();
    }
}