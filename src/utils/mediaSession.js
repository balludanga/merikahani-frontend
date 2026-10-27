/**
 * Lets the phone's lock screen, headphone buttons, keyboard media keys and the browser's media
 * notification control the player (the Media Session API: Chrome, Edge, Firefox, Safari). Where the
 * browser has none of it, every call does nothing.
 */
const supported = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator;

const ACTIONS = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto', 'stop'];

/**
 * `handlers`: { play, pause, previous, next, seekBy(seconds), seekTo(seconds), stop }.
 * Returns { story(post), playing(bool), position({duration, position, rate}), destroy() }.
 */
export function createMediaSession(handlers) {
  if (!supported()) {
    return { story() {}, playing() {}, position() {}, destroy() {} };
  }
  const session = navigator.mediaSession;
  const set = (action, handler) => {
    try {
      session.setActionHandler(action, handler);
    } catch (error) {
      // this browser does not know this action: fine
    }
  };
  set('play', () => handlers.play());
  set('pause', () => handlers.pause());
  set('previoustrack', () => handlers.previous());
  set('nexttrack', () => handlers.next());
  set('seekbackward', (details) => handlers.seekBy(-((details && details.seekOffset) || 15)));
  set('seekforward', (details) => handlers.seekBy((details && details.seekOffset) || 30));
  set('seekto', (details) => {
    if (details && typeof details.seekTime === 'number') handlers.seekTo(details.seekTime);
  });
  set('stop', () => handlers.stop());

  return {
    story(post) {
      if (!post || typeof window.MediaMetadata !== 'function') return;
      const cover = post.cover_image && !post.cover_image.startsWith('data:') ? post.cover_image : '/logo.png';
      try {
        session.metadata = new window.MediaMetadata({
          title: post.title || '',
          artist: (post.author && (post.author.full_name || post.author.username)) || '',
          album: 'लेखनी',
          artwork: [{ src: cover, sizes: '512x512' }],
        });
      } catch (error) {
        // artwork or metadata refused: the title alone is not worth failing for
      }
    },
    playing(isPlaying) {
      try {
        session.playbackState = isPlaying ? 'playing' : 'paused';
      } catch (error) {
        // fine
      }
    },
    position({ duration, position, rate }) {
      if (typeof session.setPositionState !== 'function' || !(duration > 0)) return;
      try {
        session.setPositionState({ duration, position: Math.min(Math.max(0, position), duration), playbackRate: rate || 1 });
      } catch (error) {
        // inconsistent numbers while seeking: skip this one
      }
    },
    destroy() {
      ACTIONS.forEach((action) => set(action, null));
      try {
        session.metadata = null;
        session.playbackState = 'none';
      } catch (error) {
        // fine
      }
    },
  };
}
