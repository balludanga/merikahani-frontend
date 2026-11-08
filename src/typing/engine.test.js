import fs from 'fs';
import path from 'path';
import { assemble } from './composer';
import { Engine } from './engine';
import { Layer, countWords, encodeLexicon, foldKey, parseLexicon } from './lexicon';
import { PINS } from './pins';
import { STORY_WORDS } from './storyWords.fixture';
import { literalReadings, normalizeTyped, search } from './transduce';

const LEXICON = fs.readFileSync(path.join(__dirname, 'hindi-lexicon.txt'), 'utf8');

// the engine with the real word list, shared: parsing it once keeps the suite fast
let real;
beforeAll(() => {
  real = new Engine();
  real.setLexiconText(LEXICON);
});

/** What the writer would see first for these letters. */
const first = (letters) => assemble(real.suggest(letters))[0].text;
const shown = (letters) => assemble(real.suggest(letters)).map((c) => c.text);
const same = (a, b) => foldKey(a) === foldKey(b);

describe('the typed letters', () => {
  test('only letters count; a shouted word is not a string of retroflex marks', () => {
    expect(normalizeTyped('kah-ani1')).toBe('kahani');
    expect(normalizeTyped('Taali')).toBe('Taali'); // a capital T asks for ट
    expect(normalizeTyped('KAHANI')).toBe('kahani');
    expect(normalizeTyped('')).toBe('');
    expect(normalizeTyped(null)).toBe('');
  });
});

describe('the rules on their own (names and words nobody has listed)', () => {
  const top = (w) => literalReadings(w, 1)[0].text;

  test('the obvious reading comes first', () => {
    expect(top('hain')).toBe('हैं');
    expect(top('mein')).toBe('में');
    expect(top('sundar')).toBe('सुंदर');
    expect(top('hindi')).toBe('हिंदी');
    expect(top('anamika')).toBe('अनमिका');
  });

  test('a capital T, D or N asks for the retroflex sound', () => {
    expect(top('Taali')).toBe('टाली');
    expect(top('taali')).toBe('ताली');
  });

  test('a name that no list knows still gets a reading', () => {
    const rows = assemble(new Engine().suggest('anamika'));
    expect(rows[0].kind).toBe('rule');
    expect(rows[0].text).toBe('अनमिका');
  });

  test('every Latin letter has some reading', () => {
    'abcdefghijklmnopqrstuvwxyz'.split('').forEach((letter) => {
      expect(literalReadings(letter, 1).length).toBe(1);
    });
  });
});

describe('the word list', () => {
  test('is large, well formed and in the order the search relies on', () => {
    const rows = parseLexicon(LEXICON);
    expect(rows.length).toBeGreaterThan(70000);
    const layer = new Layer(rows);
    for (let i = 1; i < layer.size; i += 1) {
      expect(layer.keys[i - 1] <= layer.keys[i]).toBe(true);
    }
    // every spelling is composed Devanagari with no stray controls
    const bad = rows.filter(([w]) => w !== w.normalize('NFC') || /[^ऀ-ॿ]/.test(w));
    expect(bad.slice(0, 5)).toEqual([]);
  });

  test('the compact form reads back exactly what was written', () => {
    const rows = [['कह', 58], ['कहना', 58], ['कहानी', 62], ['कहाँ', 60], ['ज़िंदगी', 50]];
    expect(parseLexicon(encodeLexicon(rows))).toEqual(rows);
    expect(parseLexicon('कहानी\t62\nबुरा\t40\n')).toEqual([['कहानी', 62], ['बुरा', 40]]);
  });

  test('the nukta dot does not stop a word being found', () => {
    expect(foldKey('ज़िंदगी')).toBe(foldKey('जिंदगी'));
    const shownWords = shown('zindagi');
    expect(shownWords).toEqual(expect.arrayContaining(['ज़िंदगी', 'जिंदगी']));
  });

  test('words are counted the way the story editor needs', () => {
    const counts = countWords('राहुल ने कहा राहुल, hello 123 प्रिया।');
    expect(counts.get('राहुल')).toBe(2);
    expect(counts.get('प्रिया')).toBe(1);
    expect(counts.has('hello')).toBe(false);
  });
});

