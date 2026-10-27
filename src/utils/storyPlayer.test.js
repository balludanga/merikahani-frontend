import { createStoryPlayer, initialState, isActive } from './storyPlayer';
import ssmlTTS from './ssmlTTS';
import { fetchNarration, serverVoiceInfo, silentAudioUrl } from './serverVoice';

jest.mock('./ssmlTTS', () => ({
  __esModule: true,
  default: { speak: jest.fn(), cancel: jest.fn(), pause: jest.fn(), resume: jest.fn(), setRateScale: jest.fn() },
}));
jest.mock('./serverVoice', () => ({
  fetchNarration: jest.fn(),
  serverVoiceInfo: jest.fn(),
  silentAudioUrl: jest.fn(),
}));

let audios;
class FakeAudio {
  constructor() {
    this.listeners = {};
    this.currentTime = 0;
    this.duration = NaN;
    this.readyState = 0;
    this.paused = true;
    this.playbackRate = 1;
    this.volume = 1;
    this.onended = null;
    this.onerror = null;
    this._src = '';
    this.play = jest.fn(() => {
      this.paused = false;
      return Promise.resolve();
    });
    this.pause = jest.fn(() => {
      this.paused = true;
    });
    audios.push(this);
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    if (value === 'blob:narration') {
      // the file "loads" a moment later and tells its length
      Promise.resolve().then(() => this.loaded(FakeAudio.seconds));
    }
  }

  addEventListener(name, fn, options) {
    (this.listeners[name] = this.listeners[name] || []).push({ fn, once: options && options.once });
  }

  removeEventListener() {}

  removeAttribute(name) {
    if (name === 'src') this._src = '';
  }

  loaded(seconds) {
    this.duration = seconds;
    this.readyState = 4;
    const list = this.listeners.loadedmetadata || [];
    this.listeners.loadedmetadata = list.filter((l) => !l.once);
    list.forEach((l) => l.fn());
  }
}
FakeAudio.seconds = 120;

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};
const stories = (n = 3) => Array.from({ length: n }, (_, i) => ({
  id: i + 1, title: `रचना ${i + 1}`, content: `पाठ ${i + 1}।`, slug: `r${i + 1}`, author: { full_name: 'लेखक' },
}));

let player;
let states;
let mediaHandlers;

beforeEach(() => {
  jest.useFakeTimers('modern');
  audios = [];
  global.Audio = FakeAudio;
  FakeAudio.seconds = 120;
  URL.createObjectURL = jest.fn(() => 'blob:narration');
  URL.revokeObjectURL = jest.fn();
  window.localStorage.clear();
  [ssmlTTS.speak, ssmlTTS.cancel, ssmlTTS.pause, ssmlTTS.resume, ssmlTTS.setRateScale, fetchNarration, serverVoiceInfo].forEach((m) => m.mockReset());
  silentAudioUrl.mockReturnValue('blob:silence');
  serverVoiceInfo.mockResolvedValue({ enabled: true, ready: false });
  fetchNarration.mockImplementation(async (id, { onProgress }) => {
    onProgress(50);
    return { size: id };
  });
  mediaHandlers = {};
  window.MediaMetadata = function MediaMetadata(init) {
    Object.assign(this, init);
  };
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: {
      metadata: null,
      playbackState: 'none',
      setActionHandler: jest.fn((action, handler) => {
        mediaHandlers[action] = handler;
      }),
      setPositionState: jest.fn(),
    },
  });
  states = [];
  player = createStoryPlayer((s) => states.push(s));
  player.setQueue(stories());
});

afterEach(() => {
  player.destroy();
  jest.useRealTimers();
  delete navigator.mediaSession;
});

