import { fetchNarration, fetchTimings, serverVoiceFor } from './serverVoice';
import { audioAPI } from '../services/api';

jest.mock('../services/api', () => ({ audioAPI: { forPost: jest.fn(), status: jest.fn(), timings: jest.fn() } }));

const working = (done, total) => ({ status: 202, data: { text: async () => JSON.stringify({ state: 'working', done, total }) } });
const ready = (blob) => ({ status: 200, data: blob });

beforeEach(() => {
  jest.useFakeTimers();
  audioAPI.forPost.mockReset();
});
afterEach(() => jest.useRealTimers());

// Let the awaited promises settle, then move the fake clock past one poll interval.
const tick = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  jest.advanceTimersByTime(2600);
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

test('asks again while the server is working, reports progress, returns the audio', async () => {
  const mp3 = { size: 1 };
  audioAPI.forPost
    .mockResolvedValueOnce(working(1, 4))
    .mockResolvedValueOnce(working(3, 4))
    .mockResolvedValueOnce(ready(mp3));
  const seen = [];
  const promise = fetchNarration(7, { isCancelled: () => false, onProgress: (p) => seen.push(p) });
  await tick();
  await tick();
  await expect(promise).resolves.toBe(mp3);
  expect(seen).toEqual([25, 75]);
  expect(audioAPI.forPost).toHaveBeenCalledTimes(3);
});

test('stops asking once the reader has cancelled', async () => {
  audioAPI.forPost.mockResolvedValue(working(0, 3));
  let cancelled = false;
  const promise = fetchNarration(7, { isCancelled: () => cancelled, onProgress: () => {} });
  await tick();
  cancelled = true;
  await tick();
  await expect(promise).resolves.toBeNull();
  expect(audioAPI.forPost.mock.calls.length).toBeLessThanOrEqual(2);
});

test('passes a refusal (quota used, not set up) on so the browser voice can take over', async () => {
  audioAPI.forPost.mockRejectedValue({ response: { status: 503 } });
  await expect(fetchNarration(7, { isCancelled: () => false, onProgress: () => {} })).rejects.toEqual({
    response: { status: 503 },
  });
});

describe('serverVoiceFor', () => {
  beforeEach(() => jest.useRealTimers());

  test('is usable when a new narration can be made, or this story already has one', async () => {
    audioAPI.status.mockResolvedValue({ data: { enabled: true, ready: false } });
    await expect(serverVoiceFor(3)).resolves.toBe(true);
    audioAPI.status.mockResolvedValue({ data: { enabled: false, ready: true } });
    await expect(serverVoiceFor(3)).resolves.toBe(true);
    expect(audioAPI.status).toHaveBeenLastCalledWith(3);
  });

  test('is not usable when neither is true, or the server cannot be reached', async () => {
    audioAPI.status.mockResolvedValue({ data: { enabled: false, ready: false } });
    await expect(serverVoiceFor(3)).resolves.toBe(false);
    audioAPI.status.mockRejectedValue(new Error('offline'));
    await expect(serverVoiceFor(3)).resolves.toBe(false);
  });
});

describe('fetchTimings', () => {
  test('returns the word times, or null when there are none', async () => {
    audioAPI.timings.mockResolvedValue({ data: { w: ['एक'], t: [0], title: 0, d: 1 } });
    await expect(fetchTimings(3)).resolves.toEqual({ w: ['एक'], t: [0], title: 0, d: 1 });
    audioAPI.timings.mockRejectedValue({ response: { status: 404 } });
    await expect(fetchTimings(3)).resolves.toBeNull();
  });
});
