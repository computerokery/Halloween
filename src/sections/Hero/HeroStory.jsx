import Button from '../../components/Button.jsx';
import { SectionLabel } from '../../components/EventMeta.jsx';
import './HeroStory.css';

/**
 * Copy for the scroll story (desktop, 3D). Each beat is timed against the camera in
 * src/hooks/useHeroScroll.js and sits on the side of the frame the scene leaves empty.
 *
 *   01 ritual  — the camera orbits right, revealing depth          (text left)
 *   02 guests  — the small ghosts circle the pumpkin               (text right)
 *   03 night   — the camera begins its dive toward the flame       (text lower left)
 *   finale     — inside the glow: the invitation, with the CTAs    (centre)
 */
export default function HeroStory() {
  return (
    <div className="story">
      {/* soft shade on the text side of the frame, faded in with each beat */}
      <div className="story__shade story__shade--ritual" aria-hidden="true" />
      <div className="story__shade story__shade--guests" aria-hidden="true" />
      <div className="story__shade story__shade--night" aria-hidden="true" />
      <article className="story__beat story__beat--ritual">
        <SectionLabel className="story__label">01 — The ritual</SectionLabel>
        <h2 className="story__title">
          One candle.
          <br />
          <em>One wish.</em>
        </h2>
        <p className="story__text">At the stroke of twelve a single flame wakes the night — and everything it touches starts to move.</p>
      </article>

      <article className="story__beat story__beat--guests">
        <SectionLabel className="story__label">02 — The guests</SectionLabel>
        <h2 className="story__title">
          Everyone’s on the list.
          <br />
          <em>Even them.</em>
        </h2>
        <p className="story__text">Spirits, witches and you. Costumes strongly encouraged — the ghosts are already dressed.</p>
      </article>

      <article className="story__beat story__beat--night">
        <SectionLabel className="story__label">03 — The night</SectionLabel>
        <h2 className="story__title">
          Midnight has
          <br />
          <em>a heartbeat.</em>
        </h2>
        <p className="story__text">Music, costumes and a little magic, until the last candle burns out.</p>
      </article>

      <div className="story__finale">
        <div className="story__scrim" aria-hidden="true" />
        <div className="story__finale-inner">
          <SectionLabel className="story__label">October 31 · Doors open at 8 PM</SectionLabel>
          <h2 className="story__finale-title">
            See you at <em>midnight</em>
          </h2>
          <div className="story__actions">
            <Button variant="primary" icon="up-right" href="#tickets">
              Buy tickets
            </Button>
            <Button variant="secondary" href="#lineup">
              See the lineup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
