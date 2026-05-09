import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations(arena) {
    // Hero Text Animation
    const heroTitle = document.querySelector('.hero-content h1');
    const heroSubtitle = document.querySelector('.hero-content p');
    const heroCTA = document.querySelector('.hero-content .cta-group');

    if (heroTitle) {
        gsap.from(heroTitle, {
            y: 100,
            opacity: 0,
            duration: 1.2,
            ease: "power4.out",
            delay: 0.5
        });
    }

    if (heroSubtitle) {
        gsap.from(heroSubtitle, {
            y: 50,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
            delay: 0.8
        });
    }

    if (heroCTA) {
        gsap.from(heroCTA, {
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out",
            delay: 1.1
        });
    }

    // Scroll-Linked 3D Arena
    ScrollTrigger.create({
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => {
            if (arena && typeof arena.updateCameraOnScroll === 'function') {
                arena.updateCameraOnScroll(self.progress);
            }
        }
    });

    // Stagger Reveals for sections
    const staggerSections = document.querySelectorAll('.stagger-reveal');
    staggerSections.forEach(section => {
        gsap.from(section.children, {
            scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            y: 60,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: 'power2.out'
        });
    });

    // Industrial typography effects
    const punchyText = document.querySelectorAll('.punchy-text');
    punchyText.forEach(text => {
        gsap.to(text, {
            scrollTrigger: {
                trigger: text,
                start: 'top 90%',
                scrub: true
            },
            letterSpacing: '0em',
            ease: 'none'
        });
    });
}
