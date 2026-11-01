import { useEffect, useRef } from 'react';
import { Sparkle } from '../../components/Icons.jsx';

/**
 * Press-and-hold wax seal. Holding fills the ring (--p 0→1); letting go early lets it drain.
 * Pointer and keyboard (hold Space / Enter) both work; an assistive-tech activation (a click
 * with no pointer or key hold behind it) seals at once.
 */
export default function SealButton({ disabled, duration, onSeal, children }) {
  const ref = useRef(null);
  const state = useRef({ p: 0, holding: false, raf: 0, last: 0, lastKey: -1e9, done: false });

  useEffect(() => () => cancelAnimationFrame(state.current.raf), []);

  useEffect(() => {
    if (disabled) {
      const s = state.current;
      s.holding = false;
      s.p = 0;
      ref.current?.style.setProperty('--p', 0);
    }
  }, [disabled]);

  const tick = (now) => {
    const s = state.current;
    const dt = now - s.last;
    s.last = now;
    s.p = s.holding ? Math.min(1, s.p + dt / duration) : Math.max(0, s.p - dt / 320);
    ref.current?.style.setProperty('--p', s.p.toFixed(4));
    // the whole ritual answers the hold (sigil flares, halo swells — see Summon.css)
    ref.current?.closest('.summon')?.style.setProperty('--seal', s.p.toFixed(4));
    ref.current?.classList.toggle('is-holding', s.holding);
    if (s.p >= 1 && !s.done) {
      s.done = true;
      s.holding = false;
      navigator.vibrate?.(40);
      onSeal();
      return;
    }
    if (s.holding || s.p > 0) s.raf = requestAnimationFrame(tick);
  };

  const start = () => {
    const s = state.current;
    if (disabled || s.done || s.holding) return;
    s.holding = true;
    s.last = performance.now();
    cancelAnimationFrame(s.raf);
    s.raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    state.current.holding = false;
  };

  return (
    <button
      ref={ref}
      type="button"
      className="seal"
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        state.current.lastKey = performance.now();
        if (e.repeat) return;
        start();
      }}
      onKeyUp={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        state.current.lastKey = performance.now();
        stop();
      }}
      onBlur={stop}
      onClick={(e) => {
        // a screen reader "double tap" / virtual click: no physical hold possible
        const s = state.current;
        const fromKeys = performance.now() - s.lastKey < 400;
        if (e.detail === 0 && !fromKeys && !disabled && !s.done) {
          s.done = true;
          onSeal();
        }
      }}
    >
      <span className="seal__wax" aria-hidden="true">
        <Sparkle size={22} />
      </span>
      <span className="seal__label">{children}</span>
    </button>
  );
}
