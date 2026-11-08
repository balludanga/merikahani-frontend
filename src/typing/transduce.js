/**
 * Reads Latin letters left to right and produces every plausible Devanagari spelling, cheapest first.
 *
 * Two ways to run it:
 *   - free  (no `layer`): no word list, just the rules in tables.js. The cheapest result is the
 *     "literal" transliteration used for names and words nobody has listed.
 *   - guided (a `layer` of known words): a reading is dropped the moment no known word starts with
 *     it, so only real spellings survive. This is what makes "kahani" come out as कहानी and not
 *     कहनि: the engine never builds a spelling that is not a word.
 *
 * The search is a beam search over (position, state): a state remembers what the last letter was
 * (see START / CONS / VOW in tables.js) because that decides what the next Latin piece can mean.
 */
import {
  CONSONANTS,
  CONJUNCT_PAIRS,
  CONS,
  DIGRAPH_SPLIT_COST,
  FINAL_N_AFTER_LONG,
  FINAL_U_LONG,
  FINAL_U_SHORT,
  FINAL_A_LONG,
  FINAL_A_SHORT,
  FINAL_I_LONG,
  FINAL_I_SHORT,
  GEMINATE_COST,
  GEMINATE_OK,
  GLIDE_COST,
  IMPLIED_DOT_COST,
  INDEPENDENT,
  JOIN_PLAIN,
  JOIN_PREFERRED,
  JOIN_UNLIKELY,
  COLLAPSE_COST,
  SILENT_A_COST,
  LABIAL,
  LONG,
  MATRA,
  NASAL_FINAL_M,
  NASAL_M,
  NASAL_N,
  SPLITTABLE,
  SPLITTABLE_VOWELS,
  START,
  VOW,
  VOWEL_PAIRS,
  VOWEL_SPLIT_COST,
  isVowelLetter,
} from './tables.js';

const VOWEL_TWO = new Set(VOWEL_PAIRS);

/**
 * What the writer typed, reduced to what the rules understand: ASCII letters only. A capital T, D or
 * N asks for the retroflex sound (Taali = टाली); every other capital is just a capital. A word typed
 * entirely in capitals is shouting, not a string of retroflex marks.
 */
export function normalizeTyped(raw) {
  const letters = String(raw == null ? '' : raw).replace(/[^A-Za-z]/g, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return letters.toLowerCase();
  let out = '';
  for (let i = 0; i < letters.length; i += 1) {
    const ch = letters[i];
    out += ch === 'T' || ch === 'D' || ch === 'N' ? ch : ch.toLowerCase();
  }
  return out;
}

// ---- a sorted list of keys, searched by prefix ------------------------------------------------------------
function lowerBound(keys, lo, hi, target) {
  let a = lo;
  let b = hi;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (keys[mid] < target) a = mid + 1;
    else b = mid;
  }
  return a;
}

/** The slice [lo, hi) of the sorted `keys` that starts with `prefix`, searched only inside [from, to). */
export function prefixRange(keys, from, to, prefix) {
  const lo = lowerBound(keys, from, to, prefix);
  if (lo >= to || !keys[lo].startsWith(prefix)) return null;
  const hi = lowerBound(keys, lo, to, `${prefix}￿`);
  return [lo, hi];
}

// ---- the moves out of one state -------------------------------------------------------------------------------
function consonantReadings(tok, atWordStart) {
  const alts = CONSONANTS[tok];
  if (!alts) return null;
  // A capital T/D/N at the start of a word is as likely to be a Name's capital as a retroflex mark.
  if (atWordStart && (tok === 'T' || tok === 'D' || tok === 'N' || tok === 'Th' || tok === 'Dh')) {
    return alts.map((a, idx) => (idx === 0 ? a : { ...a, c: Math.min(a.c, 0.3) }));
  }
  return alts;
}

