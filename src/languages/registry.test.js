import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  cleanCodes,
  findLanguages,
  getLanguage,
  isLanguage,
  isRtlScript,
  languageLabel,
  languageName,
} from './registry';

// The same 23 codes, in the same order, are pinned in the backend (tests/test_languages.py).
const EXPECTED_CODES = [
  'hi', 'en', 'as', 'bn', 'brx', 'doi', 'gu', 'kn', 'ks', 'kok', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa',
  'sa', 'sat', 'sd', 'ta', 'te', 'ur',
];

describe('the language list', () => {
  test('is the 22 scheduled languages and English, in the order the backend has them', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(EXPECTED_CODES);
    expect(LANGUAGES).toHaveLength(23);
    expect(DEFAULT_LANGUAGE).toBe('hi');
  });

  test('every language has a Devanagari name, a native name, a script and a sentence end', () => {
    LANGUAGES.forEach((l) => {
      expect(l.hindi).toMatch(/[ऀ-ॿ]/);
      expect(l.native.length).toBeGreaterThan(1);
      expect(l.scripts.length).toBeGreaterThan(0);
      expect(l.stop.length).toBe(1);
    });
  });

  test('the names the site shows follow the Devanagari-only rule: Latin letters only in brackets', () => {
    LANGUAGES.forEach((l) => {
      [languageName(l.code), languageLabel(l.code)].forEach((text) => {
        const outsideBrackets = text.replace(/\([^)]*\)/g, '');
        expect(outsideBrackets).not.toMatch(/[A-Za-z]/);
      });
    });
    expect(languageLabel('hi')).toBe('हिंदी');
    expect(languageLabel('ta')).toBe('तमिल (தமிழ்)');
    expect(languageLabel('mr')).toBe('मराठी'); // its own script is Devanagari: no brackets
    expect(languageLabel('en')).toBe('अंग्रेज़ी (English)');
    expect(languageLabel('brx')).toBe('बोडो (बरʼ)');
  });

  test('only the Perso-Arabic script runs right to left', () => {
    const rtl = LANGUAGES.filter((l) => isRtlScript(l.scripts[0])).map((l) => l.code);
    expect(rtl).toEqual(['ks', 'sd', 'ur']);
  });
});

describe('looking a language up', () => {
  test('an unknown or missing code means Hindi (a story from before languages)', () => {
    expect(getLanguage('ta').code).toBe('ta');
    expect(getLanguage('zz').code).toBe('hi');
    expect(getLanguage(undefined).code).toBe('hi');
    expect(isLanguage('ta')).toBe(true);
    expect(isLanguage('zz')).toBe(false);
  });

  test('a chosen list keeps known codes only, once each, in order', () => {
    expect(cleanCodes(['ta', 'hi', 'ta', 'zz', 7, null])).toEqual(['ta', 'hi']);
    expect(cleanCodes('ta')).toEqual([]);
    expect(cleanCodes(undefined)).toEqual([]);
  });

  test('the picker finds a language by its Devanagari, native or English name or its code', () => {
    expect(findLanguages('')).toHaveLength(23);
    expect(findLanguages('तमिल').map((l) => l.code)).toEqual(['ta']);
    expect(findLanguages('தமிழ்').map((l) => l.code)).toEqual(['ta']);
    expect(findLanguages('tamil').map((l) => l.code)).toEqual(['ta']);
    expect(findLanguages('TA').map((l) => l.code)).toContain('ta');
    expect(findLanguages('meitei').map((l) => l.code)).toEqual(['mni']);
    expect(findLanguages('zzzz')).toEqual([]);
  });
});
