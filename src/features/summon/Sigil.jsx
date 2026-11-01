import { useMemo } from 'react';
import { sigilOf } from './fate.js';

/**
 * The guest's sigil. Re-keyed on every new seed, so each name draws itself in again
 * (stroke draw-on via pathLength=1; see .sigil in Summon.css).
 */
export default function Sigil({ seed, className = '' }) {
  const s = useMemo(() => sigilOf(seed), [seed]);
  return (
    <svg className={`sigil ${className}`.trim()} viewBox="0 0 200 200" aria-hidden="true" focusable="false" key={seed}>
      <g className="sigil__ring">
        <path className="sigil__line" pathLength="1" d={s.ring} style={{ '--i': 0 }} />
      </g>
      <path className="sigil__line" pathLength="1" d={s.star} style={{ '--i': 1 }} />
      <path className="sigil__line" pathLength="1" d={s.spine} style={{ '--i': 2 }} />
      <path className="sigil__line" pathLength="1" d={s.inner} style={{ '--i': 3 }} />
      <path className="sigil__nodes" d={s.nodes} />
    </svg>
  );
}
