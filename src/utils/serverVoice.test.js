import { fetchNarration } from './serverVoice';
import { audioAPI } from '../services/api';

jest.mock('../services/api', () => ({ audioAPI: { forPost: jest.fn(), status: jest.fn() } }));

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
