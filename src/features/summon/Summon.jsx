import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Button from '../../components/Button.jsx';
import { alterEgo, cleanName, fateOf, MAX_NAME } from './fate.js';
import { renderPass } from './passImage.js';
import { inviteUrl, loadPass, savePass } from './storage.js';
import SealButton from './SealButton.jsx';
import Sigil from './Sigil.jsx';
import './Summon.css';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Debounced value: the sigil settles while you type instead of redrawing on every key. */
function useSettled(value, ms) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * The Midnight Pass — every "Buy tickets" / "Join the party" leads here.
 *   ritual — write your name; the night answers with a sigil and an alter ego, live
 *   seal   — press and hold the wax seal
 *   pass   — your pass (the exact PNG you save), plus an invite link that greets your friend
 *            by your name (?from=…) — every guest becomes a promoter.
 */
export default function Summon({ open, from, onClose }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const titleId = useId();
  const [reduced] = useState(reducedMotion);
  const [stored] = useState(loadPass);

  const [phase, setPhase] = useState(stored ? 'pass' : 'ritual');
  const [name, setName] = useState(stored?.name ?? '');
  const [summoner, setSummoner] = useState(stored?.from ?? from ?? '');
  const [image, setImage] = useState(null); // { url, blob }
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);

  const trimmed = name.trim();
  const settled = useSettled(trimmed, reduced ? 0 : 260);
  const fate = useMemo(() => fateOf(settled), [settled]);

  // open / close the native modal
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add('is-summoning');
      if (phase === 'ritual') requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && d.open) d.close();
  }, [open, phase]);

  useEffect(() => {
    if (!open && from && phase === 'ritual') setSummoner(from);
  }, [open, from, phase]);

  // render the pass image whenever we land on the pass with a name
  useEffect(() => {
    if (phase !== 'pass' || !trimmed) return undefined;
    let alive = true;
    let url;
    renderPass({ name: trimmed, fate: fateOf(trimmed), from: summoner || undefined })
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ url, blob });
      })
      .catch((err) => {
        console.error('[summon] pass render failed', err);
        if (alive) setStatus('The ink smudged. Try sealing again.');
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // name and summoner can't change once the pass is sealed
  }, [phase]);

  const seal = useCallback(() => {
    setPhase('sealing');
    savePass({ name: trimmed, from: summoner || undefined });
    setTimeout(() => setPhase('pass'), reduced ? 0 : 900);
  }, [trimmed, summoner, reduced]);

  const restart = () => {
    dialog.current?.style.setProperty('--seal', 0);
    setImage(null);
    setStatus('');
    setName('');
    setPhase('ritual');
    setAttempt((n) => n + 1);
    requestAnimationFrame(() => input.current?.focus());
  };

  const fileName = `midnight-pass-${trimmed.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'guest'}.png`;
  const link = inviteUrl(trimmed);
  const egoFull = `${alterEgo(fateOf(trimmed))} of ${fateOf(trimmed).domain}`;

  const share = async () => {
    const text = `I’ve been summoned to The Midnight Club — October 31. I am ${egoFull}. Find out who you are:`;
    try {
      const file = image && new File([image.blob], fileName, { type: 'image/png' });
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Midnight Pass', text: `${text} ${link}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'The Midnight Club', text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setStatus('Invite link copied — send it to someone brave.');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStatus(`Copy this link: ${link}`);
    }
  };

  return (
    <dialog
      ref={dialog}
      className={`summon summon--${phase}`}
      aria-labelledby={titleId}
      onClose={() => {
        document.documentElement.classList.remove('is-summoning');
        onClose();
      }}
      onClick={(e) => {
        // a click on the backdrop (the dialog box itself, outside the panel) closes it
        if (e.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="summon__panel">
        <button type="button" className="summon__close" aria-label="Close" onClick={() => dialog.current.close()}>
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l12 12M17 5L5 17" />
          </svg>
        </button>

        {phase !== 'pass' ? (
          <div className="summon__ritual">
            <div className="summon__stage" aria-hidden="true">
              <div className="summon__halo" />
              <Sigil seed={fate.seed} className={trimmed ? '' : 'sigil--idle'} />
              <div className="summon__burst" />
            </div>

            <form
              className="summon__form"
              onSubmit={(e) => {
                e.preventDefault();
                document.querySelector('.seal')?.focus();
              }}
            >
              <p className="summon__label">The Midnight Pass</p>
              <h2 className="summon__title" id={titleId}>
                Who answers
                <br />
                <em>the call?</em>
              </h2>
              {summoner ? (
                <p className="summon__lead">
                  <strong>{summoner}</strong> saved you a place at midnight. Write your name — the night will tell you who you are.
                </p>
              ) : (
                <p className="summon__lead">Write your name. The night already knows who you are — it only needs to hear it.</p>
              )}

              <label className="summon__field">
                <span className="summon__field-label">Your name</span>
                <input
                  ref={input}
                  className="summon__input"
                  type="text"
                  name="name"
                  autoComplete="given-name"
                  spellCheck="false"
                  maxLength={MAX_NAME}
                  placeholder="e.g. Morgan"
                  value={name}
                  onChange={(e) => setName(cleanName(e.target.value))}
                  disabled={phase === 'sealing'}
                />
              </label>

              <p className="summon__omen" aria-live="polite">
                {settled ? (
                  <span key={settled} className="summon__ego">
                    Tonight you are <em>{alterEgo(fate)}</em> of {fate.domain}.
                  </span>
                ) : (
                  <span className="summon__ego summon__ego--idle">Your midnight name will appear here.</span>
                )}
              </p>

              <div className="summon__seal-row">
                <SealButton key={attempt} disabled={!trimmed || phase === 'sealing'} duration={reduced ? 600 : 1500} onSeal={seal}>
                  {phase === 'sealing' ? 'Sealed' : 'Hold to seal your pass'}
                </SealButton>
                <p className="summon__hint">Press and hold. The wax needs a moment.</p>
              </div>
            </form>
          </div>
        ) : (
          <div className="summon__result">
            <div className="summon__ticket">
              {image ? (
                <img
                  className="summon__image"
                  src={image.url}
                  width="1080"
                  height="1350"
                  alt={`Midnight Pass for ${trimmed}: ${egoFull}. October 31, doors at 8 PM, their hour is ${fateOf(trimmed).hour}. Costume omen: ${fateOf(trimmed).omen} Pass number ${fateOf(trimmed).number}.`}
                />
              ) : (
                <div className="summon__image summon__image--pending" role="status">
                  Inking your pass…
                </div>
              )}
            </div>

            <div className="summon__after">
              <p className="summon__label">Your name is on the list</p>
              <h2 className="summon__title" id={titleId}>
                {trimmed}, <em>you’re in.</em>
              </h2>
              <p className="summon__lead">
                Be on the dance floor at <strong>{fateOf(trimmed).hour}</strong>. Now summon someone — your link greets them by your name.
              </p>
              <div className="summon__actions">
                <Button as="button" type="button" variant="primary" icon="up-right" onClick={share} disabled={!image}>
                  Summon a friend
                </Button>
                {image && (
                  <Button variant="secondary" icon={null} href={image.url} download={fileName}>
                    Save the pass
                  </Button>
                )}
              </div>
              <p className="summon__status" role="status" aria-live="polite">
                {status}
              </p>
              <button type="button" className="summon__again" onClick={restart}>
                Summon a different name
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
