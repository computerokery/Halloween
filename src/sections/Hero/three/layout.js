import manifest from '../../../assets/hero3d/manifest.json';

/**
 * World layout, derived from the 1280px design reference: 1 unit = 72 px of the reference.
 * The scene "slot" (the area the 2D hero used) is 10 × 9.25 units, x ∈ [-5, 5], y ∈ [0, 9.25].
 * The canvas extends past the slot (see .scene3d in Hero3D.css); the camera keeps the slot framed
 * exactly as in the design.
 */
export const SLOT_H = 9.25;
export const ABOVE = 0.14;                         // canvas extends 14% above the slot
export const FLOOR = 0.78;
const VIEW_H = SLOT_H * (1 + ABOVE);
export const FOV = 30;
const DIST = VIEW_H / 2 / Math.tan((FOV * Math.PI) / 360);
export const CAMERA_FINAL = [0, +(VIEW_H / 2).toFixed(3), +DIST.toFixed(3)];

/** Plane size from a pixel size, given the world width of a reference span of pixels. */
const plane = ({ size: [w, h] }, worldPerPx) => [w * worldPerPx, h * worldPerPx];

const pk = manifest.pumpkin;
const [pkW, pkH] = plane(pk, 4.5 / pk.bodyWidth);

const gh = manifest.ghost;
const [ghW, ghH] = plane(gh, 4.3 / gh.hemWidth);

const fo = manifest.foliage;
const [foW, foH] = plane(fo, 10.5 / fo.size[0]);

const pumpkinBase = [-0.24, FLOOR];
const ghostHem = [1.0, 3.0];  // centre of the hem's lower edge, behind the pumpkin
const small = manifest['ghost-small'];

export const LAYOUT = {
  pumpkin: {
    size: [pkW, pkH],
    position: [pumpkinBase[0], FLOOR + pkH / 2 - pk.base[1] * pkH, 0],
  },
  ghost: {
    size: [ghW, ghH],
    position: [ghostHem[0] - (gh.hemCenter - 0.5) * ghW, ghostHem[1] + ghH / 2 - gh.hemBottom * ghH, -0.8],
  },
  ghostLeft: { size: plane(small, 1.45 / small.size[0]), position: [-2.6, 4.45, 0.5] },
  ghostRight: { size: plane(small, 1.25 / small.size[0]), position: [4.05, 3.3, 0.9], mirror: true },
  // branches + leaf pile behind the pumpkin (the design's foliage)
  foliage: { size: [foW, foH], position: [pumpkinBase[0] + 0.25, FLOOR + foH / 2 - fo.base * foH - 0.05, -1.3] },
  // candles sit in the leaf pile beside the pumpkin
  candleTall: { size: plane(manifest.candle, 1.45 / manifest.candle.size[1]), position: [2.45, 0, 0.55] },
  candleSmall: { size: plane(manifest.candle, 0.95 / manifest.candle.size[1]), position: [-2.75, 0, 0.85], mirror: true },
};

// candles stand on the floor
for (const key of ['candleTall', 'candleSmall']) {
  const c = LAYOUT[key];
  c.position[1] = FLOOR + c.size[1] / 2 - 0.03;
}

/** World position of a UV point on a laid-out plane (z of the plane). */
export function uvToWorld(item, [u, v]) {
  const [w, h] = item.size;
  const [x, y, z] = item.position;
  return [x + (u - 0.5) * w, y + (v - 0.5) * h, z];
}

/** Where ghosts emerge: the opening at the top of the pumpkin. */
export const EMERGE = [pumpkinBase[0] + 0.05, FLOOR + pkH * 0.78, -0.3];
export const PUMPKIN_FACE = uvToWorld(LAYOUT.pumpkin, pk.flame);

export { manifest };
