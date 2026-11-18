import { BRAND, BRAND_IN, brandIn } from './brand';
import { LANGUAGES } from './languages/registry';
import { scriptMapper } from './typing/scriptmap';

describe('the brand written in each language\'s script', () => {
  test('Devanagari languages (and nobody in particular) keep लेखनी', () => {
    ['hi', 'mr', 'ne', 'sa', 'kok', 'mai', 'doi', 'brx'].forEach((code) => expect(brandIn(code)).toBe(BRAND.name));
    expect(brandIn(null)).toBe(BRAND.name);
    expect(brandIn('zz')).toBe(BRAND.name);
  });

  test('every language written in another script has its own spelling, and no Devanagari is left in it', () => {
    LANGUAGES.forEach((language) => {
      if (language.scripts[0] === 'Deva') return;
      expect(BRAND_IN[language.code]).toBeTruthy();
      expect(BRAND_IN[language.code]).not.toMatch(/[ऀ-ॿ]/);
      expect(BRAND_IN[language.code]).not.toBe(BRAND.name);
    });
  });

  test('English uses the Latin spelling the site already goes by', () => {
    expect(brandIn('en')).toBe('Lekhanii');
  });

  test('each spelling is the same word the typing writers make from लेखनी (a transliteration, not a translation)', () => {
    LANGUAGES.forEach((language) => {
      const write = scriptMapper(language.code, language.scripts[0]);
      if (!write) return;
      // Sindhi writes ي where the shared Arabic writer uses the Persian ی
      const made = language.code === 'sd' ? write(BRAND.name).replace(/ی/g, 'ي') : write(BRAND.name);
      expect(BRAND_IN[language.code]).toBe(made);
    });
  });
});
