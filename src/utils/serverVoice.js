import { audioAPI } from '../services/api';

let enabled = null;

/**
 * Whether the server can narrate stories (asked once per page load, then remembered).
 * Resolves false when it cannot be reached, so the browser's own voice is used instead.
 */
export function serverVoiceEnabled() {
  if (!enabled) {
    enabled = audioAPI
      .status()
      .then((response) => Boolean(response.data && response.data.enabled))
      .catch(() => {
        enabled = null;
        return false;
      });
  }
  return enabled;
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
