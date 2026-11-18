/**
 * Writes the Devanagari that the typing engine produces in another script.
 *
 * The engine (engine.js) reads Latin letters as Indian sounds and gives Devanagari. Every Indian
 * script writes the same sounds, so the same reading can be shown in any of them:
 *
 *   - Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada and Malayalam were laid out in
 *     Unicode in the same order as Devanagari, so a letter is its Devanagari code point moved by a
 *     fixed distance. A few letters one script lacks, and the spelling habits of each language
 *     (Tamil has no separate ga / kha / gha, Malayalam ends a word with a "chillu", Gurmukhi doubles
 *     a consonant with a mark), are handled in the small tables and passes below.
 *   - Urdu, Kashmiri and Sindhi (Perso-Arabic), Santali (Ol Chiki) and Meitei (Meetei Mayek) are
 *     built differently and have their own small writers.
 *
 * This is a typing aid, not a spelling checker: it gives the usual reading of what was typed, and
 * the writer picks another from the list or types in the language's own keyboard when it is not
 * the one they meant. Urdu is the weakest, because its spelling carries information (which "s",
 * which "z") that Latin letters do not.
 */

const DEVANAGARI_START = 0x900;
const DEVANAGARI_END = 0x97f;
const BASE = { Beng: 0x980, Guru: 0xa00, Gujr: 0xa80, Orya: 0xb00, Taml: 0xb80, Telu: 0xc00, Knda: 0xc80, Mlym: 0xd00 };

// Marks a final short "a" the writer really typed (the typing engine puts it after the consonant), so a
// Dravidian word ending in a consonant (அவன்) can be told from one ending in the vowel a (கதை, பாலா).
export const KEEP_A = '\u200B';
const NUKTA = '़';
const VIRAMA = '्';
const cp = (ch) => ch.charCodeAt(0);
const isConsonant = (ch) => !!ch && cp(ch) >= 0x915 && cp(ch) <= 0x939;
const isDevanagari = (ch) => !!ch && cp(ch) >= DEVANAGARI_START && cp(ch) <= DEVANAGARI_END;

// Letters that Unicode also gives a code point of their own (क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़) are spelled as base + dot here,
// and न/र/ल़ + dot (ऩ ऱ ऴ) as the single letter, so the passes below only have one form of each to look for.
const PRECOMPOSED_NUKTA = {
  '\u0958': '\u0915\u093C', '\u0959': '\u0916\u093C', '\u095A': '\u0917\u093C', '\u095B': '\u091C\u093C',
  '\u095C': '\u0921\u093C', '\u095D': '\u0922\u093C', '\u095E': '\u092B\u093C', '\u095F': '\u092F\u093C',
};

// ऍ ॅ ॠ ॄ: vowels only English loanwords and Sanskrit use; most scripts have no letter for them
function spreadNukta(text) {
  return text
    .replace(/\u090D/g, '\u090F')
    .replace(/\u0945/g, '\u0947')
    .replace(/\u0960/g, '\u090B')
    .replace(/\u0944/g, '\u0943')
    .replace(/[\u0958-\u095F]/g, (ch) => PRECOMPOSED_NUKTA[ch])
    .replace(/\u0928\u093C/g, '\u0929')
    .replace(/\u0930\u093C/g, '\u0931')
    .replace(/\u0933\u093C/g, '\u0934');
}

// ---- which nasal a dot stands for, from the consonant after it -------------------------------------------
const SERIES_NASAL = [
  [0x915, 0x919, 'ङ'],
  [0x91a, 0x91e, 'ञ'],
  [0x91f, 0x923, 'ण'],
  [0x924, 0x928, 'न'],
  [0x92a, 0x92e, 'म'],
];

function nasalFor(consonant) {
  const code = cp(consonant);
  const row = SERIES_NASAL.find(([from, to]) => code >= from && code <= to);
  return row ? row[2] : null;
}

/**
 * Bengali, Odia, Tamil and Malayalam write the nasal of "sundar" as the consonant itself (সুন্দর,
 * சுந்தர, സുന്ദര), not as a dot over the vowel. Done on the Devanagari, before it is moved.
 */
