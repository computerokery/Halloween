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
export const assetUrl = (name) => files[`../../../assets/hero3d/${name}`];

export const smoothstep = THREE.MathUtils.smoothstep;
export const damp = THREE.MathUtils.damp;
export const lerp = THREE.MathUtils.lerp;
