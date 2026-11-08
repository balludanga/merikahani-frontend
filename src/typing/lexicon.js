/**
 * A word list laid out for searching by prefix.
 *
 * Words are stored under a "key": the spelling without the nukta dot (ज़ → ज, ड़ → ड), because most
 * writers leave the dot out and a typed "z" or "r" should find the word either way. The spelling
 * shown to the writer is the real one, so जिंदगी and ज़िंदगी are two entries under one key, each with
 * its own weight.
 *
 * A weight is ten times the base-10 log of how often the word occurs (10 = ten times in the source,
 * 40 = ten thousand times), which keeps the file small and the arithmetic simple.
 */

const NUKTA = /़/g;

/** The spelling used for matching: no nukta, composed form. */
export function foldKey(surface) {
  return surface.normalize('NFC').replace(NUKTA, '');
}

export class Layer {
  /** @param {Array<[string, number]>} rows [spelling, weight] */
  constructor(rows) {
    const entries = rows.map(([surface, weight]) => ({ key: foldKey(surface), surface, weight }));
    // the shipped list is already in this order; only sort when it is not
    let sorted = true;
    for (let i = 1; i < entries.length && sorted; i += 1) {
      const a = entries[i - 1];
      const b = entries[i];
      if (a.key > b.key || (a.key === b.key && a.weight < b.weight)) sorted = false;
    }
    if (!sorted) entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : b.weight - a.weight));
    this.size = entries.length;
    this.keys = new Array(entries.length);
    this.surfaces = new Array(entries.length);
    this.weights = new Float32Array(entries.length);
    entries.forEach((e, i) => {
      this.keys[i] = e.key;
      this.surfaces[i] = e.surface;
      this.weights[i] = e.weight;
    });
  }
}

export const EMPTY_LAYER = new Layer([]);

/** First line of a prefix-compressed list. */
export const FRONT_CODED = '#fc1';

/**
 * Parse the lexicon file. Plain lines are "spelling<TAB>weight". A prefix-compressed file (first line
 * "#fc1") writes each line as one character that says how many leading characters it shares with the
 * line before, then the rest of the spelling: "<char for 3>ानी<TAB>62". Lines that do not parse are skipped.
 */
export function parseLexicon(text) {
  const rows = [];
  const lines = text.split('\n');
  const coded = lines[0] === FRONT_CODED;
  let previous = '';
  for (let i = coded ? 1 : 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const weight = Number(line.slice(tab + 1));
    if (!(weight > 0)) continue;
    let word;
    if (coded) {
      word = previous.slice(0, line.charCodeAt(0) - 48) + line.slice(1, tab);
      previous = word;
    } else {
      word = line.slice(0, tab);
    }
    rows.push([word, weight]);
  }
  return rows;
}

/** The compact form of a list of [spelling, weight] rows that is already in search order. */
export function encodeLexicon(rows) {
  const out = [FRONT_CODED];
  let previous = '';
  for (const [word, weight] of rows) {
    let shared = 0;
    while (shared < word.length && shared < previous.length && shared < 74 && word[shared] === previous[shared]) shared += 1;
    out.push(`${String.fromCharCode(48 + shared)}${word.slice(shared)}\t${weight}`);
    previous = word;
  }
  return `${out.join('\n')}\n`;
}

// Runs of Devanagari letters and signs: what counts as a word when reading a writer's own text.
const WORD = /[ऀ-ॣॱ-ॿ]+/g;

/** The Devanagari words in a piece of text, with how many times each appears. */
export function countWords(text) {
  const counts = new Map();
  if (!text) return counts;
  const found = String(text).match(WORD);
  if (!found) return counts;
  for (const word of found) {
    // a lone sign or a single vowel mark is not a word
    if (word.length < 2 && !/[अ-ह]/.test(word)) continue;
    const w = word.normalize('NFC');
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return counts;
}
