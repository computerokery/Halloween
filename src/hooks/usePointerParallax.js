import { useEffect } from 'react';

/**
 * Writes eased pointer position to CSS vars --mx / --my (-1..1) on the target element.
 * Layers translate by `var(--mx) * depth`, so the effect lives entirely in CSS.
 * The rAF loop only runs while the values are still settling.
 * Disabled for touch devices and prefers-reduced-motion.
 */
export default function usePointerParallax(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const fine = window.matchMedia('(pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return undefined;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;

    const tick = () => {
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      el.style.setProperty('--mx', current.x.toFixed(4));
      el.style.setProperty('--my', current.y.toFixed(4));
      const settled = Math.abs(target.x - current.x) < 0.0005 && Math.abs(target.y - current.y) < 0.0005;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [ref]);
}