function dotToNasal(text) {
  return text.replace(/[ंँ](?=([क-म]))/g, (_dot, next) => {
    const nasal = nasalFor(next);
    return nasal ? nasal + VIRAMA : 'ं';
  });
}

// ---- letters that need more than a move ---------------------------------------------------------------------
// Each table: Devanagari character -> what to write instead. The move is used for everything else.
// The three letters Devanagari spells with a dot or a variant that most scripts do not have:
const NNNA = '\u0929'; // ऩ
const RRA = '\u0931'; // ऱ
const LLLA = '\u0934'; // ऴ

const OVERRIDES = {
  Beng: {
    'ऑ': 'অ', 'ॉ': 'ো', 'ऎ': 'এ', 'ऒ': 'ও', 'ॆ': 'ে', 'ॊ': 'ো',
    [NNNA]: 'ন', [RRA]: 'র', 'ळ': 'ল', [LLLA]: 'ল', 'व': 'ব', 'य': 'য়',
  },
  Guru: {
    'ऋ': 'ਰਿ', 'ऑ': 'ਆ', 'ऎ': 'ਏ', 'ऒ': 'ਓ', 'ॉ': 'ੋ', 'ॆ': 'ੇ', 'ॊ': 'ੋ', 'ृ': '੍ਰਿ',
    [NNNA]: 'ਨ', [RRA]: 'ਰ', [LLLA]: 'ਲ਼', 'ष': 'ਸ਼',
  },
  Gujr: {
    'ऎ': 'એ', 'ऒ': 'ઓ', 'ॆ': 'ે', 'ॊ': 'ો',
    [NNNA]: 'ન', [RRA]: 'ર', [LLLA]: 'ળ',
  },
  Orya: {
    'ऑ': 'ଅ', 'ऎ': 'ଏ', 'ऒ': 'ଓ', 'ॉ': 'ୋ', 'ॆ': 'େ', 'ॊ': 'ୋ',
    [NNNA]: 'ନ', [RRA]: 'ର', [LLLA]: 'ଳ', 'व': 'ବ', 'य': 'ୟ',
  },
  Taml: {
    // Tamil writes ga, kha and gha with the one letter of ka, and so on through the other series.
    'ख': 'க', 'ग': 'க', 'घ': 'க', 'छ': 'ச', 'झ': 'ஜ', 'ठ': 'ட', 'ड': 'ட', 'ढ': 'ட',
    'थ': 'த', 'द': 'த', 'ध': 'த', 'फ': 'ப', 'ब': 'ப', 'भ': 'ப',
    'श': 'ஷ', 'स': 'ச', [NNNA]: 'ன',
    'ऋ': 'ரி', 'ऑ': 'ஆ', 'ॉ': 'ொ', 'ृ': 'ிரு',
    'ं': 'ம்', 'ँ': 'ம்', 'ः': 'ஃ',
  },
  Telu: {
    'ऑ': 'ఒ', 'ॉ': 'ొ', [NNNA]: 'న',
  },
  Knda: {
    'ऑ': 'ಒ', 'ॉ': 'ೊ', [NNNA]: 'ನ', [LLLA]: 'ಳ',
  },
  Mlym: {
    'ऑ': 'ഒ', 'ॉ': 'ൊ', [NNNA]: 'ന',
  },
};

// The scripts that have no nukta dot in everyday use: ज़ is written as ज.
const DROP_NUKTA = new Set(['Taml', 'Telu', 'Knda', 'Mlym']);

// Where a Dravidian script ends a word that was typed without a final vowel, the consonant stands alone
// (Tamil ends அவன், Malayalam അവൻ): it gets the halant (pulli / chandrakkala / virama), and Malayalam then
// turns the five that have one into their chillu letter.
const FINAL_HALANT = {
  Taml: { consonants: 'க-ஹ', block: '஀-௿', virama: '்' },
  Telu: { consonants: 'క-హ', block: 'ఀ-౿', virama: '్' },
  Knda: { consonants: 'ಕ-ಹ', block: 'ಀ-೿', virama: '್' },
  Mlym: { consonants: 'ക-ഺ', block: 'ഀ-ൿ', virama: '്' },
};

