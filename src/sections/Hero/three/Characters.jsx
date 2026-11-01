import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Trail, useTexture } from '@react-three/drei';
import { createCharacterMaterial, flicker } from './CharacterMaterial.js';
import { EMERGE, LAYOUT, PUMPKIN_FACE, manifest } from './layout.js';
import { assetUrl, damp, lerp, smoothstep } from './rig.js';

/** Loads colour + glow + height maps for an asset and builds its material. */
function useCharacter(name, options = {}) {
  const tex = useTexture({
    map: assetUrl(`${name}.webp`),
    glowMap: assetUrl(`${name}-glow.png`),
    depthMap: assetUrl(`${name}-depth.png`),
  });
  return useMemo(() => {
    tex.map.colorSpace = THREE.SRGBColorSpace;
    tex.map.anisotropy = 8;
    const [w, h] = manifest[name].size;
    const material = createCharacterMaterial({ ...tex, aspect: w / h, ...options });
    material.side = THREE.DoubleSide; // mirrored copies (scale.x = -1) show their back face
    return material;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex]);
}

const tmp = new THREE.Vector3();

/** Turns a plane part of the way toward the camera so the relief reads without looking flat. */
function faceCamera(obj, camera, amount, delta) {
  obj.getWorldPosition(tmp);
  const target = Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z) * amount;
  obj.rotation.y = damp(obj.rotation.y, target, 6, delta);
}

/* -------------------------------------------------------------------------------------------- */

export function Pumpkin({ cues }) {
  const { size, position } = LAYOUT.pumpkin;
  const material = useCharacter('pumpkin', { origin: manifest.pumpkin.flame, depth: 0.85, shade: 0.4, falloff: 3.2, sss: 1 });
  const [ox, oy] = manifest.pumpkin.flame;
  const mesh = useRef();
  const light = useRef();

  useFrame(({ clock, camera }, delta) => {
    const p = cues.pumpkin.value;
    const f = flicker(clock.elapsedTime, 1.3);
    const u = material.uniforms;
    u.uExposure.value = p.exposure;
    u.uReveal.value = p.reveal; // materialises out of the dark through smoky noise
    u.uSpark.value = p.spark;
    u.uIgnite.value = p.ignite;
    u.uWarm.value = p.warm;
    u.uGlow.value = p.glow * cues.scrollFx.value.glow;
    u.uFlicker.value = f;
    // the flame wanders a little, so the light pattern inside moves with it
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uOrigin.value.set(ox + Math.sin(t * 6.1) * 0.006 + Math.sin(t * 13.7) * 0.003, oy + Math.sin(t * 4.3) * 0.008);
    light.current.intensity = p.ignite * p.glow * cues.scrollFx.value.glow * 9 * f;
    faceCamera(mesh.current, camera, 0.35, delta);
  });

  return (
    <>
      <mesh ref={mesh} position={position} renderOrder={4} material={material}>
        <planeGeometry args={[size[0], size[1], 128, 128]} />
      </mesh>
      <pointLight ref={light} position={[PUMPKIN_FACE[0], PUMPKIN_FACE[1] + 0.2, 1.6]} color="#ff8a2a" distance={16} decay={1.4} intensity={0} />
    </>
  );
}

/* -------------------------------------------------------------------------------------------- */

const bezier2 = (a, b, c, t, out) => {
  const u = 1 - t;
  return out.set(
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
    u * u * a[2] + 2 * u * t * b[2] + t * t * c[2],
  );
};

const bezier3 = (a, b, c, d, t, out) => {
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return out.set(
    k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0],
    k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1],
    k[0] * a[2] + k[1] * b[2] + k[2] * c[2] + k[3] * d[2],
  );
};

