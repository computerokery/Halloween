import { getProject, types } from '@theatre/core';
import { buildState } from './theatreState.js';
import { CAMERA_FINAL } from './layout.js';
import { LENGTH } from './timing.js';

/**
 * The hero intro, as a Theatre.js sequence (seconds).
 *
 *   0.0  darkness, embers; the camera slowly pushes in on a moonlit pumpkin
 *   0.85 the wick sputters (spark) and smoke curls out of the top; 1.25 the flame takes —
 *        light spreads through the carving and scatters in the haze, sparks rise on the hot air
 *   1.45 camera pulls back and swings round to the final framing (3.9)
 *   1.9  the main ghost rises out of the pumpkin; 2.2 / 2.4 small ghosts swoop out
 *   2.3  leaves swirl up and start falling; 2.8 candles light
 *   3.0  typography (GSAP) begins — see TEXT_CUE
 *
 * Edit visually: run `npm run dev` and open /?studio (see .claude/skills/theatrejs).
 */
export { LENGTH, TEXT_CUE } from './timing.js';

const [cx, cy, cz] = CAMERA_FINAL;

const TRACKS = {
  Camera: {
    px: [[0, 1.0], [1.45, 0.6], [2.6, 3.2], [3.9, cx]],
    py: [[0, 3.2], [1.45, 2.95], [2.6, 4.3], [3.9, cy]],
    // a small push-in as the flame catches, then the pull-back
    pz: [[0, 14.2], [1.25, 12.6], [1.55, 11.9, 'out'], [2.6, 15.0], [3.9, cz]],
    tx: [[0, -0.2], [1.45, -0.2], [2.6, 0.4], [3.9, 0]],
    ty: [[0, 2.7], [1.45, 2.55], [2.6, 4.0], [3.9, cy]],
  },
  Pumpkin: {
    reveal: [[0.1, 0], [1.45, 1]],
    exposure: [[0, 0.4], [1.0, 0.6, 'out'], [1.25, 0.62], [2.2, 1]],
    spark: [[0.85, 0], [0.9, 0.8, 'linear'], [0.95, 0.15, 'linear'], [1.04, 0.6, 'linear'], [1.09, 0.1, 'linear'], [1.2, 1, 'linear'], [1.32, 0.55, 'linear'], [1.5, 1], [2.4, 0.3]],
    ignite: [[1.25, 0], [1.95, 1, 'out']],
    warm: [[1.25, 0], [2.3, 1]],
    glow: [[1.25, 0], [1.85, 2.0, 'out'], [2.9, 1.4]],
  },
  Ghosts: {
    main: [[1.9, 0], [3.4, 1, 'expoOut']],
    left: [[2.2, 0], [3.3, 1, 'out']],
    right: [[2.4, 0], [3.6, 1, 'out']],
  },
  Atmosphere: {
    foliage: [[0.35, 0], [2.2, 1]],
    embers: [[0, 0.25], [1.6, 0.35], [2.2, 1]],
    leaves: [[2.3, 0], [3.9, 1, 'out']],
    candles: [[2.8, 0], [3.5, 1, 'out']],
    bloom: [[0, 0.3], [1.25, 0.45], [1.6, 1.8, 'out'], [2.4, 1.25], [3.0, 1.1]],
    // the ignition beat (Ignition.jsx)
    smoke: [[0.8, 0], [3.4, 1, 'linear']],
    haze: [[1.2, 0], [1.6, 0.22, 'out'], [2.6, 0.12], [3.6, 0.08]],
    sparks: [[1.15, 0], [3.8, 1, 'linear']],
  },
};

/**
 * Scroll story (sheet "HeroScroll", position 0 → 1 = scroll progress through the pinned hero):
 *   0.00–0.40  text drifts away; the camera orbits right and lower, revealing the depth
 *   0.40–0.72  swings to the left; the main ghost rises toward the viewer, small ghosts
 *              circle the pumpkin, leaves swirl
 *   0.72–1.00  the camera dives toward the glowing face, light swells
 */
const SCROLL_TRACKS = {
  ScrollCamera: {
    px: [[0, cx], [0.4, 5.2], [0.72, -3.4], [1, -0.3]],
    py: [[0, cy], [0.4, 3.7], [0.72, 3.0], [1, 2.45]],
    pz: [[0, cz], [0.4, 14.5], [0.72, 10.8], [1, 6.6]],
    // aim off-centre so the scene sits opposite the story text (left / right / lower left)
    tx: [[0, 0], [0.2, -2.3], [0.36, -2.1], [0.5, 2.5], [0.64, 2.3], [0.78, 1.3], [0.88, 1.0], [1, -0.22]],
    ty: [[0, cy], [0.4, 3.5], [0.72, 3.3], [1, 2.3]],
  },
  ScrollFx: {
    rise: [[0, 0], [0.35, 0], [0.72, 1], [0.9, 0.6]],
    orbit: [[0, 0], [0.18, 0], [0.88, 1]],
    swirl: [[0, 0], [0.5, 0.6], [1, 1]],
    glow: [[0, 1], [0.7, 1.15], [1, 1.7]],
    bloom: [[0, 1], [0.7, 1.2], [1, 1.6]],
  },
};

const saved = import.meta.glob('./hero-state.json', { eager: true, import: 'default' });
const state =
  saved['./hero-state.json'] ??
  buildState({ Hero: { length: LENGTH, tracks: TRACKS }, HeroScroll: { length: 1, tracks: SCROLL_TRACKS } });

let instance = null;

async function maybeStudio() {
  if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('studio')) return;
  const { default: studio } = await import('@theatre/studio');
  studio.initialize();
}

/** Theatre project/sheet/objects; created once (after Studio when requested). */
export function loadChoreography() {
  instance ??= create();
  return instance;
}

async function create() {
  await maybeStudio();
  const project = getProject('MidnightClub', { state });
  const sheet = project.sheet('Hero');
  const num = (v, range) => types.number(v, { range, nudgeMultiplier: 0.01 });

  const cues = {
    project,
    sheet,
    camera: sheet.object('Camera', {
      px: types.number(cx), py: types.number(cy), pz: types.number(cz),
      tx: types.number(0), ty: types.number(cy),
    }),
    pumpkin: sheet.object('Pumpkin', {
      reveal: num(1, [0, 1]), exposure: num(1, [0, 1.5]), spark: num(0, [0, 1]), ignite: num(1, [0, 1]),
      warm: num(1, [0, 1]), glow: num(1.4, [0, 4]),
    }),
    ghosts: sheet.object('Ghosts', { main: num(1, [0, 1]), left: num(1, [0, 1]), right: num(1, [0, 1]) }),
    atmosphere: sheet.object('Atmosphere', {
      foliage: num(1, [0, 1]), smoke: num(1, [0, 1]), haze: num(0.08, [0, 2]), sparks: num(1, [0, 1]), embers: num(1, [0, 1]), leaves: num(1, [0, 1]), candles: num(1, [0, 1]), bloom: num(1.1, [0, 4]),
    }),
  };
  const scrollSheet = project.sheet('HeroScroll');
  cues.scrollSheet = scrollSheet;
  cues.scrollCamera = scrollSheet.object('ScrollCamera', {
    px: types.number(cx), py: types.number(cy), pz: types.number(cz), tx: types.number(0), ty: types.number(cy),
  });
  cues.scrollFx = scrollSheet.object('ScrollFx', {
    rise: num(0, [0, 2]), orbit: num(0, [0, 1]), swirl: num(0, [0, 1]), glow: num(1, [0, 4]), bloom: num(1, [0, 4]),
  });

  await project.ready;
  return cues;
}
