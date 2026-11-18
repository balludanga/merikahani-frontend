/**
 * How each language's Latin typing is read, as small changes to the Hindi rules in tables.js.
 *
 * Every language is typed the way Hindi is: phonetic Latin letters, read into Devanagari by the
 * engine (engine.js) and then written in the language's own script (scriptmap.js). What differs
 * between languages is a handful of habits, listed here:
 *
 *   a       Bengali, Assamese and Odia are typed the way their speakers type Latin letters: "a" is the
 *           long vowel (ami = আমি, bangla = বাংলা) and the short inherent one is simply not typed.
 *   final   what a lone "a", "i" or "u" at the end of a word means. Hindi (and Marathi, Gujarati,
 *           Punjabi, Urdu...) take it as the long vowel (mera, kahani); Bengali, Odia and the Dravidian
 *           languages mean the short one (ami, avanu). For Tamil, Telugu, Kannada and Malayalam a word
 *           that ends in a bare consonant is a different word from one that ends in "a", so a typed
 *           final "a" is remembered (KEEP_A) and the consonant otherwise gets its halant.
 *   eo      the Dravidian languages have a short e and a short o of their own: "e" and "o" are the
 *           short ones, and the long ones are the next suggestion.
 *   extras  letters Devanagari has and Hindi typing never asks for: capital L is ळ (Marathi, Gujarati,
 *           the Dravidian languages), capital R is ऱ and "zh" is ऴ (Tamil, Malayalam).
 *
 * Nothing here is a spelling checker. The first suggestion is the usual reading of the letters; the
 * list under the caret has the others.
 */
import { CONSONANTS, INDEPENDENT, MATRA, SPLITTABLE } from './tables.js';
import { KEEP_A } from './scriptmap.js';

const o = (k, c = 0, s = k) => ({ k, s, c });

const SHORT_FINAL = { a: [o('', 0), o('ा', 0.6)], i: [o('ि', 0), o('ी', 0.5)], u: [o('ु', 0), o('ू', 0.5)] };
const MARKED_FINAL = { ...SHORT_FINAL, a: [o('', 0, KEEP_A), o('ा', 0.6)] };
const LONG_A_FINAL = { ...SHORT_FINAL, a: [o('ा', 0), o('', 0.6)] };

// ॆ ॊ ऎ ऒ: the short e and o of the Dravidian languages
const SHORT_E = 'ॆ';
const SHORT_O = 'ॊ';
const DRAVIDIAN_MATRA = {
  ...MATRA,
  e: [o(SHORT_E), o('े', 0.4), o('ै', 0.9)],
  o: [o(SHORT_O), o('ो', 0.4), o('ौ', 0.9)],
};
const DRAVIDIAN_INDEPENDENT = {
  ...INDEPENDENT,
  e: [o('ऎ'), o('ए', 0.4)],
  o: [o('ऒ'), o('ओ', 0.4)],
};

const EXTRA_LETTERS = {
  L: { L: [o('ळ')] }, // ळ
  R: { R: [o('ऱ')] }, // ऱ
  zh: { zh: [o('ऴ')] }, // ऴ
};

// Bengali typists write "sh" for the ordinary s as well (bhalobasha = ভালোবাসা), so স is not far behind শ
const BENGALI_SH = { sh: [o('श'), o('स', 0.25), o('ष', 0.6)] };

function build({ final = null, eo = false, extras = [], longA = false, bengali = false }) {
  const consonants = { ...CONSONANTS, ...(bengali ? BENGALI_SH : null) };
  const splittable = new Set(SPLITTABLE);
  let caps = 'TDN';
  extras.forEach((name) => {
    Object.assign(consonants, EXTRA_LETTERS[name]);
    if (name === 'zh') splittable.add('zh');
    else caps += name;
  });
  let matra = eo ? DRAVIDIAN_MATRA : MATRA;
  let independent = eo ? DRAVIDIAN_INDEPENDENT : INDEPENDENT;
  if (longA) {
    matra = { ...matra, a: [o('ा'), o('', 0.5)] };
    independent = { ...independent, a: [o('आ'), o('अ', 0.5)] };
  }
  return {
    caps,
    consonants,
    splittable,
    matra,
    independent,
    final: longA ? LONG_A_FINAL : final === 'short' ? SHORT_FINAL : final === 'mark' ? MARKED_FINAL : null,
  };
}

// Languages not listed here are typed with the Hindi conventions as they are.
const SPECS = {
  mr: { extras: ['L'] },
  kok: { extras: ['L'] },
  gu: { extras: ['L'] },
  bn: { longA: true, bengali: true },
  as: { longA: true, bengali: true },
  or: { longA: true, extras: ['L'] },
  ta: { final: 'mark', eo: true, extras: ['zh', 'L', 'R'] },
  te: { final: 'mark', eo: true, extras: ['L', 'R'] },
  kn: { final: 'mark', eo: true, extras: ['L'] },
  ml: { final: 'mark', eo: true, extras: ['zh', 'L', 'R'] },
  sat: { final: 'mark' },
  mni: { final: 'mark' },
};

const cache = new Map();

/** The reading conventions of a language (the Hindi ones, with the changes listed above). */
export function profileFor(language) {
  if (!cache.has(language)) cache.set(language, build(SPECS[language] || {}));
  return cache.get(language);
}
