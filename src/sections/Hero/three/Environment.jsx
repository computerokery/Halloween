import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds, MeshReflectorMaterial, Sparkles } from '@react-three/drei';
import { FLOOR, PUMPKIN_FACE } from './layout.js';
import { assetUrl } from './rig.js';

const BG = '#080706';

/**
 * Warm backlight around the characters. Drawn without depth testing, after the floor, so the
 * glow continues over the ground instead of being cut at the horizon; it breathes with the flame.
 */
function BackGlow({ cues }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uStrength: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uStrength;
          varying vec2 vUv;
          void main() {
            // wide, soft ellipse centred on the pumpkin; falls to zero well inside the plane
            vec2 d = (vUv - vec2(0.5, 0.4)) * vec2(1.0, 1.25);
            float a = smoothstep(0.5, 0.0, length(d));
            a = a * a * (3.0 - 2.0 * a);
            gl_FragColor = vec4(vec3(0.95, 0.4, 0.09) * a * uStrength, 1.0);
          }
        `,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const p = cues.pumpkin.value;
    const f = 0.92 + 0.08 * Math.sin(clock.elapsedTime * 2.3) * Math.sin(clock.elapsedTime * 3.7);
    material.uniforms.uStrength.value = (0.012 + 0.11 * p.ignite * p.warm) * f;
  });

  return (
    <mesh position={[-0.2, 3.4, -2]} renderOrder={-1} material={material}>
      <planeGeometry args={[24, 15]} />
    </mesh>
  );
}

/** Soft decals on the floor: contact shadows (multiply-like) and warm light pools (additive). */
function floorDecal({ additive }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color(additive ? '#ff7a22' : '#000000') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = length((vUv - 0.5) * 2.0);
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 1.8) * uStrength;
        gl_FragColor = ${additive ? 'vec4(uColor * a, 1.0)' : 'vec4(uColor, a)'};
      }
    `,
  });
}

const SHADOWS = [
  // x, z, width, depth, strength
  [-0.24, 0.15, 5.2, 1.5, 1.0],    // pumpkin
  [0.0, -1.2, 8.5, 1.4, 0.55],     // branches + leaf pile
  [2.45, 0.6, 0.95, 0.42, 0.75],   // tall candle
  [-2.75, 0.9, 0.7, 0.32, 0.75],   // small candle
];

const POOLS = [
  // x, z, width, depth, source, strength
  [-0.24, 2.0, 8.0, 3.4, 'pumpkin', 0.3],
  [2.45, 0.8, 2.2, 1.3, 'candles', 0.22],
  [-2.75, 1.05, 1.7, 1.0, 'candles', 0.18],
];

function FloorLight({ cues }) {
  const shadows = useMemo(() => SHADOWS.map(([, , , , k]) => {
    const m = floorDecal({ additive: false });
    m.uniforms.uStrength.value = k;
    return m;
  }), []);
  const pools = useMemo(() => POOLS.map(() => floorDecal({ additive: true })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = cues.pumpkin.value;
    const c = cues.atmosphere.value.candles;
    POOLS.forEach(([, , , , src, k], i) => {
      const f = 0.85 + 0.1 * Math.sin(t * 11.3 + i * 2) + 0.05 * Math.sin(t * 23.1 + i);
      pools[i].uniforms.uStrength.value = k * f * (src === 'pumpkin' ? p.ignite * p.warm : c);
    });
    const vis = Math.min(1, p.reveal * 1.6);
    shadows.forEach((m, i) => (m.uniforms.uStrength.value = SHADOWS[i][4] * vis));
  });

  return (
    <>
      {SHADOWS.map(([x, z, w, d], i) => (
        <mesh key={`s${i}`} rotation-x={-Math.PI / 2} position={[x, FLOOR + 0.02, z]} renderOrder={0.35} material={shadows[i]}>
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
      {POOLS.map(([x, z, w, d], i) => (
        <mesh key={`p${i}`} rotation-x={-Math.PI / 2} position={[x, FLOOR + 0.015, z]} renderOrder={0.3} material={pools[i]}>
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
    </>
  );
}

/** Wet floor: reflects the lit pumpkin, candles and ghosts. */
function Floor({ quality }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR, 3]} renderOrder={0}>
      <planeGeometry args={[220, 140]} />
      <MeshReflectorMaterial
        resolution={quality === 'high' ? 512 : 256}
        blur={[420, 120]}
        mixBlur={1}
        mixStrength={4}
        mixContrast={1.1}
        mirror={0.7}
        depthScale={1.1}
        minDepthThreshold={0.35}
        maxDepthThreshold={1.4}
        roughness={0.9}
        metalness={0.55}
        color="#060504"
      />
    </mesh>
  );
}

const EMBER = new THREE.Color(2.4, 1.25, 0.42);

export default function Environment({ cues, quality, reduced }) {
  const ambient = useRef();
  useFrame(() => {
    ambient.current.intensity = 0.015 + 0.2 * cues.pumpkin.value.warm;
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 15, 29]} />
      <ambientLight ref={ambient} color="#ffb070" intensity={0.06} />
      <BackGlow cues={cues} />
      <Floor quality={quality} />
      <FloorLight cues={cues} />

      <Sparkles count={quality === 'high' ? 80 : 40} scale={[15, 8, 7]} position={[0, 4.6, 0]} size={3.2} speed={reduced ? 0 : 0.32} noise={0.8} color={EMBER} opacity={0.9} />
      <Sparkles count={24} scale={[5, 2.5, 3]} position={[PUMPKIN_FACE[0], PUMPKIN_FACE[1] + 1.4, 0.6]} size={2.4} speed={reduced ? 0 : 0.5} color={EMBER} />

      <Clouds material={THREE.MeshBasicMaterial} texture={assetUrl('smoke.png')} limit={80}>
        <Cloud seed={3} segments={16} bounds={[10, 0.5, 3]} volume={6} color="#5d5048" opacity={0.1} speed={reduced ? 0 : 0.1} fade={40} position={[0, FLOOR + 0.55, 0.6]} />
        <Cloud seed={9} segments={10} bounds={[12, 1, 2]} volume={8} color="#4a3f38" opacity={0.08} speed={reduced ? 0 : 0.08} fade={40} position={[0, FLOOR + 1.6, -3]} />
      </Clouds>
    </>
  );
}
