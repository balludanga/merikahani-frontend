import { Composer, assemble } from './composer';
import { Engine } from './engine';

// A small word list keeps these tests exact. (The real list is checked in lexicon.test.js.)
const WORDS = `कहानी 62
कहाँ 60
कहा 66
कह 58
कहना 58
कहने 56
कहीं 57
कल 56
कर 70
करना 62
क्या 70
नहीं 72
नही 30
सुंदर 52
हिंदी 55
उसने 55
बारिश 50`;

function makeEngine() {
  const engine = new Engine();
  engine.setLexiconText(WORDS.split('\n').map((l) => l.replace(' ', '\t')).join('\n'));
  return engine;
}

/** A text field made of a string, with the same contract as the real hosts. */
class StringHost {
  constructor(text = '', caret = text.length) {
    this.value = text;
    this.pos = caret;
    this.end = caret;
    this.max = undefined;
    this.allowed = true;
    this.element = null;
  }

  caret() {
    return this.pos === this.end ? this.pos : null;
  }

  collapse() {
    if (this.pos !== this.end) this.replace(this.pos, this.end, '');
    return this.pos;
  }

  text(from, to) {
    return this.value.slice(from, to);
  }

  replace(from, to, text) {
    this.value = this.value.slice(0, from) + text + this.value.slice(to);
    this.pos = this.end = from + text.length;
  }

  canCompose() {
    return this.allowed;
  }

  fits(from, to, text) {
    return this.max === undefined || this.value.length - (to - from) + text.length <= this.max;
  }

  rect() {
    return { left: 0, top: 0, bottom: 10 };
  }
}

class FakeBox {
  constructor() {
    this.view = null;
  }

  show(view) {
    this.view = view;
  }

  hide() {
    this.view = null;
  }
}

function setup(text = '') {
  const engine = makeEngine();
  const host = new StringHost(text);
  const box = new FakeBox();
  const composer = new Composer(host, { engine, box });
  return { engine, host, box, composer };
}

/** Press a key the way a browser would: offer it to the composer, then do its default if nobody claimed it. */
function press(ctx, key, mods = {}) {
  const event = {
    key,
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    defaultPrevented: false,
    stopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
    ...mods,
  };
  const handled = ctx.composer.keydown(event);
  if (!handled && !event.defaultPrevented) {
    const { host } = ctx;
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) host.replace(host.pos, host.end, key);
    else if (key === 'Enter') host.replace(host.pos, host.end, '\n');
    else if (key === 'Backspace' && host.pos > 0) host.replace(host.pos === host.end ? host.pos - 1 : host.pos, host.end, '');
  }
  return event;
}

const type = (ctx, letters) => [...letters].forEach((ch) => press(ctx, ch));

describe('typing a word', () => {
  test('the Devanagari appears as the letters are typed, not when the word ends', () => {
    const ctx = setup();
    type(ctx, 'k');
    expect(ctx.host.value).toBe('क');
    type(ctx, 'ah');
    expect(ctx.host.value).toBe('कह');
    type(ctx, 'ani');
    expect(ctx.host.value).toBe('कहानी');
    expect(ctx.host.pos).toBe(5);
    expect(ctx.composer.active).toBe(true);
  });

  test('a candidate list is shown while typing and gone afterwards', () => {
    const ctx = setup();
    type(ctx, 'kah');
    expect(ctx.box.view.items.map((i) => i.text)).toEqual(expect.arrayContaining(['कह', 'कहानी', 'कहना']));
    expect(ctx.box.view.typed).toBe('kah');
    press(ctx, ' ');
    expect(ctx.box.view).toBeNull();
  });

  test('space accepts the word and types the space', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    press(ctx, ' ');
    expect(ctx.host.value).toBe('कहानी ');
    expect(ctx.composer.active).toBe(false);
    type(ctx, 'kya');
    expect(ctx.host.value).toBe('कहानी क्या');
  });

  test('punctuation accepts the word and then types itself', () => {
    const ctx = setup();
    type(ctx, 'nahi');
    const dot = press(ctx, ',');
    expect(dot.defaultPrevented).toBe(false); // the browser types the comma
    expect(ctx.host.value).toBe('नहीं,');
  });

  test('typing in the middle of existing text leaves the rest alone', () => {
    const ctx = setup('अब  है');
    ctx.host.pos = ctx.host.end = 3;
    type(ctx, 'kya');
    expect(ctx.host.value).toBe('अब क्या है');
  });

  test('a capital letter starts a word like any other', () => {
    const ctx = setup();
    type(ctx, 'Kahani');
    expect(ctx.host.value).toBe('कहानी');
  });
});

