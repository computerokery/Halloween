const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function ArrowRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function ArrowUpRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base}>
      <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
    </svg>
  );
}

/** Four-point sparkle used in the wordmark. */
export function Sparkle({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 0c.35 6.2 1.9 10.6 12 12-10.1 1.4-11.65 5.8-12 12-.35-6.2-1.9-10.6-12-12C10.1 10.6 11.65 6.2 12 0z"
      />
    </svg>
  );
}

export function MenuIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" {...base}>
      {open ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 8h16M3 14h16" />}
    </svg>
  );
}
