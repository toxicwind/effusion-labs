
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class HeroScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        this.init();
        this.animate();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Particles - "The Data Stream"
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 2000;

        const posArray = new Float32Array(particlesCount * 3);

        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 15; // Spread
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

        // Material
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x10b981, // Emerald-500
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(this.particlesMesh);

        // Central Node - "The Orchestrator"
        const geo = new THREE.IcosahedronGeometry(1, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, wireframe: true });
        this.core = new THREE.Mesh(geo, mat);
        this.scene.add(this.core);

        this.camera.position.z = 5;

        // Mouse interaction
        this.mouseX = 0;
        this.mouseY = 0;

        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onMouseMove(event) {
        this.mouseX = event.clientX / window.innerWidth - 0.5;
        this.mouseY = event.clientY / window.innerHeight - 0.5;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Rotation
        this.particlesMesh.rotation.y += 0.001;
        this.particlesMesh.rotation.x += 0.0005;

        this.core.rotation.y -= 0.005;
        this.core.rotation.x -= 0.005;

        // Interactive "Mischief" sway
        this.scene.rotation.y += (this.mouseX * 0.5 - this.scene.rotation.y) * 0.05;
        this.scene.rotation.x += (this.mouseY * 0.5 - this.scene.rotation.x) * 0.05;

        this.renderer.render(this.scene, this.camera);
    }
}

// Auto-init if container exists
if (document.getElementById('hero-background') && window.matchMedia('(min-width: 768px)').matches) {
    new HeroScene('hero-background');
}
