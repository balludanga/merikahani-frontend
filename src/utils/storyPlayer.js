/**
 * The audio player behind the home page's "लेखनी ऑडियो": a queue of stories read aloud one at a time.
 *
 * Each story is played from the server's narration (a natural Hindi voice, a real audio file: it can
 * be paused, sought, sped up and resumed) when the server has one or can make one, and from the
 * browser's own voice otherwise (which can be paused, sped up and followed, but not sought).
 *
 * Everything the screen needs is in `state`; everything the listener can do is a method. The
 * component on top only draws it.
 */
import { useEffect, useRef, useState } from 'react';
import ssmlTTS from './ssmlTTS';
import { fetchNarration, serverVoiceInfo, silentAudioUrl } from './serverVoice';
import { SPEEDS, clearPosition, loadPosition, loadPrefs, savePosition, savePrefs } from './playerPrefs';
import { createMediaSession } from './mediaSession';

export { SPEEDS };
export const SKIP_BACK = 15;
export const SKIP_FORWARD = 30;
export const SLEEP_MINUTES = [15, 30, 45, 60];

const NO_VOICE = 'इस उपकरण पर रचना सुनाई नहीं जा सकी। हो सकता है हिंदी आवाज़ (वॉइस) उपलब्ध न हो।';
const NO_PLAY = 'आवाज़ चलाई नहीं जा सकी।';
const RESUME_MIN = 10; // seconds: a place earlier than this is not worth going back to
const RESUME_END_MARGIN = 20; // and nor is one this close to the end
const FADE_MS = 2500;

/** A story is "active" while it is being made, played or held on pause. */
export const isActive = (state) => ['preparing', 'playing', 'paused'].includes(state.phase);

export function initialState(prefs = loadPrefs()) {
  return {
    index: 0, // which story of the queue the player is on
    phase: 'idle', // idle | preparing | playing | paused | ended
    source: null, // server | browser
    time: 0, // seconds into the story (server audio)
    duration: 0, // seconds (server audio)
    progress: 0, // 0..1 (for the browser voice: how many words have been read)
    prepared: 0, // 0..100 while the server makes the narration
    resumedFrom: 0, // seconds the story carried on from, if it did
    speed: prefs.speed,
    autoNext: prefs.autoNext,
    sleep: { mode: 'off', remaining: 0 }, // off | minutes | end
    ready: {}, // post id -> its narration already exists on the server
    error: '',
  };
}

