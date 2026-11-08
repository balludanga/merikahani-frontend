import fs from 'fs';
import path from 'path';
import { convertWord } from './convert';
import { engine } from './engine';
import { transliterateLastWord } from '../utils/transliterate';

beforeAll(() => {
  engine.setLexiconText(fs.readFileSync(path.join(__dirname, 'hindi-lexicon.txt'), 'utf8'));
});

afterEach(() => {
  engine.liveKeys = false;
});

describe('converting a word when the space arrives (touch keyboards)', () => {
  test('uses the word list, so the usual Hinglish comes out right', () => {
    expect(convertWord('tumhari')).toBe('तुम्हारी');
    expect(convertWord('jaldi')).toBe('जल्दी');
    expect(convertWord('beta')).toBe('बेटा');
  });

  test('leaves anything that is not plain Latin letters alone', () => {
    expect(convertWord('कहानी')).toBe('कहानी');
    expect(convertWord('')).toBe('');
    expect(convertWord('a1')).toBe('a1');
  });

  test('stands down once a keyboard that reports its keys has been used', () => {
    engine.liveKeys = true;
    expect(convertWord('tumhari')).toBe('tumhari');
  });

  test('works through the text helpers the fields use', () => {
    const done = transliterateLastWord('bahut sundar ', 13, false, convertWord);
    expect(done.value).toBe('bahut सुंदर ');
    const last = transliterateLastWord('meri kahani', 11, true, convertWord);
    expect(last.value).toBe('meri कहानी');
    engine.liveKeys = true;
    expect(transliterateLastWord('meri kahani', 11, true, convertWord)).toBeNull();
  });
});
