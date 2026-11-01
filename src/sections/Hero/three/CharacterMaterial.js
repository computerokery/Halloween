import * as THREE from 'three';

/**
 * Shader for the approved character artwork (textured planes).
 *
 * vertex   · inflates the plane by a height map (silhouette distance) → real volume on camera moves
 *          · ripples the lower hem like fabric (ghosts), keeping a "still" rect (the lantern) rigid
 * fragment · unlit state: light sources (glow mask) are dark hollows until ignited, then light
 *            spreads outward from `uOrigin` (the flame); moonlit cool tint until `uWarm`
 *          · light sources write HDR values (> 1) so only they pass the bloom threshold
 *          · `uSpark`: the wick catching — lights the cavity, visible only through the carving
 */
const vertexShader = /* glsl */ `
  uniform sampler2D depthMap;
  uniform float uDepth;
  uniform float uTime;
  uniform float uWave;
  uniform float uHemTop;
  uniform vec4 uStill;
  varying vec2 vUv;

  float rect(vec2 p, vec4 r, float soft) {
    vec2 a = smoothstep(r.xy - soft, r.xy + soft, p);
    vec2 b = 1.0 - smoothstep(r.zw - soft, r.zw + soft, p);
    return a.x * a.y * b.x * b.y;
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += texture2D(depthMap, uv).r * uDepth;

    float w = clamp((uHemTop - uv.y) / max(uHemTop, 1e-3), 0.0, 1.0);
    w = w * w * uWave * (1.0 - rect(uv, uStill, 0.05));
    p.x += sin(uTime * 1.6 + uv.x * 7.0 + uv.y * 5.0) * 0.07 * w;
    p.y += sin(uTime * 2.2 + uv.x * 11.0) * 0.045 * w;
    p.z += cos(uTime * 1.35 + uv.x * 6.0 + uv.y * 3.0) * 0.2 * w;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D glowMap;
  uniform float uOpacity;
  uniform float uExposure;
  uniform float uGlow;
  uniform float uFlicker;
  uniform float uIgnite;
  uniform float uWarm;
  uniform float uSpark;
  uniform float uTime;
  uniform float uHideUnlit;
  uniform float uShade;
  uniform float uReveal;
  uniform float uFalloff;
  uniform float uSSS;
  uniform float uRevealMode;
  uniform float uAspect;
  uniform vec2 uOrigin;
  uniform vec3 uEmber;
  uniform vec3 uCool;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), u.x), u.y);
  }

  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.004) discard;
    float g = texture2D(glowMap, vUv).r;

    vec2 d = (vUv - uOrigin) * vec2(uAspect, 1.0);
    float r = length(d);
    float reach = uIgnite * 1.5;
    float lit = 1.0 - smoothstep(reach - 0.35, reach, r);

    float carve = smoothstep(0.04, 0.45, g);
    // night: cool moonlight from above — tops catch it, lower parts fall into shadow,
    // colour mostly kept. The candle's own light is never tinted.
    float moon = mix(0.28, 1.0, smoothstep(0.1, 0.95, vUv.y));
    vec3 grey = vec3(dot(tex.rgb, vec3(0.3, 0.59, 0.11)));
    vec3 night = mix(grey, tex.rgb, 0.72) * uCool * moon;
    vec3 col = mix(night, tex.rgb, max(uWarm, carve * lit));

    // candle light inside: brightest at the flame, dimmer toward the eyes; a weak flame is deep
    // red-orange and turns golden as it strengthens
    float near = uFalloff > 0.0 ? 0.55 + 0.9 * exp(-r * r * uFalloff) : 1.0;
    float strength = clamp(uGlow * uFlicker * 0.45 * lit, 0.0, 1.0);

    // live fire inside: rising turbulence lights the cavity unevenly. Heat is highest at the
    // flame and falls off upward and outward; it maps to a blackbody-like ramp (deep red →
    // orange → amber → pale gold), so only the hottest core ever approaches white.
    vec2 q = d * vec2(1.0, 1.0);
    float rise = uTime * 1.6;
    float turb = noise(vec2(q.x * 7.0, q.y * 5.0 - rise)) * 0.6
               + noise(vec2(q.x * 15.0 + 3.1, q.y * 11.0 - rise * 1.7)) * 0.4;
    float up = max(vUv.y - uOrigin.y, 0.0);
    float heat = exp(-r * r * 14.0) - up * 0.9 + (turb - 0.5) * 0.6;
    heat = clamp(heat * uFlicker * strength * 1.1 + 0.08 * lit, 0.0, 1.0);
    // (linear-space colours — the output is converted to sRGB)
    vec3 fire = mix(vec3(0.17, 0.006, 0.0), vec3(1.0, 0.12, 0.006), smoothstep(0.0, 0.4, heat));
    fire = mix(fire, vec3(1.0, 0.27, 0.02), smoothstep(0.35, 0.75, heat));
    fire = mix(fire, vec3(1.0, 0.62, 0.22), smoothstep(0.85, 1.0, heat));
    // keep the artwork's carved detail (inner walls, edges) under the fire colour
    float detail = dot(tex.rgb, vec3(0.3, 0.59, 0.11));
    // the fire model is for the pumpkin's cavity only (uFalloff > 0); other light sources
    // (lantern, moon, candle flames) keep their own artwork colour, warmed by a tint
    float isFire = step(0.001, uFalloff);
    vec3 tint = mix(vec3(1.0, 0.36, 0.09), vec3(1.0, 0.86, 0.62), strength);
    vec3 own = tex.rgb * tint * 1.15;
    fire = mix(own, fire * (0.55 + 0.6 * detail), isFire);
    vec3 inner = mix(uEmber, fire * near * 1.1, lit);
    // fire colour only inside the openings (tight mask) — the skin around them keeps its texture
    float hole = smoothstep(0.22, 0.6, g);
    col = mix(col, mix(uEmber, col, 0.0), carve * (1.0 - lit));
    col = mix(col, inner, hole * lit + carve * (1.0 - lit));
    // HDR only where it is hot, and kept saturated so bloom glows orange, not white
    float hdr = mix(1.0, smoothstep(0.3, 0.95, heat) * 0.5, isFire);
    vec3 hdrCol = mix(tex.rgb * tint, fire * vec3(1.0, 0.8, 0.6), isFire);
    col += hdrCol * g * lit * uGlow * uFlicker * near * hdr;

    // light through the shell: the thin flesh around each opening glows
    // (a small 8-tap blur of the glow mask: a thin rim just outside each opening)
    float halo = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      halo += texture2D(glowMap, vUv + vec2(cos(a), sin(a)) * vec2(0.012, 0.014)).r;
    }
    halo /= 8.0;
    float shell = clamp(halo * 1.8 - g * 1.6, 0.0, 1.0) * lit * uSSS;
    col += vec3(0.8, 0.05, 0.002) * shell * uGlow * uFlicker * 0.18;

    // the wick catching: light fills the cavity around the flame, seen only through the openings
    float cavity = exp(-r * r * 30.0) * 2.2 + exp(-r * r * 900.0) * 5.0;
    col += vec3(1.0, 0.6, 0.24) * uSpark * carve * cavity;
    // ambient occlusion: darker toward the floor, grounds objects in the scene
    col *= mix(1.0, mix(0.42, 1.0, smoothstep(0.0, 0.7, vUv.y)), uShade);
    col *= uExposure;

    // reveal: 0 = condense out of the dark like smoke, 1 = grow up from the base.
    // Fine noise + a wide soft front, layered over a plain fade — never blotchy.
    float n = noise(vUv * 11.0) * 0.55 + noise(vUv * 29.0) * 0.3 + noise(vUv * 63.0) * 0.15;
    // dissolve: condenses from the centre outward, noise only roughens the soft front
    float radial = length((vUv - vec2(0.5, 0.45)) * vec2(1.0, 1.15)) * 1.3;
    float field = uRevealMode < 0.5 ? radial * 0.75 + n * 0.25 : vUv.y * 0.85 + n * 0.15;
    float th = uReveal * 1.6 - 0.3;
    float shown = (1.0 - smoothstep(th - 0.35, th, field)) * smoothstep(0.0, 0.3, uReveal);
    float edge = smoothstep(th - 0.2, th - 0.06, field) * (1.0 - smoothstep(th - 0.06, th, field));
    col += vec3(1.0, 0.45, 0.12) * edge * 0.45 * (1.0 - smoothstep(0.85, 1.0, uReveal)); // faint warm front

    // trim the soft fringe left by the original white / dark backgrounds
    float a = smoothstep(0.45, 0.95, tex.a) * shown;
    a *= 1.0 - g * (1.0 - lit) * uHideUnlit;           // an unlit flame is simply not there
    gl_FragColor = vec4(col, a * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createCharacterMaterial({ map, glowMap, depthMap, aspect, origin = [0.5, 0.5], depth = 0.5, hemTop = 0, still = [0, 0, 0, 0], hideUnlit = false, shade = 0, revealMode = 0, falloff = 0, sss = 0 }) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: map },
      glowMap: { value: glowMap },
      depthMap: { value: depthMap },
      uDepth: { value: depth },
      uTime: { value: 0 },
      uWave: { value: 0 },
      uHemTop: { value: hemTop },
      uStill: { value: new THREE.Vector4(...still) },
      uOpacity: { value: 1 },
      uExposure: { value: 1 },
      uGlow: { value: 1 },
      uFlicker: { value: 1 },
      uIgnite: { value: 1 },
      uWarm: { value: 1 },
      uSpark: { value: 0 },
      uHideUnlit: { value: hideUnlit ? 1 : 0 },
      uShade: { value: shade },
      uReveal: { value: 1 },
      uFalloff: { value: falloff },
      uSSS: { value: sss },
      uRevealMode: { value: revealMode },
      uAspect: { value: aspect },
      uOrigin: { value: new THREE.Vector2(...origin) },
      uEmber: { value: new THREE.Color(0.035, 0.012, 0.004) },
      uCool: { value: new THREE.Color(0.6, 0.63, 0.72) },
    },
  });
}

/** Candle-like flicker, smooth and non-repeating enough to read as a flame. */
export function flicker(t, seed = 0) {
  return (
    0.86 +
    0.07 * Math.sin(t * 11.3 + seed) +
    0.05 * Math.sin(t * 23.1 + seed * 1.7) +
    0.04 * Math.sin(t * 5.7 + seed * 0.3)
  );
}
