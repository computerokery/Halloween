import { useEffect, useState } from 'react';
import Button from './Button.jsx';
import { MenuIcon, Sparkle } from './Icons.jsx';
import './Header.css';

export const NAV_LINKS = [
  { label: 'About the party', href: '#about' },
  { label: 'Lineup', href: '#lineup' },
  { label: 'FAQ', href: '#faq' },
];

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="Halloween — home">
      <Sparkle size={24} />
      <span className="logo__word">Halloween</span>
    </a>
  );
}

export function NavLinks({ onNavigate }) {
  return (
    <ul className="nav-links">
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <a className="nav-links__item" href={link.href} onClick={onNavigate}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Header({ className = '' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`header ${open ? 'is-open' : ''} ${className}`.trim()}>
      <div className="header__inner container">
        <Logo />

        <nav className="header__nav" aria-label="Primary">
          <NavLinks />
        </nav>

        <Button className="header__cta" variant="outline" icon="up-right" href="#tickets">
          Buy tickets
        </Button>

        <button
          type="button"
          className="header__toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <MenuIcon open={open} />
        </button>
      </div>

      <div id="mobile-menu" className="header__panel" hidden={!open}>
        <nav className="container" aria-label="Mobile">
          <NavLinks onNavigate={() => setOpen(false)} />
          <Button variant="primary" icon="up-right" href="#tickets" onClick={() => setOpen(false)}>
            Buy tickets
          </Button>
        </nav>
      </div>
    </header>
  );
}