/** Main ghost: rises out of the pumpkin, overshoots up into the air and settles behind it. */
export function GhostMain({ cues, reduced }) {
  const { size, position } = LAYOUT.ghost;
  const g = manifest.ghost;
  const material = useCharacter('ghost', { depth: 0.75, hemTop: g.hemTop + 0.08, still: g.still });
  const group = useRef();
  const hemBottom = [position[0], position[1] - size[1] / 2, position[2]];
  const start = [EMERGE[0], EMERGE[1] - 1.6, -0.5];
  const ctrl = [lerp(EMERGE[0], hemBottom[0], 0.4), hemBottom[1] + 1.1, -0.4];
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    const p = cues.ghosts.value.main;
    bezier2(start, ctrl, hemBottom, p, pos);
    pos.y += Math.sin(t * 0.9) * 0.1 * p;
    const rise = cues.scrollFx.value.rise;
    // drifts toward the viewer (not up and out of frame)
    pos.x -= rise * 0.9;
    pos.y -= rise * 0.35;
    pos.z += rise * 2.4;
    group.current.position.copy(pos);
    group.current.scale.setScalar(lerp(0.12, 1, smoothstep(p, 0, 0.55)));
    group.current.rotation.z = (1 - p) * Math.sin(p * 10) * 0.35 + Math.sin(t * 0.6) * 0.02;
    faceCamera(group.current, camera, 0.4, delta);

    const u = material.uniforms;
    u.uTime.value = t;
    u.uOpacity.value = smoothstep(p, 0, 0.12);
    u.uWave.value = reduced ? 0.3 : 1 + 2.2 * Math.sin(Math.PI * p) * (1 - p);
    u.uGlow.value = 1.6 * p;
    u.uFlicker.value = flicker(t, 4.1);
  });

  return (
    <group ref={group}>
      <mesh position={[0, size[1] / 2, 0]} renderOrder={2} material={material}>
        <planeGeometry args={[size[0], size[1], 128, 128]} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------------------------- */

const SMALL = {
  left: {
    asset: 'ghost-small',
    layout: LAYOUT.ghostLeft,
    c1: (s) => [s[0] - 1.2, s[1] + 4.2, 1.2],
    c2: (e) => [e[0] - 1.8, e[1] + 2.4, 1.8],
    seed: 0.7,
    dir: 1,
  },
  right: {
    asset: 'ghost-small',
    layout: LAYOUT.ghostRight,
    c1: (s) => [s[0] + 1.6, s[1] + 4.6, 0.8],
    c2: (e) => [e[0] + 1.4, e[1] + 2.8, 2.2],
    seed: 2.3,
    dir: -1,
  },
};

const TRAIL_COLOR = new THREE.Color(2.6, 1.35, 0.5);

/** Small ghost: swoops out of the pumpkin on an arc, leaving a light trail, then floats. */
export function SmallGhost({ cues, side, reduced }) {
  const cfg = SMALL[side];
  const { size, position } = cfg.layout;
  const material = useCharacter(cfg.asset, { depth: 0.3, hemTop: 0.5 });
  const group = useRef();
  const mesh = useRef();
  const [flying, setFlying] = useState(false);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const prev = useMemo(() => new THREE.Vector3(), []);
  const c1 = cfg.c1(EMERGE);
  const c2 = cfg.c2(position);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    const p = cues.ghosts.value[side];
    prev.copy(group.current.position);
    bezier3(EMERGE, c1, c2, position, p, pos);
    const orbit = cues.scrollFx.value.orbit;
    if (orbit > 0) {
      const a = Math.atan2(position[2] - 0.2, position[0] - EMERGE[0]) + orbit * Math.PI * 1.6 * cfg.dir;
      const k = smoothstep(orbit, 0, 0.2);
      pos.x = lerp(pos.x, EMERGE[0] + Math.cos(a) * 3.6, k);
      pos.z = lerp(pos.z, 0.2 + Math.sin(a) * 2.4, k);
      pos.y = lerp(pos.y, position[1] + Math.sin(orbit * Math.PI * 2 + cfg.seed) * 0.6, k);
    }
    pos.y += Math.sin(t * 1.25 + cfg.seed * 3) * 0.12 * p;
    group.current.position.copy(pos);
    group.current.scale.setScalar(lerp(0.15, 1, smoothstep(p, 0, 0.6)));

    // bank into the direction of travel while flying, gentle sway once settled
    const vx = delta > 0 ? (pos.x - prev.x) / delta : 0;
    const bank = THREE.MathUtils.clamp(-vx * 0.06, -0.5, 0.5) * (1 - p);
    group.current.rotation.z = damp(group.current.rotation.z, bank + Math.sin(t * 0.9 + cfg.seed) * 0.07, 5, delta);
    faceCamera(group.current, camera, 0.5, delta);
    // behind the pumpkin while leaving it, in front once out
    mesh.current.renderOrder = p < 0.3 ? 1 : 6;

    const u = material.uniforms;
    u.uTime.value = t + cfg.seed;
    u.uOpacity.value = smoothstep(p, 0.02, 0.2);
    u.uWave.value = reduced ? 0.2 : 0.7;

    const shouldFly = !reduced && p > 0.01 && p < 0.97;
    if (shouldFly !== flying) setFlying(shouldFly);
  });

  return (
    <>
      <group ref={group}>
        <mesh ref={mesh} material={material} scale-x={cfg.layout.mirror ? -1 : 1}>
          <planeGeometry args={[size[0], size[1], 48, 48]} />
        </mesh>
      </group>
      {flying && (
        <Trail target={group} width={1.1} length={4.5} decay={1.4} color={TRAIL_COLOR} attenuation={(w) => w * w} />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------------------------- */

/** Candles: the flame grows from the wick when lit, then flickers (HDR → bloom). */
export function Candle({ cues, which }) {
  const item = which === 'tall' ? LAYOUT.candleTall : LAYOUT.candleSmall;
  const flame = manifest.candle.flame;
  const material = useCharacter('candle', { origin: flame, depth: 0.25, hideUnlit: true, shade: 0.55 });
  const light = useRef();
  const seed = which === 'tall' ? 5.1 : 8.7;

  useFrame(({ clock }) => {
    const c = cues.atmosphere.value.candles;
    const warm = cues.pumpkin.value.warm;
    const f = flicker(clock.elapsedTime * 1.3, seed);
    const u = material.uniforms;
    u.uIgnite.value = c;
    u.uWarm.value = Math.max(warm, c);
    // in the dark the wax is barely there; the pumpkin's light reaches it first, then its own flame
    u.uExposure.value = lerp(0.04 + 0.4 * warm, 1, c);
    u.uOpacity.value = Math.min(1, cues.pumpkin.value.reveal * 1.6);
    u.uGlow.value = 2.4 * c;
    u.uFlicker.value = f;
    light.current.intensity = c * 1.6 * f;
  });

  const [w, h] = item.size;
  const [x, y, z] = item.position;
  const flameX = item.mirror ? 1 - flame[0] : flame[0];
  return (
    <>
      <mesh position={item.position} renderOrder={5} material={material} scale-x={item.mirror ? -1 : 1}>
        <planeGeometry args={[w, h, 24, 24]} />
      </mesh>
      <pointLight ref={light} position={[x + (flameX - 0.5) * w, y + (flame[1] - 0.5) * h + 0.1, z + 0.4]} color="#ffa040" distance={5} decay={1.6} intensity={0} />
    </>
  );
}

/* -------------------------------------------------------------------------------------------- */

/** Branches and leaf pile behind the pumpkin — grow out of the pile, in shadow until the pumpkin lights them. */
export function Foliage({ cues }) {
  const { size, position } = LAYOUT.foliage;
  const material = useCharacter('foliage', { depth: 0.2, shade: 0.45, revealMode: 1 });

  useFrame(({ clock }) => {
    const p = cues.pumpkin.value;
    const u = material.uniforms;
    u.uWarm.value = p.warm;
    u.uExposure.value = lerp(0.18, 1, p.warm) * (0.94 + 0.06 * flicker(clock.elapsedTime, 1.3));
    u.uReveal.value = cues.atmosphere.value.foliage; // branches grow up out of the leaf pile
  });

  return (
    <mesh position={position} renderOrder={0.5} material={material}>
      <planeGeometry args={[size[0], size[1], 64, 64]} />
    </mesh>
  );
}
