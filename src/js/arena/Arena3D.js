import * as THREE from 'three';

export class Arena3D {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn(`Canvas with id ${canvasId} not found`);
            return;
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });

        this.mouse = new THREE.Vector2();
        this.targetRotation = new THREE.Vector2();
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x050505, 1);

        this.camera.position.z = 5;

        this.createArena();
        this.addLights();
        this.addParticles();
        this.setupEvents();
        this.animate();
    }

    createArena() {
        // Brutalist "Cage" structure
        const group = new THREE.Group();
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x222222,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });

        const outerBoxGeometry = new THREE.BoxGeometry(20, 20, 40);
        const outerBox = new THREE.Mesh(outerBoxGeometry, material);
        group.add(outerBox);

        // Add some industrial beams
        const beamGeo = new THREE.BoxGeometry(0.2, 0.2, 40);
        const beamMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        for (let i = 0; i < 4; i++) {
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.x = (i < 2 ? -1 : 1) * 9.8;
            beam.position.y = (i % 2 === 0 ? -1 : 1) * 9.8;
            group.add(beam);
        }

        this.arenaGroup = group;
        this.scene.add(group);
    }

    addLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xff0000, 2, 50);
        pointLight.position.set(5, 5, 5);
        this.scene.add(pointLight);

        const spotLight = new THREE.SpotLight(0x00ff00, 2);
        spotLight.position.set(-5, 10, 0);
        this.scene.add(spotLight);
    }

    addParticles() {
        const geometry = new THREE.BufferGeometry();
        const count = 2000;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 40;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 0.02,
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.5
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    setupEvents() {
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

    animate() {
        requestAnimationFrame(() => this.animate());

        // Smooth rotation based on mouse
        this.targetRotation.x += (this.mouse.y * 0.1 - this.targetRotation.x) * 0.05;
        this.targetRotation.y += (this.mouse.x * 0.1 - this.targetRotation.y) * 0.05;

        this.arenaGroup.rotation.x = this.targetRotation.x;
        this.arenaGroup.rotation.y = this.targetRotation.y;

        // Slow drift for particles
        this.particles.rotation.y += 0.0005;
        
        // Scroll link - will be updated by GSAP
        // this.camera.position.z = 5 + window.scrollY * 0.01;

        this.renderer.render(this.scene, this.camera);
    }

    updateCameraOnScroll(progress) {
        // Map scroll progress (0 to 1) to camera movement
        this.camera.position.z = 5 - progress * 10;
        this.camera.rotation.z = progress * Math.PI;
        this.arenaGroup.position.z = progress * 20;
    }
}
