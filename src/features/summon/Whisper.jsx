import { useState } from 'react';
import { Sparkle } from '../../components/Icons.jsx';
import './Whisper.css';

/**
 * Greets a visitor who arrived through a friend's invite link (?from=Name):
 * "Name summoned you" — the other half of the Midnight Pass loop.
 */
export default function Whisper({ from, ready, onAnswer }) {
  const [dismissed, setDismissed] = useState(false);
  if (!from || dismissed) return null;

  return (
    <aside className={`whisper${ready ? ' is-ready' : ''}`} aria-label="Invitation">
      <span className="whisper__mark" aria-hidden="true">
        <Sparkle size={18} />
      </span>
      <div className="whisper__body">
        <p className="whisper__title">
          <strong>{from}</strong> summoned you.
        </p>
        <p className="whisper__text">They saved you a place at midnight.</p>
        <button type="button" className="whisper__answer" onClick={onAnswer}>
          Answer the call
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>
      <button type="button" className="whisper__close" aria-label="Dismiss invitation" onClick={() => setDismissed(true)}>
        <svg width="16" height="16" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l12 12M17 5L5 17" />
        </svg>
      </button>
    </aside>
  );
}
