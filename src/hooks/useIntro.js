import { useEffect, useState } from 'react';

const MAX_WAIT = 2500;

/**
 * Holds the entrance timeline ('pending') until the hero scene image is decoded
 * and fonts are ready, so the cinematic sequence never starts on a half-loaded page.
 */
export default function useIntro(criticalImages) {
  const [state, setState] = useState('pending');

  useEffect(() => {
    let cancelled = false;
    const decode = (src) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => {});
    };
    const ready = Promise.all([...criticalImages.map(decode), document.fonts?.ready]);
    const timeout = new Promise((resolve) => setTimeout(resolve, MAX_WAIT));

    Promise.race([ready, timeout]).then(() => {
      if (!cancelled) setState('play');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