describe('correcting a word', () => {
  test('Backspace takes back the last LETTER typed, not a Devanagari sign', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    press(ctx, 'Backspace');
    expect(ctx.composer.currentRaw()).toBe('kahan');
    expect(ctx.host.value).toBe('कहाँ');
    press(ctx, 'Backspace');
    press(ctx, 'Backspace');
    press(ctx, 'Backspace');
    expect(ctx.composer.currentRaw()).toBe('ka');
    expect(ctx.host.value).toBe('का');
    press(ctx, 'Backspace');
    expect(ctx.host.value).toBe('क');
    press(ctx, 'Backspace');
    expect(ctx.host.value).toBe('');
    expect(ctx.composer.active).toBe(false);
  });

  test('Escape keeps the letters as typed, in English', () => {
    const ctx = setup();
    type(ctx, 'hello');
    const esc = press(ctx, 'Escape');
    expect(ctx.host.value).toBe('hello');
    expect(esc.stopped).toBe(true);
    expect(ctx.composer.active).toBe(false);
    expect(ctx.engine.liveKeys).toBe(true); // a real keyboard: the at-the-space conversion stays off
    // the rest of the English word is not converted
    type(ctx, 'world');
    expect(ctx.host.value).toBe('helloworld');
    press(ctx, ' ');
    type(ctx, 'kya');
    expect(ctx.host.value).toBe('helloworld क्या');
  });

  test('Backspace straight after accepting a word reopens it', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    press(ctx, ' ');
    expect(ctx.host.value).toBe('कहानी ');
    press(ctx, 'Backspace');
    expect(ctx.host.value).toBe('कहानी');
    expect(ctx.composer.active).toBe(true);
    expect(ctx.composer.currentRaw()).toBe('kahani');
    expect(ctx.box.view.items[ctx.box.view.index].text).toBe('कहानी');
    // one more takes back a letter
    press(ctx, 'Backspace');
    expect(ctx.host.value).toBe('कहाँ');
  });

  test('Backspace does not reopen a word when the caret is somewhere else', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    press(ctx, ' ');
    ctx.host.pos = ctx.host.end = 3; // the writer clicked into the middle of the word
    press(ctx, 'Backspace');
    expect(ctx.composer.active).toBe(false);
    expect(ctx.host.value).toBe('कहनी ');
  });

  test('Backspace reopens only the newest word', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    press(ctx, ' ');
    type(ctx, 'kya');
    press(ctx, ' ');
    press(ctx, 'Backspace');
    expect(ctx.composer.currentRaw()).toBe('kya');
    expect(ctx.host.value).toBe('कहानी क्या');
  });
})

