import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, SplitText);

const SELECTORS = {
  header: '.header__inner',
  words: '.hero__word:not(.hero__word--accent)',
  accent: '.hero__word--accent',
  label: '.hero__label',
  copy: '.hero__copy',
  buttons: '.hero__btn',
  meta: '.hero__meta .date-indicator, .hero__details',
};

const CREAM = '#f5ebdd';
const EMBER = '#ffb45c';
const LETTERS = { each: 0.055, from: 'start' };

/**
 * Hero typography reveal (GSAP + SplitText). Everything starts hidden before the first paint;
 * the timeline plays when `cue` arrives ({ delay } in seconds — synced to the 3D intro).
 *
 *  · MIDNIGHT / IS — each letter rises out of its line and catches the pumpkin's light:
 *    it arrives as a warm, glowing ember and cools to cream as it settles.
 *  · CALLING — wiped in left to right while a band of light sweeps through its gradient,
 *    with a brief warm halo; afterwards the light sweep returns every few seconds.
 */
export default function useIntroText(scope, cue) {
  useGSAP(
    () => {
      const all = Object.values(SELECTORS).join(',');
      if (!cue) {
        gsap.set(all, { autoAlpha: 0 });
        return;
      }

      const mm = gsap.matchMedia();
      mm.add(
        { motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' },
        ({ conditions }) => {
          if (conditions.reduce) {
            gsap.fromTo(all, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, stagger: 0.03, delay: 0.1 });
            return undefined;
          }

          const split = SplitText.create(SELECTORS.words, { type: 'chars', charsClass: 'char' });
          gsap.set(all, { autoAlpha: 1 });

          const tl = gsap.timeline({ delay: cue.delay, defaults: { ease: 'expo.out', duration: 1.1 } });
          tl.from(SELECTORS.header, { autoAlpha: 0, y: -14, duration: 1 }, 0)
            // letters rise out of the line…
            .from(split.chars, { autoAlpha: 0, yPercent: 70, filter: 'blur(10px)', duration: 1.3, stagger: LETTERS }, 0.05)
            // …lit warm by the pumpkin, cooling to cream as they settle
            .fromTo(
              split.chars,
              { color: EMBER, textShadow: '0 0 26px rgba(255, 140, 50, 0.95)' },
              { color: CREAM, textShadow: '0 0 0px rgba(255, 140, 50, 0)', duration: 1.9, ease: 'power2.out', stagger: LETTERS },
              0.05,
            )
            .fromTo(
              SELECTORS.accent,
              {
                clipPath: 'inset(-20% 100% -20% -10%)',
                backgroundPosition: '0% 50%',
                filter: 'drop-shadow(0 0 0px rgba(233, 120, 32, 0))',
              },
              {
                clipPath: 'inset(-20% -10% -20% -10%)',
                backgroundPosition: '100% 50%',
                filter: 'drop-shadow(0 0 22px rgba(233, 120, 32, 0.75))',
                duration: 1.5,
                ease: 'power3.inOut',
              },
              0.55,
            )
            .to(SELECTORS.accent, { filter: 'drop-shadow(0 0 10px rgba(233, 120, 32, 0.22))', duration: 1.4, ease: 'power2.out' }, 2.05)
            .from(SELECTORS.copy, { autoAlpha: 0, y: 16 }, 0.45)
            .from(SELECTORS.label, { autoAlpha: 0, y: 12 }, 0.75)
            .from(SELECTORS.buttons, { autoAlpha: 0, y: 16, stagger: 0.09 }, 0.6)
            .from(SELECTORS.meta, { autoAlpha: 0, y: 14, stagger: 0.1 }, 0.85)
            // idle: the light sweep returns every few seconds
            .to(
              SELECTORS.accent,
              { backgroundPosition: '0% 50%', duration: 1.8, ease: 'power2.inOut', repeat: -1, yoyo: true, repeatDelay: 4.5 },
              4.5,
            );

          return () => split.revert();
        },
      );
    },
    { scope, dependencies: [cue], revertOnUpdate: true },
  );
}
