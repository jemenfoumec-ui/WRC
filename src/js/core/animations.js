import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { logger } from './config.js';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations(globe) {
    // Hero Text Animation
    const heroTitle = document.querySelector('.hero-content h1, .wrc-hero-title');
    const heroSubtitle = document.querySelector('.hero-content p, .wrc-hero-subtitle');
    const heroCTA = document.querySelector('.hero-content .cta-group, .wrc-hero-actions');

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

    // Scroll-Linked 3D Globe
    ScrollTrigger.create({
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1,
        onUpdate: (self) => {
            if (globe && typeof globe.updateCameraOnScroll === 'function') {
                globe.updateCameraOnScroll(self.progress);
            }
        }
    });

    // Stagger Reveals for sections
    const staggerSections = document.querySelectorAll('.stagger-reveal, .stagger');
    staggerSections.forEach(section => {
        const children = section.children;
        if (children.length > 0) {
            gsap.from(children, {
                scrollTrigger: {
                    trigger: section,
                    start: 'top 80%',
                    toggleActions: 'play none none reverse'
                },
                y: 60,
                opacity: 0,
                duration: 0.8,
                stagger: 0.15,
                ease: 'power2.out'
            });
        }
    });

    // Industrial typography effects
    const punchyText = document.querySelectorAll('.punchy-text, .wrc-section-title');
    punchyText.forEach(text => {
        gsap.from(text, {
            scrollTrigger: {
                trigger: text,
                start: 'top 90%',
                scrub: true
            },
            letterSpacing: '0em',
            ease: 'none'
        });
    });

    // Counter animations for stats
    const statValues = document.querySelectorAll('.stat-value, .stat-value[id]');
    statValues.forEach(stat => {
        const finalValue = stat.textContent;
        const numericValue = parseInt(finalValue.replace(/[^0-9]/g, ''), 10);
        
        if (!isNaN(numericValue) && numericValue > 0) {
            gsap.from(stat, {
                scrollTrigger: {
                    trigger: stat,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                textContent: 0,
                duration: 2,
                ease: 'power2.out',
                snap: { textContent: 1 },
                onUpdate: function() {
                    const current = Math.round(gsap.getProperty(stat, 'textContent'));
                    stat.textContent = current.toLocaleString();
                }
            });
        }
    });

    // Parallax effects for cards
    const cards = document.querySelectorAll('.glass-card, .nation-card, .stat-card, .step-card');
    cards.forEach(card => {
        gsap.to(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.5
            },
            y: -20,
            ease: 'none'
        });
    });

    logger.info('Animations initialized');
}