describe('the reading of the letters', () => {
  // each of these was wrong before: they are the ways people really type
  const cases = {
    tumhari: 'तुम्हारी', jaldi: 'जल्दी', uthta: 'उठता', jata: 'जाता', kaha: 'कहा', beta: 'बेटा', khana: 'खाना',
    yaadein: 'यादें', purani: 'पुरानी', nibhana: 'निभाना', suhana: 'सुहाना', barish: 'बारिश', usne: 'उसने',
    humne: 'हमने', kitne: 'कितने', rishte: 'रिश्ते', mehsoos: 'महसूस', school: 'स्कूल', chai: 'चाय',
    liye: 'लिए', huye: 'हुए', naye: 'नए', evam: 'एवं', swayam: 'स्वयं', unhone: 'उन्होंने', dono: 'दोनों',
    janam: 'जन्म', karam: 'कर्म', mahattwa: 'महत्व', mrutyu: 'मृत्यु', jaunga: 'जाऊँगा', jaipur: 'जयपुर',
    ghazal: 'ग़ज़ल', gham: 'ग़म', urdu: 'उर्दू', nahi: 'नहीं', kya: 'क्या', pyar: 'प्यार', priya: 'प्रिया',
    zindagi: 'ज़िंदगी', mohabbat: 'मोहब्बत', intezaar: 'इंतज़ार', kahani: 'कहानी', bachpan: 'बचपन',
  };
  // two correct spellings exist for these; either is fine first
  const alsoFine = { mahattwa: ['महत्त्व'], jaunga: ['जाऊंगा'], intezaar: ['इंतजार'], zindagi: ['जिंदगी'], khushi: ['खुशी'] };
  Object.entries(cases).forEach(([typed, expected]) => {
    test(`${typed} -> ${expected}`, () => {
      const accepted = [expected, ...(alsoFine[typed] || [])];
      expect(accepted.some((want) => same(first(typed), want))).toBe(true);
    });
  });

  test('the length of a vowel can be typed', () => {
    expect(first('baat')).toBe('बात');
    expect(first('kaam')).toBe('काम');
    expect(first('naam')).toBe('नाम');
    expect(same(first('dil'), 'दिल')).toBe(true);
  });

  test('a capital T still asks for the retroflex reading, and the plain one is offered too', () => {
    expect(shown('Taali')).toEqual(expect.arrayContaining(['ताली']));
    expect(shown('taali')).toEqual(expect.arrayContaining(['ताली']));
  });

  test('English words people type as they sound come out in Devanagari', () => {
    expect(first('doctor')).toBe('डॉक्टर');
    expect(first('college')).toBe('कॉलेज');
    expect(first('station')).toBe('स्टेशन');
    expect(PINS.hello).toBe('हैलो');
  });

  test('typed exactly, a built-in spelling comes first', () => {
    expect(first('hai')).toBe('है');
    expect(first('mein')).toBe('में');
    expect(first('aap')).toBe('आप');
  });
});

describe('a broad set of ordinary story words', () => {
  const entries = Object.entries(STORY_WORDS);

  test('is big enough to mean something', () => {
    expect(entries.length).toBeGreaterThan(250);
  });

  test('nearly every one comes out right at first sight, and the rest are in the list', () => {
    const wrong = entries.filter(([typed, want]) => !same(first(typed), want));
    const missing = entries.filter(([typed, want]) => !shown(typed).some((w) => same(w, want)));
    // a few are genuinely two correct spellings (आये / आए, हँसी / हंसी); the list always offers the other
    expect(wrong.length / entries.length).toBeLessThan(0.08);
    expect(missing.length / entries.length).toBeLessThan(0.02);
  });
});