const CHILLU = { 'ണ': 'ൺ', 'ന': 'ൻ', 'ര': 'ർ', 'ല': 'ൽ', 'ള': 'ൾ' };

function finalHalant(text, script) {
  const rule = FINAL_HALANT[script];
  const pattern = new RegExp(`([${rule.consonants}])(?![${rule.block}${KEEP_A}])`, 'g');
  return text.replace(pattern, (match, consonant) => {
    if (script === 'Mlym' && CHILLU[consonant]) return CHILLU[consonant];
    return consonant + rule.virama;
  });
}

// Tamil has two letters for n: ந at the start of a word and before த, ன everywhere else.
function tamilN(text) {
  return text.replace(/ந/g, (match, offset) => {
    const before = text[offset - 1];
    const after = text.slice(offset + 1, offset + 3);
    const atStart = !before || !/[஀-௿]/.test(before);
    return atStart || after === '்த' ? 'ந' : 'ன';
  });
}

// Gurmukhi writes a doubled consonant with the addak mark: ਪੱਕਾ, not ਪ੍ਕਾ.
const ADDAK_PAIRS = 'ਕਖ ਗਘ ਚਛ ਜਝ ਟਠ ਡਢ ਤਥ ਦਧ ਪਫ ਬਭ'.split(' ');
function addak(text) {
  const same = (a, b) => a === b || ADDAK_PAIRS.some((pair) => pair[0] === a && pair[1] === b);
  return text.replace(/([ਕ-ਹ][਼]?)੍([ਕ-ਹ])/g, (match, first, second) => {
    const base = first[0];
    return same(base, second) ? `ੱ${second}` : match;
  });
}

// Gurmukhi writes the nasal dot as a tippi after a short vowel and a bindi after a long one.
const LONG_VOWEL_SIGNS = new Set(['ा', 'ी', 'ू', 'े', 'ै', 'ो', 'ौ', 'आ', 'ई', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ']);
function gurmukhiDots(text) {
  return text.replace(/([^ंँ])?([ंँ])/g, (match, before, dot) => {
    const long = before && LONG_VOWEL_SIGNS.has(before);
    return `${before || ''}${long || dot === 'ँ' ? 'ਂ' : 'ੰ'}`;
  });
}

function brahmicMapper(script, tweaks = {}) {
  const base = BASE[script];
  const over = { ...OVERRIDES[script], ...(tweaks.over || {}) };
  return (input) => {
    let text = spreadNukta(String(input));
    if (script === 'Beng' || script === 'Orya' || script === 'Taml' || script === 'Mlym') text = dotToNasal(text);
    if (script === 'Guru') text = gurmukhiDots(text);
    // a word that ends in -m is written with the nasal dot in these three (మలయాళం is മലയാളം, not മലയാളമ്)
    if (script === 'Telu' || script === 'Knda' || script === 'Mlym') text = text.replace(/म(?![ऀ-ॿ\u200B])/g, 'ं');
    let out = '';
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === NUKTA) {
        // a dot after a consonant: kept where the script has it, dropped where it does not
        if (!DROP_NUKTA.has(script)) out += String.fromCharCode(cp(ch) - DEVANAGARI_START + base);
        continue;
      }
      if (!isDevanagari(ch)) {
        out += ch;
        continue;
      }
      if (over[ch] !== undefined) {
        out += over[ch];
        continue;
      }
      out += String.fromCharCode(cp(ch) - DEVANAGARI_START + base);
    }
    if (script === 'Guru') out = addak(out.replace(/ਢ\u0A3C/g, 'ੜ੍ਹ').replace(/ਡ\u0A3C/g, 'ੜ'));
    if (script === 'Beng') out = out.replace(/(^|[^\u0980-\u09FF])য়/g, '$1য').replace(/্য়/g, '্য');
    if (script === 'Taml') out = tamilN(out);
    if (FINAL_HALANT[script]) out = finalHalant(out, script);
    return out.split(KEEP_A).join('');
  };
}

