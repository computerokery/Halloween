---
name: react-three-fiber
description: React Three Fiber v9 (React 19) patterns used in this project — Canvas setup, useFrame/useThree, Suspense loading, lazy-loading the 3D chunk, frameloop control, events, performance and postprocessing via @react-three/postprocessing. Use when building or changing React components that render inside <Canvas>.
---

# React Three Fiber in The Midnight Club

Docs: https://docs.pmnd.rs/react-three-fiber (r3f.docs.pmnd.rs) · Postprocessing: https://docs.pmnd.rs/react-postprocessing

## Versions
`@react-three/fiber@9.8` (requires **React 19**), `@react-three/postprocessing@3.2`, `postprocessing@6.39`.

## Structure
```
src/sections/Hero/
  Hero.jsx                 picks <HeroCanvas> (WebGL) or the 2D <HeroScene> fallback
  three/
    HeroCanvas.jsx         <Canvas>, effects, performance, intro start
    World.jsx              scene graph (characters, floor, atmosphere)
    choreography.js        Theatre.js sheet + intro keyframes (see theatrejs skill)
    rig.js                 shared pointer state for parallax
```
`HeroCanvas` is loaded with `React.lazy` so three/drei/theatre stay out of the main bundle.

## Rules
- **Never `setState` inside `useFrame`.** Read Theatre values / pointer refs and mutate objects directly.
- Frame-rate independence: use `delta` or `THREE.MathUtils.damp(current, target, lambda, delta)`.
- Gate expensive work: `frameloop={visible ? 'always' : 'never'}` (IntersectionObserver on the hero).
- `dpr={[1, 1.75]}` + `<PerformanceMonitor>` to step resolution down on weak GPUs.
- The canvas has `pointer-events: none` (text and buttons sit above it). Parallax reads the window
  pointer from `rig.js`, not R3F's raycaster events.
- Load textures with drei `useTexture` inside `<Suspense>`; set `colorSpace` in the onLoad callback.
- Check WebGL support before mounting the canvas and fall back to the 2D scene.
- Reduced motion: no camera choreography, no parallax; render the final composition.

## Postprocessing
`<EffectComposer multisampling={0}>` with `Bloom (mipmapBlur, luminanceThreshold: 1)`, `Vignette`
and `Noise`. Only HDR (> 1.0) pixels bloom — light sources write HDR values in the shader.
Keep the effect count low; every pass is a full-screen draw.
