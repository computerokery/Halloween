/**
 * Fate — everything on a Midnight Pass is derived from the guest's name, deterministically:
 * the same name always summons the same alter ego, hour, omen, number and sigil.
 * (That is the point: "the night already knows you".)
 */

export const MAX_NAME = 24;

/** Trim, collapse whitespace, drop control characters, cap the length. */
export function cleanName(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MAX_NAME);
}

/** cyrb53 — small, well-distributed string hash. */
function hash(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 — seeded PRNG in [0, 1). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

const EPITHETS = [
  'Velvet', 'Hollow', 'Ember', 'Gilded', 'Crimson', 'Lantern', 'Silent', 'Wicked', 'Moonlit',
  'Ashen', 'Restless', 'Candlelit', 'Thorned', 'Smoke', 'Midnight', 'Gloaming', 'Cinder', 'Crooked',
];
const BEINGS = [
  'Wraith', 'Revenant', 'Specter', 'Familiar', 'Oracle', 'Phantom', 'Raven', 'Wisp', 'Changeling',
  'Shade', 'Alchemist', 'Harbinger', 'Sleepwalker', 'Lamplighter', 'Gravekeeper', 'Moth', 'Hex', 'Siren',
];
const DOMAINS = [
  'the Seventh Candle', 'the Hollow Hour', 'the Last Dance', 'the Crooked Moon', 'the Velvet Mist',
  'the Burning Leaf', 'the Thirteenth Bell', 'the Empty Mirror', 'the Long Shadow', 'the Lost Key',
  'the Quiet Orchard', 'the Unlit Hall', 'the Black Lake', 'the Spinning Floor',
];
const OMENS = [
  'Come in something that glows in the dark.',
  'Wear one thing borrowed from a stranger.',
  'Bring a mask you have never worn before.',
  'Something velvet. Something torn.',
  'Your costume must hide one secret pocket.',
  'Come as the thing you were afraid of at seven.',
  'All black — except for one burning colour.',
  'Wear something that rustles when you move.',
  'Bring a single candle. Do not light it until midnight.',
  'Come as someone who has been dead for a very long time.',
  'Feathers, somewhere. The ghosts insist.',
  'Dress as tonight’s weather.',
];

/** Everything printed on a pass, derived from the name. */
export function fateOf(name) {
  const key = cleanName(name).trim().toLocaleLowerCase();
  const seed = hash(key || 'midnight');
  const r = rng(seed);
  const minute = Math.floor(r() * 60);
  return {
    seed,
    epithet: pick(r, EPITHETS),
    being: pick(r, BEINGS),
    domain: pick(r, DOMAINS),
    omen: pick(r, OMENS),
    hour: `11:${String(minute).padStart(2, '0')} PM`,
    number: String(1 + (seed % 9999)).padStart(4, '0'),
  };
}

export const alterEgo = (f) => `The ${f.epithet} ${f.being}`;

/* ---------- sigil ---------- */

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const pt = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const f2 = (n) => Math.round(n * 100) / 100;
const circle = (x, y, r) => `M${f2(x - r)} ${f2(y)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(r * 2)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-r * 2)} 0`;

/**
 * A sigil in a 200×200 box, as SVG path data (also valid for canvas Path2D).
 *   ring  — double outer ring + tick marks (slowly turns on screen)
 *   star  — a star polygon {n/k} through n points
 *   inner — a centre mark (circle, crescent or eye)
 *   spine — an axis through the centre with cross bars
 *   nodes — filled dots on some of the star's points
 */
export function sigilOf(seed) {
  const r = rng(seed ^ 0x5f3759df);
  const c = 100;

  const ticks = 12 + Math.floor(r() * 3) * 6; // 12, 18 or 24
  let ring = `${circle(c, c, 94)}${circle(c, c, 86)}`;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const [x1, y1] = pt(c, c, 86, a);
    const [x2, y2] = pt(c, c, i % 3 === 0 ? 78 : 82, a);
    ring += `M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`;
  }

  const n = 5 + Math.floor(r() * 5); // 5…9 points
  const steps = [2, 3, 4].filter((k) => k < n / 2 && gcd(n, k) === 1);
  const k = steps.length ? pick(r, steps) : 2;
  const rot = -Math.PI / 2 + (r() < 0.5 ? 0 : Math.PI / n);
  const R = 64;
  const points = Array.from({ length: n }, (_, i) => pt(c, c, R, rot + (i / n) * Math.PI * 2));
  let star = '';
  if (gcd(n, k) === 1) {
    let i = 0;
    star = `M${f2(points[0][0])} ${f2(points[0][1])}`;
    for (let s = 0; s < n; s++) {
      i = (i + k) % n;
      star += `L${f2(points[i][0])} ${f2(points[i][1])}`;
    }
  } else {
    // two interleaved polygons (e.g. hexagram)
    for (let o = 0; o < k; o++) {
      const loop = points.filter((_, i) => i % k === o);
      star += loop.map(([x, y], i) => `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`).join('') + 'Z';
    }
  }

  const innerKind = Math.floor(r() * 3);
  let inner;
  if (innerKind === 0) {
    inner = circle(c, c, 14 + r() * 8);
  } else if (innerKind === 1) {
    // crescent: two arcs between the same endpoints
    const rr = 18;
    inner = `M${c} ${c - rr}A${rr} ${rr} 0 1 0 ${c} ${c + rr}A${rr * 1.35} ${rr * 1.35} 0 0 1 ${c} ${c - rr}`;
  } else {
    // eye: two arcs + pupil
    inner = `M${c - 24} ${c}Q${c} ${c - 22} ${c + 24} ${c}Q${c} ${c + 22} ${c - 24} ${c}${circle(c, c, 5)}`;
  }

  const sa = rot + (Math.floor(r() * n) / n) * Math.PI * 2;
  const [sx1, sy1] = pt(c, c, 78, sa);
  const [sx2, sy2] = pt(c, c, 78, sa + Math.PI);
  let spine = `M${f2(sx1)} ${f2(sy1)}L${f2(sx2)} ${f2(sy2)}`;
  const bars = 1 + Math.floor(r() * 3);
  for (let b = 0; b < bars; b++) {
    const d = 34 + b * 12;
    const [bx, by] = pt(c, c, d, sa);
    const [ax1, ay1] = pt(bx, by, 7 - b, sa + Math.PI / 2);
    const [ax2, ay2] = pt(bx, by, 7 - b, sa - Math.PI / 2);
    spine += `M${f2(ax1)} ${f2(ay1)}L${f2(ax2)} ${f2(ay2)}`;
  }

  let nodes = '';
  points.forEach(([x, y]) => {
    if (r() < 0.55) nodes += circle(x, y, 3.2);
  });
  nodes += circle(sx1, sy1, 2.6) + circle(sx2, sy2, 2.6);

  return { ring, star, inner, spine, nodes };
}
