import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations(arena3D) {
    // Hero Reveal
    const heroTitle = document.querySelector('.wrc-hero-title');
    if (heroTitle) {
        // Heavy, staggered "Grunt-style" impact
        gsap.from(heroTitle, {
            scale: 0.8,
            opacity: 0,
            duration: 1.5,
            ease: 'back.out(1.7)',
            letterSpacing: '0.2em',
            clearProps: 'all'
        });
    }

    // Scroll-Linked 3D
    ScrollTrigger.create({
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => {
            if (arena3D) {
                arena3D.updateOnScroll(self.progress);
            }
        }
    });

    // Staggered reveals for elements with .stagger class
    const staggerContainers = document.querySelectorAll('.stagger');
    staggerContainers.forEach((container) => {
        const children = container.children;
        if (children.length > 0) {
            gsap.from(children, {
                scrollTrigger: {
                    trigger: container,
                    start: 'top 85%',
                },
                y: 50,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                stagger: 0.15
            });
        }
    });

    // Individual sections fade in
    const sections = document.querySelectorAll('.wrc-section');
    sections.forEach(section => {
        gsap.from(section, {
            scrollTrigger: {
                trigger: section,
                start: 'top 90%',
                toggleActions: 'play none none none'
            },
            opacity: 0,
            y: 30,
            duration: 1,
            ease: 'power2.out'
        });
    });
}