// ---- Perso-Arabic (Urdu, Kashmiri, Sindhi) -----------------------------------------------------------------
const AR = {
  'क': 'ک', 'ख': 'کھ', 'ग': 'گ', 'घ': 'گھ', 'ङ': 'نگ', 'च': 'چ', 'छ': 'چھ', 'ज': 'ج', 'झ': 'جھ', 'ञ': 'ن',
  'ट': 'ٹ', 'ठ': 'ٹھ', 'ड': 'ڈ', 'ढ': 'ڈھ', 'ण': 'ن', 'त': 'ت', 'थ': 'تھ', 'द': 'د', 'ध': 'دھ', 'न': 'ن',
  [NNNA]: 'ن', 'प': 'پ', 'फ': 'پھ', 'ब': 'ب', 'भ': 'بھ', 'म': 'م', 'य': 'ی', 'र': 'ر', [RRA]: 'ر', 'ल': 'ل',
  'ळ': 'ل', [LLLA]: 'ل', 'व': 'و', 'श': 'ش', 'ष': 'ش', 'स': 'س', 'ह': 'ہ',
};
const AR_NUKTA = { 'क': 'ق', 'ख': 'خ', 'ग': 'غ', 'ज': 'ز', 'ड': 'ڑ', 'ढ': 'ڑھ', 'फ': 'ف', 'य': 'ی' };
// Sindhi has its own letters for the sounds Urdu writes with a dot or a combination.
const SINDHI = {
  'भ': 'ڀ', 'थ': 'ٿ', 'ट': 'ٽ', 'ठ': 'ٺ', 'ड': 'ڊ', 'ढ': 'ڍ', 'ध': 'ڌ', 'ण': 'ڻ', 'फ': 'ڦ', 'क': 'ڪ', 'ख': 'ک',
  'ङ': 'ڱ', 'छ': 'ڇ',
};
const AR_INDEPENDENT = {
  'अ': 'ا', 'आ': 'آ', 'इ': 'ا', 'ई': 'ای', 'उ': 'ا', 'ऊ': 'او', 'ऋ': 'ری', 'ए': 'ای', 'ऐ': 'ای', 'ओ': 'او',
  'औ': 'او', 'ऑ': 'آ', 'ऎ': 'ا', 'ऒ': 'ا',
};
// the same vowels straight after another vowel carry a hamza (آئے, آؤ)
const AR_AFTER_VOWEL = { 'इ': 'ئ', 'ई': 'ئی', 'ए': 'ئے', 'ऐ': 'ئے', 'उ': 'ؤ', 'ऊ': 'ؤ', 'ओ': 'ؤ', 'औ': 'ؤ' };
const AR_MATRA = { 'ा': 'ا', 'ि': '', 'ी': 'ی', 'ु': '', 'ू': 'و', 'ृ': 'ر', 'ो': 'و', 'ौ': 'و', 'ॉ': 'ا', 'ॆ': '', 'ॊ': 'و' };
const LABIAL = new Set(['प', 'फ', 'ब', 'भ', 'म']);
// च्छ is the one letter छ (अच्छा = اچھا), and a doubled letter takes a shadda (پکّا)
const ASPIRATED = { 'क': 'ख', 'ग': 'घ', 'च': 'छ', 'ज': 'झ', 'ट': 'ठ', 'ड': 'ढ', 'त': 'थ', 'द': 'ध', 'प': 'फ', 'ब': 'भ' };

