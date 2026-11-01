---
name: theatrejs
description: Theatre.js 0.7 cinematic sequencing for the 3D hero — project/sheet/object setup, keyframed intro choreography stored as project state JSON, playing sequences, reading values in useFrame, and editing with Theatre Studio in dev (?studio). Use when changing the hero intro timing, camera path or light cues.
---

# Theatre.js in The Midnight Club

Docs: https://www.theatrejs.com/docs/latest · State/production: https://www.theatrejs.com/docs/latest/manual/projects#state

## Versions
`@theatre/core@0.7.2` (runtime) and `@theatre/studio@0.7.2` (devDependency — never shipped).

## How the intro works (src/sections/Hero/three/choreography.js)
- One project `MidnightClub`, one sheet `Hero`, objects: `Camera`, `Pumpkin`, `Ghosts`,
  `Atmosphere`. Each object's props are plain numbers (positions, 0→1 progress, intensities).
- The keyframes are authored in code as a compact table (`TRACKS`: `[time, value, ease]`) and
  converted by `buildState()` (src/sections/Hero/three/theatreState.js) into Theatre's project
  state format (`definitionVersion 0.4.0`): `sheetsById.Hero.sequence.tracksByObject[obj]` with
  `trackIdByPropPath['["prop"]']` → `BasicKeyframedTrack` of
  `{ id, position, value, connectedRight, type: 'bezier', handles: [lx, ly, rx, ry] }`.
  The segment curve uses the left keyframe's `handles[2..3]` and the right keyframe's `handles[0..1]`.
- `revisionHistory[0]` is a hash of the table, so Studio's saved browser state is dropped
  automatically when the code-authored choreography changes.
- `HeroCanvas` waits for textures (`<Preload all>`), then `sheet.sequence.play()`. Components
  read `object.value` inside `useFrame` (no React re-renders).

## Editing visually
1. `npm run dev`, open `http://localhost:5173/?studio`
2. Studio loads (dev only, dynamic import). Scrub the `Hero` sequence, tweak keyframes.
3. Export the project state (Studio → project → Export) and save it as
   `src/sections/Hero/three/hero-state.json`; `choreography.js` uses that file when present
   instead of the generated state.

## Rules
- Keep props numeric and normalised (0→1 progress) — the components own the actual motion paths.
- Never import `@theatre/studio` statically; gate it behind `import.meta.env.DEV` + `?studio`.
- Reduced motion: set `sheet.sequence.position = sequence.length` instead of playing.
