import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * WRC 2026 - 3D Earth Globe with City Markers
 * Arena/Grunt aesthetic - fixed rotating globe with artist hotspots
 * Features world map texture, floating city labels with Teko font
 */
export class Arena3D {
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

        // CSS2D Renderer for HTML labels
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'fixed';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.left = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.labelRenderer.domElement.style.zIndex = '1';
        document.body.appendChild(this.labelRenderer.domElement);

        this.mouse = new THREE.Vector2();
        this.targetRotation = new THREE.Vector2();
        this.autoRotateSpeed = 0.0005;
        
        // Globe settings
        this.globeRadius = 5;
        this.hotspots = [];
        this.labelMarkers = [];
        
        // Performance settings
        this.isMobile = window.innerWidth < 768;
        this.particleCount = this.isMobile ? 1000 : 2500;
        
        this.init();
    }

    init() {
        this.setupRenderer();
        this.setupCamera();
        this.createGlobe();
        this.createGridLines();
        this.addParticles();
        this.setupLights();
        this.addCityMarkers();
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
        
        const globeMaterial = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6,
            wireframe: true,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide
        });

        this.globe = new THREE.Mesh(globeGeometry, globeMaterial);
        this.scene.add(this.globe);

        // Inner solid dark sphere
        const innerGlowGeometry = new THREE.SphereGeometry(this.globeRadius * 0.985, 32, 32);
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x050510,
            transparent: true,
            opacity: 0.9
        });
        this.innerGlobe = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        this.scene.add(this.innerGlobe);

        // World map texture on sphere
        this.createWorldMapTexture();

        // Outer atmosphere glow with purple tint
        const atmosphereGeometry = new THREE.SphereGeometry(this.globeRadius * 1.015, 32, 32);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Color(0x8b5cf6) },
                intensity: { value: 0.35 }
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

    createWorldMapTexture() {
        // Create world map texture using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Dark background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw simplified world map outline
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
        ctx.lineWidth = 1;
        
        // Draw grid lines
        for (let i = 0; i <= canvas.width; i += 64) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
        }
        for (let i = 0; i <= canvas.height; i += 64) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        // Draw continent shapes (simplified paths)
        ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 1;
        
        // North America
        ctx.beginPath();
        ctx.moveTo(150, 180);
        ctx.lineTo(350, 150);
        ctx.lineTo(400, 200);
        ctx.lineTo(380, 350);
        ctx.lineTo(300, 450);
        ctx.lineTo(180, 400);
        ctx.lineTo(120, 280);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // South America
        ctx.beginPath();
        ctx.moveTo(350, 450);
        ctx.lineTo(420, 480);
        ctx.lineTo(400, 650);
        ctx.lineTo(320, 800);
        ctx.lineTo(280, 700);
        ctx.lineTo(300, 500);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Europe
        ctx.beginPath();
        ctx.moveTo(850, 180);
        ctx.lineTo(1050, 150);
        ctx.lineTo(1100, 200);
        ctx.lineTo(1000, 280);
        ctx.lineTo(880, 300);
        ctx.lineTo(820, 250);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Africa
        ctx.beginPath();
        ctx.moveTo(880, 320);
        ctx.lineTo(1050, 300);
        ctx.lineTo(1100, 400);
        ctx.lineTo(1080, 550);
        ctx.lineTo(1000, 650);
        ctx.lineTo(900, 600);
        ctx.lineTo(850, 450);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Asia
        ctx.beginPath();
        ctx.moveTo(1100, 150);
        ctx.lineTo(1500, 120);
        ctx.lineTo(1700, 200);
        ctx.lineTo(1650, 350);
        ctx.lineTo(1400, 400);
        ctx.lineTo(1200, 350);
        ctx.lineTo(1100, 280);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Australia
        ctx.beginPath();
        ctx.moveTo(1550, 550);
        ctx.lineTo(1750, 520);
        ctx.lineTo(1800, 620);
        ctx.lineTo(1700, 720);
        ctx.lineTo(1550, 680);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Apply texture to a sphere slightly smaller than wireframe
        const mapGeometry = new THREE.SphereGeometry(this.globeRadius * 0.99, 64, 64);
        const mapMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.6,
            side: THREE.FrontSide
        });
        
        this.worldMap = new THREE.Mesh(mapGeometry, mapMaterial);
        this.globeGroup.add(this.worldMap);
    }

    createGridLines() {
        // Latitude lines
        const latLines = new THREE.Group();
        const latMaterial = new THREE.LineBasicMaterial({
            color: 0x8b5cf6,
            transparent: true,
            opacity: 0.08
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
            opacity: 0.06
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
            size: 0.025,
            color: 0x8888aa,
            transparent: true,
            opacity: 0.5,
            sizeAttenuation: true
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x8b5cf6, 2, 50);
        pointLight1.position.set(10, 5, 10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x22d3ee, 1, 40);
        pointLight2.position.set(-10, -5, 5);
        this.scene.add(pointLight2);
    }

    // City data with fake artist counts
    getCityData() {
        return [
            { city: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522, artists: 2847, flag: '🇫🇷' },
            { city: 'New York', country: 'US', lat: 40.7128, lon: -74.0060, artists: 4521, flag: '🇺🇸' },
            { city: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503, artists: 3892, flag: '🇯🇵' },
            { city: 'London', country: 'GB', lat: 51.5074, lon: -0.1278, artists: 2156, flag: '🇬🇧' },
            { city: 'São Paulo', country: 'BR', lat: -23.5505, lon: -46.6333, artists: 1987, flag: '🇧🇷' },
            { city: 'Berlin', country: 'DE', lat: 52.5200, lon: 13.4050, artists: 1654, flag: '🇩🇪' },
            { city: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437, artists: 3241, flag: '🇺🇸' },
            { city: 'Madrid', country: 'ES', lat: 40.4168, lon: -3.7038, artists: 1432, flag: '🇪🇸' },
            { city: 'Seoul', country: 'KR', lat: 37.5665, lon: 126.9780, artists: 2876, flag: '🇰🇷' },
            { city: 'Lagos', country: 'NG', lat: 6.5244, lon: 3.3792, artists: 1154, flag: '🇳🇬' },
            { city: 'Toronto', country: 'CA', lat: 43.6532, lon: -79.3832, artists: 1876, flag: '🇨🇦' },
            { city: 'Marseille', country: 'FR', lat: 43.2965, lon: 5.3698, artists: 987, flag: '🇫🇷' },
            { city: 'Mexico City', country: 'MX', lat: 19.4326, lon: -99.1332, artists: 1543, flag: '🇲🇽' },
            { city: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093, artists: 1234, flag: '🇦🇺' },
            { city: 'Johannesburg', country: 'ZA', lat: -26.2041, lon: 28.0473, artists: 876, flag: '🇿🇦' },
            { city: 'Milan', country: 'IT', lat: 45.4642, lon: 9.1900, artists: 1123, flag: '🇮🇹' },
            { city: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298, artists: 2098, flag: '🇺🇸' },
            { city: 'Lyon', country: 'FR', lat: 45.7640, lon: 4.8357, artists: 654, flag: '🇫🇷' },
            { city: 'Barcelona', country: 'ES', lat: 41.3851, lon: 2.1734, artists: 987, flag: '🇪🇸' },
            { city: 'Dubai', country: 'AE', lat: 25.2048, lon: 55.2708, artists: 765, flag: '🇦🇪' }
        ];
    }

    addCityMarkers() {
        const cities = this.getCityData();
        
        cities.forEach((cityData, index) => {
            // Create glowing hotspot
            const position = this.latLonToVector3(cityData.lat, cityData.lon, this.globeRadius + 0.12);
            
            const spriteMaterial = new THREE.SpriteMaterial({
                map: this.createHotspotTexture(),
                color: 0x8b5cf6,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            const size = Math.min(0.6, 0.25 + Math.log(cityData.artists + 1) * 0.08);
            sprite.scale.set(size, size, 1);
            
            sprite.userData = {
                baseScale: size,
                phase: index * 0.5,
                pulseSpeed: 0.5 + Math.random() * 0.5
            };

            this.globeGroup.add(sprite);
            this.hotspots.push(sprite);

            // Create HTML label with Teko font and blur effect on artist count
            const labelDiv = document.createElement('div');
            labelDiv.className = 'globe-label';
            labelDiv.innerHTML = `
                <div class="globe-label-city">${cityData.city}</div>
                <div class="globe-label-country">${cityData.flag} ${cityData.country}</div>
                <div class="globe-label-count" style="filter: blur(4px);">${this.formatArtistCount(cityData.artists)} ARTISTS</div>
            `;
            
            const label = new CSS2DObject(labelDiv);
            label.position.copy(position.multiplyScalar(1.15));
            
            this.globeGroup.add(label);
            this.labelMarkers.push(label);
        });
    }

    createHotspotTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
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

    formatArtistCount(count) {
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K';
        }
        return count.toString();
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
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        
        this.isMobile = window.innerWidth < 768;
    }

    onMouseMove(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        // Smooth parallax rotation based on mouse
        this.targetRotation.x += (this.mouse.y * 0.2 - this.targetRotation.x) * 0.02;
        this.targetRotation.y += (this.mouse.x * 0.2 - this.targetRotation.y) * 0.02;

        // Auto rotation (continuous, not scroll-linked)
        this.globeGroup.rotation.y += this.autoRotateSpeed;
        
        // Subtle parallax tilt
        this.globeGroup.rotation.x = this.targetRotation.x * 0.15;
        this.globeGroup.rotation.z = this.targetRotation.y * 0.05;

        // Pulse atmosphere
        if (this.atmosphere.material.uniforms) {
            this.atmosphere.material.uniforms.intensity.value = 0.3 + Math.sin(time * 0.5) * 0.1;
        }

        // Animate hotspots
        this.hotspots.forEach(hotspot => {
            const data = hotspot.userData;
            const pulse = Math.sin(time * data.pulseSpeed + data.phase) * 0.25 + 1;
            const scale = data.baseScale * pulse;
            hotspot.scale.set(scale, scale, 1);
            hotspot.material.opacity = 0.6 + Math.sin(time * 0.8 + data.phase) * 0.3;
        });

        // Slow rotation for particles
        this.particles.rotation.y += 0.0001;
        this.particles.rotation.x += 0.00005;

        // FIXED CAMERA - No scroll-linked movement
        // Camera stays static to keep globe background fixed

        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }

    // No-op for scroll - keeps background fixed
    updateCameraOnScroll(_progress) {
        // Intentionally empty - globe is fixed
    }

    /**
     * Dispose and cleanup
     */
    dispose() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('mousemove', this.handleMouseMove);

        // Clear hotspots
        this.hotspots.forEach(hotspot => {
            this.globeGroup.remove(hotspot);
            if (hotspot.material.map) {
                hotspot.material.map.dispose();
            }
            hotspot.material.dispose();
        });
        this.hotspots = [];

        // Clear labels
        this.labelMarkers.forEach(label => {
            this.globeGroup.remove(label);
        });
        this.labelMarkers = [];

        // Remove label renderer
        if (this.labelRenderer && this.labelRenderer.domElement) {
            this.labelRenderer.domElement.remove();
        }

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