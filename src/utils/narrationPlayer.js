/**
 * Plays a story aloud: the server's narration in its natural Hindi voice when it can make (or
 * already has) one, and the browser's own voice when it cannot. One player plays one story at a
 * time; starting another stops the first.
 *
 * This is the play / stop / fall-back logic the home page's audio card uses. (The story page has
 * its own copy because it also drives the word-by-word highlight; keep the two in step.)
 */
import { useEffect, useRef, useState } from 'react';
import ssmlTTS from './ssmlTTS';
import { fetchNarration, serverVoiceFor, silentAudioUrl } from './serverVoice';

export const IDLE = { phase: 'idle', progress: 0, postId: null, error: '' };

const NO_VOICE = 'इस उपकरण पर रचना सुनाई नहीं जा सकी। हो सकता है हिंदी आवाज़ (वॉइस) उपलब्ध न हो।';
const NO_PLAY = 'आवाज़ चलाई नहीं जा सकी।';

/**
 * `onChange(state)` is called whenever the state changes: { phase: 'idle' | 'preparing' | 'playing',
 * progress (0-100 while the server makes the narration), postId, error }.
 */
export function createNarrationPlayer(onChange = () => {}) {
  let state = IDLE;
  let run = 0; // bumped by every play and stop, so a slow download can never start late
  let audio = null;
  const status = new Map(); // post id -> whether the server voice can be used (or the promise of it)

  const set = (patch) => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const release = () => {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    if (audio.src && audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
    audio = null;
  };

  const halt = () => {
    run += 1;
    ssmlTTS.cancel();
    release();
  };

  const warm = (postId) => {
    if (!status.has(postId)) status.set(postId, serverVoiceFor(postId).then((ok) => { status.set(postId, ok); return ok; }));
    return status.get(postId);
  };

  const player = {
    get state() {
      return state;
    },

    /** Ask ahead whether the server voice can read this story, so the tap itself need not wait. */
    warm,

    stop() {
      halt();
      set({ ...IDLE });
    },

    /** Stop for good (the page is going away): no state change, nothing left running. */
    destroy() {
      halt();
    },

    /** Play a story ({ id, title, content }); `onEnd(post)` runs when it finishes by itself. */
    async play(post, { onEnd = () => {} } = {}) {
      halt();
      const mine = run;
      set({ phase: 'preparing', progress: 0, postId: post.id, error: '' });

      // Made at the tap: iOS only plays audio the page started from a tap, and the narration may
      // arrive seconds later. Playing a moment of silence now unlocks it.
      const known = status.get(post.id);
      let silent = null;
      if (known !== false) {
        audio = new Audio();
        silent = silentAudioUrl();
        audio.src = silent;
        audio.play().catch(() => {});
      }
      const mineAudio = audio;
      const cleanSilent = () => {
        if (silent) URL.revokeObjectURL(silent);
        silent = null;
      };

      const usable = await Promise.resolve(known === undefined ? warm(post.id) : known);
      if (mine !== run) {
        cleanSilent();
        return;
      }

      if (usable && mineAudio) {
        try {
          const mp3 = await fetchNarration(post.id, {
            isCancelled: () => mine !== run,
            onProgress: (progress) => {
              if (mine === run) set({ progress });
            },
          });
          cleanSilent();
          if (mine !== run || !mp3) return;
          mineAudio.pause();
          mineAudio.src = URL.createObjectURL(mp3);
          mineAudio.onended = () => {
            if (mine !== run) return;
            halt();
            set({ ...IDLE });
            onEnd(post);
          };
          mineAudio.onerror = () => {
            if (mine !== run) return;
            halt();
            set({ ...IDLE, error: NO_PLAY });
          };
          await mineAudio.play();
          if (mine === run) set({ phase: 'playing' });
          return;
        } catch (error) {
          cleanSilent();
          if (mine !== run) return;
          // Not set up, allowance used, very long story, offline...: the browser's own voice.
        }
      } else {
        cleanSilent();
      }

      if (mine !== run) return;
      release();
      set({ phase: 'playing' });
      ssmlTTS.speak(post.content || '', {
        lang: 'hi-IN',
        useSSML: false,
        title: post.title,
        onEnd: () => {
          if (mine !== run) return;
          set({ ...IDLE });
          onEnd(post);
        },
        onError: () => {
          if (mine !== run) return;
          set({ ...IDLE, error: NO_VOICE });
        },
      });
    },
  };
  return player;
}

/** [state, player] for a component: the player lives as long as the component and stops with it. */
export function useNarrationPlayer() {
  const [state, setState] = useState(IDLE);
  const holder = useRef(null);
  if (!holder.current) holder.current = createNarrationPlayer(setState);
  useEffect(() => () => holder.current.destroy(), []);
  return [state, holder.current];
}
