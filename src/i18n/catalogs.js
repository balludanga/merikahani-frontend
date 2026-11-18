/**
 * Which languages the interface has been translated into, and what to show for the rest.
 *
 * Hindi is the source: every string in the code is Hindi, so Hindi needs no catalog. A catalog is a
 * JSON file { "Hindi text": "translation" } in ./catalogs, loaded only when someone uses that language.
 * Adding a language = adding its file here.
 *
 * A catalog may be partial (core.json lists what every one must cover): what it lacks is shown in a
 * fallback. For the languages written in Devanagari (Marathi, Nepali, Sanskrit...) that is the Hindi
 * itself; for every other script it is the English translation, which is complete.
 * A language with no catalog at all is shown the same way as its fallback language.
 */
import { LANGUAGES, englishName, getLanguage, languageLabel } from '../languages/registry';

const LOADERS = {
  en: () => import('./catalogs/en.json'),
  bn: () => import('./catalogs/bn.json'),
  mr: () => import('./catalogs/mr.json'),
  ta: () => import('./catalogs/ta.json'),
  te: () => import('./catalogs/te.json'),
  gu: () => import('./catalogs/gu.json'),
  kn: () => import('./catalogs/kn.json'),
  ml: () => import('./catalogs/ml.json'),
  pa: () => import('./catalogs/pa.json'),
  or: () => import('./catalogs/or.json'),
  as: () => import('./catalogs/as.json'),
  ur: () => import('./catalogs/ur.json'),
  ne: () => import('./catalogs/ne.json'),
  sa: () => import('./catalogs/sa.json'),
  kok: () => import('./catalogs/kok.json'),
  mai: () => import('./catalogs/mai.json'),
  doi: () => import('./catalogs/doi.json'),
  brx: () => import('./catalogs/brx.json'),
  ks: () => import('./catalogs/ks.json'),
  sd: () => import('./catalogs/sd.json'),
  sat: () => import('./catalogs/sat.json'),
  mni: () => import('./catalogs/mni.json'),
};

export const hasCatalog = (code) => code === 'hi' || Object.prototype.hasOwnProperty.call(LOADERS, code);

/** The language whose text fills the gaps of a partial catalog: Hindi for Devanagari, English for the rest. */
export const gapFiller = (code) => (getLanguage(code).scripts[0] === 'Deva' ? 'hi' : 'en');

/** The language the interface is shown in for a person whose preferred language is `code`. */
export function uiLanguageFor(code) {
  if (!code || !LANGUAGES.some((l) => l.code === code)) return 'hi';
  if (hasCatalog(code)) return code;
  return gapFiller(code);
}

/** Interface languages that exist for real (not as a fallback). */
export const translatedLanguages = () => ['hi', ...Object.keys(LOADERS)];

/** Languages written right to left: the page itself is mirrored for them. */
export const isRtlUi = (code) => hasCatalog(code) && getLanguage(code).scripts[0] === 'Arab';

const load = async (code) => {
  const module = await LOADERS[code]();
  return { ...(module.default || module) };
};

/**
 * The catalog of a language: { "Hindi text": "translation" }, or null for Hindi. Anything the
 * language's own file lacks is taken from English (the language of the gaps, see gapFiller).
 */
export async function loadCatalog(code) {
  if (code === 'hi' || !LOADERS[code]) return null;
  const own = await load(code);
  if (code === 'en' || gapFiller(code) === 'hi') return own;
  return { ...(await load('en')), ...own };
}

// 17 November 2026 written in a locale (digits kept Latin so the page can fill them in)
const SHORT = { year: 'numeric', month: 'short', day: 'numeric' };
const MONTH_YEAR = { year: 'numeric', month: 'long' };
const HI_SHORT = ['जन॰', 'फ़र॰', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुल॰', 'अग॰', 'सित॰', 'अक्टू॰', 'नव॰', 'दिस॰'];
const HI_LONG = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर'];
const SAFE_LOCALES = { en: 'en-IN' };

/** "{0} नव॰ {1}" -> the same date as the language writes it ("{0} நவ. {1}"), made by the browser. */
export function dateEntries(code) {
  const locale = `${SAFE_LOCALES[code] || code}-u-nu-latn`;
  const entries = {};
  try {
    if (Intl.DateTimeFormat.supportedLocalesOf([locale]).length === 0) return entries;
    const slot = (date, options) =>
      new Intl.DateTimeFormat(locale, options).format(date).replace('22', '{0}').replace('2033', '{1}');
    for (let month = 0; month < 12; month += 1) {
      const sample = new Date(2033, month, 22);
      entries[`{0} ${HI_SHORT[month]} {1}`] = slot(sample, SHORT);
      entries[`${HI_LONG[month]} {0}`] = new Intl.DateTimeFormat(locale, MONTH_YEAR).format(sample).replace('2033', '{0}');
    }
    entries['अक्टूबर {0}'] = entries['अक्तूबर {0}']; // both spellings of October
  } catch (error) {
    return {};
  }
  return entries;
}

/**
 * Language names are made, not typed. In Hindi the picker shows "तमिल (தமிழ்)"; in English "Tamil (தமிழ்)";
 * in any other interface language each language is named the way its own speakers write it, with
 * the English name after it for orientation: "தமிழ் (Tamil)". Returns the entries to add to a
 * catalog (the name alone, and the name with its own script in brackets).
 */
export function languageNameEntries(code) {
  if (code === 'hi') return {};
  const entries = {};
  LANGUAGES.forEach((l) => {
    const label = languageLabel(l.code);
    if (code === 'en') {
      const name = englishName(l.code);
      entries[l.hindi] = name;
      if (label !== l.hindi) entries[label] = l.code === 'en' ? name : `${name} (${l.native})`;
    } else {
      const own = l.code === 'en' ? 'English' : l.native;
      entries[l.hindi] = own;
      entries[label] = l.code === 'en' ? 'English' : `${own} (${englishName(l.code)})`;
    }
  });
  return entries;
}
