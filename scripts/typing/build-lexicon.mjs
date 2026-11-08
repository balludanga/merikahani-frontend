#!/usr/bin/env node
/**
 * Builds src/typing/hindi-lexicon.txt, the list of real Hindi words the typing engine matches against.
 *
 *   node scripts/typing/build-lexicon.mjs --wiki <counts> --source <counts> [--curated <file>]
 *        [--verbs <file>] [--adjectives <file>] [--max 70000] --out src/typing/hindi-lexicon.txt
 *
 * Inputs are word counts ("word<TAB>times", Devanagari only) taken from
 *   - Hindi Wikipedia   (articles dump, text CC BY-SA 4.0): broad everyday and modern vocabulary
 *   - Hindi Wikisource  (literature, text CC BY-SA 4.0 / public domain): the language of stories and verse
 * A list of how often each word occurs is a statistic about the language, not a copy of any page; the
 * file holds no sentences. Counting is done by scripts/typing/count-words.mjs.
 *
 * What the builder does, in order:
 *   1. keeps only words that are well formed Devanagari (no stray signs, no broken conjuncts);
 *   2. turns each corpus's counts into a rate per million words and blends them (stories count more);
 *   3. drops words seen too rarely to trust, and words that are two common words stuck together
 *      ("लेनेका" = लेने + का), which scanned books are full of;
 *   4. adds the hand-written list (curated.txt) and the regular forms of the verbs in verbs.txt and the
 *      adjectives in adjectives.txt (morphology.mjs): everyday spoken and poetic words that encyclopedic
 *      text rarely uses, guaranteed a place;
 *   5. writes the list prefix-compressed (see lexicon.js), one "spelling<TAB>weight" per word, where weight =
 *      10 * log10(occurrences per 100 million words).
 */
import fs from 'node:fs';
import { encodeLexicon, foldKey } from '../../src/typing/lexicon.js';
import { adjectiveForms, verbForms } from './morphology.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? acc.concat([[a.slice(2), all[i + 1]]]) : acc), [])
);
if (!args.wiki || !args.source || !args.out) {
  console.error('usage: build-lexicon.mjs --wiki <counts> --source <counts> [--curated <file>] [--max N] --out <file>');
  process.exit(1);
}

// ---- well-formed Devanagari ---------------------------------------------------------------------------
const kind = (ch) => {
  const c = ch.codePointAt(0);
  if ((c >= 0x0904 && c <= 0x0914) || c === 0x0960 || c === 0x0961 || c === 0x0972) return 'V'; // vowel letters
  if (c >= 0x0915 && c <= 0x0939) return 'C'; // consonants
  if (c === 0x093c) return 'N'; // nukta
  if ((c >= 0x093e && c <= 0x094c) || c === 0x0962 || c === 0x0963 || c === 0x094e || c === 0x094f) return 'M'; // vowel signs
  if (c === 0x094d) return 'H'; // virama
  if (c === 0x0901 || c === 0x0902 || c === 0x0903) return 'A'; // candrabindu, anusvara, visarga
  return 'X';
};

const NEXT = {
  '^': 'VC',
  V: 'AVC$',
  C: 'NMHACV$',
  N: 'MHACV$',
  M: 'ACV$',
  H: 'C',
  A: 'CV$',
};

export function wellFormed(word) {
  if (word.length < 1 || word.length > 18) return false;
  let state = '^';
  for (const ch of word) {
    const k = kind(ch);
    if (k === 'X' || !NEXT[state] || NEXT[state].indexOf(k) === -1) return false;
    state = k;
  }
  return NEXT[state].indexOf('$') !== -1;
}

// ---- read counts ---------------------------------------------------------------------------------------------
function readCounts(file) {
  const counts = new Map();
  let total = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    const word = line.slice(0, tab).normalize('NFC');
    const n = Number(line.slice(tab + 1));
    if (!n || !wellFormed(word)) continue;
    counts.set(word, (counts.get(word) || 0) + n);
    total += n;
  }
  return { counts, total };
}

const wiki = readCounts(args.wiki);
const source = readCounts(args.source);
console.error(`wikipedia: ${wiki.counts.size} forms, ${wiki.total} words; wikisource: ${source.counts.size} forms, ${source.total} words`);

