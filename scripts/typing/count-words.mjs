#!/usr/bin/env node
/**
 * Counts Devanagari word forms in whatever text arrives on stdin (wiki markup is fine: only runs of
 * Devanagari letters and signs are kept) and prints "word<TAB>times", most frequent first.
 *
 *   curl -s https://dumps.wikimedia.org/hiwiki/latest/hiwiki-latest-pages-articles.xml.bz2 | bzcat \
 *     | node scripts/typing/count-words.mjs > counts-wiki.tsv
 *   (the same with hiwikisource for the literature counts)
 *
 * The output feeds scripts/typing/build-lexicon.mjs. Nothing is stored but the counts.
 */
import { stdin, stdout, stderr } from 'node:process';

// letters, vowel signs, nukta, virama, anusvara... but not danda, digits or punctuation (U+0964..U+096F)
const RUN = /[ऀ-ॣॱ-ॿ]+/g;
const counts = new Map();
let carry = '';
let chars = 0;

function eat(text) {
  RUN.lastIndex = 0;
  let m;
  while ((m = RUN.exec(text)) !== null) counts.set(m[0], (counts.get(m[0]) || 0) + 1);
}

stdin.setEncoding('utf8');
stdin.on('data', (chunk) => {
  chars += chunk.length;
  const text = carry + chunk;
  // hold back a trailing run that may continue in the next chunk
  let cut = text.length;
  while (cut > 0 && /[ऀ-ॣॱ-ॿ]/.test(text[cut - 1])) cut -= 1;
  carry = text.slice(cut);
  eat(text.slice(0, cut));
  if (chars % 50000000 < chunk.length) stderr.write(`${(chars / 1e6).toFixed(0)}M chars, ${counts.size} forms\n`);
});
stdin.on('end', () => {
  eat(carry);
  const merged = new Map();
  for (const [word, n] of counts) {
    const key = word.normalize('NFC');
    merged.set(key, (merged.get(key) || 0) + n);
  }
  const rows = [...merged].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  stdout.write(rows.map(([w, n]) => `${w}\t${n}`).join('\n') + '\n');
  stderr.write(`done: ${chars} chars, ${rows.length} forms with count >= 2\n`);
});
