import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Environment from './Environment.jsx';
import Ignition from './Ignition.jsx';
import { Candle, Foliage, GhostMain, Pumpkin, SmallGhost } from './Characters.jsx';
import { FallingLeaves, LeafPile } from './Leaves.jsx';
import { LENGTH } from './choreography.js';
import { damp, lerp, pointer, smoothstep } from './rig.js';
import { scrollState } from './scroll.js';

/**
 * Camera follows the Theatre "Camera" object during the intro, then the "ScrollCamera" object
 * (scroll story, sheet HeroScroll scrubbed by scroll progress); it drifts with the pointer.
 */
function CameraRig({ cues, reduced }) {
  const settle = useRef(0);
  const look = useRef({ x: 0, y: 0 });

  useFrame(({ camera }, delta) => {
    const s = scrollState.progress;
    cues.scrollSheet.sequence.position = s;
    const intro = cues.camera.value;
    const sc = cues.scrollCamera.value;
    const w = smoothstep(s, 0, 0.03);
    const c = {
      px: lerp(intro.px, sc.px, w), py: lerp(intro.py, sc.py, w), pz: lerp(intro.pz, sc.pz, w),
      tx: lerp(intro.tx, sc.tx, w), ty: lerp(intro.ty, sc.ty, w),
    };
    const done = cues.sheet.sequence.position >= LENGTH - 0.05;
    settle.current = damp(settle.current, done && !reduced ? 1 : 0, 1.5, delta);
    look.current.x = damp(look.current.x, pointer.x, 2.2, delta);
    look.current.y = damp(look.current.y, pointer.y, 2.2, delta);
    const k = settle.current;
    camera.position.set(c.px + look.current.x * 0.7 * k, c.py - look.current.y * 0.35 * k, c.pz);
    camera.lookAt(c.tx + look.current.x * 0.2 * k, c.ty - look.current.y * 0.1 * k, 0);
  });
  return null;
}

export default function World({ cues, quality, reduced }) {
  return (
    <>
      <Environment cues={cues} quality={quality} reduced={reduced} />
      <Ignition cues={cues} reduced={reduced} />
      <Foliage cues={cues} />
      <GhostMain cues={cues} reduced={reduced} />
      <SmallGhost cues={cues} side="left" reduced={reduced} />
      <SmallGhost cues={cues} side="right" reduced={reduced} />
      <Pumpkin cues={cues} />
      <Candle cues={cues} which="tall" />
      <Candle cues={cues} which="small" />
      <LeafPile cues={cues} count={quality === 'high' ? 54 : 30} />
      {!reduced && <FallingLeaves cues={cues} count={quality === 'high' ? 16 : 9} />}
      <CameraRig cues={cues} reduced={reduced} />
    </>
  );
}
