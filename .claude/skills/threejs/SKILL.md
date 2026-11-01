---
name: threejs
description: three.js (r186) rendering in this project — custom ShaderMaterials, textures and color management, geometry, lights, fog, render order, disposal and performance. Use when writing or debugging anything that touches `three` directly (shaders, materials, textures, camera math) in src/sections/Hero/three/.
---

# three.js in The Midnight Club

Docs: https://threejs.org/docs/ · Manual: https://threejs.org/manual/ · Examples: https://threejs.org/examples/

## Version
`three@0.186.0` — pinned because `postprocessing@6.39` supports `>=0.168 <0.187`.
Don't bump three without checking `npm view postprocessing peerDependencies`.

## Where it lives
- `src/sections/Hero/three/` — the WebGL hero (rendered through React Three Fiber).
- `src/sections/Hero/three/materials/CharacterMaterial.js` — the shader every character plane uses.
- Textures come from `src/assets/hero3d/` (built by `tools/build_3d_assets.py`; `manifest.json` holds sizes and anchor UVs).

## Conventions
- **Characters are textured planes, not models.** The approved artwork is 2D. Volume comes from a
  height map (`*-depth.png`) displaced in the vertex shader; emissive light from `*-glow.png`.
  Never replace the artwork with generated geometry.
- **Color management**: colour textures get `texture.colorSpace = THREE.SRGBColorSpace`; data maps
  (depth, glow) stay `NoColorSpace`. Custom shaders must end with
  `#include <tonemapping_fragment>` and `#include <colorspace_fragment>`.
- **The canvas renders with `flat` (NoToneMapping)** so the artwork's colours match the references.
  HDR values (> 1.0) are used on purpose for light sources so only they pass the bloom threshold.
- **Transparent planes**: `transparent: true, depthWrite: false` and an explicit `renderOrder`
  (back → front). Don't rely on automatic sorting for overlapping characters.
- **Units**: 1 world unit = 72 px of the 1280px design reference. The scene "slot" is 10 × 9.25
  units, floor at y = 0.78.

## Gotchas
- Mutate uniforms in `useFrame` (`material.uniforms.uTime.value = t`), never re-create materials per frame.
- `PlaneGeometry` segments drive the displacement quality — characters use 96–128 segments.
- Dispose of manually created textures/geometries (R3F disposes of JSX-declared ones automatically).
- `fog` only affects materials that include the fog chunks; the character shader opts out on purpose.
- Prefer `MathUtils.damp` over hand-written lerps for frame-rate-independent easing.
