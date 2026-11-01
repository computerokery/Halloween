import layers from '../../assets/hero/layers.json';
import sceneBackSrc from '../../assets/hero/scene-back.webp';
import pumpkinSrc from '../../assets/hero/pumpkin.webp';
import pumpkinFaceSrc from '../../assets/hero/pumpkin-face.webp';
import ghostMainSrc from '../../assets/hero/ghost-main.webp';
import ghostLeftSrc from '../../assets/hero/ghost-left.webp';
import ghostRightSrc from '../../assets/hero/ghost-right.webp';
import { Leaves, Particles, Smoke } from './Atmosphere.jsx';

/** Images the intro waits for before it starts. */
export const CRITICAL_IMAGES = [sceneBackSrc, pumpkinSrc, pumpkinFaceSrc, ghostMainSrc];

const pct = (v) => `${v}%`;

/** Places a layer at its box inside the scene plate (all values are % of the plate). */
const boxStyle = ({ left, top, width, height }) => ({
  left: pct(left),
  top: pct(top),
  width: pct(width),
  height: pct(height),
});

/** A point / size given in plate % re-expressed relative to a layer's own box. */
const within = (box, x, y, w) => ({
  '--x': pct(((x - box.left) / box.width) * 100),
  '--y': pct(((y - box.top) / box.height) * 100),
  '--w': pct((w / box.width) * 100),
});

/**
 * Offset from a layer's centre to the point ghosts emerge from (top of the pumpkin),
 * in container-query units of the scene so the flight scales with the plate.
 */
const flight = (box) => {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  return {
    '--fx': `${(layers.emerge.left - cx).toFixed(3)}cqw`,
    '--fy': `${((layers.emerge.top - cy) / layers.aspect).toFixed(3)}cqw`,
  };
};

const GHOSTS = [
  { name: 'main', src: ghostMainSrc, box: layers['ghost-main'], w: 928, h: 1056 },
  { name: 'left', src: ghostLeftSrc, box: layers['ghost-left'], w: 233, h: 244 },
  { name: 'right', src: ghostRightSrc, box: layers['ghost-right'], w: 202, h: 227 },
];

const at = (p, w, ar = 1) => ({ '--x': pct(p.left), '--y': pct(p.top), '--w': pct(w), '--ar': ar });

/**
 * Jack-o'-lantern, lit by one candle inside:
 *   body    moonlit and cool until the flame catches, then warms up
 *   spark   the wick catching, seen through the mouth
 *   face    carved light spreading outward from the flame (radial mask)
 *   glows   interior, eyes flare and floor spill — all flicker on the same flame rhythm
 */
function Pumpkin() {
  const box = layers.pumpkin;
  const { flame, eyes, base } = layers;
  const w = layers['pumpkin-width'];
  const origin = {
    '--ox': pct(((flame.left - box.left) / box.width) * 100),
    '--oy': pct(((flame.top - box.top) / box.height) * 100),
  };

  return (
    <div className="pumpkin">
      <img className="layer pumpkin__body" style={boxStyle(box)} src={pumpkinSrc} alt="" width="759" height="738" />
      <span className="pumpkin__face" style={{ ...boxStyle(layers['pumpkin-face']), ...origin }}>
        <img className="pumpkin__face-img" src={pumpkinFaceSrc} alt="" width="759" height="738" />
      </span>
      <span className="glow glow--spark" style={at(flame, w * 0.16)}><span className="glow__light" /></span>
      <span className="glow glow--pumpkin" style={at({ left: flame.left, top: (flame.top + eyes.top) / 2 }, w * 1.05, 1.5)}><span className="glow__light" /></span>
      <span className="glow glow--eyes" style={at(eyes, w * 0.8, 2.6)}><span className="glow__light" /></span>
      <span className="glow glow--floor" style={at(base, w * 1.5, 5)}><span className="glow__light" /></span>
    </div>
  );
}

/**
 * The approved character scene from the design, as independent layers (back to front):
 *   back plate   foliage, branches, star, floor
 *   ghosts       main ghost (hat, lantern, moon) + two small ghosts — they fly out of the pumpkin
 *   pumpkin      jack-o'-lantern in front of the ghosts; its carved face lights up first
 *   fx           particles, falling leaves, floor smoke
 */
export default function HeroScene() {
  const main = layers['ghost-main'];

  return (
    <div className="scene" aria-hidden="true" style={{ '--aspect': layers.aspect }}>
      <div className="scene__reveal">
        <img className="layer" style={boxStyle(layers['scene-back'])} src={sceneBackSrc} alt="" width="1620" height="1498" fetchPriority="high" />
        {/* night air where the main ghost will appear; lifts as it rises */}
        <span className="scene__veil" style={boxStyle(main)} />
        <span className="glow glow--star" style={{ '--x': '37.8%', '--y': '20.8%', '--w': '8%' }}><span className="glow__light" /></span>
      </div>

      {GHOSTS.map(({ name, src, box, w, h }) => (
        <div key={name} className={`ghost ghost--${name}`} style={{ ...boxStyle(box), ...flight(box) }}>
          <div className="ghost__fly-x">
            <div className="ghost__fly-y">
              <div className="ghost__float">
                <div className="ghost__sway">
                  <img className="ghost__img" src={src} alt="" width={w} height={h} decoding="async" />
                  {name === 'main' && (
                    <>
                      <span className="glow glow--lantern" style={within(main, 40.3, 44.8, 15)}><span className="glow__light" /></span>
                      <span className="glow glow--moon" style={within(main, 85.8, 18.6, 11)}><span className="glow__light" /></span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="scene__reveal">
        <Pumpkin />
        <span className="glow glow--candle" style={{ '--x': '74.4%', '--y': '76%', '--w': '9%', '--ar': 0.8 }}><span className="glow__light" /></span>
      </div>

      <Particles />
      <Leaves />
      <Smoke layer="front" />
    </div>
  );
}
