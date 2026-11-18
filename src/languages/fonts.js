/**
 * The fonts a language's script needs.
 *
 * Devanagari and Latin are in the page from the start. The other scripts (Noto, from Google Fonts like
 * the rest) are fetched only when a page shows text in them, so a Hindi reader never downloads
 * Tamil: `needFonts('ta')` adds one stylesheet for it, once. The families are also listed in the
 * font stacks (`--indic-fonts` in App.css), so the browser uses them as soon as they have arrived.
 */
import { LANGUAGES, getLanguage } from './registry';

// ISO 15924 script -> the Google Fonts family that draws it
export const FAMILY = {
  Beng: 'Noto Serif Bengali',
  Gujr: 'Noto Serif Gujarati',
  Guru: 'Noto Serif Gurmukhi',
  Knda: 'Noto Serif Kannada',
  Mlym: 'Noto Serif Malayalam',
  Orya: 'Noto Serif Oriya',
  Taml: 'Noto Serif Tamil',
  Telu: 'Noto Serif Telugu',
  Arab: 'Noto Naskh Arabic',
  Olck: 'Noto Sans Ol Chiki',
  Mtei: 'Noto Sans Meetei Mayek',
};

const href = (families) =>
  `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;700`).join('&')}&display=swap`;

function add(families, key) {
  if (typeof document === 'undefined' || !families.length) return;
  // the page itself says what it already has, so a hot reload or a test that clears the head starts clean
  if (document.head.querySelector(`link[data-fonts="${key}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href(families);
  link.setAttribute('data-fonts', key);
  document.head.appendChild(link);
}

/** The families a list of language codes needs that the page does not already have. */
export function familiesFor(codes) {
  const out = [];
  codes.forEach((code) => {
    getLanguage(code).scripts.forEach((script) => {
      const family = FAMILY[script];
      if (family && !out.includes(family)) out.push(family);
    });
  });
  return out;
}

/** Make sure the scripts of these languages can be drawn (call it from the page that shows them). */
export function needFonts(codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  list.forEach((code) => {
    const families = familiesFor([code]);
    add(families, families.join('|'));
  });
}

/** Every script the site supports, for the language picker that shows each name in its own script. */
export function needAllFonts() {
  add(Object.values(FAMILY), 'all');
}

export const ALL_CODES = LANGUAGES.map((l) => l.code);
