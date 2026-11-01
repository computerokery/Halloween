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
  uniform float uCandle;
  uniform float uLightIn;
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

  // charred wick standing out of the rim (candle texture UVs), anti-aliased, rounded tip
  float candleWick(vec2 uv) {
    float w = 0.016;
    vec2 q = vec2((uv.x - 0.487) / w, (uv.y - 0.588) / (w * 0.55));
    float body = (1.0 - smoothstep(0.75, 1.15, abs(uv.x - 0.487) / w)) * step(uv.y, 0.588) * smoothstep(0.5, 0.51, uv.y);
    float tip = 1.0 - smoothstep(0.75, 1.15, length(q));
    return max(body, tip);
  }

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
    // The hue is kept (a near-neutral, darker exposure — a cool tint over orange reads mauve);
    // the moon only adds a faint cool sheen on the glossy highlights near the top.
    float moon = mix(0.3, 1.0, smoothstep(0.05, 0.95, vUv.y));
    float lum0 = dot(tex.rgb, vec3(0.3, 0.59, 0.11));
    vec3 night = tex.rgb * vec3(0.5, 0.47, 0.46) * moon;
    night += vec3(0.42, 0.48, 0.62) * pow(lum0, 2.2) * smoothstep(0.35, 1.0, vUv.y) * 0.35;
    night = mix(tex.rgb, night, step(0.0001, 1.0 - uWarm) * 1.0);
    vec3 col = mix(night, tex.rgb, max(uWarm, carve * lit));

    float strength = clamp(uGlow * uFlicker * 0.45 * lit, 0.0, 1.0);
    float isFire = step(0.001, uFalloff);

    // other light sources (lantern, moon, candle flames): artwork colour, warmed by a tint
    vec3 tint = mix(vec3(1.0, 0.36, 0.09), vec3(1.0, 0.86, 0.62), strength);
    vec3 inner = mix(uEmber, tex.rgb * tint * 1.15, lit);
    float mask = smoothstep(0.22, 0.6, g);

    // pumpkin: the artwork already *is* the lit carving — bevelled cut walls, lit tops of the
    // teeth, the glowing back wall. Show it as painted and let the candle drive it: a weak flame
    // reads deep red, the light breathes with the flicker, a slow shimmer rises through the
    // cavity, and it is a touch brighter near the flame.
    float shimmer = 0.93 + 0.07 * noise(vec2(vUv.x * 7.0, vUv.y * 5.0 - uTime * 1.3));
    float near = 0.92 + 0.16 * exp(-r * r * max(uFalloff, 0.001));
    float lightK = (0.68 + 0.36 * uFlicker) * shimmer * near;
    vec3 weak = mix(vec3(1.0, 0.32, 0.1), vec3(1.0), smoothstep(0.05, 0.5, strength));
    vec3 dark = uEmber + tex.rgb * 0.05;                 // the unlit hollow keeps a hint of its walls
    vec3 carving = mix(dark, tex.rgb * weak * lightK, lit);
    inner = mix(inner, carving, isFire);
    mask = mix(mask, carve, isFire);       // whole carved region (the art blends into itself)
    col = mix(col, inner, mask);

    // bloom: light sources glow fully; on the pumpkin only the hottest pixels bloom, so the
    // bevelled walls keep their definition
    float lum = dot(tex.rgb, vec3(0.3, 0.59, 0.11));
    float hdr = mix(1.0, smoothstep(0.7, 1.0, lum) * 0.4, isFire);
    col += tex.rgb * mix(tint, weak, isFire) * g * lit * uGlow * uFlicker * hdr;

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

    // the wick catching: a small flame lights the inside of the cavity, seen only through the
    // openings — the light falls on the carved walls (the artwork's own interior), never a flat fill
    float cavity = exp(-r * r * 22.0);
    col += tex.rgb * vec3(1.0, 0.5, 0.2) * uSpark * carve * cavity * 1.6 * (1.0 - lit);
    col += vec3(1.0, 0.62, 0.28) * uSpark * carve * exp(-r * r * 1400.0) * 2.5;
    // candle, unlit: the artwork's wax is lit by its own flame (glowing top, translucent orange
    // body). Without the flame that reads as a cut-out, so the wax gets its own matte look —
    // ivory, lit only from the side facing the pumpkin (u = 0), top in shade, wick charred.
    if (uCandle > 0.5) {
      // keep the artwork's wax (drips, texture), pulled toward ivory and shaded as a cylinder
      float wl = dot(tex.rgb, vec3(0.3, 0.59, 0.11));
      vec3 wax = mix(tex.rgb, wl * vec3(1.0, 0.84, 0.6), 0.25);
      float nx = (vUv.x - 0.5) * 2.0;                                      // -1 = side facing the pumpkin
      float lambert = clamp(-nx * 0.75 + 0.35, 0.0, 1.0);
      lambert *= sqrt(max(1.0 - nx * nx, 0.0)) * 0.4 + 0.6;               // curved edges fall off
      float topShade = mix(1.0, 0.5, smoothstep(0.4, 0.52, vUv.y));       // rim faces the dark sky
      vec3 light = vec3(1.0, 0.52, 0.22) * lambert * uLightIn * 0.65 + vec3(0.045, 0.035, 0.03);
      vec3 unlitWax = wax * light * topShade;
      // the wick: a charred stub standing out of the rim
      // the wick: a charred stub with a rounded, slightly glowing-dead tip
      float wick = candleWick(vUv);
      unlitWax = mix(unlitWax, vec3(0.03, 0.02, 0.015), wick);
      unlitWax += vec3(0.25, 0.06, 0.01) * wick * smoothstep(0.55, 0.585, vUv.y) * uLightIn * 0.3;
      col = mix(unlitWax, col, lit);
    }

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
    // an unlit candle: everything above the flame base is cut cleanly (anti-aliased), only the
    // wick stands up; the flame then grows out of the wick as the light spreads (lit)
    if (uCandle > 0.5) {
      float aa = fwidth(vUv.y) * 1.5;
      float below = 1.0 - smoothstep(0.553 - aa, 0.553 + aa, vUv.y);
      a *= mix(max(below, candleWick(vUv)), 1.0, lit);
    } else {
      a *= 1.0 - smoothstep(0.02, 0.25, g) * (1.0 - lit) * uHideUnlit; // an unlit flame is not there
    }
    gl_FragColor = vec4(col, a * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createCharacterMaterial({ map, glowMap, depthMap, aspect, origin = [0.5, 0.5], depth = 0.5, hemTop = 0, still = [0, 0, 0, 0], hideUnlit = false, candle = false, shade = 0, revealMode = 0, falloff = 0, sss = 0 }) {
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
      uCandle: { value: candle ? 1 : 0 },
      uLightIn: { value: 0 },
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