function arabicMapper(language) {
  const consonant = (ch, nukta) => {
    if (nukta && AR_NUKTA[ch]) return AR_NUKTA[ch];
    if (language === 'sd' && SINDHI[ch]) return SINDHI[ch];
    return AR[ch] || ch;
  };
  const writeWord = (word) => {
    let out = '';
    let afterVowel = false; // the last thing written was a vowel letter
    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i];
      const next = word[i + 1];
      const last = i + 1 >= word.length || !isDevanagari(next);
      if (ch === 'ज' && next === VIRAMA && word[i + 2] === 'ञ') {
        out += 'گی'; // ज्ञ is read "gy": ज्ञान = گیان
        i += 2;
        afterVowel = false;
      } else if (isConsonant(ch) || ch === NNNA || ch === RRA || ch === LLLA) {
        const dotted = next === NUKTA;
        if (!dotted && next === VIRAMA && ASPIRATED[ch] === word[i + 2]) {
          i += 1; // the first half of च्छ: the aspirated letter that follows says it all
          continue;
        }
        const letter = consonant(ch, dotted);
        out += letter;
        if (dotted) i += 1;
        if (!dotted && word[i + 1] === VIRAMA && word[i + 2] === ch) {
          out += 'ّ'; // a doubled letter: one letter and a shadda
          i += 2;
        }
        afterVowel = false;
      } else if (AR_INDEPENDENT[ch] !== undefined) {
        out += afterVowel && AR_AFTER_VOWEL[ch] ? AR_AFTER_VOWEL[ch] : AR_INDEPENDENT[ch];
        afterVowel = true;
      } else if (ch === 'े' || ch === 'ै') {
        out += last ? 'ے' : 'ی';
        afterVowel = true;
      } else if (AR_MATRA[ch] !== undefined) {
        out += AR_MATRA[ch];
        afterVowel = AR_MATRA[ch] !== '';
      } else if (ch === 'ं' || ch === 'ँ') {
        // a nasal before a consonant is a noon (a meem before p, b, m); at the end it is noon ghunna
        const following = word[i + 1];
        if (isConsonant(following)) out += LABIAL.has(following) ? 'م' : 'ن';
        else out += 'ں';
        afterVowel = false;
      } else if (ch === VIRAMA || ch === NUKTA) {
        // no vowel is written, and a bare dot has nothing to sit on
      } else if (ch === 'ः') {
        out += 'ہ';
      } else {
        out += ch;
      }
    }
    return out;
  };
  return (input) => String(input).replace(/[ऀ-ॿ]+/g, (word) => writeWord(spreadNukta(word)));
}

// ---- Ol Chiki (Santali) --------------------------------------------------------------------------------------
// Ol Chiki has no inherent vowel and no vowel signs: every vowel is a letter of its own.
const OLCK = {
  'क': 'ᱠ', 'ख': 'ᱠᱷ', 'ग': 'ᱜ', 'घ': 'ᱜᱷ', 'ङ': 'ᱝ', 'च': 'ᱪ', 'छ': 'ᱪᱷ', 'ज': 'ᱡ', 'झ': 'ᱡᱷ', 'ञ': 'ᱧ',
  'ट': 'ᱴ', 'ठ': 'ᱴᱷ', 'ड': 'ᱰ', 'ढ': 'ᱰᱷ', 'ण': 'ᱬ', 'त': 'ᱛ', 'थ': 'ᱛᱷ', 'द': 'ᱫ', 'ध': 'ᱫᱷ', 'न': 'ᱱ',
  [NNNA]: 'ᱱ', 'प': 'ᱯ', 'फ': 'ᱯᱷ', 'ब': 'ᱵ', 'भ': 'ᱵᱷ', 'म': 'ᱢ', 'य': 'ᱭ', 'र': 'ᱨ', [RRA]: 'ᱨ', 'ल': 'ᱞ',
  'ळ': 'ᱞ', [LLLA]: 'ᱞ', 'व': 'ᱣ', 'श': 'ᱥ', 'ष': 'ᱥ', 'स': 'ᱥ', 'ह': 'ᱦ',
};
const OLCK_NUKTA = { 'ड': 'ᱲ', 'ढ': 'ᱲᱷ', 'ज': 'ᱡ', 'क': 'ᱠ', 'ख': 'ᱠ', 'ग': 'ᱜ', 'फ': 'ᱯ', 'य': 'ᱭ' };
const OLCK_VOWEL = {
  'अ': 'ᱟ', 'आ': 'ᱟ', 'इ': 'ᱤ', 'ई': 'ᱤ', 'उ': 'ᱩ', 'ऊ': 'ᱩ', 'ऋ': 'ᱨᱤ', 'ए': 'ᱮ', 'ऐ': 'ᱮ', 'ओ': 'ᱳ',
  'औ': 'ᱳ', 'ऑ': 'ᱚ', 'ऎ': 'ᱮ', 'ऒ': 'ᱳ',
};
const OLCK_MATRA = {
  'ा': 'ᱟ', 'ि': 'ᱤ', 'ी': 'ᱤ', 'ु': 'ᱩ', 'ू': 'ᱩ', 'ृ': 'ᱨᱤ', 'े': 'ᱮ', 'ै': 'ᱮ', 'ो': 'ᱳ', 'ौ': 'ᱳ', 'ॉ': 'ᱚ',
  'ॆ': 'ᱮ', 'ॊ': 'ᱳ',
};
const OLCK_NASAL = { 'ङ': 'ᱝ', 'ञ': 'ᱧ', 'ण': 'ᱬ', 'न': 'ᱱ', 'म': 'ᱢ' };

