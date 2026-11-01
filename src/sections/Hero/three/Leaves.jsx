import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { EMERGE, FLOOR, LAYOUT, PUMPKIN_FACE, manifest } from './layout.js';
import { flicker } from './CharacterMaterial.js';
import { assetUrl, lerp, smoothstep } from './rig.js';

const SPRITES = ['leaf-1', 'leaf-2', 'leaf-3', 'leaf-4'];
const TOP = 10.5;
const RANGE = TOP - FLOOR;

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function useLeafMaterials() {
  const maps = useTexture(SPRITES.map((s) => assetUrl(`${s}.webp`)));
  return useMemo(
    () =>
      maps.map((map) => {
        map.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      }),
    [maps],
  );
}

const leafSize = (sprite, width) => {
  const [w, h] = manifest[sprite].size;
  return [width, (width * h) / w];
};

/**
 * Leaves burst out of the pumpkin in a swirl during the intro, then fall and tumble in 3D,
 * each on its own speed and path.
 */
export function FallingLeaves({ cues, count }) {
  const materials = useLeafMaterials();
  const refs = useRef([]);
  const leaves = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: count }, (_, i) => {
      const sprite = i % SPRITES.length;
      return {
        sprite,
        size: leafSize(SPRITES[sprite], 0.32 + r() * 0.34),
        x: (r() * 2 - 1) * 5.2,     // stay clear of the text columns
        z: -2.5 + r() * 5.5,
        speed: 0.32 + r() * 0.3,
        phase: r() * RANGE,
        sway: 0.4 + r() * 0.8,
        spin: [0.6 + r() * 1.4, 0.4 + r() * 1.2, r() * Math.PI * 2],
        swirl: r() * Math.PI * 2,
        lift: 0.6 + r() * 0.5,
      };
    });
  }, [count]);

  const vortex = useRef(0);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const v = cues.atmosphere.value.leaves;
    const swirl = cues.scrollFx.value.swirl;
    // the vortex angle accumulates over time (slowly), so scrolling never makes it jump
    vortex.current += Math.min(delta, 0.05) * 0.22 * swirl;
    leaves.forEach((l, i) => {
      const m = refs.current[i];
      if (!m) return;
      // steady state: falling loop
      const fy = TOP - ((t * l.speed + l.phase) % RANGE);
      // while scrolling the fall turns into a slow vortex around the pumpkin
      const sa = vortex.current + swirl * l.phase * 0.3;
      const fx = l.x * Math.cos(sa) - l.z * Math.sin(sa) * swirl + Math.sin(t * 0.55 + l.phase) * l.sway * (1 + swirl * 0.4);
      const fz = l.z * Math.cos(sa) + l.x * Math.sin(sa) * swirl + Math.cos(t * 0.4 + l.phase) * 0.35;
      // intro: a vortex out of the pumpkin
      const a = l.swirl + v * 7;
      const rad = 0.3 + v * 4.2;
      const sx = EMERGE[0] + Math.cos(a) * rad;
      const sy = EMERGE[1] - 0.6 + v * 6.5 * l.lift;
      const sz = Math.sin(a) * rad * 0.6;
      const w = smoothstep(v, 0.55, 1);
      m.position.set(lerp(sx, fx, w), lerp(sy, fy, w), lerp(sz, fz, w));
      m.rotation.set(t * l.spin[0] + l.phase, t * l.spin[1], Math.sin(t * 0.8 + l.spin[2]) * 0.7);
      const fade = Math.min(1, (fy - FLOOR) / 0.6); // sink out at the floor
      m.scale.setScalar(smoothstep(v, 0, 0.15) * lerp(1, fade, w));
    });
  });

  return leaves.map((l, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} material={materials[l.sprite]} renderOrder={l.z > 0.5 ? 7 : 1} scale={0}>
      <planeGeometry args={l.size} />
    </mesh>
  ));
}

/**
 * A pile of leaves around the pumpkin's base — some flat, some propped up — hiding where the
 * pumpkin and candles meet the floor. Every leaf is lit by distance from the pumpkin's mouth and
 * the candle flames (inverse-square falloff, flickering), so the pile glows near the light and
 * sinks into darkness at its edges.
 */
