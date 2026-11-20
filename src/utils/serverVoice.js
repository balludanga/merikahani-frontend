import { audioAPI } from '../services/api';

/**
 * What the server can do for this story: `enabled` (a new narration can be made now) and `ready` (its
 * narration already exists, and plays even on a day the free allowance is used up). `covered`: the
 * server voice is the voice for this story's language, so when it cannot make the narration (a limit
 * is hit) NOTHING is played: the device's own voice never stands in for it (see `mayUseDeviceVoice`).
 * All false when the server cannot be reached at all, so the browser's own voice is used instead.
 */
export function serverVoiceInfo(postId) {
  return audioAPI
    .status(postId)
    .then((response) => ({
      enabled: Boolean(response.data && response.data.enabled),
      ready: Boolean(response.data && response.data.ready),
      covered: Boolean(response.data && response.data.covered),
    }))
    .catch(() => ({ enabled: false, ready: false, covered: false }));
}

/**
 * May the device's own voice read this story when the server voice cannot? Only for a language the
 * server voice does not cover (Bodo, Dogri, Konkani, Sanskrit, ...). For a language it does cover, a
 * limit on the free service means silence, not a stand-in: the paid service will lift the limits.
 */
export const mayUseDeviceVoice = (info) => !(info && info.covered);

export const SERVER_VOICE_BUSY = 'आवाज़ अभी उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।';
export const SIGN_IN_TO_LISTEN = 'पूरी रचना सुनने के लिए साइन इन करें';

/** What to tell a listener when the server voice could not make the narration (`error` is what the request raised). */
export const whyNoServerVoice = (error) =>
  error && error.response && error.response.status === 401 ? SIGN_IN_TO_LISTEN : SERVER_VOICE_BUSY;

/** Whether the server voice can be used for this story at all. */
export function serverVoiceFor(postId) {
  return serverVoiceInfo(postId).then((info) => info.enabled || info.ready);
}

/** When each word of a narration is spoken, or null if the server has no timings for it. */
export function fetchTimings(postId) {
  return audioAPI
    .timings(postId)
    .then((response) => response.data)
    .catch(() => null);
}

/**
 * A moment of silence as a playable address. iOS Safari only lets a page play audio from
 * inside a tap; playing this at the tap "unlocks" the audio element so the real narration,
 * which arrives seconds later, may start. (A blob: address, because the page's security
 * policy does not allow data: for media.)
 */
export function silentAudioUrl() {
  const samples = 800;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const POLL_MS = 2500;
const GIVE_UP_MS = 6 * 60 * 1000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The story's narration as an MP3 Blob. The server makes it in the background the first
 * time (202 + progress), so ask again until it is ready. Resolves null if `isCancelled()`
 * turns true meanwhile; rejects when the server cannot (503 / 413 / 401...) or takes too long.
 */
export async function fetchNarration(postId, { isCancelled, onProgress }) {
  const started = Date.now();
  for (;;) {
    const response = await audioAPI.forPost(postId);
    if (isCancelled()) return null;
    if (response.status === 200) return response.data;
    try {
      const info = JSON.parse(await response.data.text());
      if (info && info.total) onProgress(Math.round((100 * info.done) / info.total));
    } catch (error) {
      // progress is only a courtesy
    }
    if (Date.now() - started > GIVE_UP_MS) throw new Error('narration took too long');
    await sleep(POLL_MS);
    if (isCancelled()) return null;
  }
}
