import * as THREE from 'three';
import gsap from 'gsap';

export class Arena3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scrollProgress = 0;
        this.mouse = { x: 0, y: 0 };
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.initScene();
        this.addEventListeners();
        this.animate();
    }

    initScene() {
        // Arena Geometry (Industrial Cage) - Brutalist style
        const cageGroup = new THREE.Group();
        
        const geometry = new THREE.CylinderGeometry(15, 15, 60, 6, 20, true);
        const material = new THREE.MeshBasicMaterial({
            color: 0x444444,
            wireframe: true,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        this.cage = new THREE.Mesh(geometry, material);
        cageGroup.add(this.cage);

        // Add some structural beams
        for (let i = 0; i < 6; i++) {
            const beamGeom = new THREE.BoxGeometry(0.5, 60, 0.5);
            const beamMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
            const beam = new THREE.Mesh(beamGeom, beamMat);
            const angle = (i / 6) * Math.PI * 2;
            beam.position.x = Math.cos(angle) * 15;
            beam.position.z = Math.sin(angle) * 15;
            cageGroup.add(beam);
        }

        this.scene.add(cageGroup);
        this.cageGroup = cageGroup;

        // Dust particles
        this.particles = this.createParticles();
        this.scene.add(this.particles);

        this.camera.position.z = 25;
        this.camera.position.y = 5;
    }

    createParticles() {
        const count = 3000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
            velocities[i] = Math.random() * 0.02;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleVelocities = velocities;

        const material = new THREE.PointsMaterial({
            size: 0.04,
            color: 0x8b5cf6, // Primary color theme
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });

        return new THREE.Points(geometry, material);
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) - 0.5;
            this.mouse.y = (e.clientY / window.innerHeight) - 0.5;
        });
    }

    updateOnScroll(progress) {
        this.scrollProgress = progress;
        
        // Animate camera and scene based on scroll
        gsap.to(this.cageGroup.rotation, {
            y: progress * Math.PI * 2,
            duration: 1,
            ease: 'power2.out'
        });

        gsap.to(this.camera.position, {
            z: 25 - (progress * 15),
            y: 5 - (progress * 10),
            duration: 1.5,
            ease: 'power2.out'
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        if (this.reducedMotion) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const time = Date.now() * 0.001;

        // Subtle rotation
        if (this.cageGroup) {
            this.cageGroup.rotation.x = Math.sin(time * 0.2) * 0.05;
        }

        // Mouse interaction
        this.camera.position.x += (this.mouse.x * 5 - this.camera.position.x) * 0.05;
        this.camera.position.y += (-this.mouse.y * 5 + 5 - this.camera.position.y) * 0.05;
        this.camera.lookAt(0, 0, 0);

        // Particle animation
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= this.particleVelocities[i] + (this.scrollProgress * 0.1);
                if (positions[i * 3 + 1] < -40) positions[i * 3 + 1] = 40;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
            this.particles.rotation.y += 0.001;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
