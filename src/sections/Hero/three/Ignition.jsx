import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { EMERGE, PUMPKIN_FACE } from './layout.js';
import { assetUrl } from './rig.js';

/**
 * The ignition beat — what really happens when a candle catches inside a pumpkin:
 *   · smoke   a thin curl of smoke rises out of the top while the wick sputters
 *   · haze    the flame's light scatters in the night air: a soft, flickering glow (no beams)
 *   · sparks  rise on the hot air from the top and the mouth, staggered, cooling from yellow
 *             to deep red as they climb, twinkling out
 * Driven by Theatre "Atmosphere" cues (smoke / haze / sparks).
 */

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function Haze({ cues }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uStrength: { value: 0 }, uTime: { value: 0 } },
        fragmentShader: /* glsl */ `
          uniform float uStrength;
          uniform float uTime;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), u.x), u.y);
          }
          void main() {
            vec2 p = (vUv - vec2(0.5, 0.45)) * vec2(1.0, 1.3);
            float r = length(p);
            // light scattering in uneven, slowly drifting haze
            float haze = noise(vUv * 4.0 + vec2(uTime * 0.05, -uTime * 0.08)) * 0.5
                       + noise(vUv * 9.0 - vec2(uTime * 0.03, uTime * 0.11)) * 0.5;
            float glow = exp(-r * r * 9.0) * (0.55 + 0.6 * haze) + exp(-r * r * 40.0) * 0.5;
            // fade to exactly zero well inside the plane — no visible edge
            vec2 e = abs(vUv - 0.5) * 2.0;
            glow *= (1.0 - smoothstep(0.55, 0.98, e.x)) * (1.0 - smoothstep(0.55, 0.98, e.y));
            gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * glow * uStrength, 1.0);
          }
        `,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = 0.88 + 0.08 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 23.3);
    material.uniforms.uStrength.value = cues.atmosphere.value.haze * f;
    material.uniforms.uTime.value = t;
  });

  return (
    <mesh position={[PUMPKIN_FACE[0], PUMPKIN_FACE[1] + 0.8, -1.4]} renderOrder={0.6} material={material}>
      <planeGeometry args={[14, 11]} />
    </mesh>
  );
}

const PUFFS = 7;

function Smoke({ cues }) {
  const map = useTexture(assetUrl('smoke.png'));
  const puffs = useMemo(
    () =>
      Array.from({ length: PUFFS }, (_, i) => {
        const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, color: '#a8968a', opacity: 0 });
        return { m, offset: i / PUFFS, spin: (i % 2 ? 1 : -1) * (0.3 + i * 0.07), sway: 0.5 + (i % 3) * 0.2 };
      }),
    [map],
  );
  const meshes = useMemo(() => [], []);

  useFrame(({ clock }) => {
    const s = cues.atmosphere.value.smoke; // 0 → 1 over the ignition
    const t = clock.elapsedTime;
    puffs.forEach((p, i) => {
      const mesh = meshes[i];
      if (!mesh) return;
      // each puff is born at the top opening, rises, widens, curls and thins out
      const life = THREE.MathUtils.clamp(s * 1.6 - p.offset, 0, 1);
      const y = EMERGE[1] - 0.2 + life * 3.2;
      mesh.position.set(EMERGE[0] + Math.sin(life * 3.0 + p.offset * 6.0) * 0.35 * p.sway * life, y, EMERGE[2] + 0.4);
      mesh.rotation.z = p.spin * life * 2.0 + t * 0.1 * p.spin;
      mesh.scale.setScalar(0.35 + life * 1.8);
      p.m.opacity = Math.sin(Math.PI * life) * 0.38 * (1 - s * 0.35);
    });
  });

  return puffs.map((p, i) => (
    <mesh key={i} ref={(el) => (meshes[i] = el)} material={p.m} renderOrder={1.5}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  ));
}

const COUNT = 46;

function Sparks({ cues }) {
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT; i++) {
      // x: lateral drift, y: start (0 = top opening, 1 = mouth), z: buoyancy, w: birth time
      seeds.set([Math.random() * 2 - 1, Math.random() < 0.7 ? 0 : 1, 0.5 + Math.random(), Math.random()], i * 4);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: 0 },
        uTime: { value: 0 },
        uTop: { value: new THREE.Vector3(...EMERGE) },
        uMouth: { value: new THREE.Vector3(PUMPKIN_FACE[0], PUMPKIN_FACE[1], 0.9) },
        uPx: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 seed;
        uniform float uT;
        uniform float uTime;
        uniform vec3 uTop;
        uniform vec3 uMouth;
        uniform float uPx;
        varying float vLife;
        varying float vHeat;
        void main() {
          // staggered births; each spark lives ~1.4 s of the cue
          float age = clamp((uT - seed.w * 0.6) / 0.4, 0.0, 1.0);
          vec3 o = mix(uTop, uMouth, seed.y);
          vec3 p = o;
          p.y += age * (1.6 + seed.z * 2.2);                            // buoyant rise
          p.x += seed.x * age * 0.9 + sin(age * 9.0 + seed.w * 20.0) * 0.12 * age;
          p.z += age * 0.4;
          vHeat = 1.0 - age;                                            // cools as it climbs
          float twinkle = 0.65 + 0.35 * sin(uTime * 30.0 + seed.w * 50.0);
          vLife = smoothstep(0.0, 0.06, age) * (1.0 - smoothstep(0.55, 1.0, age)) * step(0.001, uT) * twinkle;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (3.0 + seed.z * 3.5) * uPx * (16.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        varying float vHeat;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.05, d);
          vec3 c = mix(vec3(1.6, 0.25, 0.03), vec3(2.8, 1.7, 0.6), vHeat);  // deep red → hot yellow
          gl_FragColor = vec4(c * a * vLife, 1.0);
        }
      `,
    });
    return { geometry: g, material: m };
  }, []);

  useFrame(({ gl, clock }) => {
    material.uniforms.uT.value = cues.atmosphere.value.sparks;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPx.value = gl.getPixelRatio();
  });

  return <points geometry={geometry} material={material} renderOrder={8} frustumCulled={false} />;
}

export default function Ignition({ cues, reduced }) {
  if (reduced) return null;
  return (
    <>
      <Smoke cues={cues} />
      <Haze cues={cues} />
      <Sparks cues={cues} />
    </>
  );
}
