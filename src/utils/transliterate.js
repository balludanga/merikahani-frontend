/**
 * Phonetic Hinglish → Devanagari transliteration.
 *
 * Two layers:
 *  1. A dictionary of very frequent words (us, raat, kuch, hua, tha, ...) for
 *     idiomatic spellings no rule set can fully capture.
 *  2. Baraha-style phonetic rules: consonants, matras, conjunct halants and
 *     nasalization — pure functions, no network calls, instant feedback.
 *
 * Conventions: "aa"→ा, "ee/ii"→ी, "oo/uu"→ू, "chh"→छ, "sh"→श, "ksh"→क्ष.
 * Capital T/D/N give the retroflex ट/ड/ण series.
 */

import { PINS } from '../typing/pins.js';

const WORDS = PINS;

const CONSONANTS = {
  ksh: 'क्ष', chh: 'छ',
  kh: 'ख', gh: 'घ', ch: 'च', jh: 'झ', th: 'थ', dh: 'ध', ph: 'फ', bh: 'भ', sh: 'श',
  Th: 'ठ', Dh: 'ढ', N: 'ण',
  k: 'क', q: 'क़', g: 'ग', j: 'ज', z: 'ज़', t: 'त', T: 'ट',
  d: 'द', D: 'ड', n: 'न', p: 'प', f: 'फ़', b: 'ब', m: 'म',
  y: 'य', r: 'र', l: 'ल', v: 'व', w: 'व', s: 'स', h: 'ह',
};

// Consonant pairs that read as conjuncts and take a halant (प्र, त्र, स्व…).
const CLUSTER_HALANT = new Set([
  'pr', 'kr', 'gr', 'tr', 'dr', 'br', 'vr', 'fr', 'sr', 'hr', 'zr',
  'kl', 'pl', 'bl', 'gl', 'sl', 'vl',
  'ky', 'gy', 'py', 'my', 'dy', 'ty', 'ny', 'by', 'ry', 'hy',
  'sv', 'st', 'sp', 'sk', 'sm', 'sn', 'shn', 'sth', 'tn', 'dv', 'tv', 'hm', 'hn',
]);

const VOWEL_SIGNS = {
  aa: 'ा', ii: 'ी', ee: 'ी', uu: 'ू', oo: 'ू',
  ai: 'ै', au: 'ौ', ou: 'ौ', a: '', i: 'ि', u: 'ु', e: 'े', o: 'ो',
};

