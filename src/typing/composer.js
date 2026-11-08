/**
 * Live Hinglish typing, independent of the editor it runs in.
 *
 * While a writer types Latin letters, the Devanagari for them is written into the text at once and
 * rewritten with every further letter (what you see is what will stay). A small list under the caret
 * offers other spellings and longer words. The word is "composed" until the writer accepts it:
 *
 *   space / punctuation / Enter   accept what is shown (space also types the space)
 *   ↑ ↓ or Tab / Shift+Tab        look at the other candidates; the text changes as you go
 *   Enter after ↑ ↓               accept the chosen candidate and stay on the line
 *   Esc                           give up: the letters stay as typed, in English
 *   Backspace                     takes back the last LETTER typed (not a Devanagari sign), and straight
 *                                 after accepting a word with space it reopens that word
 *   a click anywhere / a shortcut / moving the caret    accept what is shown
 *
 * The editor (Quill, a textarea...) is reached only through a small `host` object:
 *   caret() -> index | null       text(from, to) -> string      replace(from, to, text)
 *   collapse() -> index           canCompose(index) -> bool     fits(from, to, text) -> bool
 *   rect(index) -> {left, top, bottom}   (viewport coordinates, for the list)
 */
import { engine as sharedEngine } from './engine.js';

export const DANDA = '।';
const LETTER = /^[A-Za-z]$/;
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock']);
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Delete']);
const MAX_ROWS = 7;
// another way to read the letters typed is a little likelier to be wanted than a longer word that merely begins with them
const WHOLE_WORD_EDGE = 1.0;
let counter = 0;

/**
 * The rows to show. The first is what the word becomes if the writer just presses space: the best
 * whole-word reading of the letters. After it come the other possibilities, most likely first -
 * other spellings and longer words alike - so a rare old spelling never crowds out a useful word.
 * The plain phonetic spelling is always among them (names and new words need it).
 */
export function assemble(result) {
  const known = result.convert.filter((c) => c.kind !== 'rule');
  const rules = result.convert.filter((c) => c.kind === 'rule');
  const first = known[0] || rules[0];
  if (!first) return [];
  const phonetic = known.length ? rules[0] : null;
  // with nothing known, the other phonetic spellings are the alternatives
  const spellings = known.length ? [] : rules.slice(1, 3);
  const rest = known
    .slice(1)
    .concat(result.complete, spellings)
    .filter((c) => c.text !== first.text)
    .sort((a, b) => b.score + (b.kind === 'more' ? 0 : WHOLE_WORD_EDGE) - (a.score + (a.kind === 'more' ? 0 : WHOLE_WORD_EDGE)))
    .slice(0, MAX_ROWS - 1);
  if (phonetic && phonetic.text !== first.text && !rest.some((c) => c.text === phonetic.text)) {
    if (rest.length >= MAX_ROWS - 1) rest.pop();
    rest.push(phonetic);
  }
  return [first].concat(rest);
}

export class Composer {
  constructor(host, options = {}) {
    this.host = host;
    this.engine = options.engine || sharedEngine;
    this.box = options.box || null;
    this.enabled = options.enabled || (() => true);
    this.showList = options.showList || (() => true);
    this.onCommit = options.onCommit || null;
    this.c = null; // the word being composed
    this.last = null; // the word accepted most recently (so Backspace can reopen it)
    this.id = `hs-${(counter += 1)}`;
    this.unwatch = null;
    this.taken = null; // the letter key most recently taken over, for guardInput
  }

  get active() {
    return this.c !== null;
  }

  destroy() {
    this.close();
  }

  // ---- keys ---------------------------------------------------------------------------------------------
  /** Returns true when the key was handled here (the caller must then leave it alone). */
  keydown(e) {
    // the guard covers only the echo of THIS key press: whatever was taken over before is forgotten
    this.taken = null;
    if (!this.enabled()) {
      if (this.c) this.commit();
      return false;
    }
    // an operating-system keyboard (phone, Hindi IME) is composing: stay out of its way
    if (e.isComposing || e.keyCode === 229 || e.key === 'Process' || e.key === 'Dead' || e.key === 'Unidentified') return false;
    const { key } = e;
    if (MODIFIER_KEYS.has(key)) return false;
    // this keyboard reports its keys, so the at-the-space conversion made for touch keyboards is not needed
    if (key.length === 1) this.engine.liveKeys = true;
    const shortcut = e.ctrlKey || e.metaKey || e.altKey;
    return this.c ? this.keyWhileComposing(e, key, shortcut) : this.keyIdle(e, key, shortcut);
  }

