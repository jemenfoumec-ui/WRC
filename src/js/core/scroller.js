import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

class Scroller {
    constructor() {
        this.lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            smoothTouch: false,
            touchMultiplier: 2,
            infinite: false,
        });

        this.init();
    }

    init() {
        this.lenis.on('scroll', ScrollTrigger.update);

        gsap.ticker.add((time) => {
            this.lenis.raf(time * 1000);
        });

        gsap.ticker.lagSmoothing(0);

        // Debug
        // this.lenis.on('scroll', (e) => {
        //     console.log(e);
        // });
    }

    scrollTo(target, options = {}) {
        this.lenis.scrollTo(target, options);
    }

    stop() {
        this.lenis.stop();
    }

    start() {
        this.lenis.start();
    }
}

export const scroller = new Scroller();
