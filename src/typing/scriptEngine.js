/**
 * The typing engine of a language other than Hindi.
 *
 * It has the same surface as the Hindi engine (engine.js), which is all the composer needs:
 * `suggest(letters)` gives candidates, `learn` remembers a pick, `onChange` says when the data
 * changed. Underneath is an ordinary engine with no word list that reads the letters by the
 * language's conventions (profiles.js) into Devanagari; every candidate is then written in the
 * language's own script (scriptmap.js).
 *
 * What the writer picks is remembered as the Devanagari it came from (that is what the engine
 * understands), under a storage key of its own for each language.
 */
import { Engine } from './engine.js';
import { profileFor } from './profiles.js';
import { scriptMapper } from './scriptmap.js';

const MAX_REMEMBERED = 600;

export class ScriptEngine {
  constructor(language, script, storage = null) {
    this.language = language;
    this.script = script;
    this.inner = new Engine({}, { profile: profileFor(language), pins: false, literals: 8 });
    this.map = scriptMapper(language, script) || ((text) => text);
    this.back = new Map(); // what was shown -> the Devanagari it was made from
    // set by the composer once a keyboard that reports its keys has been used (see convert.js)
    this.liveKeys = false;
    if (storage) this.inner.attachStorage(storage);
  }

  /** There is no word list to wait for. */
  ready() {
    return true;
  }

  suggest(raw) {
    const result = this.inner.suggest(raw);
    if (!result.typed) return result;
    const seen = new Set();
    const write = (list) => {
      const out = [];
      list.forEach((candidate) => {
        const text = this.map(candidate.text);
        if (seen.has(text)) return;
        seen.add(text);
        this.remember(text, candidate.text);
        out.push({ ...candidate, text });
      });
      return out;
    };
    const convert = write(result.convert);
    const complete = write(result.complete);
    // rulesOnly: there is no word list behind this, so the list under the caret offers more spellings
    return { typed: result.typed, convert, complete, top: convert.length ? convert[0].text : result.typed, rulesOnly: true };
  }

  remember(shown, source) {
    this.back.delete(shown);
    this.back.set(shown, source);
    if (this.back.size > MAX_REMEMBERED) this.back.delete(this.back.keys().next().value);
  }

  learn(typed, shown, chosen = false, known = true) {
    const source = this.back.get(shown);
    if (source) this.inner.learn(typed, source, chosen, known);
  }

  onChange(listener) {
    return this.inner.onChange(listener);
  }

  /** Words of the story being written are in the language's own script; the engine reads Devanagari. */
  setStoryText() {}

  attachStorage(storage) {
    this.inner.attachStorage(storage);
  }

  forgetEverything() {
    this.inner.forgetEverything();
  }
}
