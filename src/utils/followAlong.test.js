import {
  alignWords, createFollowAlong, estimateTimes, indexAt, normalizeWord, tokenizePage,
} from './followAlong';

const norm = (text) => text.split(/\s+/).filter(Boolean).map(normalizeWord);

describe('normalizeWord', () => {
  test('ignores punctuation, quote marks, the danda and the two spellings of a nukta', () => {
    expect(normalizeWord('“ज़िंदगी,”')).toBe(normalizeWord('जिंदगी'));
    expect(normalizeWord('ज़')).toBe(normalizeWord('ज')); // precomposed ज़ vs plain ज
    expect(normalizeWord('हाँ!')).toBe('हाँ');
    expect(normalizeWord('खत्म।')).toBe('खत्म');
    expect(normalizeWord('—')).toBe('');
    expect(normalizeWord('Hello,')).toBe('hello');
  });
});

describe('alignWords', () => {
  test('identical text maps word to word', () => {
    expect(alignWords(norm('एक दो तीन'), norm('एक दो तीन'))).toEqual([0, 1, 2]);
  });

  test('the spoken title is skipped and the body starts at page word 0', () => {
    const spoken = norm('पहली बारिश वह शाम थी');
    expect(alignWords(spoken, norm('वह शाम थी'), 2)).toEqual([-1, -1, 0, 1, 2]);
  });

  test('punctuation-only words are passed over on either side', () => {
    expect(alignWords(norm('एक — दो'), norm('एक दो'))).toEqual([0, -1, 1]);
    expect(alignWords(norm('एक दो'), norm('एक * दो'))).toEqual([0, 2]);
  });

  test('words the page has extra, or the speech has extra, do not throw the rest off', () => {
    expect(alignWords(norm('एक तीन चार'), norm('एक दो तीन चार'))).toEqual([0, 2, 3]); // page has an extra word
    expect(alignWords(norm('एक दो तीन चार'), norm('एक तीन चार'))).toEqual([0, -1, 1, 2]); // speech has an extra word
  });

  test('a word spelled differently is still taken as the same place', () => {
    expect(alignWords(norm('एक दुनिया तीन'), norm('एक दुनीया तीन'))).toEqual([0, 1, 2]);
  });

  test('nothing to match is fine', () => {
    expect(alignWords([], norm('एक'))).toEqual([]);
    expect(alignWords(norm('एक'), [])).toEqual([-1]);
  });
});

describe('time helpers', () => {
  test('indexAt finds the word being said at a moment', () => {
    const times = [0, 0.5, 1.2, 2.0];
    expect([-1, 0, 0.49, 0.5, 1.9, 2, 99].map((t) => indexAt(times, t))).toEqual([-1, 0, 0, 1, 2, 3, 3]);
    expect(indexAt([], 1)).toBe(-1);
  });

  test('estimateTimes spreads the words over the duration, leaving room after a full stop', () => {
    const words = ['एक', 'दो।', 'तीन', 'चार'];
    const times = estimateTimes(words, 10);
    expect(times[0]).toBe(0);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[3]).toBeLessThan(10);
    expect(times[2] - times[1]).toBeGreaterThan(times[1] - times[0]); // the word after the full stop starts later
  });
});

describe('tokenizePage', () => {
  test('lists the words in reading order, even across a highlight mark, with their positions', () => {
    document.body.innerHTML = '<div id="r"><p>एक <mark>दो</mark> तीन।</p><p>चार</p></div>';
    const tokens = tokenizePage(document.getElementById('r'));
    expect(tokens.map((t) => t.raw)).toEqual(['एक', 'दो', 'तीन।', 'चार']);
    expect(tokens[1].node.parentNode.tagName).toBe('MARK');
    expect(tokens[2].node.nodeValue.slice(tokens[2].start, tokens[2].end)).toBe('तीन।');
    expect(tokenizePage(null)).toEqual([]);
  });
});

describe('follow-along session', () => {
  let highlights;
  let rect;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    highlights = new Map();
    global.CSS = { highlights };
    window.Highlight = class {
      constructor(...ranges) {
        this.ranges = ranges;
      }
    };
    rect = { top: 400, bottom: 420, height: 20, width: 40 };
    Range.prototype.getBoundingClientRect = () => rect;
    window.scrollTo = jest.fn();
    window.innerHeight = 800;
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    document.body.innerHTML = '<div id="r"><p>वह शाम <mark>थी</mark> सुंदर।</p><p>फिर रात आई।</p></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.CSS;
    delete window.Highlight;
  });

  const root = () => document.getElementById('r');
  const marked = () => highlights.get('narration').ranges[0].toString();

  test('marks the word being said, skipping the title the page does not show', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['शाम', 'की', 'वह', 'शाम', 'थी', 'सुंदर।', 'फिर', 'रात', 'आई।'], 2);
    follow.moveTo(2);
    expect(marked()).toBe('वह');
    follow.moveTo(4);
    expect(marked()).toBe('थी'); // inside the reader's own <mark>, still found
    follow.moveTo(8);
    expect(marked()).toBe('आई।');
    follow.stop();
    expect(highlights.has('narration')).toBe(false);
  });

  test('on a word with no match it stays on the last one it found', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'अजीब', 'शाम'], 0);
    follow.moveTo(0);
    follow.moveTo(1);
    expect(marked()).toBe('वह'); // "अजीब" is not on the page
    follow.moveTo(2);
    expect(marked()).toBe('शाम');
  });

  test('scrolls only when the word leaves the comfortable part of the screen', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम', 'थी'], 0);
    follow.moveTo(0); // top 400 of 800: comfortable
    expect(window.scrollTo).not.toHaveBeenCalled();
    rect = { top: 700, bottom: 720, height: 20, width: 40 };
    follow.moveTo(1);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo.mock.calls[0][0].top).toBe(700 - 800 * 0.3); // brings it to a third of the way down
    follow.stop();
  });

  test('stops steering for a few seconds once the reader scrolls themselves', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम', 'थी'], 0);
    window.dispatchEvent(new Event('wheel'));
    rect = { top: 700, bottom: 720, height: 20, width: 40 };
    follow.moveTo(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5100);
    follow.moveTo(1);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    follow.stop();
  });

  test('follows an audio element by its clock using the given word times', () => {
    const audio = { currentTime: 0, duration: 6, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const follow = createFollowAlong(root());
    follow.attachAudio(audio, { w: ['शाम', 'वह', 'शाम', 'थी', 'सुंदर।'], t: [0, 1, 2, 3, 4], title: 1, d: 6 });
    audio.currentTime = 2.2;
    jest.advanceTimersByTime(40);
    expect(marked()).toBe('शाम');
    audio.currentTime = 4.5;
    jest.advanceTimersByTime(40);
    expect(marked()).toBe('सुंदर।');
    follow.stop();
    expect(highlights.has('narration')).toBe(false);
  });

  test('without word times it estimates from the page text and the audio length', () => {
    const audio = { currentTime: 0, duration: 8, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const follow = createFollowAlong(root());
    follow.attachAudio(audio, null);
    audio.currentTime = 7.9;
    jest.advanceTimersByTime(40);
    expect(marked()).toBe('आई।'); // the last word, near the end
    follow.stop();
  });

  test('a browser without the highlight API still works, it just paints nothing', () => {
    delete window.Highlight;
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम'], 0);
    expect(() => follow.moveTo(1)).not.toThrow();
    expect(highlights.size).toBe(0);
    follow.stop();
  });
});
