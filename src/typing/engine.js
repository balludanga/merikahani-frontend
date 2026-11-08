/**
 * Turns the Latin letters a writer has typed so far into Devanagari candidates.
 *
 * Sources, in the order they are consulted:
 *   - PINS      everyday spellings no rule derives (nahi, mein, hai): offered first when typed exactly;
 *   - the word list (a big file of real Hindi words with how common each is), read through the
 *     permissive rules in tables.js, so "kahani", "kahaani" and "kahni" all reach कहानी;
 *   - the writer's own words (what they have typed and picked before: names, favourite words);
 *   - the words already in the story being written (so a character's name is offered at once);
 *   - the rules alone, for anything the lists do not know.
 *
 * `suggest` returns two lists. `convert` holds whole-word readings of exactly what was typed (the first
 * one is what space accepts). `complete` holds longer words that begin with what was typed
 * ("kah" -> कहानी, कहना ...): the "suggest the word before I finish it" part.
 */
import { EMPTY_LAYER, Layer, countWords, parseLexicon } from './lexicon.js';
import { PINS } from './pins.js';
import { IMPLIED_NASAL, IMPLIED_NASAL_COST } from './tables.js';
import { literalReadings, normalizeTyped, prefixRange, search } from './transduce.js';

/**
 * How candidates are ranked. A score is   freq * (how common the word is, minus `floor`)
 *                                       - cost * (how unnatural the spelling reading is)
 *                                       - extra * (letters still to type, for completions).
 * The numbers were picked by measuring against real people's spellings (scripts/typing/evaluate.mjs).
 */
export const RANK = {
  freq: 1.0,
  cost: 1.0,
  extra: 0.15,
  floor: 1.5,
  literal: 0.3, // rules-only readings rank below a known word that reads equally well
  pin: 8, // above any ordinary word (the best scores about 5), yet a writer's repeated picks can outvote it
  pick: 2.5, // per doubling of how often the writer chose this word for these letters
  width: 120, // beam width of the guided search
  states: 14, // how many readings are scanned for completions
  perState: 6, // completions kept from each reading
};

const MAX_TYPED = 28;
const EMPTY = Object.freeze({ typed: '', convert: [], complete: [], top: '' });

export class Engine {
  constructor(rank = {}) {
    this.rank = { ...RANK, ...rank };
    this.main = EMPTY_LAYER;
    this.mine = EMPTY_LAYER;
    this.story = EMPTY_LAYER;
    this.uses = new Map(); // word -> times the writer committed it
    this.picks = new Map(); // "letters\tword" -> times chosen over the first suggestion
    this.storyCounts = new Map();
    this.unfamiliar = new Map(); // words not in any list, accepted once so far
    this.storage = null;
    // true once a keyboard that reports its keys has been used: then live typing does everything and
    // nothing is converted behind the writer's back (see convert.js)
    this.liveKeys = false;
    this.version = 0;
    this.cache = new Map();
    this.listeners = new Set();
    this.dirtyMine = false;
    this.dirtyStory = false;
  }

  // ---- data ----------------------------------------------------------------------------------------
  ready() {
    return this.main.size > 0;
  }

  setLexiconText(text) {
    this.main = new Layer(parseLexicon(text));
    this.changed();
  }

  /** Words of the story being written: offered ahead of the general list (names, special terms). */
  setStoryText(text) {
    this.storyCounts = countWords(text);
    this.dirtyStory = true;
    this.changed();
  }

  noteStoryWord(word) {
    this.storyCounts.set(word, (this.storyCounts.get(word) || 0) + 1);
    this.dirtyStory = true;
    this.cache.clear();
  }

  /**
   * Remember a word the writer has just accepted for the letters `typed`. A word the lists already
   * know is remembered at once; one they do not (a name, or a slip) only after it has been accepted
   * twice, so a single wrong guess is never taught back to the writer.
   */
  learn(typed, word, chosen = false, known = true) {
    if (!word || word.length < 2) return;
    this.noteStoryWord(word);
    if (!known && !chosen && !this.uses.has(word)) {
      const seen = (this.unfamiliar.get(word) || 0) + 1;
      touch(this.unfamiliar, word, seen, 300);
      if (seen < 2) return;
    }
    touch(this.uses, word, (this.uses.get(word) || 0) + 1, 2500);
    if (chosen) {
      const key = `${typed}\t${word}`;
      touch(this.picks, key, (this.picks.get(key) || 0) + 1, 1500);
    }
    this.dirtyMine = true;
    this.save();
  }

  attachStorage(storage) {
    this.storage = storage;
    try {
      const data = storage.load();
      if (data && typeof data === 'object') {
        this.uses = new Map(Object.entries(data.uses || {}).map(([k, v]) => [k, Number(v) || 1]));
        this.picks = new Map(Object.entries(data.picks || {}).map(([k, v]) => [k, Number(v) || 1]));
        this.dirtyMine = true;
        this.changed();
      }
    } catch (error) {
      // unreadable saved data: start fresh
    }
  }

