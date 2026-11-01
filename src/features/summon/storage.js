import { cleanName } from './fate.js';

const KEY = 'midnight-pass';
const PARAM = 'from';

/** The guest's sealed pass, remembered on this device (may be unavailable — private mode etc.). */
export function loadPass() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    const name = cleanName(data?.name).trim();
    return name ? { name, from: cleanName(data.from).trim() || undefined } : null;
  } catch {
    return null;
  }
}

export function savePass(pass) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pass));
  } catch {
    /* not remembered — the pass still works for this visit */
  }
}

/** The name of whoever summoned this visitor (?from=…), if any. */
export function readSummoner() {
  try {
    return cleanName(new URLSearchParams(window.location.search).get(PARAM)).trim() || null;
  } catch {
    return null;
  }
}

/** A link that greets the friend by the sender's name. */
export function inviteUrl(name) {
  const url = new URL(window.location.pathname, window.location.origin);
  if (name) url.searchParams.set(PARAM, name);
  return url.toString();
}
