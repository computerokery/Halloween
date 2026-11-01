import { lazy, Suspense, useRef } from 'react';
import Button from '../../components/Button.jsx';
import { DateIndicator, InfoItem, SectionLabel } from '../../components/EventMeta.jsx';
import usePointerParallax from '../../hooks/usePointerParallax.js';
import HeroScene from './HeroScene.jsx';
import HeroStory from './HeroStory.jsx';
import { Smoke } from './Atmosphere.jsx';
import './Hero.css';
import './HeroScene.css';
import './Atmosphere.css';

const HeroCanvas = lazy(() => import('./three/HeroCanvas.jsx'));

/**
 * The 3D canvas covers the whole hero (so nothing is ever clipped before the screen edge);
 * an empty slot in the layout — the same box the 2D scene uses — tells the camera where the
 * composition belongs (see ViewFit in three/HeroCanvas.jsx).
 */
function Canvas3D({ slot, reduced, onStart }) {
  return (
    <div className="hero__canvas" aria-hidden="true">
      <Suspense fallback={null}>
        <HeroCanvas slot={slot} reduced={reduced} onStart={onStart} />
      </Suspense>
    </div>
  );
}

export default function Hero({ webgl, reduced, onSceneStart }) {
  const ref = useRef(null);
  const slot = useRef(null);
  usePointerParallax(ref);

  return (
    <section className={`hero${webgl ? ' hero--3d' : ''}`} id="top" ref={ref} aria-labelledby="hero-title">
      {!webgl && (
        <div className="hero__backdrop" aria-hidden="true">
          <div className="hero__ambient" />
          <Smoke layer="back" />
        </div>
      )}
      {webgl && <Canvas3D slot={slot} reduced={reduced} onStart={onSceneStart} />}

      <div className="hero__layout container">
        <div className="hero__intro">
          <h1 className="hero__title" id="hero-title">
            <span className="hero__line">
              <span className="hero__word">Midnight</span>
            </span>
            <span className="hero__line">
              <span className="hero__word">is</span>{' '}
              <span className="hero__word hero__word--accent">calling</span>
            </span>
          </h1>
          <SectionLabel className="hero__label">
            One night. No rules.
            <br />
            Just magic.
          </SectionLabel>
        </div>

        {webgl ? <div className="scene scene--3d" ref={slot} style={{ '--aspect': 720 / 666 }} aria-hidden="true" /> : <HeroScene />}

        <div className="hero__aside">
          <p className="hero__copy">
            A night to lose yourself.
            <br />
            Music, costumes and a little magic — come get your dose of fright.
          </p>
          <div className="hero__actions">
            <Button variant="primary" href="#tickets" className="hero__btn">
              Join the party
            </Button>
            <Button variant="secondary" href="#about" className="hero__btn">
              What to expect
            </Button>
          </div>
        </div>

        <div className="hero__meta">
          <DateIndicator date="October 31" dateTime="2026-10-31T20:00" time="Doors open at 8 PM" />
          <dl className="hero__details">
            <InfoItem label="Dress code">
              Anything but
              <br />
              ordinary
            </InfoItem>
            <InfoItem label="The vibe">
              Midnight magic
              <br />
              Wild dancing
            </InfoItem>
          </dl>
        </div>
      </div>

      {webgl && <HeroStory />}
    </section>
  );
}