  save() {
    if (!this.storage) return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        this.storage.save({ uses: Object.fromEntries(this.uses), picks: Object.fromEntries(this.picks) });
      } catch (error) {
        // storage full or blocked: the next visit starts without it
      }
    }, 800);
  }

  forgetEverything() {
    this.uses.clear();
    this.picks.clear();
    this.unfamiliar.clear();
    this.dirtyMine = true;
    this.changed();
    if (this.storage) {
      try {
        this.storage.save({ uses: {}, picks: {} });
      } catch (error) {
        // nothing to clean
      }
    }
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  changed() {
    this.version += 1;
    this.cache.clear();
    this.listeners.forEach((fn) => fn());
  }

  rebuild() {
    if (this.dirtyMine) {
      const rows = [];
      this.uses.forEach((count, word) => rows.push([word, Math.round(40 + 12 * Math.log10(count))]));
      this.mine = new Layer(rows);
      this.dirtyMine = false;
    }
    if (this.dirtyStory) {
      const rows = [];
      this.storyCounts.forEach((count, word) => rows.push([word, Math.round(38 + 14 * Math.log10(count))]));
      this.story = new Layer(rows);
      this.dirtyStory = false;
    }
  }

  // ---- asking ----------------------------------------------------------------------------------------
  suggest(raw) {
    const typed = normalizeTyped(raw);
    if (!typed) return EMPTY;
    this.rebuild();
    const hit = this.cache.get(typed);
    if (hit) return hit;

    const R = this.rank;
    const found = new Map();
    const add = (text, score, kind) => {
      const old = found.get(text);
      if (!old) {
        found.set(text, { text, score, kind });
        return;
      }
      // a word that reads exactly as typed is never demoted to "a longer word you might mean"
      if (old.kind !== 'more' && kind === 'more') return;
      if (old.kind === 'more' && kind !== 'more') {
        found.set(text, { text, score, kind });
        return;
      }
      if (score > old.score) found.set(text, { text, score, kind });
    };

    const literal = literalReadings(typed, 4);
    literal.forEach((l, i) => add(l.text, -R.cost * l.cost - R.literal - i * 0.05, 'rule'));

    const pinned = PINS[typed.toLowerCase()];
    if (pinned) add(pinned, R.pin, 'pin');

    if (typed.length <= MAX_TYPED) {
      this.scan(this.main, typed, add, 'word');
      this.scan(this.mine, typed, add, 'mine');
      this.scan(this.story, typed, add, 'story');
    }

    // words the writer has taught us for exactly these letters
    this.picks.forEach((count, key) => {
      const tab = key.indexOf('\t');
      if (key.slice(0, tab) !== typed) return;
      const entry = found.get(key.slice(tab + 1));
      if (entry) entry.score += R.pick * Math.log2(1 + count);
    });

    const all = [...found.values()].sort((a, b) => b.score - a.score);
    const convert = all.filter((c) => c.kind !== 'more');
    const complete = all.filter((c) => c.kind === 'more');
    const result = { typed, convert, complete, top: convert.length ? convert[0].text : typed };
    if (this.cache.size > 400) this.cache.clear();
    this.cache.set(typed, result);
    return result;
  }

  scan(layer, typed, add, kind) {
    if (!layer.size) return;
    const R = this.rank;
    const { keys, surfaces, weights } = layer;
    const states = search(typed, layer, R.width);
    let scanned = 0;
    for (const s of states) {
      const base = -R.cost * s.cost;
      let a = s.lo;
      while (a < s.hi && keys[a] === s.out) {
        add(surfaces[a], base + R.freq * (weights[a] / 10 - R.floor), kind);
        a += 1;
      }
      // a final nasal dot the writer left out (nahi = नहीं)
      for (const dot of IMPLIED_NASAL) {
        const range = a < s.hi ? prefixRange(keys, a, s.hi, s.out + dot) : null;
        if (!range) continue;
        for (let j = range[0]; j < range[1] && keys[j] === s.out + dot; j += 1) {
          add(surfaces[j], base - R.cost * IMPLIED_NASAL_COST + R.freq * (weights[j] / 10 - R.floor), kind);
        }
      }
      // longer words that begin with this reading
      if (a < s.hi && scanned < R.states) {
        scanned += 1;
        const top = [];
        const outLength = s.out.length;
        for (let j = a; j < s.hi; j += 1) {
          const score = base + R.freq * (weights[j] / 10 - R.floor) - R.extra * (keys[j].length - outLength);
          if (top.length < R.perState || score > top[top.length - 1].score) {
            top.push({ j, score });
            top.sort((x, y) => y.score - x.score);
            if (top.length > R.perState) top.pop();
          }
        }
        for (const t of top) add(surfaces[t.j], t.score, 'more');
      }
    }
  }
}

// Keep a Map ordered by recency and never larger than `limit` entries.
function touch(map, key, value, limit) {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value);
}

export const engine = new Engine();
