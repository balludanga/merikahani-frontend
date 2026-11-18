import fs from 'fs';
import path from 'path';
import { LANGUAGES } from '../languages/registry';
import { assemble } from './composer';
import { engineFor, typingKind, typingScripts, chosenScript } from './engines';
import { parseLexicon } from './lexicon';
import { profileFor } from './profiles';
import { ScriptEngine } from './scriptEngine';
import { KEEP_A, scriptMapper } from './scriptmap';

// words the Hindi list holds, for checking that every letter the engine can produce has somewhere to go
const ROWS = parseLexicon(fs.readFileSync(path.join(__dirname, 'hindi-lexicon.txt'), 'utf8'));
const SAMPLE = ROWS.filter((_, i) => i % 12 === 0).map((row) => row[0]);

const SCRIPT_PROPERTY = {
  Beng: 'Bengali', Guru: 'Gurmukhi', Gujr: 'Gujarati', Orya: 'Oriya', Taml: 'Tamil', Telu: 'Telugu',
  Knda: 'Kannada', Mlym: 'Malayalam', Arab: 'Arabic', Olck: 'Ol_Chiki', Mtei: 'Meetei_Mayek',
};
const belongsTo = (script) =>
  new RegExp(`^[\\p{scx=${SCRIPT_PROPERTY[script]}}\\p{Script=Common}\\p{Script=Inherited}]*$`, 'u');

const top = (language, typed, script) => engineFor(language, script).suggest(typed).top;
const shown = (language, typed, script) => assemble(engineFor(language, script).suggest(typed)).map((c) => c.text);