function olChikiMapper() {
  const writeWord = (word) => {
    let out = '';
    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i];
      const next = word[i + 1];
      if (isConsonant(ch) || ch === NNNA || ch === RRA || ch === LLLA) {
        const dotted = next === NUKTA;
        out += (dotted && OLCK_NUKTA[ch]) || OLCK[ch] || ch;
        if (dotted) i += 1;
        const after = word[i + 1];
        // a consonant with no vowel sign and no halant has its own short a, except at the end of a word
        const bare = after !== undefined && after !== VIRAMA && !OLCK_MATRA[after] && after !== 'ं' && after !== 'ँ';
        const beforeNasal = after === 'ं' || after === 'ँ';
        if (bare || beforeNasal) out += 'ᱟ';
      } else if (OLCK_VOWEL[ch] !== undefined) {
        out += OLCK_VOWEL[ch];
      } else if (OLCK_MATRA[ch] !== undefined) {
        out += OLCK_MATRA[ch];
      } else if (ch === 'ं' || ch === 'ँ') {
        const nasal = isConsonant(next) ? nasalFor(next) : null;
        out += OLCK_NASAL[nasal] || 'ᱝ';
      } else if (ch === 'ः') {
        out += 'ᱦ';
      } else if (ch === VIRAMA || ch === NUKTA) {
        // consonants simply stand side by side
      } else {
        out += ch;
      }
    }
    return out;
  };
  return (input) => String(input).replace(/[ऀ-ॿ]+/g, (word) => writeWord(spreadNukta(word)));
}

// ---- Meetei Mayek (Meitei) -----------------------------------------------------------------------------------
const MTEI = {
  'क': 'ꯀ', 'ख': 'ꯈ', 'ग': 'ꯒ', 'घ': 'ꯘ', 'ङ': 'ꯉ', 'च': 'ꯆ', 'छ': 'ꯆ', 'ज': 'ꯖ', 'झ': 'ꯓ', 'ञ': 'ꯅ',
  'ट': 'ꯇ', 'ठ': 'ꯊ', 'ड': 'ꯗ', 'ढ': 'ꯙ', 'ण': 'ꯅ', 'त': 'ꯇ', 'थ': 'ꯊ', 'द': 'ꯗ', 'ध': 'ꯙ', 'न': 'ꯅ',
  [NNNA]: 'ꯅ', 'प': 'ꯄ', 'फ': 'ꯐ', 'ब': 'ꯕ', 'भ': 'ꯚ', 'म': 'ꯃ', 'य': 'ꯌ', 'र': 'ꯔ', [RRA]: 'ꯔ', 'ल': 'ꯂ',
  'ळ': 'ꯂ', [LLLA]: 'ꯂ', 'व': 'ꯋ', 'श': 'ꯁ', 'ष': 'ꯁ', 'स': 'ꯁ', 'ह': 'ꯍ',
};
// the eight letters that end a syllable ("lonsum") and the consonant each one is
const MTEI_LONSUM = { 'ꯀ': 'ꯛ', 'ꯂ': 'ꯜ', 'ꯃ': 'ꯝ', 'ꯄ': 'ꯞ', 'ꯅ': 'ꯟ', 'ꯇ': 'ꯠ', 'ꯉ': 'ꯡ', 'ꯌ': 'ꯢ' };
const MTEI_VOWEL = {
  'अ': 'ꯑ', 'आ': 'ꯑꯥ', 'इ': 'ꯏ', 'ई': 'ꯏ', 'उ': 'ꯎ', 'ऊ': 'ꯎ', 'ऋ': 'ꯔꯤ', 'ए': 'ꯑꯦ', 'ऐ': 'ꯑꯩ', 'ओ': 'ꯑꯣ',
  'औ': 'ꯑꯧ', 'ऑ': 'ꯑꯣ', 'ऎ': 'ꯑꯦ', 'ऒ': 'ꯑꯣ',
};
const MTEI_MATRA = {
  'ा': 'ꯥ', 'ि': 'ꯤ', 'ी': 'ꯤ', 'ु': 'ꯨ', 'ू': 'ꯨ', 'ृ': 'ꯔꯤ', 'े': 'ꯦ', 'ै': 'ꯩ', 'ो': 'ꯣ', 'ौ': 'ꯧ', 'ॉ': 'ꯣ',
  'ॆ': 'ꯦ', 'ॊ': 'ꯣ',
};
const MTEI_VIRAMA = '꯭';

