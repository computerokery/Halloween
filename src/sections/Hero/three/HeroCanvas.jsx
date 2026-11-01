import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, Preload } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import World from './World.jsx';
import { LENGTH, loadChoreography } from './choreography.js';
import { ABOVE, CAMERA_FINAL, FOV } from './layout.js';
import './Hero3D.css';

function Effects({ cues }) {
  const bloom = useRef();
  useFrame(() => {
    if (bloom.current) bloom.current.intensity = cues.atmosphere.value.bloom * cues.scrollFx.value.bloom;
  });
  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} radius={0.78} />
      <Vignette offset={0.28} darkness={0.72} />
      <Noise opacity={0.035} premultiply />
    </EffectComposer>
  );
}

/** Runs once everything inside <Suspense> is loaded: starts the Theatre sequence. */
function IntroStarter({ cues, reduced, onStart }) {
  useEffect(() => {
    const sequence = cues.sheet.sequence;
    // dev only: /?t=1.5 freezes the intro at that time (for reviewing frames)
    const frozen = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('t') : null;
    if (frozen !== null) sequence.position = parseFloat(frozen);
    else if (reduced) sequence.position = LENGTH;
    else sequence.play({ iterationCount: 1 });
    onStart?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * WebGL hero scene: React Three Fiber + Drei + postprocessing, choreographed by Theatre.js.
 * Loaded lazily (three/drei/theatre stay out of the main bundle).
 */
/**
 * The canvas covers the whole hero, but the camera keeps framing the composition exactly as
 * designed: the reference view is the scene slot widened on the sides and raised 14% (see
 * layout.js), and the larger canvas is rendered as an offset window around it.
 */
const SIDE = () => (window.innerWidth >= 1200 ? 0.45 : window.innerWidth >= 768 ? 0.26 : 0.06);

function ViewFit({ slot }) {
  const { camera, gl } = useThree();
  const view = useRef(null);

  useEffect(() => {
    const measure = () => {
      const el = slot.current;
      if (!el) return;
      const s = el.getBoundingClientRect();
      const c = gl.domElement.getBoundingClientRect();
      const side = SIDE();
      const refW = s.width * (1 + 2 * side);
      const refH = s.height * (1 + ABOVE);
      view.current = { refW, refH, x: c.left - (s.left - s.width * side), y: c.top - (s.top - s.height * ABOVE), w: c.width, h: c.height };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(gl.domElement);
    if (slot.current) ro.observe(slot.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [slot, gl]);

  useFrame(() => {
    const v = view.current;
    if (!v || !v.w) return;
    camera.aspect = v.refW / v.refH; // R3F resets this on resize; the window below is what renders
    camera.setViewOffset(v.refW, v.refH, v.x, v.y, v.w, v.h);
  }, -1);
  return null;
}

export default function HeroCanvas({ slot, reduced, onStart }) {
  const wrap = useRef();
  const [cues, setCues] = useState(null);
  const [visible, setVisible] = useState(true);
  const [quality, setQuality] = useState(() => (window.innerWidth < 768 ? 'low' : 'high'));
  const [dpr, setDpr] = useState(() => Math.min(1.75, window.devicePixelRatio || 1));

  useEffect(() => {
    let alive = true;
    loadChoreography().then((c) => alive && setCues(c));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '100px' });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  return (
    <div className="scene3d" ref={wrap} aria-hidden="true">
      <Canvas
        flat
        dpr={dpr}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
        camera={{ fov: FOV, near: 0.1, far: 80, position: CAMERA_FINAL }}
      >
        <ViewFit slot={slot} />
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1);
            setQuality('low');
          }}
        />
        {cues && (
          <Suspense fallback={null}>
            <World cues={cues} quality={quality} reduced={reduced} />
            <Effects cues={cues} />
            <Preload all />
            <IntroStarter cues={cues} reduced={reduced} onStart={onStart} />
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}