export function createStoryPlayer(onChange = () => {}) {
  const prefs = loadPrefs();
  let state = initialState(prefs);
  let queue = [];
  let run = 0; // bumped by every play / stop, so a slow download can never start late
  let audio = null;
  let unlocked = false;
  let blobUrl = null;
  let ticker = 0;
  let lastSaved = 0;
  let sleepUntil = 0;
  let sleepTimer = 0;
  let fading = 0;
  let unlockTimer = 0;
  const info = new Map(); // post id -> Promise<{ enabled, ready }>
  let session = null;

  const set = (patch) => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const story = () => queue[state.index] || null;

  const lookup = (post) => {
    if (!info.has(post.id)) {
      info.set(post.id, serverVoiceInfo(post.id).then((result) => {
        if (result.ready && !state.ready[post.id]) set({ ready: { ...state.ready, [post.id]: true } });
        return result;
      }));
    }
    return info.get(post.id);
  };

  // --- the audio element -----------------------------------------------------------------------

  const ensureAudio = () => {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'auto';
    audio.preservesPitch = true; // faster or slower, never chipmunk
    audio.webkitPreservesPitch = true;
    return audio;
  };

  const releaseBlob = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  };

  const stopTicker = () => {
    clearInterval(ticker);
    ticker = 0;
  };

  const remember = (force = false) => {
    const post = story();
    if (!post || !audio || state.source !== 'server') return;
    const now = Date.now();
    if (!force && now - lastSaved < 5000) return;
    lastSaved = now;
    if (audio.currentTime > RESUME_MIN) savePosition(post.id, audio.currentTime);
  };

  const startTicker = () => {
    stopTicker();
    ticker = setInterval(() => {
      if (!audio || state.source !== 'server' || state.phase !== 'playing') return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : state.duration;
      set({ time: audio.currentTime, duration, progress: duration > 0 ? audio.currentTime / duration : 0 });
      session.position({ duration, position: audio.currentTime, rate: state.speed });
      remember();
    }, 250);
  };

  /** Stop everything that is sounding or counting, without changing what the screen shows. */
  const halt = () => {
    run += 1;
    stopTicker();
    clearInterval(fading);
    ssmlTTS.cancel();
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
    }
  };

  const fail = (message) => {
    halt();
    set({ phase: 'idle', source: null, error: message });
    session.playing(false);
  };

  // --- the sleep timer -------------------------------------------------------------------------

  const clearSleep = () => {
    clearInterval(sleepTimer);
    sleepTimer = 0;
    sleepUntil = 0;
  };

  const fadeOutAndPause = () => {
    if (!audio || state.source !== 'server') {
      player.pause();
      return;
    }
    const startVolume = audio.volume;
    const steps = 20;
    let step = 0;
    clearInterval(fading);
    fading = setInterval(() => {
      step += 1;
      audio.volume = Math.max(0, startVolume * (1 - step / steps));
      if (step >= steps) {
        clearInterval(fading);
        player.pause();
        audio.volume = startVolume;
      }
    }, FADE_MS / steps);
  };

  // --- finishing a story -----------------------------------------------------------------------

  const onEnded = (mine) => {
    if (mine !== run) return;
    const post = story();
    if (post) clearPosition(post.id);
    stopTicker();
    const sleepAtEnd = state.sleep.mode === 'end';
    if (sleepAtEnd) clearSleep();
    set({ phase: 'ended', time: state.duration, progress: 1, sleep: sleepAtEnd ? { mode: 'off', remaining: 0 } : state.sleep });
    session.playing(false);
    if (!sleepAtEnd && state.autoNext && state.index + 1 < queue.length) player.play(state.index + 1);
  };

  // --- playing ---------------------------------------------------------------------------------

  const playFromServer = async (mine, post) => {
    const mp3 = await fetchNarration(post.id, {
      isCancelled: () => mine !== run,
      onProgress: (prepared) => {
        if (mine === run) set({ prepared });
      },
    });
    if (mine !== run || !mp3) return true; // cancelled: nothing more to do
    const element = ensureAudio();
    releaseBlob();
    blobUrl = URL.createObjectURL(mp3);
    element.src = blobUrl;
    element.playbackRate = state.speed;
    await new Promise((resolve) => {
      if (element.readyState >= 1 && Number.isFinite(element.duration)) {
        resolve();
        return;
      }
      element.addEventListener('loadedmetadata', resolve, { once: true });
      element.addEventListener('error', resolve, { once: true });
    });
    if (mine !== run) return true;
    const duration = Number.isFinite(element.duration) ? element.duration : 0;
    const saved = loadPosition(post.id);
    let resumedFrom = 0;
    if (saved > RESUME_MIN && (!duration || saved < duration - RESUME_END_MARGIN)) {
      element.currentTime = saved;
      resumedFrom = saved;
    }
    element.volume = 1;
    // Tied to THIS play: a late event from a story that has since been left does nothing.
    element.onended = () => onEnded(mine);
    element.onerror = () => {
      if (mine === run && isActive(state)) fail(NO_PLAY);
    };
    await element.play();
    if (mine !== run) return true;
    lastSaved = Date.now();
    set({
      phase: 'playing', source: 'server', duration, time: element.currentTime,
      progress: duration > 0 ? element.currentTime / duration : 0, resumedFrom,
      ready: { ...state.ready, [post.id]: true },
    });
    startTicker();
    return true;
  };

  const playFromBrowser = (mine, post) => {
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
    releaseBlob();
    ssmlTTS.setRateScale(state.speed);
    let words = 0;
    set({ phase: 'playing', source: 'browser', time: 0, duration: 0, progress: 0, resumedFrom: 0 });
    ssmlTTS.speak(post.content || '', {
      lang: 'hi-IN',
      useSSML: false,
      title: post.title,
      onTokens: (tokens) => {
        words = tokens.words.length;
      },
      onWord: (index) => {
        if (mine === run && words > 0) set({ progress: Math.min(1, (index + 1) / words) });
      },
      onEnd: () => onEnded(mine),
      onError: () => {
        if (mine === run) fail(NO_VOICE);
      },
    });
  };

  const player = {
    get state() {
      return state;
    },

    get story() {
      return story();
    },

    get queue() {
      return queue;
    },

    /** The stories to play, in order. A different list starts the player afresh. */
    setQueue(stories) {
      const same = stories.length === queue.length && stories.every((item, i) => item.id === queue[i].id);
      queue = stories;
      if (same) return;
      halt();
      clearSleep();
      info.clear();
      set({ ...initialState({ speed: state.speed, autoNext: state.autoNext }), ready: {} });
      stories.slice(0, 12).forEach(lookup);
      session.story(story());
    },

    /** Put the player on a story without playing it. */
    select(index) {
      if (index < 0 || index >= queue.length) return;
      halt();
      set({ index, phase: 'idle', source: null, time: 0, duration: 0, progress: 0, prepared: 0, resumedFrom: 0, error: '' });
      session.story(story());
      session.playing(false);
    },

    /** Play the story at `index` (the one it is on, by default). */
    async play(index = state.index) {
      const post = queue[index];
      if (!post) return;
      halt();
      const mine = run;
      set({
        index, phase: 'preparing', source: null, time: 0, duration: 0, progress: 0,
        prepared: 0, resumedFrom: 0, error: '',
      });
      session.story(post);

      // Made at the tap and then kept: iOS only lets a page play audio it started from a tap, and the
      // narration may arrive seconds later. Playing a moment of silence now unlocks the element for
      // this story and for every one after it (so "next" and auto-next can start by themselves).
      if (!unlocked) {
        const element = ensureAudio();
        const silent = silentAudioUrl();
        element.src = silent;
        element.play().catch(() => {});
        unlocked = true;
        unlockTimer = setTimeout(() => URL.revokeObjectURL(silent), 2000);
      }

      const { enabled, ready } = await lookup(post);
      if (mine !== run) return;
      if (enabled || ready) {
        try {
          await playFromServer(mine, post);
          if (mine === run) {
            session.playing(true);
            session.position({ duration: state.duration, position: state.time, rate: state.speed });
          }
          return;
        } catch (error) {
          if (mine !== run) return;
          // Not set up, allowance used, very long story, offline...: the browser's own voice.
        }
      }
      if (mine !== run) return;
      playFromBrowser(mine, post);
      session.playing(true);
    },

    pause() {
      if (state.phase !== 'playing') return;
      if (state.source === 'server' && audio) {
        audio.pause();
        remember(true);
      } else if (state.source === 'browser') {
        ssmlTTS.pause();
      }
      set({ phase: 'paused' });
      session.playing(false);
    },

    resume() {
      if (state.phase !== 'paused') return;
      if (state.source === 'server' && audio) {
        audio.volume = 1;
        audio.play().catch(() => fail(NO_PLAY));
        lastSaved = Date.now();
      } else if (state.source === 'browser') {
        ssmlTTS.resume();
      }
      set({ phase: 'playing' });
      session.playing(true);
    },

    /** The big button: play, pause or resume, whichever makes sense; or cancel while being made. */
    toggle() {
      if (state.phase === 'playing') player.pause();
      else if (state.phase === 'paused') player.resume();
      else if (state.phase === 'preparing') player.stop();
      else player.play(state.index);
    },

    stop() {
      remember(true);
      halt();
      set({ phase: 'idle', source: null, time: 0, progress: 0, prepared: 0, resumedFrom: 0 });
      session.playing(false);
    },

    next() {
      if (state.index + 1 >= queue.length) return;
      if (isActive(state) || state.phase === 'ended') player.play(state.index + 1);
      else player.select(state.index + 1);
    },

    /** Like every player: a second press near the start goes to the previous story, otherwise restarts this one. */
    previous() {
      if (state.source === 'server' && state.time > 5) {
        player.seekTo(0);
        return;
      }
      if (state.index === 0) {
        if (state.source === 'server') player.seekTo(0);
        return;
      }
      if (isActive(state) || state.phase === 'ended') player.play(state.index - 1);
      else player.select(state.index - 1);
    },

    /** Server audio only: move to `seconds` into the story. */
    seekTo(seconds) {
      if (state.source !== 'server' || !audio || !(state.duration > 0)) return;
      const to = Math.min(Math.max(0, seconds), state.duration);
      audio.currentTime = to;
      set({ time: to, progress: to / state.duration });
      session.position({ duration: state.duration, position: to, rate: state.speed });
      remember(true);
    },

    skip(seconds) {
      player.seekTo((state.source === 'server' && audio ? audio.currentTime : state.time) + seconds);
    },

    setSpeed(speed) {
      if (!SPEEDS.includes(speed)) return;
      if (audio) audio.playbackRate = speed;
      ssmlTTS.setRateScale(speed);
      set({ speed });
      savePrefs({ speed, autoNext: state.autoNext });
    },

    cycleSpeed() {
      player.setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]);
    },

    setAutoNext(autoNext) {
      set({ autoNext: Boolean(autoNext) });
      savePrefs({ speed: state.speed, autoNext: Boolean(autoNext) });
    },

    /** mode: 'off', 'minutes' (with `minutes`), or 'end' (after the story that is playing). */
    setSleep(mode, minutes = 0) {
      clearSleep();
      if (mode === 'minutes' && minutes > 0) {
        sleepUntil = Date.now() + minutes * 60000;
        set({ sleep: { mode: 'minutes', remaining: minutes * 60 } });
        sleepTimer = setInterval(() => {
          const remaining = Math.max(0, Math.round((sleepUntil - Date.now()) / 1000));
          if (remaining <= 0) {
            clearSleep();
            set({ sleep: { mode: 'off', remaining: 0 } });
            if (state.phase === 'playing') fadeOutAndPause();
            return;
          }
          set({ sleep: { mode: 'minutes', remaining } });
        }, 1000);
      } else if (mode === 'end') {
        set({ sleep: { mode: 'end', remaining: 0 } });
      } else {
        set({ sleep: { mode: 'off', remaining: 0 } });
      }
    },

    /** Leave nothing sounding or counting (the page is going away). */
    destroy() {
      remember(true);
      halt();
      clearSleep();
      clearTimeout(unlockTimer);
      releaseBlob();
      session.destroy();
      if (audio) {
        audio.removeAttribute('src');
        audio = null;
      }
    },
  };

  session = createMediaSession({
    play: () => (state.phase === 'paused' ? player.resume() : player.play(state.index)),
    pause: () => player.pause(),
    previous: () => player.previous(),
    next: () => player.next(),
    seekBy: (seconds) => player.skip(seconds),
    seekTo: (seconds) => player.seekTo(seconds),
    stop: () => player.stop(),
  });

  return player;
}

/** [state, player] for a component: the player lives as long as the component and stops with it. */
export function useStoryPlayer(stories) {
  const [state, setState] = useState(() => initialState());
  const holder = useRef(null);
  if (!holder.current) holder.current = createStoryPlayer(setState);
  useEffect(() => {
    holder.current.setQueue(stories);
  }, [stories]);
  useEffect(() => () => holder.current.destroy(), []);
  return [state, holder.current];
}
