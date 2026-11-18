/**
 * The languages a person reads and writes in, kept on this device (so a visitor who is not signed in
 * keeps their choice too). When someone is signed in the same lists live on their account
 * (see useLanguages.js), and the account wins.
 *
 * An empty read list means "not chosen yet": every language is shown.
 */
import { cleanCodes, DEFAULT_LANGUAGE, isLanguage } from './registry';

const KEYS = { read: 'lekhani_read_langs', write: 'lekhani_write_langs' };
const LAST = 'lekhani_last_write_lang';
const PRIMARY = 'lekhani_primary_lang';
const EVENT = 'lekhani:languages';

function load(key) {
  try {
    return cleanCodes(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch (error) {
    return [];
  }
}

export const getChoice = (kind) => load(KEYS[kind]);

/** Save a list for 'read' or 'write' and tell every page that shows it. Returns the cleaned list. */
export function setChoice(kind, codes) {
  const clean = cleanCodes(codes);
  if (kind === 'read' && clean.length) {
    const primary = getPrimary();
    if (primary && !clean.includes(primary)) {
      try {
        localStorage.removeItem(PRIMARY);
      } catch (error) {
        // nothing to clear it from
      }
    }
  }
  try {
    localStorage.setItem(KEYS[kind], JSON.stringify(clean));
  } catch (error) {
    // storage blocked: the choice lasts for this visit only, through the event below
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind, codes: clean } }));
  return clean;
}

/**
 * The one language a person prefers: the interface is shown in it, its stories come first and a new
 * story starts in it. null until they choose. Always one of the languages they read in, when they
 * have chosen any (the server keeps the same rule for the account).
 */
export function getPrimary() {
  try {
    const code = localStorage.getItem(PRIMARY);
    if (code && isLanguage(code)) return code;
  } catch (error) {
    // storage blocked: none chosen
  }
  return null;
}

export function setPrimary(code) {
  const clean = code && isLanguage(code) ? code : null;
  try {
    if (clean) localStorage.setItem(PRIMARY, clean);
    else localStorage.removeItem(PRIMARY);
  } catch (error) {
    // the choice lasts for this visit only, through the event below
  }
  // a preferred language is one of the languages they read in
  const reading = getChoice('read');
  if (clean && reading.length && !reading.includes(clean)) setChoice('read', [clean, ...reading]);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind: 'primary', codes: clean ? [clean] : [] } }));
  return clean;
}

export function subscribe(listener) {
  const onEvent = () => listener();
  const onStorage = (e) => {
    if (!e.key || Object.values(KEYS).includes(e.key) || e.key === PRIMARY) listener();
  };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
}

/** The language the writer used last, so a new story starts in it. */
export function lastWriteLanguage() {
  try {
    const code = localStorage.getItem(LAST);
    if (code && isLanguage(code)) return code;
  } catch (error) {
    // storage blocked: fall through
  }
  return null;
}

export function rememberWriteLanguage(code) {
  if (!isLanguage(code)) return;
  try {
    localStorage.setItem(LAST, code);
  } catch (error) {
    // nothing to keep it in
  }
}

/** The language a new story starts in: the preferred one, else the one used last, else the first they write in, else Hindi. */
export function startingLanguage() {
  return getPrimary() || lastWriteLanguage() || getChoice('write')[0] || DEFAULT_LANGUAGE;
}
