import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Hero from './sections/Hero/Hero.jsx';
import { CRITICAL_IMAGES } from './sections/Hero/HeroScene.jsx';
import { TEXT_CUE, TEXT_CUE_2D } from './sections/Hero/three/timing.js';
import useIntro from './hooks/useIntro.js';
import useIntroText from './hooks/useIntroText.js';
import useHeroScroll from './hooks/useHeroScroll.js';
import Whisper from './features/summon/Whisper.jsx';
import { loadPass, readSummoner } from './features/summon/storage.js';

// the Midnight Pass ritual loads on first use
const Summon = lazy(() => import('./features/summon/Summon.jsx'));
const SUMMON_LINKS = 'a[href="#tickets"]';

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const page = useRef(null);
  const [webgl] = useState(hasWebGL);
  const [reduced] = useState(prefersReducedMotion);
  // the 2D fallback scene waits for its images; the 3D scene has its own loader
  const intro = useIntro(webgl ? [] : CRITICAL_IMAGES);
  const [textCue, setTextCue] = useState(null);

  useEffect(() => {
    if (!webgl && intro === 'play') setTextCue({ delay: TEXT_CUE_2D });
  }, [webgl, intro]);

  // never leave the page without its text if the 3D scene is slow or fails
  useEffect(() => {
    const id = setTimeout(() => setTextCue((c) => c ?? { delay: 0 }), 6000);
    return () => clearTimeout(id);
  }, []);

  const onSceneStart = useCallback(() => setTextCue((c) => c ?? { delay: reduced ? 0 : TEXT_CUE }), [reduced]);

  // ?from=Name — someone sent this visitor their invite link
  const [summoner] = useState(() => {
    const from = readSummoner();
    if (from) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    return loadPass() ? null : from;
  });
  const [summon, setSummon] = useState({ mounted: false, open: false });
  const openSummon = useCallback(() => setSummon({ mounted: true, open: true }), []);
  const closeSummon = useCallback(() => setSummon((s) => ({ ...s, open: false })), []);

  // every ticket CTA (header, hero, scroll finale) opens the ritual
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!e.target.closest?.(SUMMON_LINKS)) return;
      e.preventDefault();
      openSummon();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [openSummon]);

  useIntroText(page, textCue);
  useHeroScroll(page, webgl);

  return (
    <div className="page" data-intro={intro} ref={page}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero webgl={webgl} reduced={reduced} onSceneStart={onSceneStart} />
      </main>
      {!summon.mounted && <Whisper from={summoner} ready={Boolean(textCue)} onAnswer={openSummon} />}
      {summon.mounted && (
        <Suspense fallback={null}>
          <Summon open={summon.open} from={summoner} onClose={closeSummon} />
        </Suspense>
      )}
    </div>
  );
}
