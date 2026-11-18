/**
 * The languages a story can be written in: the 22 languages of the Eighth Schedule, and English.
 *
 * The same list, in the same order, lives in the backend (app/core/languages.py); registry.test.js
 * and the backend's test_languages.py each pin the codes, so the two cannot drift apart unnoticed.
 *
 * The site's own words are Devanagari only, so a language is named in Devanagari (`hindi`) and, when
 * its own script is another one, its native name follows in brackets ("तमिल (தமிழ்)").
 * `english` is never shown: it only lets the picker find "tamil" when someone types it.
 *
 *   code     shortest ISO 639 code, also the BCP 47 `lang` of the text
 *   scripts  ISO 15924 codes, the usual one first (the typing helper writes the first unless told otherwise)
 *   stop     the character that ends a sentence
 */

export const DEFAULT_LANGUAGE = 'hi';

export const LANGUAGES = [
  { code: 'hi', english: 'Hindi', hindi: 'हिंदी', native: 'हिन्दी', scripts: ['Deva'], stop: '।' },
  { code: 'en', english: 'English', hindi: 'अंग्रेज़ी', native: 'English', scripts: ['Latn'], stop: '.' },
  { code: 'as', english: 'Assamese', hindi: 'असमिया', native: 'অসমীয়া', scripts: ['Beng'], stop: '।' },
  { code: 'bn', english: 'Bengali', hindi: 'बांग्ला', native: 'বাংলা', scripts: ['Beng'], stop: '।' },
  { code: 'brx', english: 'Bodo', hindi: 'बोडो', native: 'बरʼ', scripts: ['Deva'], stop: '।' },
  { code: 'doi', english: 'Dogri', hindi: 'डोगरी', native: 'डोगरी', scripts: ['Deva'], stop: '।' },
  { code: 'gu', english: 'Gujarati', hindi: 'गुजराती', native: 'ગુજરાતી', scripts: ['Gujr'], stop: '.' },
  { code: 'kn', english: 'Kannada', hindi: 'कन्नड़', native: 'ಕನ್ನಡ', scripts: ['Knda'], stop: '.' },
  { code: 'ks', english: 'Kashmiri', hindi: 'कश्मीरी', native: 'کٲشُر', scripts: ['Arab', 'Deva'], stop: '۔' },
  { code: 'kok', english: 'Konkani', hindi: 'कोंकणी', native: 'कोंकणी', scripts: ['Deva'], stop: '।' },
  { code: 'mai', english: 'Maithili', hindi: 'मैथिली', native: 'मैथिली', scripts: ['Deva'], stop: '।' },
  { code: 'ml', english: 'Malayalam', hindi: 'मलयालम', native: 'മലയാളം', scripts: ['Mlym'], stop: '.' },
  { code: 'mni', english: 'Manipuri Meitei', hindi: 'मणिपुरी', native: 'ꯃꯩꯇꯩꯂꯣꯟ', scripts: ['Mtei', 'Beng'], stop: '꯫' },
  { code: 'mr', english: 'Marathi', hindi: 'मराठी', native: 'मराठी', scripts: ['Deva'], stop: '.' },
  { code: 'ne', english: 'Nepali', hindi: 'नेपाली', native: 'नेपाली', scripts: ['Deva'], stop: '।' },
  { code: 'or', english: 'Odia Oriya', hindi: 'ओड़िया', native: 'ଓଡ଼ିଆ', scripts: ['Orya'], stop: '।' },
  { code: 'pa', english: 'Punjabi', hindi: 'पंजाबी', native: 'ਪੰਜਾਬੀ', scripts: ['Guru'], stop: '।' },
  { code: 'sa', english: 'Sanskrit', hindi: 'संस्कृत', native: 'संस्कृतम्', scripts: ['Deva'], stop: '।' },
  { code: 'sat', english: 'Santali', hindi: 'संताली', native: 'ᱥᱟᱱᱛᱟᱲᱤ', scripts: ['Olck', 'Deva'], stop: '᱾' },
  { code: 'sd', english: 'Sindhi', hindi: 'सिंधी', native: 'سِنڌِي', scripts: ['Arab', 'Deva'], stop: '۔' },
  { code: 'ta', english: 'Tamil', hindi: 'तमिल', native: 'தமிழ்', scripts: ['Taml'], stop: '.' },
  { code: 'te', english: 'Telugu', hindi: 'तेलुगु', native: 'తెలుగు', scripts: ['Telu'], stop: '.' },
  { code: 'ur', english: 'Urdu', hindi: 'उर्दू', native: 'اردو', scripts: ['Arab'], stop: '۔' },
];

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code, language]));

/** Script names for the typing helper's "which script" choice (languages that are written in more than one). */
export const SCRIPT_NAMES = {
  Deva: 'देवनागरी',
  Arab: 'फ़ारसी-अरबी',
  Mtei: 'मीतेई मयेक',
  Beng: 'बांग्ला',
  Olck: 'ओल चिकी',
  Latn: 'रोमन',
};

export const isLanguage = (code) => BY_CODE.has(code);

/** The language for a code, or Hindi when the code is missing or unknown (a story from before languages). */
export function getLanguage(code) {
  return BY_CODE.get(code) || BY_CODE.get(DEFAULT_LANGUAGE);
}

/** Right-to-left script (Urdu, and Kashmiri / Sindhi in the Perso-Arabic script). */
export const isRtlScript = (script) => script === 'Arab';

/** Devanagari is the script the site is written in; a native name in it needs no brackets. */
const DEVANAGARI = /[ऀ-ॿ]/;

/** "तमिल (தமிழ்)", or just "मराठी" when the native name is in Devanagari already. */
export function languageLabel(code) {
  const language = getLanguage(code);
  if (language.code === 'hi') return language.hindi;
  const showNative = !DEVANAGARI.test(language.native) || language.code === 'brx';
  return showNative ? `${language.hindi} (${language.native})` : language.hindi;
}

/** The locale a device voice is looked up by (only its language part matters: "ta-IN" finds any Tamil voice). */
export const speechLocale = (code) => (code === 'en' ? 'en-IN' : `${getLanguage(code).code}-IN`);

/** The name in English letters, for an English interface ("Manipuri", not the search spelling "Manipuri Meitei"). */
export const englishName = (code) => getLanguage(code).english.split(' ')[0];

/** Only the name, in Devanagari: for tight places (a chip on a story card). */
export function languageName(code) {
  return getLanguage(code).hindi;
}

/** Known codes only, no repeats, in the order given. */
export function cleanCodes(codes) {
  const out = [];
  (Array.isArray(codes) ? codes : []).forEach((code) => {
    if (typeof code === 'string' && BY_CODE.has(code) && !out.includes(code)) out.push(code);
  });
  return out;
}

/** The languages whose name contains what was typed (Devanagari, native or English spelling). */
export function findLanguages(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return LANGUAGES;
  return LANGUAGES.filter(
    (language) =>
      language.hindi.toLowerCase().includes(needle) ||
      language.native.toLowerCase().includes(needle) ||
      language.english.toLowerCase().includes(needle) ||
      language.code === needle
  );
}
