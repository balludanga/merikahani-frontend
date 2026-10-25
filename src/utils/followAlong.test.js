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
  let rect;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    rect = { left: 100, right: 160, top: 400, bottom: 424, height: 24, width: 60 };
    Range.prototype.getBoundingClientRect = () => rect;
    window.scrollTo = jest.fn();
    window.innerHeight = 800;
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    window.matchMedia = () => ({ matches: false });
    document.body.innerHTML = '<div id="r"><p>वह शाम <mark>थी</mark> सुंदर।</p><p>फिर रात आई।</p></div>';
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  const root = () => document.getElementById('r');
  const pill = () => document.querySelector('.narration-pill');
  const pos = () => {
    const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(pill().style.transform);
    return { x: parseFloat(x), y: parseFloat(y), w: parseFloat(pill().style.width), h: parseFloat(pill().style.height) };
  };
  const frames = (ms) => jest.advanceTimersByTime(ms);

  test('knows which page word it is on, skipping the title the page does not show', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['शाम', 'की', 'वह', 'शाम', 'थी', 'सुंदर।', 'फिर', 'रात', 'आई।'], 2);
    follow.moveTo(2);
    expect(follow.current()).toBe('वह');
    follow.moveTo(4);
    expect(follow.current()).toBe('थी'); // inside the reader's own <mark>, still found
    follow.moveTo(8);
    expect(follow.current()).toBe('आई।');
    follow.stop();
  });

  test('on a word with no match it stays on the last one it found', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'अजीब', 'शाम'], 0);
    follow.moveTo(0);
    follow.moveTo(1);
    expect(follow.current()).toBe('वह'); // "अजीब" is not on the page
    follow.moveTo(2);
    expect(follow.current()).toBe('शाम');
    follow.stop();
  });

  test('the band settles over the word, a little wider than it', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम'], 0);
    follow.moveTo(0);
    frames(1500);
    const p = pos();
    expect(p.x).toBeCloseTo(100 - 3, 0);
    expect(p.w).toBeCloseTo(60 + 6, 0);
    expect(p.y).toBeCloseTo(400 - 1, 0);
    expect(p.h).toBeCloseTo(24 + 2, 0);
    expect(pill().classList.contains('on')).toBe(true);
    follow.stop();
  });

  test('moving to the next word is a glide, not a jump, and the front edge runs ahead of the back edge', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम', 'थी'], 0);
    follow.moveTo(0);
    frames(1500);
    rect = { left: 180, right: 250, top: 400, bottom: 424, height: 24, width: 70 }; // the next word, to the right
    follow.moveTo(1);
    frames(48); // a few frames in
    const early = pos();
    const front = early.x + early.w;
    expect(early.x).toBeGreaterThan(97); // the back edge has started to move ...
    expect(early.x).toBeLessThan(177); // ... but is nowhere near there yet
    expect(front).toBeGreaterThan(163 + 20); // the front edge is well ahead of where it started (163)
    expect(front - 253).toBeLessThan(0); // and not there yet either
    expect(front - 163).toBeGreaterThan((early.x - 97) * 1.5); // front edge covers more distance than the back edge
    frames(2000);
    const settled = pos();
    expect(settled.x).toBeCloseTo(177, 0);
    expect(settled.x + settled.w).toBeCloseTo(253, 0);
    follow.stop();
  });

  test('at a new line the band opens out from the start of that line instead of flying across', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम', 'थी'], 0);
    rect = { left: 400, right: 470, top: 400, bottom: 424, height: 24, width: 70 }; // end of a line
    follow.moveTo(0);
    frames(1500);
    rect = { left: 40, right: 100, top: 440, bottom: 464, height: 24, width: 60 }; // start of the next line
    follow.moveTo(1);
    frames(16);
    const first = pos();
    expect(first.y).toBeCloseTo(439, 0); // already on the new line
    expect(first.x).toBeLessThan(40); // at its start, not still out at 400
    expect(first.w).toBeLessThan(40); // and only just opening out
    frames(2000);
    expect(pos().w).toBeCloseTo(66, 0);
    follow.stop();
  });

  test('with reduced motion the band simply sits on the word', () => {
    window.matchMedia = () => ({ matches: true });
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम'], 0);
    follow.moveTo(0);
    frames(16);
    rect = { left: 300, right: 360, top: 400, bottom: 424, height: 24, width: 60 };
    follow.moveTo(1);
    frames(16);
    expect(pos().x).toBeCloseTo(297, 0);
    follow.stop();
  });

  test('scrolls only when the word leaves the comfortable part of the screen', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम', 'थी'], 0);
    follow.moveTo(0); // top 400 of 800: comfortable
    expect(window.scrollTo).not.toHaveBeenCalled();
    rect = { left: 100, right: 160, top: 700, bottom: 724, height: 24, width: 60 };
    follow.moveTo(1);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo.mock.calls[0][0].top).toBe(700 - 800 * 0.3); // brings it to a third of the way down
    follow.stop();
  });

  test('stops steering for a few seconds once the reader scrolls themselves', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह', 'शाम', 'थी'], 0);
    window.dispatchEvent(new Event('wheel'));
    rect = { left: 100, right: 160, top: 700, bottom: 724, height: 24, width: 60 };
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
    frames(40);
    expect(follow.current()).toBe('शाम');
    audio.currentTime = 4.5;
    frames(40);
    expect(follow.current()).toBe('सुंदर।');
    follow.stop();
  });

  test('reads the clock a little ahead so the easing band arrives with the word, not after it', () => {
    const audio = { currentTime: 0, duration: 6, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const follow = createFollowAlong(root());
    follow.attachAudio(audio, { w: ['शाम', 'वह', 'शाम', 'थी', 'सुंदर।'], t: [0, 1, 2, 3, 4], title: 1, d: 6 });
    audio.currentTime = 1.96; // 40 ms before "शाम" (the 2nd page word) is due to start
    frames(40);
    expect(follow.current()).toBe('शाम');
    audio.currentTime = 1.8; // still well before it
    follow.stop();
  });

  describe('continuous glide', () => {
    const boxes = {
      'वह': { left: 100, right: 160, top: 400, bottom: 424, height: 24, width: 60 },
      'शाम': { left: 180, right: 250, top: 400, bottom: 424, height: 24, width: 70 },
      'थी': { left: 270, right: 310, top: 400, bottom: 424, height: 24, width: 40 },
    };
    const timings = { w: ['वह', 'शाम', 'थी'], t: [0, 1, 2], title: 0, d: 3 };
    const audioAt = (currentTime, extra = {}) => ({ currentTime, duration: 3, addEventListener: jest.fn(), removeEventListener: jest.fn(), ...extra });

    beforeEach(() => {
      Range.prototype.getBoundingClientRect = function box() {
        return boxes[this.toString()] || rect;
      };
    });

    test('holds on a word while it is spoken', () => {
      const audio = audioAt(0.4);
      const follow = createFollowAlong(root());
      follow.attachAudio(audio, timings);
      frames(1500);
      expect(pos().x).toBeCloseTo(97, 0); // still on the first word, mid-way through it
      follow.stop();
    });

    test('glides to the next word in the last moments before it starts, arriving as the voice does', () => {
      const audio = audioAt(0.9);
      const follow = createFollowAlong(root());
      follow.attachAudio(audio, timings);
      frames(1500);
      const partway = pos();
      expect(partway.x).toBeGreaterThan(120); // already well on its way ...
      expect(partway.x).toBeLessThan(175); // ... but not there yet
      audio.currentTime = 1.0;
      frames(1500);
      expect(pos().x).toBeCloseTo(177, 0); // there when the word starts
      follow.stop();
    });

    test('keeps moving between the audio element\'s coarse time reports', () => {
      const audio = audioAt(0.9, { paused: false, playbackRate: 1 });
      const follow = createFollowAlong(root());
      follow.attachAudio(audio, timings);
      expect(follow.current()).toBe('वह');
      frames(80); // the element still says 0.9, but 80 ms have gone by
      expect(follow.current()).toBe('शाम');
      follow.stop();
    });

    test('believes the audio element after a seek or a stall', () => {
      const audio = audioAt(0.1, { paused: false, playbackRate: 1 });
      const follow = createFollowAlong(root());
      follow.attachAudio(audio, timings);
      frames(32);
      audio.currentTime = 2.2; // the reader dragged to the end
      frames(32);
      expect(follow.current()).toBe('थी');
      audio.currentTime = 0.2; // and back to the start
      frames(32);
      expect(follow.current()).toBe('वह');
      follow.stop();
    });
  });

  test('without word times it estimates from the page text and the audio length', () => {
    const audio = { currentTime: 0, duration: 8, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const follow = createFollowAlong(root());
    follow.attachAudio(audio, null);
    audio.currentTime = 7.9;
    frames(40);
    expect(follow.current()).toBe('आई।'); // the last word, near the end
    follow.stop();
  });

  test('stopping fades the band out and then removes it', () => {
    const follow = createFollowAlong(root());
    follow.setSpoken(['वह'], 0);
    follow.moveTo(0);
    frames(100);
    expect(pill()).not.toBeNull();
    follow.stop();
    expect(pill().classList.contains('on')).toBe(false);
    frames(500);
    expect(pill()).toBeNull();
  });
});