describe('playing from the server', () => {
  test('goes from preparing to playing, and reports where it is in the story', async () => {
    player.play(0);
    expect(player.state.phase).toBe('preparing');
    await flush();
    expect(player.state).toMatchObject({ phase: 'playing', source: 'server', duration: 120, index: 0 });
    expect(states.some((s) => s.phase === 'preparing' && s.prepared === 50)).toBe(true);
    audios[0].currentTime = 30;
    jest.advanceTimersByTime(300);
    expect(player.state.time).toBe(30);
    expect(player.state.progress).toBeCloseTo(0.25);
  });

  test('unlocks the audio element at the tap and then uses that one element for every story', async () => {
    player.play(0);
    expect(audios).toHaveLength(1);
    expect(audios[0].src).toBe('blob:silence');
    expect(audios[0].play).toHaveBeenCalled();
    await flush();
    player.play(1);
    await flush();
    expect(audios).toHaveLength(1); // the same element, so auto-next and next work on iOS
    expect(player.state.index).toBe(1);
  });

  test('knows which stories already have a narration', async () => {
    serverVoiceInfo.mockImplementation(async (id) => ({ enabled: true, ready: id === 2 }));
    player.setQueue(stories(4));
    await flush();
    expect(player.state.ready).toEqual({ 2: true });
    player.play(0);
    await flush();
    expect(player.state.ready).toEqual({ 1: true, 2: true }); // and a story just narrated is ready
  });

  test('asks the server about the first twelve stories only, once each', async () => {
    serverVoiceInfo.mockClear();
    player.setQueue(stories(20));
    await flush();
    expect(serverVoiceInfo).toHaveBeenCalledTimes(12);
  });
});

describe('pause, resume, stop', () => {
  test('pauses and resumes the audio, and remembers the place', async () => {
    player.play(0);
    await flush();
    audios[0].currentTime = 45;
    player.pause();
    expect(player.state.phase).toBe('paused');
    expect(audios[0].paused).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('lekhani_player_positions'))[1].t).toBe(45);
    player.resume();
    expect(player.state.phase).toBe('playing');
    expect(audios[0].paused).toBe(false);
  });

  test('the big button plays, pauses, resumes, and cancels while the narration is being made', async () => {
    player.toggle();
    expect(player.state.phase).toBe('preparing');
    player.toggle();
    expect(player.state.phase).toBe('idle'); // cancelled
    player.toggle();
    await flush();
    expect(player.state.phase).toBe('playing');
    player.toggle();
    expect(player.state.phase).toBe('paused');
    player.toggle();
    expect(player.state.phase).toBe('playing');
  });

  test('carries on from where the listener left a story', async () => {
    player.play(0);
    await flush();
    audios[0].currentTime = 70;
    player.stop();
    player.play(0);
    await flush();
    expect(audios[0].currentTime).toBe(70);
    expect(player.state.resumedFrom).toBe(70);
  });

  test('does not carry on from the very start or the very end', async () => {
    window.localStorage.setItem('lekhanii', '');
    player.play(0);
    await flush();
    audios[0].currentTime = 5; // too early to matter
    player.stop();
    player.play(0);
    await flush();
    expect(audios[0].currentTime).toBe(5);
    expect(player.state.resumedFrom).toBe(0);
    audios[0].currentTime = 110; // within 20 s of the end of 120 s
    player.stop();
    player.play(0);
    await flush();
    expect(player.state.resumedFrom).toBe(0);
  });
});

describe('seeking', () => {
  test('skip back 15 and forward 30, staying inside the story', async () => {
    player.play(0);
    await flush();
    audios[0].currentTime = 20;
    player.skip(30);
    expect(audios[0].currentTime).toBe(50);
    player.skip(-15);
    expect(audios[0].currentTime).toBe(35);
    player.skip(-100);
    expect(audios[0].currentTime).toBe(0);
    player.skip(1000);
    expect(audios[0].currentTime).toBe(120);
  });

  test('seekTo moves to the place and updates the screen at once', async () => {
    player.play(0);
    await flush();
    player.seekTo(60);
    expect(audios[0].currentTime).toBe(60);
    expect(player.state).toMatchObject({ time: 60, progress: 0.5 });
  });
});

describe('speed', () => {
  test('changes the audio speed, the browser voice speed, and is remembered', async () => {
    player.play(0);
    await flush();
    player.setSpeed(1.5);
    expect(audios[0].playbackRate).toBe(1.5);
    expect(ssmlTTS.setRateScale).toHaveBeenLastCalledWith(1.5);
    expect(player.state.speed).toBe(1.5);
    expect(JSON.parse(window.localStorage.getItem('lekhani_player_prefs')).speed).toBe(1.5);
    expect(createStoryPlayer().state.speed).toBe(1.5); // a new visit starts at the remembered speed
  });

  test('a new story starts at the chosen speed, and a made-up speed is refused', async () => {
    player.setSpeed(2);
    player.setSpeed(7);
    expect(player.state.speed).toBe(2);
    player.play(1);
    await flush();
    expect(audios[0].playbackRate).toBe(2);
  });

  test('cycles through the speeds and comes back round', () => {
    const seen = [];
    for (let i = 0; i < 6; i += 1) {
      player.cycleSpeed();
      seen.push(player.state.speed);
    }
    expect(seen).toEqual([1.25, 1.5, 2, 0.75, 1, 1.25]);
  });
});

