/**
 * What the audio player remembers between visits, kept in this browser only: the speed, whether to
 * move on to the next story by itself, and where each story was left (so it can carry on from there).
 * Storage can be missing or full (private windows), so every call is guarded and the player works without it.
 */
const PREFS_KEY = 'lekhani_player_prefs';
const POSITIONS_KEY = 'lekhani_player_positions';
const MAX_POSITIONS = 40;

export const DEFAULT_PREFS = { speed: 1, autoNext: false };
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // no storage: fine
  }
};

export function loadPrefs() {
  const saved = read(PREFS_KEY, {});
  return {
    speed: SPEEDS.includes(saved.speed) ? saved.speed : DEFAULT_PREFS.speed,
    autoNext: saved.autoNext === true,
  };
}

export function savePrefs(prefs) {
  write(PREFS_KEY, { speed: prefs.speed, autoNext: prefs.autoNext });
}

/** Seconds into a story where the listener stopped, or 0. */
export function loadPosition(postId) {
  const entry = read(POSITIONS_KEY, {})[postId];
  return entry && entry.t > 0 ? entry.t : 0;
}

export function savePosition(postId, seconds) {
  const all = read(POSITIONS_KEY, {});
  all[postId] = { t: Math.round(seconds * 10) / 10, at: Date.now() };
  const ids = Object.keys(all);
  if (ids.length > MAX_POSITIONS) {
    ids.sort((a, b) => all[a].at - all[b].at).slice(0, ids.length - MAX_POSITIONS).forEach((id) => delete all[id]);
  }
  write(POSITIONS_KEY, all);
}

export function clearPosition(postId) {
  const all = read(POSITIONS_KEY, {});
  if (all[postId]) {
    delete all[postId];
    write(POSITIONS_KEY, all);
  }
}
