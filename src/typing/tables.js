/**
 * The rules of Hinglish typing, as data.
 *
 * Someone typing Hindi in Latin letters is not following a fixed spelling scheme: "kahani" and
 * "kahaani" both mean कहानी, "t" may be त or ट, a typed "a" may be the short अ (kal) or the long
 * आ (kahani), and the nasal in "hindi" is never typed as a separate sign. So instead of one rule
 * per letter, every Latin piece lists ALL the Devanagari it can stand for, each with a cost
 * (0 = the obvious reading, higher = less likely). The engine (transduce.js) tries every
 * combination against a real word list and ranks what is left; the cheapest reading is the
 * fallback for words the list does not know (names, new words).
 *
 * Two spellings are kept for each output:
 *   k - the "key" spelling used for matching: the nukta dot (ज़ ड़ फ़ ...) is dropped, because most
 *       writers leave it out and the word list is matched without it;
 *   s - what the writer sees when the word is not found in the list: with the nukta where the
 *       Latin letter asks for one (z, f, q).
 */

// Where we are in a word while reading it left to right.
export const START = 0; // nothing yet, or the last thing was a vowel letter
export const CONS = 1; // the last thing was a consonant (its short "a" is still undecided)
export const VOW = 2; // the last thing was a vowel sign or the short "a" itself

const o = (k, c = 0, s = k) => ({ k, s, c });

// ---- consonants (longest Latin piece first when reading) -----------------------------------------
export const CONSONANTS = {
  // pieces of three letters
  chh: [o('छ'), o('च्छ', 0.35)],
  ksh: [o('क्ष')],
  // pieces of two letters
  Th: [o('ठ'), o('थ', 0.8)],
  Dh: [o('ढ'), o('ध', 0.8)],
  kh: [o('ख')],
  gh: [o('घ'), o('ग', 0.5, 'ग़')],
  ch: [o('च'), o('छ', 0.5)],
  jh: [o('झ')],
  th: [o('थ'), o('ठ', 0.4)],
  dh: [o('ध'), o('ढ', 0.4)],
  ph: [o('फ')],
  bh: [o('भ')],
  sh: [o('श'), o('ष', 0.4), o('स', 0.9)],
  gy: [o('ज्ञ', 0.3)],
  jn: [o('ज्ञ', 0.5)],
  // single letters
  k: [o('क')],
  q: [o('क', 0, 'क़')],
  g: [o('ग')],
  c: [o('च', 0.4), o('क', 0.6), o('स', 0.8)],
  j: [o('ज')],
  z: [o('ज', 0, 'ज़')],
  t: [o('त'), o('ट', 0.4)],
  T: [o('ट'), o('त', 0.8)],
  d: [o('द'), o('ड', 0.4)],
  D: [o('ड'), o('द', 0.8)],
  n: [o('न'), o('ण', 0.5)],
  N: [o('ण'), o('न', 0.8)],
  p: [o('प')],
  f: [o('फ', 0, 'फ़')],
  b: [o('ब')],
  m: [o('म')],
  y: [o('य')],
  r: [o('र'), o('ड', 1.0, 'ड़')],
  l: [o('ल')],
  v: [o('व')],
  w: [o('व')],
  s: [o('स'), o('श', 0.5), o('ष', 0.9)],
  h: [o('ह')],
  x: [o('क्स', 0.5), o('क्ष', 0.8)],
};

// A digraph may also be read as two letters ("uphaar" is उपहार, not उफार).
export const DIGRAPH_SPLIT_COST = 0.9;
export const SPLITTABLE = new Set(['chh', 'kh', 'gh', 'ch', 'jh', 'th', 'dh', 'ph', 'bh', 'sh', 'Th', 'Dh']);

// ---- vowels ----------------------------------------------------------------------------------------
// After a consonant: a vowel sign, or nothing at all (the consonant's own short "a").
export const MATRA = {
  a: [o('', 0), o('ा', 0.6)],
  aa: [o('ा')],
  i: [o('ि'), o('ी', 0.5)],
  ii: [o('ी'), o('ि', 0.8)],
  ee: [o('ी'), o('े', 0.8)],
  u: [o('ु'), o('ू', 0.5)],
  uu: [o('ू'), o('ु', 0.8)],
  oo: [o('ू'), o('ो', 0.6), o('ु', 0.8)],
  e: [o('े'), o('ै', 0.6), o('', 0.9)], // "kehna" is कहना: this e stands for the short a
  ei: [o('े'), o('ै', 0.5)],
  ai: [o('ै'), o('े', 0.6), o('ाय', 0.8), o('य', 1.0)], // chai = चाय, jaipur = जयपुर
  o: [o('ो'), o('ौ', 0.6), o('ॉ', 0.8)],
  au: [o('ौ'), o('ो', 0.6), o('ाऊ', 0.7)], // jaunga = जाऊँगा
  ou: [o('ौ', 0.2)],
  ri: [o('ृ', 0.5)],
};

// At the start of a word, or straight after another vowel: a full vowel letter.
export const INDEPENDENT = {
  a: [o('अ'), o('आ', 0.6)],
  aa: [o('आ')],
  i: [o('इ'), o('ई', 0.5)],
  ii: [o('ई')],
  ee: [o('ई')],
  u: [o('उ'), o('ऊ', 0.5)],
  uu: [o('ऊ')],
  oo: [o('ऊ')],
  e: [o('ए'), o('ऐ', 0.6)],
  ei: [o('ए'), o('ऐ', 0.5)],
  ai: [o('ऐ'), o('ए', 0.6)],
  o: [o('ओ'), o('औ', 0.6), o('ऑ', 0.8)],
  au: [o('औ'), o('आऊ', 0.7)],
  ou: [o('औ', 0.2)],
  ri: [o('ऋ', 0.4)],
};