describe('moving between stories', () => {
  test('next plays the next story while one is playing, and only moves the title when stopped', async () => {
    player.next();
    expect(player.state).toMatchObject({ index: 1, phase: 'idle' });
    expect(fetchNarration).not.toHaveBeenCalled();
    player.play(1);
    await flush();
    player.next();
    await flush();
    expect(player.state).toMatchObject({ index: 2, phase: 'playing' });
  });

  test('does not go past the last story or before the first', async () => {
    player.select(2);
    player.next();
    expect(player.state.index).toBe(2);
    player.select(0);
    player.previous();
    expect(player.state.index).toBe(0);
  });

  test('previous restarts the story when it has been playing a while, and goes back when it has not', async () => {
    player.play(1);
    await flush();
    audios[0].currentTime = 40;
    jest.advanceTimersByTime(300);
    player.previous();
    expect(audios[0].currentTime).toBe(0);
    expect(player.state.index).toBe(1);
    jest.advanceTimersByTime(300);
    player.previous();
    await flush();
    expect(player.state.index).toBe(0);
    expect(player.state.phase).toBe('playing');
  });

  test('a download that finishes after the listener moved on does nothing', async () => {
    let release;
    fetchNarration.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    player.play(0);
    await flush();
    player.play(1);
    await flush();
    expect(player.state).toMatchObject({ index: 1, phase: 'playing' });
    release({ size: 1 });
    await flush();
    expect(player.state).toMatchObject({ index: 1, phase: 'playing' });
  });
});

describe('finishing a story', () => {
  test('stops at the end when auto-next is off', async () => {
    player.play(0);
    await flush();
    audios[0].onended();
    expect(player.state.phase).toBe('ended');
    expect(player.state.index).toBe(0);
  });

  test('moves on to the next story by itself when auto-next is on, and stops after the last', async () => {
    player.setAutoNext(true);
    expect(JSON.parse(window.localStorage.getItem('lekhani_player_prefs')).autoNext).toBe(true);
    player.play(1);
    await flush();
    audios[0].onended();
    await flush();
    expect(player.state).toMatchObject({ index: 2, phase: 'playing' });
    audios[0].onended();
    await flush();
    expect(player.state).toMatchObject({ index: 2, phase: 'ended' });
  });

  test('a finished story is not resumed from its end next time', async () => {
    player.play(0);
    await flush();
    audios[0].currentTime = 60;
    player.pause();
    audios[0].onended();
    player.play(0);
    await flush();
    expect(player.state.resumedFrom).toBe(0);
  });
});

describe('sleep timer', () => {
  test('counts down, then fades out and pauses', async () => {
    player.play(0);
    await flush();
    player.setSleep('minutes', 15);
    expect(player.state.sleep).toEqual({ mode: 'minutes', remaining: 900 });
    jest.advanceTimersByTime(60000);
    expect(player.state.sleep.remaining).toBe(840);
    jest.advanceTimersByTime(15 * 60000 - 60000 + 1000);
    expect(player.state.sleep.mode).toBe('off');
    expect(audios[0].volume).toBeLessThan(1); // fading
    jest.advanceTimersByTime(3000);
    expect(player.state.phase).toBe('paused');
    expect(audios[0].volume).toBe(1); // ready for the next time
  });

  test('"at the end of the story" stops there, even with auto-next on, then switches itself off', async () => {
    player.setAutoNext(true);
    player.play(0);
    await flush();
    player.setSleep('end');
    audios[0].onended();
    await flush();
    expect(player.state).toMatchObject({ index: 0, phase: 'ended' });
    expect(player.state.sleep.mode).toBe('off');
  });

  test('can be switched off', async () => {
    player.setSleep('minutes', 30);
    player.setSleep('off');
    expect(player.state.sleep.mode).toBe('off');
    jest.advanceTimersByTime(40 * 60000);
    expect(player.state.phase).toBe('idle');
  });
});