describe('choosing another candidate', () => {
  test('the arrow keys walk through the candidates and the text follows', () => {
    const ctx = setup();
    type(ctx, 'kahan');
    const first = ctx.host.value;
    const down = press(ctx, 'ArrowDown');
    expect(down.defaultPrevented).toBe(true);
    expect(ctx.host.value).not.toBe(first);
    expect(ctx.box.view.index).toBe(1);
    expect(ctx.host.value).toBe(ctx.box.view.items[1].text);
    press(ctx, 'ArrowUp');
    expect(ctx.host.value).toBe(first);
    press(ctx, 'ArrowUp'); // wraps round to the last
    expect(ctx.box.view.index).toBe(ctx.box.view.items.length - 1);
  });

  test('Tab and Shift+Tab walk too', () => {
    const ctx = setup();
    type(ctx, 'kah');
    press(ctx, 'Tab');
    expect(ctx.box.view.index).toBe(1);
    press(ctx, 'Tab', { shiftKey: true });
    expect(ctx.box.view.index).toBe(0);
  });

  test('Enter after choosing accepts it and does not start a new line', () => {
    const ctx = setup();
    type(ctx, 'kahan');
    press(ctx, 'ArrowDown');
    const chosen = ctx.host.value;
    const enter = press(ctx, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(ctx.host.value).toBe(chosen);
    expect(ctx.composer.active).toBe(false);
  });

  test('Enter without choosing accepts the word and then breaks the line as usual', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    const enter = press(ctx, 'Enter');
    expect(enter.defaultPrevented).toBe(false);
    expect(ctx.host.value).toBe('कहानी\n');
  });

  test('clicking a candidate takes it', () => {
    const ctx = setup();
    type(ctx, 'kah');
    const at = ctx.box.view.items.findIndex((i) => i.text === 'कहना');
    expect(at).toBeGreaterThan(0);
    ctx.box.view.onPick(at);
    expect(ctx.host.value).toBe('कहना');
    expect(ctx.composer.active).toBe(false);
  });

  test('a longer word offered while typing can be taken', () => {
    const ctx = setup();
    type(ctx, 'kah');
    const more = ctx.box.view.items.findIndex((i) => i.kind === 'more');
    expect(more).toBeGreaterThan(0);
    ctx.box.view.onPick(more);
    expect(ctx.host.value.length).toBeGreaterThan(2);
  });

  // the index of the first alternative that is another reading of the letters, not a longer word
  const otherReading = (ctx) => ctx.box.view.items.findIndex((item, i) => i > 0 && item.kind !== 'more');

  test('what was chosen is remembered for the same letters', () => {
    const ctx = setup();
    type(ctx, 'kaha');
    const before = ctx.host.value;
    const at = otherReading(ctx);
    expect(at).toBeGreaterThan(0);
    ctx.box.view.onPick(at);
    const chosen = ctx.host.value;
    expect(chosen).not.toBe(before);
    ctx.host.replace(0, ctx.host.value.length, '');
    type(ctx, 'kaha');
    expect(ctx.host.value).toBe(chosen);
  });

  test('a writer who keeps choosing another word outvotes even a built-in spelling', () => {
    const ctx = setup();
    type(ctx, 'kahan');
    expect(ctx.host.value).toBe('कहाँ'); // the built-in spelling
    let picked = '';
    for (let i = 0; i < 4; i += 1) {
      ctx.host.replace(0, ctx.host.value.length, '');
      type(ctx, 'kahan');
      const at = otherReading(ctx);
      expect(at).toBeGreaterThan(0);
      picked = ctx.box.view.items[at].text;
      ctx.box.view.onPick(at);
    }
    ctx.host.replace(0, ctx.host.value.length, '');
    type(ctx, 'kahan');
    expect(ctx.host.value).toBe(picked);
  });

  test('picking a longer word lifts it in the list but never makes it what space accepts', () => {
    const ctx = setup();
    type(ctx, 'kah');
    const at = ctx.box.view.items.findIndex((item) => item.text === 'कहानी');
    expect(at).toBeGreaterThan(0);
    for (let i = 0; i < 3; i += 1) {
      ctx.box.view.onPick(at);
      ctx.host.replace(0, ctx.host.value.length, '');
      type(ctx, 'kah');
    }
    expect(ctx.host.value).toBe('कह'); // still what the letters spell
    const now = ctx.box.view.items.findIndex((item) => item.text === 'कहानी');
    expect(now).toBe(1); // but it is the first alternative
  });
})

describe('leaving the composition', () => {
  test('a shortcut accepts the word and passes through', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    const undo = press(ctx, 'z', { metaKey: true });
    expect(undo.defaultPrevented).toBe(false);
    expect(ctx.composer.active).toBe(false);
    expect(ctx.host.value).toBe('कहानी');
  });

  test('the arrow keys that move sideways accept the word first', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    const left = press(ctx, 'ArrowLeft');
    expect(left.defaultPrevented).toBe(false);
    expect(ctx.composer.active).toBe(false);
  });

  test('pressing Shift alone does not end the word', () => {
    const ctx = setup();
    type(ctx, 'kah');
    press(ctx, 'Shift');
    expect(ctx.composer.active).toBe(true);
    press(ctx, 'a', { shiftKey: true });
    expect(ctx.composer.currentRaw()).toBe('kaha');
  });

  test('a click or losing focus accepts what is shown', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    ctx.composer.interrupted();
    expect(ctx.composer.active).toBe(false);
    expect(ctx.host.value).toBe('कहानी');
    expect(ctx.box.view).toBeNull();
  });
});