// Pieces that are read as one long vowel (a nasal after them is more likely: hain, mein, hoon).
export const LONG = new Set(['aa', 'ii', 'ee', 'uu', 'oo', 'ai', 'au', 'ei', 'ou']);
// Two-letter vowel pieces that may also be read as two vowels in a row (kai is कई, not कै).
export const VOWEL_PAIRS = ['aa', 'ai', 'au', 'ee', 'ei', 'ii', 'oo', 'ou', 'uu'];
export const SPLITTABLE_VOWELS = new Set(['ai', 'au']);
export const VOWEL_SPLIT_COST = 0.6;

// ---- joining two consonants ---------------------------------------------------------------------------
// Typed side by side, two consonants are either a conjunct (प्र, स्त: a halant joins them) or the first
// keeps its short a (dekhna is देखना, no halant). The list below says which is more likely; the word
// list settles the rest.
export const CONJUNCT_PAIRS = new Set([
  'pr', 'kr', 'gr', 'tr', 'dr', 'br', 'vr', 'fr', 'sr', 'hr', 'zr', 'Tr', 'Dr', 'shr', 'bhr', 'dhr', 'phr', 'khr', 'ghr', 'thr',
  'kl', 'pl', 'bl', 'gl', 'sl', 'vl', 'fl',
  'ky', 'gy', 'py', 'my', 'dy', 'ty', 'ny', 'by', 'ry', 'hy', 'ly', 'vy', 'sy', 'shy', 'cy', 'jy', 'dhy', 'khy',
  'sv', 'st', 'sp', 'sk', 'sm', 'sn', 'sth', 'sph', 'skh', 'tn', 'dv', 'tv', 'hm', 'hn', 'kt', 'pt', 'kv', 'sht', 'shn', 'shm',
  'mh', 'nh', 'lh', 'rh', 'ndh', 'ntr', 'ksh', 'ktr', 'jv', 'tm', 'dm', 'dhm', 'rt', 'rm', 'rk', 'rg', 'rd', 'rp', 'rb', 'rj', 'rv', 'rn', 'rth', 'rdh', 'rsh', 'rs', 'rl', 'ls', 'lt', 'lp', 'lm', 'lk', 'ld',
]);
export const JOIN_PREFERRED = 0.1;
export const JOIN_PLAIN = 0.25;
export const JOIN_UNLIKELY = 0.6;

// ---- cost of the short "a" at the end of what has been typed so far --------------------------------------
// Typed at the end, "a" is far more often the long ā (mera, hota, jaata) than a silent a (ram).
export const FINAL_A_LONG = 0.3;
export const FINAL_A_SHORT = 1.3;
export const FINAL_I_LONG = 0.1;
export const FINAL_I_SHORT = 0.3;
// Typed last, a plain u is as often the long sound (urdu, hindu, aansoo) as the short one (guru, sadhu).
export const FINAL_U_LONG = 0.15;
export const FINAL_U_SHORT = 0.15;

// ---- nasal sounds ---------------------------------------------------------------------------------------
// The nasal dot is typed as plain n or m (hindi, sundar, hoon) and may only sit on a vowel. Costs are
// [ं, ँ]. Before a consonant the dot is the usual spelling (सुंदर, not सुन्दर); at the very end it is
// likely only after a long vowel (hain, mein, hoon), while after a short one the n is a real न (din, sun).
export const NASAL_N = {
  beforeConsonant: [0.05, 0.45],
  endAfterLong: [0, 0.3],
  endAfterShort: [0.35, 0.6],
};
export const NASAL_M = { cost: [0.5, 0.9] };
// Reading a final n after a long vowel as the consonant न costs a little extra, so hain gives हैं.
export const FINAL_N_AFTER_LONG = 0.15;

// A final -m is often the nasal dot: evam = एवं, swayam = स्वयं.
export const NASAL_FINAL_M = 0.45;
// A nasal dot the writer did not type in the middle of a word (unhone = उन्होंने, dono = दोनों).
export const IMPLIED_DOT_COST = 0.6;

// Typing a word whose last vowel really carries a nasal dot, without the n (nahi for नहीं, mein for में).
export const IMPLIED_NASAL_COST = 0.6;
export const IMPLIED_NASAL = ['ं', 'ँ'];

// A consonant typed once where the word doubles it (mohabat for मोहब्बत, acha for अच्छा).
export const GEMINATE_COST = 1.0;
export const GEMINATE_OK = new Set(['k', 'g', 'j', 't', 'd', 'p', 'b', 'T', 'D', 'c', 'l', 'm', 'n', 's']);

// A y between two vowels that is only a glide and is not written: liye = लिए, huye = हुए.
export const GLIDE_COST = 0.4;
// The a in janam / karam is typed but silent: जन्म, कर्म.
export const SILENT_A_COST = 0.7;
// A letter typed twice for one in the word: mahattwa = महत्व.
export const COLLAPSE_COST = 0.7;

// ---- helpers -----------------------------------------------------------------------------------------------
const VOWEL_LETTERS = 'aeiou';
export const isVowelLetter = (ch) => ch !== undefined && ch !== '' && VOWEL_LETTERS.indexOf(ch) !== -1;
export const isLetter = (ch) => ch !== undefined && /^[A-Za-z]$/.test(ch);
export const LABIAL = new Set(['p', 'b', 'm']);