// ---- blend ------------------------------------------------------------------------------------------------------
const SOURCE_SHARE = 0.55; // stories and verse matter most for this site
const rate = new Map(); // per million words
const seenIn = new Map();
const all = new Set([...wiki.counts.keys(), ...source.counts.keys()]);
for (const w of all) {
  const a = wiki.counts.get(w) || 0;
  const b = source.counts.get(w) || 0;
  rate.set(w, (1 - SOURCE_SHARE) * (a / wiki.total) * 1e6 + SOURCE_SHARE * (b / source.total) * 1e6);
  seenIn.set(w, { a, b });
}

// ---- keep what can be trusted -----------------------------------------------------------------------------------
// A word earns its place by being common somewhere, or by turning up in both kinds of text (a word that
// appears in an encyclopedia AND in stories is a real word; one that appears in a single article is
// usually a name, a typo or a foreign term).
const trusted = (w) => {
  const { a, b } = seenIn.get(w);
  const r = rate.get(w);
  if (r >= 4) return true; // common anywhere
  if (a >= 3 && b >= 3 && r >= 0.25) return true; // seen in both kinds of text
  if (b >= 30 && r >= 0.5) return true; // often in stories and verse
  if (a >= 40 && r >= 1) return true; // often in articles
  return false;
};
let kept = [...all].filter(trusted);

// Words that are really common words run together ("लेनेका" = लेने + का, "अधिकारोंकी" = अधिकारों + की):
// scanned books and typed articles are full of them. A word counts as glued when it splits into two
// words that both occur often, and is itself much rarer than either part.
const core = new Set(
  [...all]
    .filter((w) => w.length >= 2 && rate.get(w) >= 3)
    .sort((x, y) => rate.get(y) - rate.get(x))
    .slice(0, 45000)
);
// Only real postpositions: ने, या, न, एक... also end plenty of genuine words (निकलने, सिखाया, अवरोधन).
const PARTICLES = new Set(['का', 'की', 'के', 'को', 'से', 'में', 'पर']);
const glued = (w) => {
  if (w.length < 6) return false;
  for (let i = 3; i <= w.length - 2; i += 1) {
    const left = w.slice(0, i);
    const right = w.slice(i);
    if (!core.has(left) || !core.has(right)) continue;
    const parts = Math.min(rate.get(left), rate.get(right));
    // a long word followed by a particle, much rarer than the word alone: करनेके, अधिकारोंकी
    if (PARTICLES.has(right) && left.length >= 4 && rate.get(w) < parts * 0.25) return true;
    // two ordinary words run together and far rarer than either
    if (right.length >= 3 && rate.get(w) < parts * 0.04) return true;
  }
  return false;
};
const before = kept.length;
kept = kept.filter((w) => !glued(w));
console.error(`trusted: ${before}; after dropping glued words: ${kept.length}`);

// ---- hand-written additions ---------------------------------------------------------------------------------------
const MIN_CURATED = 3; // rate per million for a word that was only added by hand
const MIN_GENERATED = 1.5; // ... and for a form worked out by morphology.mjs
const final = new Map(kept.map((w) => [w, rate.get(w)]));

function addWords(file, floor, expand, label) {
  if (!file) return;
  let added = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const text = line.replace(/#.*$/, '').trim();
    if (!text) continue;
    for (const raw of text.split(/\s+/)) {
      for (const form of expand(raw.normalize('NFC'))) {
        if (!wellFormed(form)) {
          if (label === 'curated') console.error(`${label} word skipped (not well formed): ${form}`);
          continue;
        }
        if (!final.has(form)) added += 1;
        final.set(form, Math.max(final.get(form) || 0, floor));
      }
    }
  }
  console.error(`${label}: ${added} new words`);
}
addWords(args.curated, MIN_CURATED, (w) => [w], 'curated');
addWords(args.verbs, MIN_GENERATED, verbForms, 'verbs');
addWords(args.adjectives, MIN_GENERATED, adjectiveForms, 'adjectives');

// ---- cut to size and write ----------------------------------------------------------------------------------------------
const max = Number(args.max) || 70000;
const rows = [...final].sort((x, y) => y[1] - x[1]).slice(0, max);
const weight = (r) => Math.max(1, Math.round(10 * Math.log10(r * 100)));
// in the order the engine searches: by spelling without the nukta dot, then most common first
const ordered = rows
  .map(([w, r]) => [w, weight(r)])
  .sort((x, y) => {
    const a = foldKey(x[0]);
    const b = foldKey(y[0]);
    return a < b ? -1 : a > b ? 1 : y[1] - x[1];
  });
fs.writeFileSync(args.out, encodeLexicon(ordered));
const bytes = fs.statSync(args.out).size;
console.error(`wrote ${ordered.length} words, ${(bytes / 1e6).toFixed(2)} MB`);