  keyIdle(e, key, shortcut) {
    if (shortcut) return false;

    if (key.length === 1 && LETTER.test(key)) {
      let caret = this.host.caret();
      if (caret === null) caret = this.host.collapse ? this.host.collapse() : null;
      if (caret === null || !this.canStartAt(caret)) return false;
      e.preventDefault();
      this.taken = { letter: key, at: Date.now() };
      this.c = { start: caret, raw: '', shown: '', list: [], index: 0, navigated: false, typed: '' };
      this.unwatch = this.engine.onChange(() => this.refresh());
      if (!this.append(key)) this.close();
      return true;
    }

    // a second space ends the sentence with the Hindi full stop
    if (key === ' ') {
      const caret = this.host.caret();
      if (caret !== null && caret >= 2 && this.host.canCompose(caret)) {
        const pair = this.host.text(caret - 2, caret);
        if (pair.length === 2 && pair[1] === ' ' && !/\s/.test(pair[0]) && pair[0] !== DANDA) {
          if (!this.host.fits(caret - 1, caret, `${DANDA} `)) return false;
          e.preventDefault();
          this.host.replace(caret - 1, caret, `${DANDA} `);
          this.last = null;
          return true;
        }
      }
      return false;
    }

    // Backspace straight after "word " reopens the word, so a wrong pick is one key away from fixed
    if (key === 'Backspace' && this.last) {
      const L = this.last;
      const caret = this.host.caret();
      if (
        caret !== null &&
        caret === L.end + 1 &&
        this.host.text(L.end, caret) === ' ' &&
        this.host.text(L.start, L.end) === L.text
      ) {
        e.preventDefault();
        this.host.replace(L.end, caret, '');
        this.c = { start: L.start, raw: L.raw, shown: L.text, list: [], index: 0, navigated: false, typed: '' };
        this.unwatch = this.engine.onChange(() => this.refresh());
        this.relist();
        const at = this.c.list.findIndex((x) => x.text === L.text);
        if (at >= 0) this.c.index = at;
        this.paint();
        return true;
      }
    }
    return false;
  }

  keyWhileComposing(e, key, shortcut) {
    if (shortcut) {
      this.commit();
      return false;
    }
    if (key.length === 1 && LETTER.test(key)) {
      e.preventDefault();
      this.taken = { letter: key, at: Date.now() };
      this.append(key);
      return true;
    }
    switch (key) {
      case 'Backspace': {
        e.preventDefault();
        const c = this.c;
        c.raw = c.raw.slice(0, -1);
        if (!c.raw) {
          this.host.replace(c.start, c.start + c.shown.length, '');
          this.close();
        } else {
          this.relist();
          this.paint();
        }
        return true;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
        return true;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Tab': {
        const c = this.c;
        if (c.list.length < 2) {
          // nothing to choose between: the key does its normal job (move, change field) after accepting
          this.commit();
          return false;
        }
        e.preventDefault();
        const step = key === 'ArrowUp' || (key === 'Tab' && e.shiftKey) ? -1 : 1;
        c.index = (c.index + step + c.list.length) % c.list.length;
        c.navigated = true;
        this.paint();
        return true;
      }
      case 'Enter': {
        const chosen = this.c.navigated;
        this.commit();
        if (chosen) {
          e.preventDefault();
          return true;
        }
        return false;
      }
      case ' ': {
        const caret = this.c.start + this.c.shown.length;
        this.commit();
        if (this.host.fits(caret, caret, ' ')) {
          e.preventDefault();
          this.host.replace(caret, caret, ' ');
          return true;
        }
        return false;
      }
      default:
        if (MOVE_KEYS.has(key) || key.length === 1) this.commit(); // digits, punctuation, arrows: accept, then act
        return false;
    }
  }

  /**
   * For the browser's own `beforeinput`: if it is about to type a letter that was just taken over here
   * (some touch keyboards ignore "cancel this key"), stop it, so the letter is not typed twice.
   * Returns true when it cancelled the input.
   */
  guardInput(e) {
    const taken = this.taken;
    if (!taken || e.inputType !== 'insertText' || e.data !== taken.letter || Date.now() - taken.at > 150) return false;
    this.taken = null;
    e.preventDefault();
    return true;
  }