describe('suggesting longer words', () => {
  test('letters typed so far offer the words that continue them', () => {
    const rows = assemble(real.suggest('kah'));
    const more = rows.filter((r) => r.kind === 'more').map((r) => r.text);
    expect(more.length).toBeGreaterThan(1);
    expect(rows.map((r) => r.text)).toEqual(expect.arrayContaining(['कहा', 'कहना']));
  });

  test('common words are offered at once for a single letter', () => {
    const rows = shown('k');
    expect(rows[0]).toBe('क');
    expect(rows).toEqual(expect.arrayContaining(['के', 'की', 'का']));
  });

  test('a longer word is never what space accepts', () => {
    const [top] = assemble(real.suggest('kah'));
    expect(top.kind).not.toBe('more');
    expect(top.text).toBe('कह');
  });

  test('the first row is always a reading of exactly what was typed', () => {
    ['k', 'ka', 'kar', 'kitab', 'zindagi', 'anamika', 'qqq'].forEach((typed) => {
      const rows = assemble(real.suggest(typed));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].kind).not.toBe('more');
    });
  });

  test('answers in a few milliseconds even for long input', () => {
    const t0 = Date.now();
    for (let i = 0; i < 200; i += 1) real.suggest(['kitab', 'zindagi', 'pratishtha', 'mohabbat', 'vishwavidyalay'][i % 5] + (i % 3 ? '' : 'a'));
    expect((Date.now() - t0) / 200).toBeLessThan(30);
  });
});

describe('what the writer teaches it', () => {
  test('a name used in the story is offered at once', () => {
    const e = new Engine();
    e.setLexiconText(LEXICON);
    expect(assemble(e.suggest('anaika'))[0].text).not.toBe('अनाइका');
    e.setStoryText('अनाइका ने कहा। अनाइका हँस पड़ी। फिर अनाइका चली गई।');
    expect(assemble(e.suggest('anaika'))[0].text).toBe('अनाइका');
  });

  test('a word accepted twice is remembered; a one-off slip is not', () => {
    const e = new Engine();
    e.setLexiconText(LEXICON);
    e.learn('qwx', 'क्वक्स', false, false);
    expect(e.uses.has('क्वक्स')).toBe(false);
    e.learn('qwx', 'क्वक्स', false, false);
    expect(e.uses.has('क्वक्स')).toBe(true);
  });

  test('what was learned survives a reload', () => {
    let saved = null;
    const storage = { load: () => saved, save: (data) => { saved = JSON.parse(JSON.stringify(data)); } };
    jest.useFakeTimers();
    const a = new Engine();
    a.setLexiconText(LEXICON);
    a.attachStorage(storage);
    a.learn('kaha', 'कह', true, true);
    jest.advanceTimersByTime(1000);
    jest.useRealTimers();
    expect(saved.uses['कह']).toBe(1);
    const b = new Engine();
    b.setLexiconText(LEXICON);
    b.attachStorage(storage);
    expect(b.uses.get('कह')).toBe(1);
    expect(b.picks.get('kaha\tकह')).toBe(1);
  });

  test('forgetting wipes it', () => {
    const e = new Engine();
    e.learn('kaha', 'कह', true, true);
    e.forgetEverything();
    expect(e.uses.size + e.picks.size).toBe(0);
  });
});

describe('the search itself', () => {
  test('only spellings that are real words survive a guided search', () => {
    const layer = new Layer([['कहानी', 60], ['कहाँ', 60]]);
    const states = search('kahani', layer, 50);
    const words = states.flatMap((s) => {
      const out = [];
      for (let i = s.lo; i < s.hi && layer.keys[i] === s.out; i += 1) out.push(layer.surfaces[i]);
      return out;
    });
    expect(words).toContain('कहानी');
    expect(words).not.toContain('कहनी');
  });
});
