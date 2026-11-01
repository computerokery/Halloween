---
name: drei
description: Drei v10 helpers used with React Three Fiber in this project — useTexture, shaderMaterial, Sparkles, Trail, Cloud/Clouds, MeshReflectorMaterial, PerformanceMonitor, AdaptiveDpr, Preload. Use when adding a 3D helper, effect or material in src/sections/Hero/three/ before writing it by hand.
---

# Drei in The Midnight Club

Repo/docs: https://github.com/pmndrs/drei · https://drei.docs.pmnd.rs

## Version
`@react-three/drei@10.7` (pairs with fiber 9 / React 19).

## What we use and why
| Helper | Use here |
|---|---|
| `useTexture` | character, glow and depth maps (suspends; preload with `useTexture.preload`) |
| `shaderMaterial` | `CharacterMaterial` — declares uniforms + GLSL, then `extend({ CharacterMaterial })` |
| `Sparkles` | rising embers around the pumpkin |
| `Trail` | light trails behind small ghosts while they fly out of the pumpkin |
| `Cloud` / `Clouds` | low drifting smoke (pass our local `smoke.png` as `texture` — never the CDN default) |
| `MeshReflectorMaterial` | the wet floor reflecting the lit pumpkin |
| `PerformanceMonitor` | lowers DPR / reflector resolution when FPS drops |
| `Preload` | uploads all textures to the GPU before the intro starts |

## Gotchas
- `Cloud` loads a remote texture by default; always pass `texture={smokeUrl}`.
- `MeshReflectorMaterial` re-renders the scene: keep `resolution` ≤ 512 (256 on mobile) and
  `mixBlur` high. It is a `MeshStandardMaterial`, so it needs lights to show colour.
- `Trail` attaches to its child's world position — mount it only while the ghost is flying,
  otherwise idle floating draws a permanent smear.
- `Sparkles` `speed={0}` for reduced motion.
- Drei components accept refs; animate via refs in `useFrame`, not props.
