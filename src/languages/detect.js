/**
 * Does the text look like it is in another language than the one the writer chose?
 *
 * Only the script is looked at, so only what a script settles is suggested: Tamil letters are Tamil,
 * Gurmukhi is Punjabi. Devanagari is shared by many languages, and Latin letters are also how some people
 * write Hindi, so those are never "corrected" except from a clearly different script.
 */
import { getLanguage } from './registry';

const SCRIPTS = [
  ['Deva', /[ऀ-ॿ]/g],
  ['Beng', /[ঀ-৿]/g],
  ['Guru', /[਀-੿]/g],
  ['Gujr', /[઀-૿]/g],
  ['Orya', /[଀-୿]/g],
  ['Taml', /[஀-௿]/g],
  ['Telu', /[ఀ-౿]/g],
  ['Knda', /[ಀ-೿]/g],
  ['Mlym', /[ഀ-ൿ]/g],
  ['Arab', /[؀-ۿݐ-ݿ]/g],
  ['Olck', /[᱐-᱿]/g],
  ['Mtei', /[ꯀ-꯿]/g],
  ['Latn', /[A-Za-z]/g],
];

// the language a script points to when it has only one (or one that is by far the usual)
const LANGUAGE_OF = {
  Deva: 'hi', Beng: 'bn', Guru: 'pa', Gujr: 'gu', Orya: 'or', Taml: 'ta', Telu: 'te', Knda: 'kn', Mlym: 'ml',
  Arab: 'ur', Olck: 'sat', Mtei: 'mni', Latn: 'en',
};

const MIN_LETTERS = 24;
const SHARE = 0.7;

/** The script most of the letters are in, or null when the text is short or mixed. */
export function dominantScript(text) {
  const sample = String(text || '').slice(0, 4000);
  const counts = SCRIPTS.map(([script, pattern]) => [script, (sample.match(pattern) || []).length]);
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  if (total < MIN_LETTERS) return null;
  const [script, n] = counts.reduce((best, row) => (row[1] > best[1] ? row : best));
  return n / total >= SHARE ? script : null;
}

/** A language code worth suggesting instead of `current`, or null when the text fits `current` or says nothing. */
export function suggestLanguage(text, current) {
  const script = dominantScript(text);
  if (!script) return null;
  const language = getLanguage(current);
  if (language.scripts.includes(script)) return null;
  // Devanagari-script languages and Latin: one Hindi story in Roman letters is not a sign of anything
  if (script === 'Latn' && language.code === 'hi') return null;
  const code = LANGUAGE_OF[script];
  return code && code !== current ? code : null;
}
