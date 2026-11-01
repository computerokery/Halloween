import leaf1 from '../../assets/hero/leaf-1.webp';
import leaf2 from '../../assets/hero/leaf-2.webp';
import leaf3 from '../../assets/hero/leaf-3.webp';
import leaf4 from '../../assets/hero/leaf-4.webp';

const LEAF_SPRITES = [leaf1, leaf2, leaf3, leaf4];

/* Deterministic PRNG so markup is stable between renders. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = rng(31);
const range = (min, max) => min + rand() * (max - min);

const PARTICLES = Array.from({ length: 26 }, () => ({
  x: range(8, 92),
  y: range(12, 96),
  size: range(1.5, 3.6),
  dur: range(5, 8),
  delay: -range(0, 8),
  dx: range(-24, 24),
  rise: range(90, 180),
  o: range(0.45, 0.95),
}));

/* Hand-placed lanes (% of the scene plate) keep leaves away from the copy columns. */
const LEAVES = [
  { sprite: 1, x: 24, size: 26, dur: 9.2, delay: 0, sway: 34, spin: 1 },
  { sprite: 3, x: 70, size: 34, dur: 8.1, delay: 1.6, sway: -28, spin: -1 },
  { sprite: 0, x: 46, size: 40, dur: 10, delay: 3.4, sway: 40, spin: 1 },
  { sprite: 2, x: 84, size: 24, dur: 7.4, delay: 5.1, sway: -22, spin: -1 },
  { sprite: 1, x: 34, size: 20, dur: 8.6, delay: 6.8, sway: 26, spin: -1, far: true },
  { sprite: 3, x: 60, size: 22, dur: 9.6, delay: 8.3, sway: -30, spin: 1, far: true },
];

const px = (v) => `${v.toFixed(2)}px`;

export function Smoke({ layer }) {
  const blobs = layer === 'back' ? ['a', 'b'] : ['c'];
  return (
    <div className={`smoke smoke--${layer}`} aria-hidden="true">
      {blobs.map((b) => (
        <span key={b} className={`smoke__blob smoke__blob--${b}`} />
      ))}
    </div>
  );
}

export function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: px(p.size),
            height: px(p.size),
            '--dur': `${p.dur.toFixed(2)}s`,
            '--delay': `${p.delay.toFixed(2)}s`,
            '--dx': px(p.dx),
            '--rise': px(-p.rise),
            '--o': p.o.toFixed(2),
          }}
        />
      ))}
    </div>
  );
}

export function Leaves() {
  return (
    <div className="leaves" aria-hidden="true">
      {LEAVES.map((l, i) => (
        <span
          key={i}
          className={`leaf${l.far ? ' leaf--far' : ''}`}
          style={{
            left: `${l.x}%`,
            width: `${l.size}px`,
            '--dur': `${l.dur}s`,
            '--delay': `${l.delay}s`,
            '--sway': `${l.sway}px`,
            '--spin': l.spin,
          }}
        >
          <span className="leaf__fall">
            <span className="leaf__sway">
              <img className="leaf__img" src={LEAF_SPRITES[l.sprite]} alt="" decoding="async" />
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
