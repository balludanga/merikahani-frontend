import {
  getChoice,
  getPrimary,
  lastWriteLanguage,
  rememberWriteLanguage,
  setChoice,
  setPrimary,
  startingLanguage,
  subscribe,
} from './store';

beforeEach(() => {
  localStorage.clear();
});

describe('the languages kept on this device', () => {
  test('nothing chosen is an empty list, which means every language', () => {
    expect(getChoice('read')).toEqual([]);
    expect(getChoice('write')).toEqual([]);
  });

  test('a choice is cleaned, kept, and announced to every page that shows it', () => {
    const heard = jest.fn();
    const stop = subscribe(heard);
    expect(setChoice('read', ['ta', 'zz', 'hi', 'ta'])).toEqual(['ta', 'hi']);
    expect(getChoice('read')).toEqual(['ta', 'hi']);
    expect(getChoice('write')).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    setChoice('read', ['bn']);
    expect(heard).toHaveBeenCalledTimes(1); // unsubscribed
  });

  test('a damaged saved value is an empty list, not an error', () => {
    localStorage.setItem('lekhani_read_langs', '{not json');
    expect(getChoice('read')).toEqual([]);
    localStorage.setItem('lekhani_read_langs', JSON.stringify('ta'));
    expect(getChoice('read')).toEqual([]);
  });

  test('a new story starts in the preferred language, else the one used last, else the first they write in, else Hindi', () => {
    expect(startingLanguage()).toBe('hi');
    setChoice('write', ['mr', 'ta']);
    expect(startingLanguage()).toBe('mr');
    rememberWriteLanguage('ta');
    expect(lastWriteLanguage()).toBe('ta');
    expect(startingLanguage()).toBe('ta');
    rememberWriteLanguage('not-a-language');
    expect(lastWriteLanguage()).toBe('ta');
    setPrimary('bn');
    expect(startingLanguage()).toBe('bn');
  });
});

describe('the preferred language', () => {
  test('is none until chosen, and only a real language can be chosen', () => {
    expect(getPrimary()).toBeNull();
    expect(setPrimary('ta')).toBe('ta');
    expect(getPrimary()).toBe('ta');
    expect(setPrimary('klingon')).toBeNull();
    expect(getPrimary()).toBeNull();
  });

  test('is always one of the languages they read in, when they read in some', () => {
    setChoice('read', ['hi', 'en']);
    setPrimary('ta');
    expect(getChoice('read')).toEqual(['ta', 'hi', 'en']);
    // none chosen = every language: nothing to add it to
    setChoice('read', []);
    setPrimary('mr');
    expect(getChoice('read')).toEqual([]);
    expect(getPrimary()).toBe('mr');
  });

  test('is forgotten when it is taken off the list of languages they read in', () => {
    setChoice('read', ['hi', 'ta']);
    setPrimary('ta');
    setChoice('read', ['hi']);
    expect(getPrimary()).toBeNull();
  });

  test('a change is announced like any other choice', () => {
    const heard = jest.fn();
    const stop = subscribe(heard);
    setPrimary('ta');
    expect(heard).toHaveBeenCalled();
    stop();
  });
});
