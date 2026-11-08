#!/usr/bin/env node
/**
 * How good is the Hinglish typing engine? Measured against how real people spell Hindi in Latin letters.
 *
 *   node scripts/typing/evaluate.mjs --lexicon src/typing/hindi-lexicon.txt --pairs <file> [--limit N] [--rank freq=1,cost=1]
 *
 * <file> holds lines "devanagari<TAB>latin<TAB>times" (the Dakshina romanization lexicon, CC BY-SA 4.0,
 * Google Research: https://github.com/google-research-datasets/dakshina). It is used for measuring only and
 * is never shipped. Each line is one person's spelling of one word.
 *
 * Reports, for the writer's list of candidates (the rows shown under the caret):
 *   top1 / top3 / top7   how often the intended word is first / among the first three / anywhere in the list
 *   typed->shown         for the fewest letters that make the word appear (a prefix of what was typed),
 *                        the average share of the letters that had to be typed
 * A word is "right" when it matches ignoring the nukta dot, which writers use inconsistently.
 */
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { assemble } from '../../src/typing/composer.js';
import { Engine } from '../../src/typing/engine.js';
import { foldKey } from '../../src/typing/lexicon.js';

export function readPairs(file, limit = Infinity) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    const [native, latin, times] = line.split('\t');
    if (!native || !latin || !/^[a-zA-Z]+$/.test(latin)) continue;
    rows.push({ native: native.normalize('NFC'), latin, times: Number(times) || 1 });
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Token pairs from running text: lines "devanagari<TAB>n<TAB>latin<TAB>n" whose two sides have the same
 * number of words (the Dakshina "romanized.split" file). Each word keeps the weight of one occurrence,
 * so common words count as often as they are used.
 */
export function readSentencePairs(file, limit = Infinity, skip = 0) {
  const trim = /^[\s.,;:!?'"()[\]\-।|]+|[\s.,;:!?'"()[\]\-।|]+$/g;
  const rows = [];
  let seen = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    const [native, , latin] = line.split('\t');
    if (!native || !latin) continue;
    const a = native.split(/\s+/);
    const b = latin.split(/\s+/);
    if (a.length !== b.length) continue;
    for (let i = 0; i < a.length; i += 1) {
      const nativeWord = a[i].replace(trim, '').normalize('NFC');
      const latinWord = b[i].replace(trim, '');
      if (/^[\u0900-\u0963]+$/.test(nativeWord) && /^[A-Za-z]+$/.test(latinWord)) {
        seen += 1;
        if (seen <= skip) continue;
        rows.push({ native: nativeWord, latin: latinWord, times: 1 });
        if (rows.length >= limit) return rows;
      }
    }
  }
  return rows;
}

export function makeEngine(lexiconFile, rank = {}) {
  const engine = new Engine(rank);
  if (lexiconFile) engine.setLexiconText(fs.readFileSync(lexiconFile, 'utf8'));
  return engine;
}

/** Fewest letters of `latin` after which `native` is among the rows shown; null if never. */
function lettersNeeded(engine, latin, native, rows = 7) {
  const want = foldKey(native);
  for (let n = 1; n <= latin.length; n += 1) {
    const list = assemble(engine.suggest(latin.slice(0, n))).slice(0, rows);
    if (list.some((c) => foldKey(c.text) === want)) return n;
  }
  return null;
}

export function evaluate(engine, pairs, { keystrokes = false } = {}) {
  const t0 = performance.now();
  let n = 0;
  let w = 0;
  const hit = { top1: 0, top3: 0, top7: 0, conv1: 0 };
  const wHit = { top1: 0, top3: 0, top7: 0 };
  let saved = 0;
  let savedN = 0;
  const misses = [];
  for (const { native, latin, times } of pairs) {
    const want = foldKey(native);
    const result = engine.suggest(latin);
    const rows = assemble(result);
    const at = rows.findIndex((c) => foldKey(c.text) === want);
    n += 1;
    w += times;
    if (result.convert[0] && foldKey(result.convert[0].text) === want) hit.conv1 += 1;
    if (at === 0) {
      hit.top1 += 1;
      wHit.top1 += times;
    }
    if (at >= 0 && at < 3) {
      hit.top3 += 1;
      wHit.top3 += times;
    }
    if (at >= 0) {
      hit.top7 += 1;
      wHit.top7 += times;
    } else if (misses.length < 4000) {
      misses.push({ native, latin, got: rows.slice(0, 3).map((c) => c.text) });
    }
    if (keystrokes) {
      const k = lettersNeeded(engine, latin, native);
      if (k !== null) {
        saved += k / latin.length;
        savedN += 1;
      }
    }
  }
  const ms = performance.now() - t0;
  const pct = (x, d) => Math.round((1000 * x) / d) / 10;
  return {
    pairs: n,
    top1: pct(hit.top1, n),
    top3: pct(hit.top3, n),
    top7: pct(hit.top7, n),
    wTop1: pct(wHit.top1, w),
    wTop3: pct(wHit.top3, w),
    wTop7: pct(wHit.top7, w),
    conversionTop1: pct(hit.conv1, n),
    typedShare: savedN ? Math.round((1000 * saved) / savedN) / 10 : null,
    msPerWord: Math.round((100 * ms) / n) / 100,
    misses,
  };
}

function parseRank(text) {
  const out = {};
  if (!text) return out;
  text.split(',').forEach((pair) => {
    const [k, v] = pair.split('=');
    out[k] = Number(v);
  });
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('evaluate.mjs')) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? acc.concat([[a.slice(2), all[i + 1]]]) : acc), [])
  );
  const pairs =
    args.format === 'sentences'
      ? readSentencePairs(args.pairs, Number(args.limit) || Infinity, Number(args.skip) || 0)
      : readPairs(args.pairs, Number(args.limit) || Infinity);
  const engine = makeEngine(args.lexicon, parseRank(args.rank));
  const r = evaluate(engine, pairs, { keystrokes: args.keystrokes !== undefined });
  const { misses, ...summary } = r;
  console.log(JSON.stringify(summary, null, 2));
  if (args.misses) {
    console.log('\nsome misses (intended | typed | shown first):');
    misses.slice(0, Number(args.misses)).forEach((m) => console.log(`${m.native}\t${m.latin}\t${m.got.join(' ')}`));
  }
}