describe('the browser voice', () => {
  beforeEach(async () => {
    serverVoiceInfo.mockResolvedValue({ enabled: false, ready: false });
    player.setQueue(stories(4)); // a new list: the server is asked afresh
    await flush();
  });

  test('is used when the server cannot, follows progress, pauses, and cannot be sought', async () => {
    player.setSpeed(1.25);
    player.play(0);
    await flush();
    expect(fetchNarration).not.toHaveBeenCalled();
    expect(ssmlTTS.setRateScale).toHaveBeenLastCalledWith(1.25);
    expect(player.state).toMatchObject({ phase: 'playing', source: 'browser' });
    const [text, options] = ssmlTTS.speak.mock.calls[0];
    expect(text).toBe('पाठ 1।');
    options.onTokens({ words: ['a', 'b', 'c', 'd'], titleWords: 0 });
    options.onWord(1);
    expect(player.state.progress).toBe(0.5);
    player.seekTo(30);
    player.skip(30); // nothing to seek in
    expect(player.state.time).toBe(0);
    player.pause();
    expect(ssmlTTS.pause).toHaveBeenCalled();
    player.resume();
    expect(ssmlTTS.resume).toHaveBeenCalled();
    options.onEnd();
    expect(player.state.phase).toBe('ended');
  });

  test('reports a voice that is missing', async () => {
    player.play(0);
    await flush();
    ssmlTTS.speak.mock.calls[0][1].onError();
    expect(player.state).toMatchObject({ phase: 'idle' });
    expect(player.state.error).toMatch(/हिंदी आवाज़/);
  });

  test('is also used if the server fails half way', async () => {
    serverVoiceInfo.mockResolvedValue({ enabled: true, ready: false });
    player.setQueue(stories(5));
    fetchNarration.mockRejectedValue({ response: { status: 503 } });
    player.play(0);
    await flush();
    expect(player.state.source).toBe('browser');
  });

  test('a narration that exists is used even on a day new ones cannot be made', async () => {
    serverVoiceInfo.mockResolvedValue({ enabled: false, ready: true });
    player.setQueue(stories(6));
    player.play(0);
    await flush();
    expect(player.state.source).toBe('server');
  });
});

describe('the queue and cleaning up', () => {
  test('a different list of stories starts the player afresh, the same list leaves it alone', async () => {
    player.play(1);
    await flush();
    player.setQueue(stories()); // same ids
    expect(player.state).toMatchObject({ index: 1, phase: 'playing' });
    player.setQueue(stories(2).map((s) => ({ ...s, id: s.id + 10 })));
    expect(player.state).toMatchObject({ index: 0, phase: 'idle' });
    expect(audios[0].paused).toBe(true);
  });

  test('destroy leaves nothing sounding and no timers running', async () => {
    player.play(0);
    await flush();
    player.setSleep('minutes', 15);
    player.destroy();
    expect(audios[0].paused).toBe(true);
    expect(ssmlTTS.cancel).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('isActive means being made, played or held on pause', () => {
    expect(['idle', 'preparing', 'playing', 'paused', 'ended'].map((phase) => isActive({ phase }))).toEqual([false, true, true, true, false]);
    expect(initialState().phase).toBe('idle');
  });
});

describe('lock screen and headphone controls', () => {
  test('shows the story and answers play, pause, next, previous and seeking', async () => {
    player.play(0);
    await flush();
    const session = navigator.mediaSession;
    expect(session.metadata).toMatchObject({ title: 'रचना 1', artist: 'लेखक', album: 'लेखनी' });
    expect(session.playbackState).toBe('playing');
    mediaHandlers.pause();
    expect(player.state.phase).toBe('paused');
    expect(session.playbackState).toBe('paused');
    mediaHandlers.play();
    expect(player.state.phase).toBe('playing');
    mediaHandlers.seekforward({});
    expect(audios[0].currentTime).toBe(30);
    mediaHandlers.seekbackward({ seekOffset: 10 });
    expect(audios[0].currentTime).toBe(20);
    mediaHandlers.seekto({ seekTime: 90 });
    expect(audios[0].currentTime).toBe(90);
    mediaHandlers.nexttrack();
    await flush();
    expect(player.state.index).toBe(1);
    expect(session.metadata.title).toBe('रचना 2');
    expect(session.setPositionState).toHaveBeenCalled();
  });

  test('is cleared when the player goes away', () => {
    player.destroy();
    expect(mediaHandlers.play).toBeNull();
  });
});
