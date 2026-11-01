import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { scrollState } from '../sections/Hero/three/scroll.js';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** A beat: fades/rises in, holds while the camera moves, then drifts out. */
function beat(tl, name, start, end) {
  const selector = `.story__beat--${name}`;
  const shade = `.story__shade--${name}`;
  tl.fromTo(shade, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07, ease: 'power1.out' }, start - 0.02).to(
    shade,
    { autoAlpha: 0, duration: 0.06, ease: 'power1.in' },
    end - 0.04,
  );
  tl.fromTo(
    selector,
    { autoAlpha: 0, y: 40, filter: 'blur(10px)' },
    { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.06, ease: 'power2.out' },
    start,
  ).to(selector, { autoAlpha: 0, y: -40, filter: 'blur(8px)', duration: 0.05, ease: 'power2.in' }, end - 0.05);
}

/**
 * Scroll story for the 3D hero (desktop, motion allowed). The hero pins for 3.2 screens of
 * scrolling; progress is scrubbed (smoothed) into `scrollState.progress`, which the 3D scene
 * maps onto the Theatre sheet "HeroScroll" (camera orbit → ghosts circling → dive into the glow).
 * The copy follows the camera (see HeroStory.jsx) and ends on the invitation.
 * Scrolling back up plays everything in reverse.
 */
export default function useHeroScroll(scope, enabled) {
  useGSAP(
    () => {
      if (!enabled) return;
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1200px) and (prefers-reduced-motion: no-preference)', () => {
        const finale = document.querySelector('.story__finale');
        const tl = gsap.timeline({
          defaults: { ease: 'power1.in' },
          scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: '+=320%',
            pin: true,
            scrub: 1.2,
            anticipatePin: 1,
            // the finale's buttons are clickable only once it is on screen
            onUpdate: (self) => finale?.classList.toggle('is-active', self.progress > 0.9),
          },
        });

        tl.to(scrollState, { progress: 1, ease: 'none', duration: 1 }, 0)
          // the opening copy steps aside as the camera starts moving
          .to('.hero__meta', { y: 40, autoAlpha: 0, duration: 0.06 }, 0)
          .to('.hero__intro', { yPercent: -30, autoAlpha: 0, filter: 'blur(8px)', duration: 0.09 }, 0.005)
          .to('.hero__aside', { yPercent: -22, autoAlpha: 0, filter: 'blur(8px)', duration: 0.08 }, 0.015);

        beat(tl, 'ritual', 0.12, 0.34);   // orbit right, text left
        beat(tl, 'guests', 0.41, 0.63);   // ghosts circle, text right
        beat(tl, 'night', 0.68, 0.85);    // the dive begins

        tl.fromTo(
          '.story__finale',
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.07, ease: 'power2.out' },
          0.88,
        ).fromTo(
          '.story__finale-inner',
          { y: 36, scale: 0.96, filter: 'blur(12px)' },
          { y: 0, scale: 1, filter: 'blur(0px)', duration: 0.08, ease: 'power3.out' },
          0.89,
        );

        return () => {
          scrollState.progress = 0;
        };
      });
    },
    { scope, dependencies: [enabled] },
  );
}
