import { SSMLTTSEngine, splitForSpeech } from './ssmlTTS';

// A stand-in for the browser's speech synthesizer: it records what was spoken and lets a
// test finish or fail an utterance by hand.
function installFakeSynth(voices) {
  const spoken = [];
  const synth = {
    getVoices: () => voices,
    speak: (u) => spoken.push(u),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };
  window.speechSynthesis = synth;
  global.SpeechSynthesisUtterance = function Utterance(text) {
    this.text = text;
  };
  return { spoken, synth };
}

const HI = { name: 'Lekha', lang: 'hi-IN' };
const EN_IN = { name: 'Veena', lang: 'en-IN' };

afterEach(() => {
  delete window.speechSynthesis;
  delete global.SpeechSynthesisUtterance;
});

describe('splitForSpeech', () => {
  test('breaks at sentence ends and keeps pieces short', () => {
    const sentence = 'यह एक छोटा सा वाक्य है।';
    const text = Array(30).fill(sentence).join(' ');
    const pieces = splitForSpeech(text);
    expect(pieces.length).toBeGreaterThan(1);
    pieces.forEach((p) => {
      expect(p.length).toBeLessThanOrEqual(120);
      expect(p.endsWith('।')).toBe(true);
    });
    expect(pieces.join(' ')).toBe(text);
  });

  test('a sentence longer than the limit is cut at a space', () => {
    const words = Array(60).fill('शब्द').join(' ');
    const pieces = splitForSpeech(words);
    pieces.forEach((p) => expect(p.length).toBeLessThanOrEqual(120));
    expect(pieces.join(' ')).toBe(words);
  });

  test('line breaks separate pieces and a decimal point does not', () => {
    expect(splitForSpeech('पहली पंक्ति\n\nदूसरी पंक्ति')).toEqual(['पहली पंक्ति', 'दूसरी पंक्ति']);
    expect(splitForSpeech('कीमत 3.5 रुपये थी।')).toEqual(['कीमत 3.5 रुपये थी।']);
  });
});

describe('SSMLTTSEngine', () => {
  test('speaks Hindi with a Hindi voice, never an English-India one', () => {
    const { spoken } = installFakeSynth([EN_IN, HI]);
    new SSMLTTSEngine().speak('नमस्ते।', { lang: 'hi-IN', useSSML: false });
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBe(HI);
    expect(spoken[0].lang).toBe('hi-IN');
  });

  test('reports an error when the device has voices but none in Hindi', () => {
    const { spoken } = installFakeSynth([EN_IN]);
    const onError = jest.fn();
    const onEnd = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    new SSMLTTSEngine().speak('नमस्ते।', { lang: 'hi-IN', useSSML: false, onError, onEnd });
    expect(spoken).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  test('plain text containing "<" is read as written, not parsed as markup', () => {
    const { spoken } = installFakeSynth([HI]);
    new SSMLTTSEngine().speak('पाँच < छह और सात > आठ।', { lang: 'hi-IN', useSSML: false });
    expect(spoken[0].text).toBe('पाँच < छह और सात > आठ।');
  });

  test('walks through the pieces in order and then calls onEnd once', () => {
    const { spoken } = installFakeSynth([HI]);
    const onEnd = jest.fn();
    new SSMLTTSEngine().speak('पहला वाक्य।\nदूसरा वाक्य।', { lang: 'hi-IN', useSSML: false, onEnd });
    expect(spoken.map((u) => u.text)).toEqual(['पहला वाक्य।']);
    spoken[0].onend();
    expect(spoken.map((u) => u.text)).toEqual(['पहला वाक्य।', 'दूसरा वाक्य।']);
    expect(onEnd).not.toHaveBeenCalled();
    spoken[1].onend();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  test('a late "end" from a cancelled run cannot skip or finish the new run', () => {
    const { spoken } = installFakeSynth([HI]);
    const engine = new SSMLTTSEngine();
    const firstEnd = jest.fn();
    engine.speak('पुराना एक।\nपुराना दो।', { lang: 'hi-IN', useSSML: false, onEnd: firstEnd });
    const stale = spoken[0];

    engine.cancel();
    const secondEnd = jest.fn();
    engine.speak('नया एक।\nनया दो।', { lang: 'hi-IN', useSSML: false, onEnd: secondEnd });
    expect(spoken.map((u) => u.text)).toEqual(['पुराना एक।', 'नया एक।']);

    // Safari / Firefox fire "end" for the utterance that cancel() cut off.
    stale.onend();
    expect(spoken).toHaveLength(2);
    expect(firstEnd).not.toHaveBeenCalled();
    expect(secondEnd).not.toHaveBeenCalled();

    spoken[1].onend();
    expect(spoken.map((u) => u.text)).toEqual(['पुराना एक।', 'नया एक।', 'नया दो।']);
  });

  test('an "interrupted" error from cancel() is not reported as a failure', () => {
    const { spoken } = installFakeSynth([HI]);
    const engine = new SSMLTTSEngine();
    const onError = jest.fn();
    engine.speak('नमस्ते।', { lang: 'hi-IN', useSSML: false, onError });
    engine.cancel();
    spoken[0].onerror({ error: 'interrupted' });
    expect(onError).not.toHaveBeenCalled();
  });

  test('a pending pause timer does not fire into a later run', () => {
    jest.useFakeTimers();
    const { spoken } = installFakeSynth([HI]);
    const engine = new SSMLTTSEngine();
    engine.speak('<break time="500ms"/>पुराना।', { lang: 'hi-IN' });
    engine.cancel();
    engine.speak('नया।', { lang: 'hi-IN', useSSML: false });
    jest.advanceTimersByTime(1000);
    expect(spoken.map((u) => u.text)).toEqual(['नया।']);
    jest.useRealTimers();
  });

  test('waits for the voice list when the browser has not loaded it yet', () => {
    jest.useFakeTimers();
    const voices = [];
    const { spoken, synth } = installFakeSynth(voices);
    let notify;
    synth.addEventListener = (name, fn) => { notify = fn; };
    synth.removeEventListener = jest.fn();

    new SSMLTTSEngine().speak('नमस्ते।', { lang: 'hi-IN', useSSML: false });
    expect(spoken).toHaveLength(0);

    voices.push(HI);
    notify();
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBe(HI);
    jest.useRealTimers();
  });
});
