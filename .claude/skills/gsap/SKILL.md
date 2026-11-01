---
name: gsap
description: GSAP 3.15 in this project — DOM timelines for the hero typography (SplitText), useGSAP cleanup in React, matchMedia for reduced motion, ScrollTrigger for scroll-linked sections. Use when animating HTML/CSS elements (text, buttons, sections); 3D camera choreography belongs to Theatre.js instead.
---

# GSAP in The Midnight Club

Docs: https://gsap.com/docs/v3/ · React: https://gsap.com/resources/React · SplitText: https://gsap.com/docs/v3/Plugins/SplitText

## Version
`gsap@3.15` + `@gsap/react`. All plugins (SplitText, ScrollTrigger, …) ship in the public package
and are free; register once: `gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger)`.

## Division of labour
- **GSAP** → DOM: headline, labels, copy, buttons, header, meta row; later scroll-linked sections.
- **Theatre.js** → the 3D scene (camera, lights, characters). Don't drive Three objects with GSAP.
- **CSS** → simple hover states and infinite ambient loops.

## Pattern (see src/sections/Hero/useHeroTextIntro.js)
```js
useGSAP(() => {
  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    const { reduce } = ctx.conditions;
    const split = SplitText.create(titleRef.current, { type: 'words,chars', mask: 'words' });
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    // build tl…
    return () => split.revert();
  });
}, { scope: rootRef, dependencies: [start] });
```
- Always scope with `useGSAP({ scope })` so selectors and cleanup stay local.
- Hide animated elements before the first paint with `gsap.set(..., { autoAlpha: 0 })` inside
  `useGSAP` (it runs in a layout effect), never with CSS that JS-less users would get stuck with.
- Animate `transform`/`opacity`/`filter` only. `SplitText` with `mask: 'words'` gives clean reveals.
- Reduced motion: same timeline structure, near-zero durations, no movement.
- Kill/revert on unmount (useGSAP does this automatically for anything created inside it).