function pushVowel(list, text, len, extra, st, atEnd, nextCh) {
  const table = st === CONS ? MATRA : INDEPENDENT;
  let alts = table[text];
  if (!alts) return;
  if (st === CONS && atEnd) {
    // a plain a or i typed last: the long sound is far likelier (mera, hota, kahani)
    if (text === 'a') {
      alts = [
        { k: 'ा', s: 'ा', c: FINAL_A_LONG },
        { k: '', s: '', c: FINAL_A_SHORT },
      ];
    } else if (text === 'i') {
      alts = [
        { k: 'ी', s: 'ी', c: FINAL_I_LONG },
        { k: 'ि', s: 'ि', c: FINAL_I_SHORT },
      ];
    } else if (text === 'u') {
      alts = [
        { k: 'ू', s: 'ू', c: FINAL_U_LONG },
        { k: 'ु', s: 'ु', c: FINAL_U_SHORT },
      ];
    }
  }
  const lv = LONG.has(text) ? 1 : 0;
  // before another consonant the writer may simply not have typed the nasal dot (unhone = उन्होंने)
  const dotOk = nextCh !== undefined && !isVowelLetter(nextCh);
  for (const a of alts) {
    // the short a of a consonant that is followed by another consonant may be silent: janam = जन्म
    const ia = st === CONS && text === 'a' && a.k === '' ? 1 : 0;
    list.push({ len, k: a.k, s: a.s, c: a.c + extra, st: VOW, lv, pl: '', ia });
    if (dotOk && a.k !== '') {
      list.push({ len, k: `${a.k}ं`, s: `${a.s}ं`, c: a.c + extra + IMPLIED_DOT_COST, st: VOW, lv: 0, pl: '', ia: 0 });
    }
  }
}

export function movesFrom(q, i, st, lv, pl, ia) {
  const list = [];
  const n = q.length;
  const ch = q[i];

  if (isVowelLetter(ch)) {
    const two = q.substr(i, 2);
    if (two.length === 2 && VOWEL_TWO.has(two)) {
      pushVowel(list, two, 2, 0, st, i + 2 === n, q[i + 2]);
      // "ai" and "au" can also be two vowels in a row (kai = कई)
      if (SPLITTABLE_VOWELS.has(two)) pushVowel(list, ch, 1, VOWEL_SPLIT_COST, st, false, q[i + 1]);
    } else {
      pushVowel(list, ch, 1, 0, st, i + 1 === n, q[i + 1]);
    }
    return list;
  }

  // "ri" and "ru" are the vowel ऋ / ृ (krishna, rishi; mrutyu, drushti); "r" + "i" is read as well, below.
  if (ch === 'r' && (q[i + 1] === 'i' || q[i + 1] === 'u')) {
    const table = st === CONS ? MATRA.ri : INDEPENDENT.ri;
    const extra = q[i + 1] === 'u' ? 0.3 : 0;
    for (const a of table) list.push({ len: 2, k: a.k, s: a.s, c: a.c + extra, st: VOW, lv: 0, pl: '', ia: 0 });
  }

  // consonants: longest Latin piece first; a digraph may also be read as two letters
  let longest = 0;
  for (let len = 3; len >= 1; len -= 1) {
    if (i + len > n) continue;
    const tok = q.substr(i, len);
    const alts = consonantReadings(tok, i === 0);
    if (!alts) continue;
    if (!longest) longest = len;
    const split = len < longest && SPLITTABLE.has(q.substr(i, longest)) ? DIGRAPH_SPLIT_COST : 0;
    const nextCh = q[i + len];
    for (const a of alts) {
      const tokLower = tok.toLowerCase();
      if (st === CONS) {
        const pair = `${pl}${tokLower}`;
        const double = pl === tokLower;
        // joined by a halant: प्र, स्त, क्ष, or a doubled letter such as bb
        const halant = double ? 0 : CONJUNCT_PAIRS.has(pair) ? JOIN_PREFERRED : JOIN_PLAIN;
        list.push({ len, k: `्${a.k}`, s: `्${a.s}`, c: a.c + split + halant, st: CONS, lv: 0, pl: tokLower, ia: 0 });
        // not joined: the first letter keeps its short a (dekhna = देखना)
        const plain = double || CONJUNCT_PAIRS.has(pair) ? JOIN_UNLIKELY : JOIN_PLAIN;
        list.push({ len, k: a.k, s: a.s, c: a.c + split + plain, st: CONS, lv: 0, pl: tokLower, ia: 0 });
      } else {
        const finalN = st === VOW && lv && nextCh === undefined && (tok === 'n' || tok === 'N') ? FINAL_N_AFTER_LONG : 0;
        list.push({ len, k: a.k, s: a.s, c: a.c + split + finalN, st: CONS, lv: 0, pl: tokLower, ia: 0 });
        // janam is जन्म: the a that was typed is silent, and the two consonants are joined
        if (st === VOW && ia) {
          list.push({ len, k: `्${a.k}`, s: `्${a.s}`, c: a.c + split + SILENT_A_COST, st: CONS, lv: 0, pl: tokLower, ia: 0 });
        }
        // typed once, written twice: मोहब्बत (mohabat), अच्छा (acha)
        if (st === VOW && len === 1 && GEMINATE_OK.has(tok) && isVowelLetter(nextCh)) {
          list.push({
            len,
            k: `${a.k}्${a.k}`,
            s: `${a.s}्${a.s}`,
            c: a.c + GEMINATE_COST,
            st: CONS,
            lv: 0,
            pl: tokLower,
            ia: 0,
          });
        }
      }
    }
    // the nasal dot is typed as n or m and only sits on a vowel
    if (st === VOW && len === 1) {
      if (tok === 'n' && (nextCh === undefined || !isVowelLetter(nextCh))) {
        const [dot, moon] =
          nextCh !== undefined ? NASAL_N.beforeConsonant : lv ? NASAL_N.endAfterLong : NASAL_N.endAfterShort;
        list.push({ len, k: 'ं', s: 'ं', c: dot, st: VOW, lv: 0, pl: '', ia: 0 });
        list.push({ len, k: 'ँ', s: 'ँ', c: moon, st: VOW, lv: 0, pl: '', ia: 0 });
      } else if (tok === 'm' && nextCh !== undefined && LABIAL.has(nextCh)) {
        list.push({ len, k: 'ं', s: 'ं', c: NASAL_M.cost[0], st: VOW, lv: 0, pl: '', ia: 0 });
        list.push({ len, k: 'ँ', s: 'ँ', c: NASAL_M.cost[1], st: VOW, lv: 0, pl: '', ia: 0 });
      } else if (tok === 'm' && nextCh === undefined) {
        // a word that ends in -am / -um is often written with the dot: evam = एवं, swayam = स्वयं
        list.push({ len, k: 'ं', s: 'ं', c: NASAL_FINAL_M, st: VOW, lv: 0, pl: '', ia: 0 });
      }
      // a y between two vowels is often only a glide: liye = लिए, huye = हुए, naye = नए
      if (tok === 'y' && isVowelLetter(nextCh)) {
        list.push({ len, k: '', s: '', c: GLIDE_COST, st: VOW, lv: 0, pl: '', ia: 0 });
      }
    }
    // a doubled letter typed for a single one: mahattwa = महत्व
    if (st === CONS && len === 1 && pl === tok.toLowerCase()) {
      list.push({ len, k: '', s: '', c: COLLAPSE_COST, st: CONS, lv: 0, pl, ia: 0 });
    }
  }
  return list;
}

