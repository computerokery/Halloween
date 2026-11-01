import * as THREE from 'three';

/** Window pointer in -1..1 (the canvas itself ignores pointer events so the UI stays clickable). */
export const pointer = { x: 0, y: 0 };

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );
}

const files = import.meta.glob('../../../assets/hero3d/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
/** URL of a bundled hero asset. Throws if it is missing — a silent `undefined` would make some
 *  helpers (e.g. drei <Clouds>) fall back to remote default textures. */
export const assetUrl = (name) => {
  const url = files[`../../../assets/hero3d/${name}`];
  if (!url) throw new Error(`Missing hero asset: ${name} (run python tools/build_3d_assets.py)`);
  return url;
};

export const smoothstep = THREE.MathUtils.smoothstep;
export const damp = THREE.MathUtils.damp;
export const lerp = THREE.MathUtils.lerp;
