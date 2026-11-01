/**
 * Scroll progress through the pinned hero (0 → 1), written by GSAP ScrollTrigger in the DOM
 * (src/hooks/useHeroScroll.js) and read every frame by the 3D scene. A plain object on purpose:
 * no React re-renders while scrolling.
 */
export const scrollState = { progress: 0 };