  canStartAt(caret) {
    if (!this.host.canCompose(caret)) return false;
    // never start in the middle of a Latin word (pasted text, a word kept in English with Esc)
    if (caret > 0) {
      const prev = this.host.text(caret - 1, caret);
      if (/[A-Za-z0-9]/.test(prev)) return false;
      if (prev === '@') return false;
      if (prev === '.' && caret > 1 && /[A-Za-z0-9]/.test(this.host.text(caret - 2, caret - 1))) return false;
    }
    if (caret > 2 && this.host.text(Math.max(0, caret - 8), caret).indexOf('://') !== -1) return false;
    return true;
  }

  // ---- the word being composed -------------------------------------------------------------------------
  append(letter) {
    const c = this.c;
    const before = { raw: c.raw, list: c.list, index: c.index, typed: c.typed, navigated: c.navigated };
    c.raw += letter;
    this.relist();
    const next = c.list[0] ? c.list[0].text : c.raw;
    if (!this.host.fits(c.start, c.start + c.shown.length, next)) {
      Object.assign(c, before); // the field is full: the letter is refused, like any other
      return false;
    }
    c.index = 0;
    c.navigated = false;
    this.paint();
    return true;
  }

  relist() {
    const c = this.c;
    const result = this.engine.suggest(c.raw);
    c.typed = result.typed;
    c.list = assemble(result);
    if (!c.list.length) c.list = [{ text: c.raw, kind: 'rule', score: 0 }];
    if (c.index >= c.list.length) c.index = 0;
  }

  /** Make the text and the list agree with the highlighted candidate. */
  paint() {
    const c = this.c;
    const text = (c.list[c.index] || { text: c.raw }).text;
    if (text !== c.shown) {
      this.host.replace(c.start, c.start + c.shown.length, text);
      c.shown = text;
    }
    this.draw();
  }

  draw() {
    const c = this.c;
    if (!this.box) return;
    if (!this.showList()) {
      this.box.hide();
      return;
    }
    // anchored at the start of the word, so the list does not slide sideways with every letter
    const locate = () => this.host.rect(this.c ? this.c.start : c.start);
    this.box.show({
      id: this.id,
      items: c.list,
      index: c.index,
      typed: c.raw,
      rect: locate(),
      locate,
      onPick: (i) => this.pick(i),
      element: this.host.element || null,
    });
  }

  pick(i) {
    const c = this.c;
    if (!c) return;
    c.index = i;
    c.navigated = true;
    this.paint();
    this.commit();
    if (this.host.focus) this.host.focus();
  }

  /** The engine learned something (the word list arrived): look again at what is being typed. */
  refresh() {
    const c = this.c;
    if (!c) return;
    const shown = c.list[c.index] ? c.list[c.index].text : null;
    this.relist();
    if (c.navigated && shown) {
      const at = c.list.findIndex((x) => x.text === shown);
      c.index = at >= 0 ? at : 0;
    } else {
      c.index = 0;
    }
    this.paint();
  }

  /** Keep what is shown. */
  commit() {
    const c = this.c;
    if (!c) return;
    this.close();
    const text = c.shown;
    if (!text || !c.raw) return;
    const kind = c.list[c.index] ? c.list[c.index].kind : 'rule';
    this.engine.learn(c.typed, text, c.navigated && c.index !== 0, kind !== 'rule');
    this.last = { start: c.start, end: c.start + text.length, text, raw: c.raw, typed: c.typed };
    if (this.onCommit) this.onCommit(text);
  }

  /** Esc: turn the shown Devanagari back into the letters as typed. */
  cancel() {
    const c = this.c;
    if (!c) return;
    this.host.replace(c.start, c.start + c.shown.length, c.raw);
    this.close();
    this.last = null;
  }

  close() {
    this.c = null;
    if (this.unwatch) {
      this.unwatch();
      this.unwatch = null;
    }
    if (this.box) this.box.hide();
  }

  /** The editor lost focus, was clicked, or the caret was moved by something other than us. */
  interrupted() {
    if (this.c) this.commit();
  }

  /** Where the caret should be if nothing else touched it (so a host can tell when someone did). */
  expectedCaret() {
    return this.c ? this.c.start + this.c.shown.length : null;
  }

  currentRaw() {
    return this.c ? this.c.raw : '';
  }
}
