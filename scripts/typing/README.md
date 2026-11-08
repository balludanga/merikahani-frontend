# Hindi typing: where the word list comes from, and how it is measured

The live Hinglish typing in the editor (`src/typing/`) matches the letters a writer types against a list
of real Hindi words. This folder holds everything that builds and checks that list. None of it runs in
the browser or in `npm run build`.

## What ships

`src/typing/hindi-lexicon.txt` — 83,836 words, 0.9 MB (about 240 KB gzip / 195 KB Brotli on the wire),
prefix-compressed (see `src/typing/lexicon.js`). Each line is a spelling and a weight, where weight =
10 × log10(occurrences per 100 million words). It is fetched once, the first time someone types, and
cached by the browser (the file name carries a hash, so Vercel serves it with the long-lived cache
header the `/static/` rule already sets).

## Where the words come from

| Source | Used for | Terms |
| --- | --- | --- |
| Hindi Wikipedia, articles dump of 2026-11-01 | how common each word is in everyday and modern prose | text CC BY-SA 4.0; **only word counts are used**, no sentences are kept |
| Hindi Wikisource, dump of 2026-11-01 | how common each word is in stories and verse | text CC BY-SA 4.0 / public domain; word counts only |
| `curated.txt`, `verbs.txt`, `adjectives.txt` | spoken, poetic and inflected words an encyclopedia rarely uses | written for this project |

A list of how often each word occurs is a statistic about the language, not a copy of any page. Credit
anyway: *"Word frequencies counted from Hindi Wikipedia and Hindi Wikisource (CC BY-SA 4.0)."*

`build-lexicon.mjs` keeps a word only if it is well-formed Devanagari and common somewhere (or seen in both
kinds of text), then drops glued words (`करनेके`, `अधिकारोंकी` — a long word plus a postposition, much
rarer than the word alone), then adds the hand-written words and the regular verb/adjective forms
(`morphology.mjs`). The file is reproducible byte for byte from the inputs.

## Rebuilding it

```sh
# 1. count words (streams the dumps; nothing is stored but the counts)
curl -s https://dumps.wikimedia.org/hiwiki/latest/hiwiki-latest-pages-articles.xml.bz2 | bzcat \
  | node scripts/typing/count-words.mjs > /tmp/counts-wiki.tsv
curl -s https://dumps.wikimedia.org/hiwikisource/latest/hiwikisource-latest-pages-articles.xml.bz2 | bzcat \
  | node scripts/typing/count-words.mjs > /tmp/counts-source.tsv

# 2. build the list
node scripts/typing/build-lexicon.mjs --wiki /tmp/counts-wiki.tsv --source /tmp/counts-source.tsv \
  --curated scripts/typing/curated.txt --verbs scripts/typing/verbs.txt \
  --adjectives scripts/typing/adjectives.txt --max 200000 --out src/typing/hindi-lexicon.txt
```

Newer dumps give a slightly different list; that is fine. Re-run the evaluation below and compare.

## Measuring it

Real people's spellings are the test. The **Dakshina** romanization data (Google Research, CC BY-SA 4.0,
<https://github.com/google-research-datasets/dakshina>) has Hindi words and sentences that people
typed in Latin letters. It is used for measuring only and is never shipped. Get the three files you need
by streaming the 2 GB tar and stopping early:

```sh
curl -s https://storage.googleapis.com/gresearch/dakshina/dakshina_dataset_v1.0.tar | tar -xqf - -C /tmp/dakshina \
  dakshina_dataset_v1.0/hi/lexicons/hi.translit.sampled.dev.tsv \
  dakshina_dataset_v1.0/hi/lexicons/hi.translit.sampled.test.tsv \
  dakshina_dataset_v1.0/hi/romanized/hi.romanized.split.tsv
node scripts/typing/evaluate.mjs --lexicon src/typing/hindi-lexicon.txt --keystrokes 1 \
  --pairs /tmp/dakshina/dakshina_dataset_v1.0/hi/lexicons/hi.translit.sampled.test.tsv
node scripts/typing/evaluate.mjs --lexicon src/typing/hindi-lexicon.txt --keystrokes 1 --format sentences \
  --pairs /tmp/dakshina/dakshina_dataset_v1.0/hi/romanized/hi.romanized.split.tsv --skip 100000 --limit 20000
```

"Right" means the intended word, ignoring the nukta dot (writers use it inconsistently). *First* is the
row that space accepts; *in the list* is anywhere among the (at most seven) rows the writer sees.

Results on data the ranking was **not** tuned on:

| | old engine (fixed rules) | now: first | now: in the list |
| --- | --- | --- | --- |
| running text (words weighted by use; tokens 100,000–120,000) | 57% | **87%** | 92% |
| running text (first 20,000 tokens, which the ranking was tuned on) | 45% | 82% | 88% |
| rare words (2,500 Wikipedia words, test split, 4,502 spellings) | 18% | **53%** | 65% |

On average a word appears in the list after about half of its letters have been typed. A broad set of
290 everyday story words (`src/typing/storyWords.fixture.js`, checked by `engine.test.js`) comes out right first 95% of the
time and is in the list 99% of the time; most of the rest are two valid spellings (आये / आए, हँसी / हंसी).
Coverage of the site's own stories by the word list is about 98%.

What the benchmark cannot tell you: it is made of Wikipedia sentences, so names and encyclopedic words
are over-represented. For fiction, the curated list and the writer's own words (see below) matter more.

## What was tuned, and what was not

- The weight of word frequency against "how natural is this spelling" (`RANK` in `engine.js`) was searched
  on a grid; the defaults sit on a plateau, so re-weighting gains nothing.
- A few costs were set from the data: a final plain *a* is the long ā far more often than silent
  (`FINAL_A_SHORT`), and how likely a writer is to leave out a nasal dot (`IMPLIED_*`).
- Individual rule costs in `tables.js` are hand-set. Learning them from the Dakshina training split
  (Viterbi-style: align each romanization to its word, count which alternatives were used) is the obvious
  next step and was not done.

## Not done on purpose

- No network lookups while typing (Google Input Tools and similar). Every key would send the writer's
  unpublished text to a third party, and the privacy page promises it does not.
- No bigger list: past about 70k words the additions are mostly proper nouns and typos from Wikipedia, which
  slow nothing but add noise. The extra literary words are better added to `curated.txt`.
