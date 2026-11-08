/**
 * The old "convert the word when the space arrives" path, now reading from the same engine.
 *
 * It exists for phones and tablets: a touch keyboard does not report which key was pressed, so the
 * live typing in composer.js cannot start there. The letters arrive as ordinary text and the word is
 * converted when a space or punctuation mark ends it - but with the full word list behind it, so
 * "tumhari" is तुम्हारी and not तुमहरी.
 *
 * Once a keyboard that does report its keys has been used, this path does nothing: live typing has
 * already written the Hindi, and any Latin word still in the text is there on purpose (Esc, pasted
 * English, an address).
 */
import { engine } from './engine.js';

/** The best Devanagari for a word typed in Latin letters (the word itself if there is nothing). */
export function convertWord(word) {
  if (!word || !/^[A-Za-z]+$/.test(word)) return word;
  if (engine.liveKeys) return word;
  const result = engine.suggest(word);
  const best = result.convert[0];
  if (!best) return word;
  engine.learn(result.typed, best.text, false, best.kind !== 'rule');
  return best.text;
}
