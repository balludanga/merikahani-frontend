import en from './catalogs/en.json';
import { interfaceStrings } from './extract';
import { translateKey } from './normalize';
import { LANGUAGES } from '../languages/registry';
import { isRtlUi, translatedLanguages, uiLanguageFor } from './catalogs';

// Hindi text that stays as it is in every language: the brand, symbols and Devanagari numerals
const STAYS = new Set(['लेखनी', 'अ', '१', '२', '३', 'ल', '।']);

// Hindi text in the code that no one ever reads on the page: <meta> descriptions, search keywords and
// pieces of code the string finder cuts out of a longer line
const NOT_SHOWN = new Set(require('./not-shown.json'));

const plain = (list) => list.filter((s) => !s.includes('{*') && !STAYS.has(s) && !NOT_SHOWN.has(s));

describe('the English catalog covers the interface', () => {
  const all = interfaceStrings();
  const files = Object.keys(all).filter((file) => !file.startsWith('content/'));

  test('every Hindi text shown in the interface has an English translation', () => {
    const missing = [];
    files.forEach((file) => {
      plain(all[file]).forEach((text) => {
        if (translateKey(en, text) === null) missing.push(`${file}: ${text}`);
      });
    });
    // when this fails: add the text to src/i18n/catalogs/en.json (or, if no one reads it, to not-shown.json)
    expect(missing).toEqual([]);
  });

  test('every translation keeps the numbers and slots of its Hindi', () => {
    const slots = (text) => (text.match(/\{\*?\d+\}/g) || []).sort().join(',');
    const bad = Object.entries(en).filter(([hindi, english]) => slots(hindi) !== slots(english));
    expect(bad.map(([hindi]) => hindi)).toEqual([]);
  });

  test('the brand name is never translated', () => {
    Object.entries(en).forEach(([hindi, english]) => {
      if (hindi.includes('लेखनी')) expect(english).toContain('लेखनी');
    });
    expect(Object.prototype.hasOwnProperty.call(en, 'लेखनी')).toBe(false);
  });

  test('no entry is empty, and none is only Devanagari (that would be no translation)', () => {
    Object.entries(en).forEach(([hindi, english]) => {
      expect(english.trim()).not.toBe('');
      if (!/लेखनी/.test(hindi) && hindi.length > 4) expect(english).not.toBe(hindi);
    });
  });
});

describe('the interface catalogs of the other languages', () => {
  const core = require('./core.json');
  const slots = (text) => (text.match(/\{\*?\d+\}/g) || []).sort().join(',');
  const languages = translatedLanguages().filter((code) => code !== 'hi' && code !== 'en');
  // written in Devanagari, so the Hindi stays in the text where a catalog lacks it
  const DEVANAGARI = ['mr', 'ne', 'sa', 'kok', 'mai', 'doi', 'brx'];

  test('there are catalogs for the languages we have translated', () => {
    expect(languages.sort()).toEqual([
      'as', 'bn', 'brx', 'doi', 'gu', 'kn', 'kok', 'ks', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur',
    ]);
  });

  languages.forEach((code) => {
    describe(code, () => {
      const catalog = require(`./catalogs/${code}.json`);

      test('translates every core text', () => {
        const missing = core.filter((hindi) => !catalog[hindi]);
        expect(missing).toEqual([]);
      });

      test('has only texts that exist in the English catalog (no stray keys)', () => {
        const stray = Object.keys(catalog).filter((hindi) => !Object.prototype.hasOwnProperty.call(en, hindi));
        expect(stray).toEqual([]);
      });

      test('keeps the numbers and slots of the Hindi and the brand name', () => {
        Object.entries(catalog).forEach(([hindi, text]) => {
          expect(slots(text)).toBe(slots(hindi));
          if (hindi.includes('लेखनी')) expect(text).toContain('लेखनी');
        });
      });

      if (!DEVANAGARI.includes(code)) {
        test('has no Hindi left in it except the brand and the typing example', () => {
          const HINDI = /[ऀ-ॣ०-ॿ]/;
          Object.entries(catalog).forEach(([, text]) => {
            const rest = text.replace(/लेखनी/g, '').replace(/अ /g, '').replace(/कहानी/g, '');
            expect(rest).not.toMatch(HINDI);
          });
        });
      }
    });
  });
});

describe('which language the interface is shown in', () => {
  test('translated languages are shown as they are; the others fall back', () => {
    expect(translatedLanguages()).toEqual(expect.arrayContaining(['hi', 'en', 'bn', 'ta', 'ur', 'ne']));
    expect(uiLanguageFor('hi')).toBe('hi');
    expect(uiLanguageFor('en')).toBe('en');
    // every one of the 23 languages now has an interface of its own
    LANGUAGES.forEach((language) => expect(uiLanguageFor(language.code)).toBe(language.code));
    expect(uiLanguageFor(null)).toBe('hi');
    expect(uiLanguageFor('zz')).toBe('hi');
  });

  test('the right-to-left languages mirror the page, the others do not', () => {
    ['ur', 'ks', 'sd'].forEach((code) => expect(isRtlUi(code)).toBe(true));
    ['hi', 'en', 'ta', 'sat', 'mni', 'sa'].forEach((code) => expect(isRtlUi(code)).toBe(false));
  });
});
