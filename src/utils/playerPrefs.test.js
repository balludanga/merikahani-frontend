import {
  SPEEDS, clearPosition, loadPosition, loadPrefs, savePosition, savePrefs,
} from './playerPrefs';
import { createMediaSession } from './mediaSession';
import { formatTime } from '../components/StoryPlayer';

beforeEach(() => window.localStorage.clear());

describe('saved preferences', () => {
  test('start at normal speed with auto-next off, and remember what the listener chose', () => {
    expect(loadPrefs()).toEqual({ speed: 1, autoNext: false });
    savePrefs({ speed: 1.5, autoNext: true });
    expect(loadPrefs()).toEqual({ speed: 1.5, autoNext: true });
  });

  test('ignore a speed that is not on offer and damaged storage', () => {
    window.localStorage.setItem('lekhani_player_prefs', JSON.stringify({ speed: 9, autoNext: 'yes' }));
    expect(loadPrefs()).toEqual({ speed: 1, autoNext: false });
    window.localStorage.setItem('lekhani_player_prefs', '{not json');
    expect(loadPrefs()).toEqual({ speed: 1, autoNext: false });
    expect(SPEEDS).toEqual([0.75, 1, 1.25, 1.5, 2]);
  });

  test('keep the place in each story, and forget it on request', () => {
    expect(loadPosition(7)).toBe(0);
    savePosition(7, 83.456);
    expect(loadPosition(7)).toBe(83.5);
    clearPosition(7);
    expect(loadPosition(7)).toBe(0);
  });

  test('remember only the most recent forty stories', () => {
    for (let id = 1; id <= 45; id += 1) {
      jest.spyOn(Date, 'now').mockReturnValue(1000 + id);
      savePosition(id, 30);
    }
    Date.now.mockRestore();
    expect(loadPosition(1)).toBe(0); // the oldest were let go
    expect(loadPosition(45)).toBe(30);
    expect(Object.keys(JSON.parse(window.localStorage.getItem('lekhani_player_positions')))).toHaveLength(40);
  });

  test('work when storage is not available at all', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(loadPrefs()).toEqual({ speed: 1, autoNext: false });
    expect(() => savePrefs({ speed: 1.25, autoNext: false })).not.toThrow();
    expect(() => savePosition(1, 50)).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
  });
});

describe('media session', () => {
  test('does nothing, quietly, in a browser without it', () => {
    const none = createMediaSession({});
    expect(() => {
      none.story({ title: 'x' });
      none.playing(true);
      none.position({ duration: 10, position: 1, rate: 1 });
      none.destroy();
    }).not.toThrow();
  });

  test('ignores a browser that refuses an action or a position', () => {
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        setActionHandler: jest.fn(() => {
          throw new Error('unsupported action');
        }),
        setPositionState: jest.fn(() => {
          throw new Error('bad position');
        }),
      },
    });
    const session = createMediaSession({ play() {}, pause() {}, previous() {}, next() {}, seekBy() {}, seekTo() {}, stop() {} });
    expect(() => session.position({ duration: 10, position: 12, rate: 1 })).not.toThrow();
    expect(() => session.destroy()).not.toThrow();
    delete navigator.mediaSession;
  });

  test('does not give the browser a position for a story of unknown length', () => {
    const setPositionState = jest.fn();
    Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: { setActionHandler: jest.fn(), setPositionState } });
    createMediaSession({}).position({ duration: 0, position: 0, rate: 1 });
    expect(setPositionState).not.toHaveBeenCalled();
    delete navigator.mediaSession;
  });
});

describe('time display', () => {
  test('shows minutes and seconds, and hours when there are any', () => {
    expect([0, 5, 83, 600, 3725, -4, NaN].map(formatTime)).toEqual(['0:00', '0:05', '1:23', '10:00', '1:02:05', '0:00', '0:00']);
  });
});