describe('where it stays out of the way', () => {
  test('an operating-system keyboard in the middle of a composition is left alone', () => {
    const ctx = setup();
    const a = press(ctx, 'k', { isComposing: true });
    const b = press(ctx, 'k', { keyCode: 229 });
    expect(a.defaultPrevented).toBe(false);
    expect(b.defaultPrevented).toBe(false);
    expect(ctx.composer.active).toBe(false);
  });

  test('nothing happens when Hindi typing is switched off', () => {
    const engine = makeEngine();
    const host = new StringHost();
    const composer = new Composer(host, { engine, box: new FakeBox(), enabled: () => false });
    const ctx = { engine, host, composer, box: null };
    type(ctx, 'kahani');
    expect(host.value).toBe('kahani');
  });

  test('not inside code, links or other protected text', () => {
    const ctx = setup();
    ctx.host.allowed = false;
    type(ctx, 'kahani');
    expect(ctx.host.value).toBe('kahani');
  });

  test('not in the middle of an English word or a web address', () => {
    const ctx = setup('hello');
    type(ctx, 'k');
    expect(ctx.host.value).toBe('hellok');
    const mail = setup('name@');
    type(mail, 'kya');
    expect(mail.host.value).toBe('name@kya');
    const url = setup('https://');
    type(url, 'kya');
    expect(url.host.value).toBe('https://kya');
  });

  test('a letter that would overfill the field is refused', () => {
    const ctx = setup();
    ctx.host.max = 4;
    type(ctx, 'kahani');
    expect(ctx.host.value.length).toBeLessThanOrEqual(4);
  });

  test('typing over a selection replaces it', () => {
    const ctx = setup('पुराना शब्द');
    ctx.host.pos = 0;
    ctx.host.end = 6;
    type(ctx, 'kya');
    expect(ctx.host.value).toBe('क्या शब्द');
  });
});

describe('a keyboard that ignores "cancel this key"', () => {
  const input = (data, inputType = 'insertText') => ({ data, inputType, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

  test('a letter that was taken over is not typed a second time', () => {
    const ctx = setup();
    press(ctx, 'k');
    const echo = input('k');
    expect(ctx.composer.guardInput(echo)).toBe(true);
    expect(echo.defaultPrevented).toBe(true);
    // only once
    expect(ctx.composer.guardInput(input('k'))).toBe(false);
  });

  test('a different letter, a paste, or input that arrives late is left alone', () => {
    const ctx = setup();
    press(ctx, 'k');
    expect(ctx.composer.guardInput(input('x'))).toBe(false);
    expect(ctx.composer.guardInput(input('k', 'insertFromPaste'))).toBe(false);
    const late = setup();
    press(late, 'k');
    late.composer.taken.at -= 1000;
    expect(late.composer.guardInput(input('k'))).toBe(false);
  });

  test('a letter the writer types a moment later is theirs, even if it is the same letter', () => {
    // hello, Esc, then world: the second "o" is typed natively and must never be mistaken for an echo
    const ctx = setup();
    type(ctx, 'hello');
    press(ctx, 'Escape');
    press(ctx, 'w');
    press(ctx, 'o');
    expect(ctx.composer.guardInput(input('o'))).toBe(false);
    expect(ctx.host.value).toBe('hellowo');
    type(ctx, 'rld');
    expect(ctx.host.value).toBe('helloworld');
  });

  test('another key press forgets what was taken over before it', () => {
    const ctx = setup();
    press(ctx, 'k');
    press(ctx, 'ArrowLeft'); // a different key, handled elsewhere
    expect(ctx.composer.guardInput(input('k'))).toBe(false);
  });

  test('nothing is cancelled when no key was taken over', () => {
    const ctx = setup();
    expect(ctx.composer.guardInput(input('k'))).toBe(false);
  });
});

describe('the sentence ending', () => {
  test('a second space turns into the Hindi full stop', () => {
    const ctx = setup();
    type(ctx, 'kahani');
    press(ctx, ' ');
    press(ctx, ' ');
    expect(ctx.host.value).toBe('कहानी। ');
  });

  test('no full stop at the start or after another full stop', () => {
    const ctx = setup();
    press(ctx, ' ');
    press(ctx, ' ');
    expect(ctx.host.value).toBe('  ');
    const done = setup('बात। ');
    press(done, ' ');
    expect(done.host.value).toBe('बात।  ');
  });
});

describe('the list of candidates', () => {
  test('whole-word readings come before longer words, and the plain phonetic spelling is always there', () => {
    const engine = makeEngine();
    const rows = assemble(engine.suggest('kah'));
    const kinds = rows.map((r) => r.kind);
    expect(kinds.indexOf('more')).toBeGreaterThan(kinds.lastIndexOf('word'));
    expect(rows.length).toBeLessThanOrEqual(7);
    // a name no list knows still gets a reading
    const name = assemble(engine.suggest('anamika'));
    expect(name[0].kind).toBe('rule');
    expect(name[0].text).toBe('अनमिका');
  });
});
