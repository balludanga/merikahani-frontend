/**
 * The interface language: the one place that knows which language the interface is in.
 *
 *   t('Hindi text')      the text in the interface language (for strings built outside the page)
 *   setUiLanguage(code)  load that language's catalog and redraw the page in it
 *   initI18n()           called once before the first paint
 *
 * The interface follows the person's preferred language (see languages/store.js and
 * components/LanguageSync): `uiLanguageFor` turns it into the language actually shown.
 */
import { BRAND, brandIn } from '../brand';
import { needFonts } from '../languages/fonts';
import { isLanguage } from '../languages/registry';
import { getPrimary } from '../languages/store';
import { dateEntries, isRtlUi, languageNameEntries, loadCatalog, uiLanguageFor } from './catalogs';
import { applyCatalog, startTranslating, translateLoose } from './dom';

let current = 'hi';
let currentBrand = BRAND.name;
const listeners = new Set();

export const getUiLanguage = () => current;
export const onUiLanguage = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** A Hindi text in the interface language. Falls back to the Hindi itself. */
export function t(source, values) {
  const shown = translateLoose(source);
  if (!values) return shown;
  return shown.replace(/\{(\w+)\}/g, (slot, name) => (values[name] !== undefined ? values[name] : slot));
}

export async function setUiLanguage(code) {
  const wanted = uiLanguageFor(code);
  // the brand follows the preferred language itself (not the language the interface falls back to)
  const brand = brandIn(code);
  if (wanted === current && document.documentElement.lang === wanted && brand === currentBrand) return;
  let catalog = null;
  if (wanted !== 'hi') {
    try {
      catalog = await loadCatalog(wanted);
      if (catalog) catalog = { ...catalog, ...languageNameEntries(wanted), ...dateEntries(wanted) };
    } catch (error) {
      // the file did not arrive: stay as we are rather than half-translate
      return;
    }
  }
  current = catalog ? wanted : 'hi';
  currentBrand = brand;
  document.documentElement.lang = current;
  document.documentElement.dir = isRtlUi(current) ? 'rtl' : 'ltr';
  // the interface and the brand are drawn in the preferred language's script: make sure its font is there
  if (code && isLanguage(code)) needFonts(code);
  applyCatalog(catalog, brand);
  listeners.forEach((fn) => fn(current));
}

export async function initI18n() {
  startTranslating();
  await setUiLanguage(getPrimary());
}