export function LeafPile({ cues, count }) {
  const materials = useLeafMaterials();
  const refs = useRef([]);
  const leaves = useMemo(() => {
    const r = rng(41);
    const items = [];
    const add = (cx, cz, rx, rz, n, a0, a1, scale) => {
      for (let i = 0; i < n; i++) {
        const a = a0 + r() * (a1 - a0);
        const rad = 0.55 + r() * 0.45;
        const tilt = r() < 0.4 ? 0.5 + r() * 0.5 : r() * 0.25; // some propped up against the pile
        const sprite = Math.floor(r() * SPRITES.length);
        const width = scale * (0.38 + r() * 0.3);
        items.push({
          sprite,
          size: leafSize(SPRITES[sprite], width),
          pos: [cx + Math.cos(a) * rx * rad, FLOOR + 0.02 + tilt * width * 0.3, cz + Math.sin(a) * rz * rad],
          rot: [-Math.PI / 2 + tilt, (r() - 0.5) * 0.6, r() * Math.PI * 2],
          tone: 0.75 + r() * 0.35,
        });
      }
    };
    const [px] = PUMPKIN_FACE;
    add(px, 0.25, 2.3, 0.55, Math.round(count * 0.35), 0.05, Math.PI - 0.05, 1.25); // buries the base line
    add(px, 0.45, 3.1, 1.2, Math.round(count * 0.3), 0.15, Math.PI - 0.15, 1);    // front arc
    add(px, -0.2, 3.4, 0.6, Math.round(count * 0.15), -0.3, Math.PI + 0.3, 1.1); // sides
    add(LAYOUT.candleTall.position[0], LAYOUT.candleTall.position[2] + 0.2, 0.7, 0.4, Math.round(count * 0.1), 0, Math.PI, 0.8);
    add(LAYOUT.candleSmall.position[0], LAYOUT.candleSmall.position[2] + 0.2, 0.6, 0.35, Math.round(count * 0.1), 0, Math.PI, 0.75);
    // far leaves first so nearer ones overlap them
    return items.sort((a, b) => a.pos[2] - b.pos[2]);
  }, [count]);

  const tinted = useMemo(() => leaves.map((l) => materials[l.sprite].clone()), [leaves, materials]);
  const lights = useMemo(() => {
    const flame = (item) => {
      const [w, h] = item.size;
      const fx = item.mirror ? 1 - manifest.candle.flame[0] : manifest.candle.flame[0];
      return new THREE.Vector3(item.position[0] + (fx - 0.5) * w, item.position[1] + (manifest.candle.flame[1] - 0.5) * h, item.position[2]);
    };
    return { pumpkin: new THREE.Vector3(PUMPKIN_FACE[0], PUMPKIN_FACE[1] - 0.4, 0.6), a: flame(LAYOUT.candleTall), b: flame(LAYOUT.candleSmall) };
  }, []);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = cues.pumpkin.value;
    const c = cues.atmosphere.value.candles;
    const fp = flicker(t, 1.3);
    leaves.forEach((l, i) => {
      v.set(...l.pos);
      const lp = (p.ignite * p.warm * 3.2 * fp) / (1 + v.distanceToSquared(lights.pumpkin) * 0.55);
      const la = (c * 1.1 * flicker(t * 1.3, 5.1)) / (1 + v.distanceToSquared(lights.a) * 2.2);
      const lb = (c * 0.9 * flicker(t * 1.3, 8.7)) / (1 + v.distanceToSquared(lights.b) * 2.6);
      const k = Math.min(1.25, 0.05 + lp + la + lb) * l.tone;
      // warm light reads redder as it falls off
      tinted[i].color.setRGB(k, k * (0.72 + 0.2 * Math.min(1, k)), k * (0.5 + 0.25 * Math.min(1, k)));
      tinted[i].opacity = Math.min(1, p.reveal * 1.6);
    });
  });

  return leaves.map((l, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} position={l.pos} rotation={l.rot} material={tinted[i]} renderOrder={l.pos[2] > 0.5 ? 6 : 4.5}>
      <planeGeometry args={l.size} />
    </mesh>
  ));
}