const INDEPENDENT = {
  aa: 'आ', a: 'अ', ii: 'ई', ee: 'ई', i: 'इ', uu: 'ऊ', oo: 'ऊ',
  u: 'उ', ai: 'ऐ', au: 'औ', ou: 'औ', e: 'ए', o: 'ओ',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const isVowel = (ch) => VOWELS.has(ch.toLowerCase());

function matchConsonant(word, i) {
  const three = word.slice(i, i + 3);
  const two = word.slice(i, i + 2);
  const one = word[i];
  if (CONSONANTS[three]) return { text: CONSONANTS[three], size: 3 };
  if (CONSONANTS[two]) return { text: CONSONANTS[two], size: 2 };
  if (CONSONANTS[one]) return { text: CONSONANTS[one], size: 1 };
  return null;
}

function matchVowel(word, i, isFinal) {
  const two = word.slice(i, i + 2).toLowerCase();
  const one = word[i].toLowerCase();
  if (isFinal && one === 'i') return { text: 'ी', size: 1 };
  if (VOWEL_SIGNS[two] !== undefined) return { text: VOWEL_SIGNS[two], size: 2 };
  if (VOWEL_SIGNS[one] !== undefined) return { text: VOWEL_SIGNS[one], size: 1 };
  return null;
}

/** Transliterate a single Latin-alphabet word into Devanagari. */
export function transliterateWord(word) {
  if (!word || !/^[a-zA-Z]+$/.test(word)) return word;
  const dict = WORDS[word.toLowerCase()];
  if (dict) return dict;

  let out = '';
  let i = 0;
  let pendingConsonant = false; // last unit was a bare consonant (no vowel since)
  let prevSingle = null; // raw letter of the previous single-letter consonant

  while (i < word.length) {
    const ch = word[i];

    if (isVowel(ch)) {
      const vowel = matchVowel(word, i, i + 1 >= word.length);
      if (!vowel) {
        out += ch;
        i += 1;
        continue;
      }
      if (pendingConsonant) {
        out += vowel.text; // matra ('a' → inherent vowel, no mark)
        pendingConsonant = false;
        prevSingle = null;
      } else {
        const key = word.slice(i, i + vowel.size).toLowerCase();
        out += INDEPENDENT[key] || VOWEL_SIGNS[key] || ch;
      }
      i += vowel.size;
      continue;
    }

    const consonant = matchConsonant(word, i);
    if (!consonant) {
      out += ch; // unknown symbol — pass through
      i += 1;
      pendingConsonant = false;
      prevSingle = null;
      continue;
    }

    const single = consonant.size === 1 ? word[i] : null;
    const nextCh = word[i + consonant.size];

    if (pendingConsonant) {
      // Conjunct between two single-letter consonants (priya → प्र, pakka → पक्).
      if (prevSingle) {
        const pair = (prevSingle + word[i]).toLowerCase();
        const isDouble = single && prevSingle === single;
        if (isDouble || CLUSTER_HALANT.has(pair)) {
          out += '्';
        }
      }
      out += consonant.text;
      pendingConsonant = true;
    } else if (
      single && single.toLowerCase() === 'n' && nextCh &&
      ['k', 'g', 'q'].includes(nextCh.toLowerCase())
    ) {
      out += 'ं'; // ं before k/g/q — pankha → पंखा, rang → रंग
      pendingConsonant = false;
    } else {
      out += consonant.text;
      pendingConsonant = true;
    }
    prevSingle = single;
    i += consonant.size;
  }

  return out;
}

/**
 * Convert the completed word just before `caret` in `text`.
 * Fires only when the caret follows a terminator (space, newline,
 * punctuation) so the current word is never converted mid-typing.
 * With `force`, the word ending exactly at the caret is converted
 * (used on blur). `convert` turns one Latin word into Devanagari
 * (the live typing engine passes its word-list-backed converter).
 */
export function transliterateLastWord(text, caret, force = false, convert = transliterateWord) {
  if (typeof text !== 'string' || caret <= 0 || caret > text.length) return null;
  if (!force && /[a-zA-Z]/.test(text[caret - 1])) return null;

  const end = force ? caret : caret - 1;
  let start = end;
  while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) start -= 1;
  if (start === end) return null;

  const word = text.slice(start, end);
  const converted = convert(word);
  if (converted === word) return null;

  return {
    value: text.slice(0, start) + converted + text.slice(end),
    caret: start + converted.length + (text.length - end),
  };
}

// Devanagari danda / purna viram — the Hindi sentence terminator ("।"),
// informally the "closing line". It replaces an English full stop in Hindi
// prose.
export const DANDA = '।';

/**
 * Typing aid: pressing space twice ends the sentence with "।" instead of
 * leaving a stray double space. Given the full `text` and the `caret` offset
 * (just after the second space), returns { value, caret } when a
 * word→"  " pattern is present, else null. Only fires after real content
 * (never after another space, the start, or an existing danda).
 */
export function dandaOnDoubleSpace(text, caret) {
  if (typeof text !== 'string' || caret < 2) return null;
  if (text.slice(caret - 2, caret) !== '  ') return null;
  const before = caret >= 3 ? text[caret - 3] : '';
  if (!before || /\s/.test(before) || before === DANDA) return null;
  const replaceWith = `${DANDA} `;
  return {
    value: text.slice(0, caret - 2) + replaceWith + text.slice(caret),
    caret: caret - 2 + replaceWith.length,
  };
}
