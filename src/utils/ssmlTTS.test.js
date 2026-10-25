import { SSMLTTSEngine, splitForSpeech, planNarration } from './ssmlTTS';

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
    jest.useFakeTimers();
    const { spoken } = installFakeSynth([HI]);
    const onEnd = jest.fn();
    new SSMLTTSEngine().speak('पहला वाक्य।\nदूसरा वाक्य।', { lang: 'hi-IN', useSSML: false, onEnd });
    expect(spoken.map((u) => u.text)).toEqual(['पहला वाक्य।']);
    spoken[0].onend();
    // the narrator breathes between paragraphs before the next one starts
    expect(spoken).toHaveLength(1);
    jest.advanceTimersByTime(800);
    expect(spoken.map((u) => u.text)).toEqual(['पहला वाक्य।', 'दूसरा वाक्य।']);
    expect(onEnd).not.toHaveBeenCalled();
    spoken[1].onend();
    expect(onEnd).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('a late "end" from a cancelled run cannot skip or finish the new run', () => {
    jest.useFakeTimers();
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
    jest.advanceTimersByTime(800);
    expect(spoken.map((u) => u.text)).toEqual(['पुराना एक।', 'नया एक।', 'नया दो।']);
    jest.useRealTimers();
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

describe('voice choice', () => {
  const pick = (voices, lang = 'hi-IN') => {
    installFakeSynth(voices);
    return new SSMLTTSEngine().findVoice(lang, ['swara', 'lekha']);
  };

  test('prefers a neural / natural voice over a compact one', () => {
    const compact = { name: 'Lekha (Compact)', lang: 'hi-IN' };
    const natural = { name: 'Microsoft Swara Online (Natural) - Hindi (India)', lang: 'hi-IN' };
    expect(pick([compact, natural])).toBe(natural);
  });

  test('skips the half-empty entries Edge sometimes lists', () => {
    const broken = { name: 'Microsoft undefined Online (Natural) - undefined', lang: 'hi-IN' };
    expect(pick([broken, HI])).toBe(HI);
  });

  test('understands the hi_IN spelling Android uses', () => {
    const android = { name: 'Hindi', lang: 'hi_IN' };
    expect(pick([EN_IN, android])).toBe(android);
  });
});

describe('planNarration', () => {
  const speech = (segments) => segments.filter((s) => !s.isBreak);
  const gaps = (segments) => segments.filter((s) => s.isBreak).map((s) => s.breakDuration);

  test('longer silence for a paragraph than a sentence, longer still for a blank line', () => {
    const sentence = gaps(planNarration('एक बात कही गई थी। दूसरी बात भी कही गई।'));
    const paragraph = gaps(planNarration('एक बात कही गई थी।\nदूसरी बात भी कही गई।'));
    const section = gaps(planNarration('एक बात कही गई थी।\n\nदूसरी बात भी कही गई।'));
    expect(sentence).toHaveLength(1);
    expect(paragraph[0]).toBeGreaterThan(sentence[0]);
    expect(section[0]).toBeGreaterThan(paragraph[0]);
  });

  test('breathes at a comma and does not leave a silence at the very end', () => {
    const plan = planNarration('जब पहली बारिश आई तो, तब सब घर लौट आए।');
    expect(speech(plan)).toHaveLength(2);
    expect(gaps(plan)).toHaveLength(1);
    expect(plan[plan.length - 1].isBreak).toBeFalsy();
  });

  test('a "* * *" line is a silent scene break, never spoken', () => {
    const plan = planNarration('पहला अध्याय समाप्त हुआ।\n* * *\nदूसरा अध्याय शुरू हुआ।');
    expect(speech(plan).map((s) => s.text)).toEqual(['पहला अध्याय समाप्त हुआ।', 'दूसरा अध्याय शुरू हुआ।']);
    expect(gaps(plan)).toEqual([1300]);
  });

  test('quoted speech is set higher and brisker than narration; quote marks are not spoken', () => {
    const plan = planNarration('उसने धीरे से कहा “मैं कल वापस आऊँगा” और चल दिया।', { rate: 1, pitch: 1 });
    const parts = speech(plan);
    expect(parts.map((s) => s.text).join(' ')).not.toMatch(/[“”]/);
    const quoted = parts.find((s) => s.text.includes('वापस'));
    const narration = parts[0];
    expect(quoted.pitch).toBeGreaterThan(narration.pitch);
  });

  test('a question lifts the pitch and an ellipsis slows the pace', () => {
    const base = { rate: 1, pitch: 1 };
    const statement = speech(planNarration('वह सुबह बहुत जल्दी घर से निकल गया था।', base))[0];
    const question = speech(planNarration('वह सुबह बहुत जल्दी घर से निकल गया था?', base))[0];
    const trail = speech(planNarration('वह सुबह बहुत जल्दी घर से निकल गया था…', base))[0];
    expect(question.pitch).toBeGreaterThan(statement.pitch);
    expect(trail.rate).toBeLessThan(statement.rate);
  });

  test('sentences differ slightly, stay within a few percent, and are repeatable', () => {
    const text = Array.from({ length: 12 }, (_, i) => `यह वाक्य संख्या ${i + 1} है जो पढ़ा जा रहा है।`).join(' ');
    const a = speech(planNarration(text, { rate: 1, pitch: 1 }));
    const b = speech(planNarration(text, { rate: 1, pitch: 1 }));
    expect(a).toEqual(b);
    expect(new Set(a.map((s) => s.rate)).size).toBeGreaterThan(1);
    a.forEach((s) => {
      expect(s.rate).toBeGreaterThan(0.95);
      expect(s.rate).toBeLessThan(1.05);
      expect(s.pitch).toBeGreaterThan(0.97);
      expect(s.pitch).toBeLessThan(1.03);
    });
  });

  test('the title is read first, slower and lower, then a pause', () => {
    const plan = planNarration('कहानी शुरू होती है।', { rate: 1, pitch: 1, title: 'पहली बारिश' });
    expect(plan[0].text).toBe('पहली बारिश');
    expect(plan[0].rate).toBeLessThan(1);
    expect(plan[0].pitch).toBeLessThan(1);
    expect(plan[1].isBreak).toBe(true);
  });
});
