import { createNarrationPlayer } from './narrationPlayer';
import ssmlTTS from './ssmlTTS';
import { fetchNarration, serverVoiceFor, silentAudioUrl } from './serverVoice';

jest.mock('./ssmlTTS', () => ({ __esModule: true, default: { speak: jest.fn(), cancel: jest.fn() } }));
jest.mock('./serverVoice', () => ({
  fetchNarration: jest.fn(),
  serverVoiceFor: jest.fn(),
  silentAudioUrl: jest.fn(() => 'blob:silence'),
}));

let audios;
class FakeAudio {
  constructor() {
    this.src = '';
    this.paused = true;
    this.play = jest.fn(() => {
      this.paused = false;
      return Promise.resolve();
    });
    this.pause = jest.fn(() => {
      this.paused = true;
    });
    audios.push(this);
  }
}

const story = (id, extra = {}) => ({ id, title: `रचना ${id}`, content: `पाठ ${id}।`, ...extra });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  audios = [];
  global.Audio = FakeAudio;
  URL.createObjectURL = jest.fn(() => 'blob:narration');
  URL.revokeObjectURL = jest.fn();
  ssmlTTS.speak.mockReset();
  ssmlTTS.cancel.mockReset();
  fetchNarration.mockReset();
  serverVoiceFor.mockReset();
  silentAudioUrl.mockReturnValue('blob:silence'); // (Create React App resets mocks before every test)
});

test('plays the server narration: preparing, then playing, and tells you when it ends', async () => {
  serverVoiceFor.mockResolvedValue(true);
  fetchNarration.mockImplementation(async (id, { onProgress }) => {
    onProgress(40);
    return { size: 1 };
  });
  const states = [];
  const player = createNarrationPlayer((s) => states.push(s));
  const onEnd = jest.fn();
  await player.play(story(1), { onEnd });
  expect(states.map((s) => s.phase)).toEqual(['preparing', 'preparing', 'playing']);
  expect(states[1].progress).toBe(40);
  expect(player.state).toMatchObject({ phase: 'playing', postId: 1 });
  expect(audios).toHaveLength(1);
  expect(audios[0].src).toBe('blob:narration');
  expect(ssmlTTS.speak).not.toHaveBeenCalled();
  audios[0].onended();
  expect(player.state.phase).toBe('idle');
  expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
});

test('unlocks audio at the tap (before waiting on anything), for iOS', () => {
  serverVoiceFor.mockReturnValue(new Promise(() => {})); // never answers
  const player = createNarrationPlayer();
  player.play(story(1));
  expect(audios).toHaveLength(1);
  expect(audios[0].src).toBe('blob:silence');
  expect(audios[0].play).toHaveBeenCalled();
});

test('uses the browser voice when the server cannot', async () => {
  serverVoiceFor.mockResolvedValue(false);
  const player = createNarrationPlayer();
  const onEnd = jest.fn();
  await player.play(story(2), { onEnd });
  expect(fetchNarration).not.toHaveBeenCalled();
  expect(ssmlTTS.speak).toHaveBeenCalledTimes(1);
  const [text, options] = ssmlTTS.speak.mock.calls[0];
  expect(text).toBe('पाठ 2।');
  expect(options).toMatchObject({ lang: 'hi-IN', useSSML: false, title: 'रचना 2' });
  expect(player.state.phase).toBe('playing');
  expect(audios[0].pause).toHaveBeenCalled(); // the unlock element is let go
  options.onEnd();
  expect(player.state.phase).toBe('idle');
  expect(onEnd).toHaveBeenCalled();
});

test('falls back to the browser voice if the server fails half way', async () => {
  serverVoiceFor.mockResolvedValue(true);
  fetchNarration.mockRejectedValue({ response: { status: 503 } });
  const player = createNarrationPlayer();
  await player.play(story(3));
  expect(ssmlTTS.speak).toHaveBeenCalledTimes(1);
  expect(player.state.phase).toBe('playing');
});

test('does not even make an audio element for a story already known to need the browser voice', async () => {
  serverVoiceFor.mockResolvedValue(false);
  const player = createNarrationPlayer();
  await player.warm(4);
  await tick();
  await player.play(story(4));
  expect(audios).toHaveLength(0);
  expect(ssmlTTS.speak).toHaveBeenCalled();
});

test('asks the server about a story once, however often it is warmed or played', async () => {
  serverVoiceFor.mockResolvedValue(true);
  fetchNarration.mockResolvedValue({ size: 1 });
  const player = createNarrationPlayer();
  player.warm(5);
  player.warm(5);
  await player.play(story(5));
  expect(serverVoiceFor).toHaveBeenCalledTimes(1);
});

test('stopping while the narration is still being made cancels it for good', async () => {
  serverVoiceFor.mockResolvedValue(true);
  let cancelled;
  let release;
  fetchNarration.mockImplementation((id, { isCancelled }) => new Promise((resolve) => {
    cancelled = isCancelled;
    release = resolve;
  }));
  const player = createNarrationPlayer();
  const pending = player.play(story(6));
  await tick();
  expect(player.state.phase).toBe('preparing');
  player.stop();
  expect(player.state).toMatchObject({ phase: 'idle', postId: null });
  expect(cancelled()).toBe(true);
  release({ size: 1 }); // it arrives too late
  await pending;
  expect(player.state.phase).toBe('idle');
  expect(audios[0].src).not.toBe('blob:narration'); // nothing started playing
  expect(ssmlTTS.speak).not.toHaveBeenCalled();
});

test('playing another story stops the first, and the first one finishing late does nothing', async () => {
  serverVoiceFor.mockResolvedValue(true);
  let releaseFirst;
  fetchNarration
    .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
    .mockResolvedValueOnce({ size: 2 });
  const player = createNarrationPlayer();
  const first = player.play(story(7));
  await tick();
  const second = player.play(story(8));
  await second;
  expect(player.state).toMatchObject({ phase: 'playing', postId: 8 });
  releaseFirst({ size: 1 });
  await first;
  expect(player.state).toMatchObject({ phase: 'playing', postId: 8 }); // still the second story
  expect(audios[0].pause).toHaveBeenCalled(); // the first story's element was let go
});

test('an audio element that cannot play reports it and goes quiet', async () => {
  serverVoiceFor.mockResolvedValue(true);
  fetchNarration.mockResolvedValue({ size: 1 });
  const player = createNarrationPlayer();
  await player.play(story(9));
  audios[0].onerror();
  expect(player.state.phase).toBe('idle');
  expect(player.state.error).toMatch(/आवाज़/);
});

test('a browser voice that is missing reports it', async () => {
  serverVoiceFor.mockResolvedValue(false);
  const player = createNarrationPlayer();
  await player.play(story(10));
  ssmlTTS.speak.mock.calls[0][1].onError();
  expect(player.state.phase).toBe('idle');
  expect(player.state.error).toMatch(/हिंदी आवाज़/);
});

test('destroy leaves nothing playing and makes no state change', async () => {
  serverVoiceFor.mockResolvedValue(true);
  fetchNarration.mockResolvedValue({ size: 1 });
  const states = [];
  const player = createNarrationPlayer((s) => states.push(s));
  await player.play(story(11));
  const count = states.length;
  player.destroy();
  expect(states).toHaveLength(count);
  expect(ssmlTTS.cancel).toHaveBeenCalled();
  expect(audios[0].pause).toHaveBeenCalled();
});