function meeteiMapper() {
  const writeWord = (word) => {
    let out = '';
    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i];
      const next = word[i + 1];
      if (isConsonant(ch) || ch === NNNA || ch === RRA || ch === LLLA) {
        let letter = MTEI[ch] || ch;
        const dotted = next === NUKTA;
        if (dotted) i += 1;
        const after = word[i + 1];
        const closes = after === undefined || after === VIRAMA; // the end of a word, or a consonant that joins the next one
        if (closes && MTEI_LONSUM[letter]) letter = MTEI_LONSUM[letter];
        out += letter;
        if (after === VIRAMA) {
          if (!MTEI_LONSUM[MTEI[ch]] || letter === MTEI[ch]) out += MTEI_VIRAMA;
          i += 1;
        }
      } else if (MTEI_VOWEL[ch] !== undefined) {
        out += MTEI_VOWEL[ch];
      } else if (MTEI_MATRA[ch] !== undefined) {
        out += MTEI_MATRA[ch];
      } else if (ch === 'ं' || ch === 'ँ') {
        out += 'ꯡ';
      } else if (ch === 'ः') {
        out += 'ꯍ';
      } else if (ch === VIRAMA || ch === NUKTA) {
        // handled with the consonant before it
      } else {
        out += ch;
      }
    }
    return out;
  };
  return (input) => String(input).replace(/[ऀ-ॿ]+/g, (word) => writeWord(spreadNukta(word)));
}

// ---- which writer a language and script get ------------------------------------------------------------------
const ASSAMESE = { over: { 'र': 'ৰ', 'व': 'ৱ' } };

/**
 * A function that turns Devanagari text into `script` for `language`, or null when the Devanagari is
 * already right (Hindi, Marathi, Nepali, Sanskrit, Konkani, Maithili, Dogri, Bodo, and Kashmiri /
 * Sindhi / Santali written in Devanagari) or the language is not typed this way (English).
 */
export function scriptMapper(language, script) {
  if (language === 'en' || script === 'Latn' || script === 'Deva') return null;
  const clean = (write) => (input) => write(input).split(KEEP_A).join('');
  if (script === 'Arab') return clean(arabicMapper(language));
  if (script === 'Olck') return clean(olChikiMapper());
  if (script === 'Mtei') return clean(meeteiMapper());
  if (BASE[script]) return brahmicMapper(script, language === 'as' ? ASSAMESE : {});
  return null;
}

/** Characters of `text` that are Devanagari (the test uses this to find a letter the writer missed). */
export const devanagariLeft = (text) => (String(text).match(/[ऀ-ॿ]/g) || []).join('');