/**
 * Every reading of `q` (already normalized) that uses all of its letters.
 * Returns states { out, surf, cost, st, lo, hi }: with a `layer`, `out` is the key spelling and
 * [lo, hi) are the words that start with it; without one, `surf` is the spelling to show.
 */
export function search(q, layer, width = 120) {
  const n = q.length;
  const guided = !!layer;
  const frontier = Array.from({ length: n + 1 }, () => new Map());
  frontier[0].set('', { out: '', surf: '', cost: 0, st: START, lv: 0, pl: '', ia: 0, lo: 0, hi: guided ? layer.size : 0 });
  const memo = new Map();

  for (let i = 0; i < n; i += 1) {
    const here = [...frontier[i].values()].sort((a, b) => a.cost - b.cost).slice(0, width);
    for (const s of here) {
      const id = `${i}|${s.st}|${s.lv}|${s.pl}|${s.ia}`;
      let list = memo.get(id);
      if (!list) {
        list = movesFrom(q, i, s.st, s.lv, s.pl, s.ia);
        memo.set(id, list);
      }
      for (const m of list) {
        let lo = s.lo;
        let hi = s.hi;
        const out = s.out + m.k;
        if (guided && m.k) {
          const range = prefixRange(layer.keys, lo, hi, out);
          if (!range) continue;
          [lo, hi] = range;
        }
        const surf = guided ? '' : s.surf + m.s;
        const key = `${m.st}|${m.lv}|${m.pl}|${m.ia}|${guided ? out : surf}`;
        const target = frontier[i + m.len];
        const cost = s.cost + m.c;
        const prev = target.get(key);
        if (!prev || prev.cost > cost) {
          target.set(key, { out, surf, cost, st: m.st, lv: m.lv, pl: m.pl, ia: m.ia, lo, hi });
        }
      }
    }
  }
  return [...frontier[n].values()].sort((a, b) => a.cost - b.cost);
}

/**
 * The spellings the rules alone give, cheapest first: [{ text, cost }] (no word list involved).
 * The first is the "literal" reading used for names and anything the list does not know.
 */
export function literalReadings(raw, limit = 4) {
  const q = normalizeTyped(raw);
  if (!q) return [];
  const states = search(q, null, 40);
  const seen = new Set();
  const out = [];
  for (const s of states) {
    if (seen.has(s.surf)) continue;
    seen.add(s.surf);
    out.push({ text: s.surf, cost: s.cost });
    if (out.length >= limit) break;
  }
  return out;
}