describe('writing the engine\'s Devanagari in another script', () => {
  const cases = [
    ['bn', 'Beng'], ['as', 'Beng'], ['gu', 'Gujr'], ['pa', 'Guru'], ['or', 'Orya'], ['ta', 'Taml'], ['te', 'Telu'],
    ['kn', 'Knda'], ['ml', 'Mlym'], ['ur', 'Arab'], ['ks', 'Arab'], ['sd', 'Arab'], ['sat', 'Olck'], ['mni', 'Mtei'],
  ];

  test.each(cases)('%s (%s): thousands of real words come out in that script and nothing is left in Devanagari', (language, script) => {
    const write = scriptMapper(language, script);
    const own = belongsTo(script);
    const bad = [];
    SAMPLE.forEach((word) => {
      const out = write(word);
      if (!own.test(out) || /[ऀ-ॿ]/.test(out) || out.includes(KEEP_A) || !out) bad.push(`${word} -> ${out}`);
    });
    expect(SAMPLE.length).toBeGreaterThan(5000);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  test('Devanagari languages need no writer, and English never has one', () => {
    ['hi', 'mr', 'ne', 'sa', 'kok', 'mai', 'doi', 'brx'].forEach((language) => {
      expect(scriptMapper(language, 'Deva')).toBeNull();
    });
    expect(scriptMapper('en', 'Latn')).toBeNull();
    // Kashmiri, Sindhi and Santali can be written in Devanagari instead
    expect(scriptMapper('sd', 'Deva')).toBeNull();
  });

  test('the shapes that matter, letter by letter', () => {
    const t = (language, script, text) => scriptMapper(language, script)(text);
    // a nasal dot before a consonant is the consonant itself in Bengali, Odia, Tamil, Malayalam
    expect(t('bn', 'Beng', 'सुंदर')).toBe('সুন্দর');
    expect(t('ta', 'Taml', 'सुंदर')).toBe('சுந்தர்');
    expect(t('ml', 'Mlym', 'सुंदर' + KEEP_A)).toBe('സുന്ദര');
    // and stays a dot in Gujarati, Telugu, Kannada; Gurmukhi picks tippi or bindi by the vowel before it
    expect(t('gu', 'Gujr', 'सुंदर')).toBe('સુંદર');
    expect(t('pa', 'Guru', 'सुंदर')).toBe('ਸੁੰਦਰ');
    expect(t('pa', 'Guru', 'मैं')).toBe('ਮੈਂ');
    // Tamil has one letter for ka / kha / ga / gha, and two for n
    expect(t('ta', 'Taml', 'कखगघ')).toBe('கககக்');
    expect(t('ta', 'Taml', 'नमन')).toBe('நமன்');
    // Gurmukhi doubles a consonant with addak
    expect(t('pa', 'Guru', 'पक्का')).toBe('ਪੱਕਾ');
    // Malayalam ends a word with a chillu
    expect(t('ml', 'Mlym', 'अवन')).toBe('അവൻ');
    // Assamese has its own ra and wa
    expect(t('as', 'Beng', 'रव')).toBe('ৰৱ');
    expect(t('bn', 'Beng', 'रव')).toBe('রব');
    // Urdu: long vowels are letters, short ones are left out, a final e is the bari ye
    expect(t('ur', 'Arab', 'किताब')).toBe('کتاب');
    expect(t('ur', 'Arab', 'कहानी')).toBe('کہانی');
    expect(t('ur', 'Arab', 'आए')).toBe('آئے');
    expect(t('ur', 'Arab', 'अच्छा')).toBe('اچھا');
    // Ol Chiki has no vowel signs; Meetei Mayek closes a syllable with a lonsum letter
    expect(t('sat', 'Olck', 'हिंदी')).toBe('ᱦᱤᱱᱫᱤ');
    expect(t('mni', 'Mtei', 'किताब')).toBe('ꯀꯤꯇꯥꯕ');
  });
});

describe('typing in each language', () => {
  test('every language has a typing kind, and English needs none', () => {
    expect(typingKind('hi')).toBe('lexicon');
    expect(typingKind('en')).toBe('none');
    LANGUAGES.filter((l) => !['hi', 'en'].includes(l.code)).forEach((l) => expect(typingKind(l.code)).toBe('rules'));
    expect(engineFor('en')).toBeNull();
  });

  test('the languages written in two scripts offer both, the usual first', () => {
    expect(typingScripts('sd')).toEqual(['Arab', 'Deva']);
    expect(typingScripts('ks')).toEqual(['Arab', 'Deva']);
    expect(typingScripts('sat')).toEqual(['Olck', 'Deva']);
    expect(typingScripts('mni')).toEqual(['Mtei', 'Beng']);
    expect(typingScripts('ta')).toEqual(['Taml']);
    expect(typingScripts('hi')).toEqual(['Deva']);
    expect(chosenScript('sd')).toBe('Arab');
  });

  test('every language gives some reading for ordinary words, in its own script', () => {
    LANGUAGES.filter((l) => l.code !== 'en' && l.code !== 'hi').forEach((l) => {
      const script = l.scripts[0];
      ['kahani', 'ghar', 'pyaar', 'mitra', 'nadi'].forEach((typed) => {
        const text = top(l.code, typed);
        expect(text).toBeTruthy();
        if (script !== 'Deva') expect(text).toMatch(belongsTo(script));
        expect(text).not.toContain(KEEP_A);
        // no Latin letter ever survives into the text
        expect(text).not.toMatch(/[A-Za-z]/);
      });
    });
  });

  test('typing never leaves the marker or Devanagari in a script that is not Devanagari', () => {
    ['ta', 'te', 'kn', 'ml', 'bn', 'ur', 'sat', 'mni'].forEach((code) => {
      const script = LANGUAGES.find((l) => l.code === code).scripts[0];
      ['avana', 'avan', 'telugu', 'amma', 'tamizh', 'kaaLi'].forEach((typed) => {
        shown(code, typed).forEach((text) => {
          expect(text).toMatch(belongsTo(script));
          expect(text).not.toMatch(/[ऀ-ॿ]/);
        });
      });
    });
  });

  test('well-known words, as a native typist would type them', () => {
    expect(top('ta', 'tamizh')).toBe('தமிழ்');
    expect(top('ta', 'vaNakkam')).toBe('வணக்கம்');
    expect(top('te', 'telugu')).toBe('తెలుగు');
    expect(top('kn', 'kannaDa')).toBe('ಕನ್ನಡ');
    expect(top('ml', 'malayaaLam')).toBe('മലയാളം');
    expect(top('bn', 'ami')).toBe('আমি');
    expect(top('bn', 'tumi')).toBe('তুমি');
    expect(top('bn', 'amaar')).toBe('আমার');
    expect(top('gu', 'gujaraati')).toBe('ગુજરાતી');
    expect(top('pa', 'panjaabi')).toBe('ਪੰਜਾਬੀ');
    expect(top('mr', 'maraaThi')).toBe('मराठी');
    expect(top('ne', 'namaste')).toBe('नमस्ते');
    expect(top('ur', 'kitaab')).toBe('کتاب');
    expect(top('ur', 'zindagi')).toBe('زندگی');
  });

  test('a Dravidian word that ends in a typed "a" keeps the vowel; one that ends in a consonant does not', () => {
    expect(top('ta', 'avan')).toBe('அவன்');
    expect(top('ta', 'avana')).toBe('அவன');
    expect(top('ml', 'avan')).toBe('അവൻ');
    expect(top('ml', 'avana')).toBe('അവന');
  });

  test('"e" and "o" are the short vowels in the Dravidian languages, and the long ones are next on the list', () => {
    expect(top('ta', 'enna')).toBe('என்ன'); // எ, not ஏ
    expect(shown('ta', 'ena')).toContain('ஏன'); // the long ē is on the list
    expect(top('te', 'eppuDu')).toBe('ఎప్పుడు'); // capital D is the retroflex ḍ, as in Hindi typing
    expect(shown('te', 'ela')).toContain('ఏల');
    expect(shown('bn', 'bhalobasha')).toContain('ভালোবাসা');
  });

  test('capital L, R and zh reach the letters Hindi typing has no use for', () => {
    expect(top('mr', 'kaLa')).toBe('कळा');
    expect(top('ta', 'kuLam')).toContain('ள');
    expect(top('ta', 'kuRam')).toContain('ற');
    expect(top('ta', 'vazhi')).toContain('ழ');
    expect(top('ml', 'vazhi')).toContain('ഴ');
  });

  test('typing goes through the same candidate list as Hindi, with the plain reading first', () => {
    const list = assemble(engineFor('ta').suggest('amma'));
    expect(list.length).toBeGreaterThan(0);
    list.forEach((c) => expect(typeof c.text).toBe('string'));
    expect(new Set(list.map((c) => c.text)).size).toBe(list.length); // no repeats after the script collapses letters
  });

  test('what a writer picks is remembered per language, by the Devanagari it was made from', () => {
    const engine = new ScriptEngine('mr', 'Deva');
    const result = engine.suggest('mitr');
    engine.learn(result.typed, result.top, true, true);
    expect(engine.inner.uses.size).toBe(1);
    // text the engine never showed is ignored rather than guessed at
    engine.learn('zzz', 'कुछ और', false, true);
    expect(engine.inner.uses.size).toBe(1);
  });

  test('the Hindi conventions are the plain ones; other profiles only change what they list', () => {
    const plain = profileFor('hi');
    expect(plain.final).toBeNull();
    expect(plain.caps).toBe('TDN');
    expect(profileFor('ta').caps).toBe('TDNLR');
    expect(profileFor('ta').consonants.zh).toBeDefined();
    expect(profileFor('bn').matra.a[0].k).toBe('ा');
  });
});
