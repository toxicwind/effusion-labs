import { gsap } from "gsap";

/**
 * HYPEBRÜT HUD ENGINE
 * 2026 Epistemic Brutalism + Liquid Glass Interactions
 */

class HUD {
    constructor() {
        this.cursor = document.createElement('div');
        this.cursor.className = 'hud-reticle';
        document.getElementById('hud-layer').appendChild(this.cursor);

        this.initEvents();
        this.initIntro();
    }

    initEvents() {
        // Mouse Tracking
        window.addEventListener('mousemove', (e) => {
            gsap.to(this.cursor, {
                x: e.clientX,
                y: e.clientY,
                duration: 0.1,
                ease: "power2.out"
            });
        });

        // Hover Interactions with Liquid Glass
        document.querySelectorAll('.liquid-glass').forEach(el => {
            el.addEventListener('mouseenter', () => {
                gsap.to(this.cursor, { scale: 2, borderColor: '#fff' });
                gsap.to(el, { scale: 1.02, duration: 0.3 });
            });
            el.addEventListener('mouseleave', () => {
                gsap.to(this.cursor, { scale: 1, borderColor: '#00ff00' });
                gsap.to(el, { scale: 1, duration: 0.3 });
            });
        });
    }

    initIntro() {
        const tl = gsap.timeline();

        // Staggered entry of brutalist elements
        tl.from(".liquid-glass", {
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "back.out(1.7)"
        })
            .from(".glitch-text", {
                scale: 0.9,
                opacity: 0,
                duration: 0.5,
                filter: "blur(10px)"
            }, "-=0.5");
    }
}

// Auto-init on load
if (typeof window !== 'undefined') {
    window.onload = () => {
        console.log("🦾 HYPEBRÜT OS: ONLINE");
        new HUD();
    };
}
