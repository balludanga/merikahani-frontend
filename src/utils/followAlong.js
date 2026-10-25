/**
 * Follow-along reading: a band of colour that flows over the word being narrated, and keeps it
 * in view.
 *
 * The story text on the page is never changed. The band is a separate element laid over the
 * page; every frame it eases toward the word's real position, its front edge faster than its
 * back edge, so it stretches forward and settles like a current rather than jumping from word to
 * word. At the start of a new line it opens out from the line's start. Because the word's
 * position is read again every frame, the band stays right through scrolling and reflow.
 *
 * Two kinds of narration feed it a spoken-word index: the server's audio (word times from the
 * backend, or an estimate) and the browser's own voice (word-boundary events or a timer). The
 * spoken words and the words on the page come from the same text but not letter for letter (the
 * title is spoken, quote marks are not, a divider is skipped), so they are matched up first.
 */

// How quickly the band's edges ease toward the word (time constants, ms): the front edge runs
// ahead of the back edge, which is what makes it look like flowing water.
const FRONT_MS = 70;
const BACK_MS = 150;
const LINE_MS = 60;
// The band eases toward each word, so it arrives a little after the word starts. Reading the
// audio clock this far ahead cancels that (measured: the band trailed the voice by 0.13 s).
const LOOKAHEAD = 0.12;
const PAD_X = 3;
const PAD_Y = 1;

/** A word reduced to what is heard: no punctuation, quote marks or nukta, one spelling. */
export function normalizeWord(word) {
  return String(word)
    .normalize('NFD')
    .replace(/[़‌‍]/g, '')
    .replace(/[^ऀ-ॣ०-ॿa-zA-Z0-9]/g, '')
    .toLowerCase();
}

/**
 * Match spoken words to page words, in order. Returns an array: for each spoken word, the index
 * of its page word, or -1 when it has none (the title, a word the page does not show).
 * `skip` leading spoken words (the title) are left unmatched.
 */
export function alignWords(spoken, page, skip = 0, reach = 8) {
  const map = new Array(spoken.length).fill(-1);
  let i = skip;
  let j = 0;
  while (i < spoken.length && j < page.length) {
    if (spoken[i] === '') {
      i += 1;
    } else if (page[j] === '') {
      j += 1;
    } else if (spoken[i] === page[j]) {
      map[i] = j;
      i += 1;
      j += 1;
    } else {
      // Out of step: is the next spoken word a little further on the page, or the next page
      // word a little further in the speech? Skip whichever gap is shorter.
      let pageAhead = -1;
      let speechAhead = -1;
      for (let k = 1; k <= reach; k += 1) {
        if (pageAhead < 0 && page[j + k] === spoken[i]) pageAhead = k;
        if (speechAhead < 0 && spoken[i + k] === page[j]) speechAhead = k;
      }
      if (pageAhead > 0 && (speechAhead < 0 || pageAhead <= speechAhead)) {
        j += pageAhead;
      } else if (speechAhead > 0) {
        i += speechAhead;
      } else {
        // Same place, spelled differently: take them as the same word.
        map[i] = j;
        i += 1;
        j += 1;
      }
    }
  }
  return map;
}

/** The words of the story as laid out on the page: text node, position, and normalized form. */
export function tokenizePage(root) {
  const tokens = [];
  if (!root) return tokens;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const pattern = /\S+/g;
    let match = pattern.exec(node.nodeValue);
    while (match) {
      tokens.push({
        node,
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        norm: normalizeWord(match[0]),
      });
      match = pattern.exec(node.nodeValue);
    }
  }
  return tokens;
}

/** Index of the last time that is <= `at` (-1 before the first). `times` is ascending. */
export function indexAt(times, at) {
  let low = 0;
  let high = times.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (times[mid] <= at) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

// Room for the pause after a word, in "letters" of speaking time (same figures as the server).
const PAUSE_WEIGHT = { clause: 4.5, sentence: 11 };

const letters = (word) => Math.max(1, (word.match(/[ऀ-ॣ०-ॿ\w]/g) || []).length);

function pauseAfter(word) {
  if (/[।॥?!][”"’)]*$|\.[”"’)]*$/.test(word)) return PAUSE_WEIGHT.sentence;
  if (/[,;:—–…][”"’)]*$/.test(word)) return PAUSE_WEIGHT.clause;
  return 0;
}

/**
 * Word start times (seconds) spread over `duration` by word length and punctuation pauses.
 * A fallback for narrations whose real word times are not available.
 */
export function estimateTimes(words, duration) {
  const weights = words.map((word, i) => letters(word) + (i < words.length - 1 ? pauseAfter(word) : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  return weights.map((weight) => {
    const start = (at / total) * duration;
    at += weight;
    return start;
  });
}

/**
 * One follow-along session over the story body `root`.
 *
 *   const follow = createFollowAlong(root);
 *   follow.setSpoken(words, titleWords);   // the words as spoken, in order
 *   follow.moveTo(i);                      // the i-th spoken word is being said now
 *   follow.attachAudio(audio, timings);    // or: follow an <audio> element by its clock
 *   follow.stop();
 */
export function createFollowAlong(root) {
  let page = [];
  let map = [];
  let lastPage = -1;
  let manualUntil = 0;
  let frame = 0;
  let loop = 0;
  let stopped = false;
  let onMetadata = null;
  let media = null;
  let target = null; // the Range of the word being said
  let box = null; // where the band is drawn now, in page coordinates
  let lastTick = 0;

  const reduceMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pill = document.createElement('div');
  pill.className = 'narration-pill';
  pill.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pill);

  const noteManualScroll = () => {
    manualUntil = Date.now() + 5000; // the reader is steering: leave the page alone for a while
  };
  const keys = (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) noteManualScroll();
  };
  window.addEventListener('wheel', noteManualScroll, { passive: true });
  window.addEventListener('touchmove', noteManualScroll, { passive: true });
  window.addEventListener('keydown', keys);

  const rangeFor = (token) => {
    const range = document.createRange();
    range.setStart(token.node, token.start);
    range.setEnd(token.node, token.end);
    return range;
  };

  /** The word's rectangle in page coordinates (its first line, if it wraps). */
  const wordBox = (range) => {
    const rects = range.getClientRects ? range.getClientRects() : null;
    const r = rects && rects.length ? rects[0] : range.getBoundingClientRect();
    return {
      x0: r.left + window.scrollX - PAD_X,
      x1: r.right + window.scrollX + PAD_X,
      y0: r.top + window.scrollY - PAD_Y,
      y1: r.bottom + window.scrollY + PAD_Y,
    };
  };

  const keepInView = (range) => {
    if (Date.now() < manualUntil) return;
    const rect = range.getBoundingClientRect ? range.getBoundingClientRect() : null;
    if (!rect || (!rect.height && !rect.width)) return;
    const height = window.innerHeight;
    if (rect.top < height * 0.18 || rect.bottom > height * 0.62) {
      window.scrollTo({ top: window.scrollY + rect.top - height * 0.3, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  };

  const ease = (from, to, dt, ms) => from + (to - from) * (1 - Math.exp(-dt / ms));

  /** One animation frame: let the band flow toward the current word, and draw it. */
  const flow = () => {
    if (stopped) return;
    const now = Date.now();
    const dt = Math.min(64, lastTick ? now - lastTick : 16);
    lastTick = now;
    if (target) {
      const goal = wordBox(target);
      if (!box || reduceMotion()) {
        box = { ...goal, x1: reduceMotion() ? goal.x1 : goal.x0 };
      } else if (Math.abs(goal.y0 - box.y0) > (goal.y1 - goal.y0) * 0.6) {
        // A new line: begin at its start and open out along it.
        box = { x0: goal.x0 - 14, x1: goal.x0 - 14, y0: goal.y0, y1: goal.y1 };
      } else {
        box.y0 = ease(box.y0, goal.y0, dt, LINE_MS);
        box.y1 = ease(box.y1, goal.y1, dt, LINE_MS);
      }
      if (!reduceMotion()) {
        box.x0 = ease(box.x0, goal.x0, dt, BACK_MS);
        box.x1 = ease(box.x1, goal.x1, dt, FRONT_MS);
      }
      pill.style.transform = `translate3d(${box.x0}px, ${box.y0}px, 0)`;
      pill.style.width = `${Math.max(0, box.x1 - box.x0)}px`;
      pill.style.height = `${Math.max(0, box.y1 - box.y0)}px`;
      pill.classList.add('on');
    }
    loop = requestAnimationFrame(flow);
  };
  loop = requestAnimationFrame(flow);

  const follow = {
    /** The spoken words, in order; the first `titleWords` are the title and are not on the page. */
    setSpoken(words, titleWords = 0) {
      page = tokenizePage(root);
      map = alignWords(words.map(normalizeWord), page.map((t) => t.norm), titleWords);
      lastPage = -1;
    },

    /** The page word the band is on, as written (for tests and debugging). */
    current() {
      return page[lastPage] ? page[lastPage].raw : null;
    },

    /** The i-th spoken word is being said. */
    moveTo(i) {
      if (stopped || !map.length) return;
      let at = map[i] === undefined ? -1 : map[i];
      for (let back = 1; at < 0 && back <= 6 && i - back >= 0; back += 1) at = map[i - back]; // a gap: stay on the last word
      if (at < 0 || at === lastPage || !page[at]) return;
      lastPage = at;
      try {
        target = rangeFor(page[at]);
      } catch (error) {
        return; // the page changed under us; the next word will do
      }
      keepInView(target);
    },

    /** Follow an audio element: its clock decides the word, with real `timings` or an estimate. */
    attachAudio(audio, timings) {
      media = audio;
      const begin = () => {
        let times;
        if (timings && timings.w && timings.w.length && timings.t && timings.t.length === timings.w.length) {
          follow.setSpoken(timings.w, timings.title || 0);
          times = timings.t;
        } else {
          page = tokenizePage(root);
          follow.setSpoken(page.map((t) => t.raw), 0);
          times = estimateTimes(page.map((t) => t.raw), audio.duration || 0);
        }
        let shown = -2;
        const tick = () => {
          if (stopped) return;
          const i = indexAt(times, audio.currentTime + LOOKAHEAD);
          if (i !== shown && i >= 0) {
            shown = i;
            follow.moveTo(i);
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      };
      const needsLength = !(timings && timings.w && timings.w.length);
      if (needsLength && !(audio.duration > 0)) {
        onMetadata = () => begin();
        audio.addEventListener('loadedmetadata', onMetadata, { once: true });
      } else {
        begin();
      }
    },

    /** End the session: let the band fade away and stop watching. */
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(loop);
      window.removeEventListener('wheel', noteManualScroll);
      window.removeEventListener('touchmove', noteManualScroll);
      window.removeEventListener('keydown', keys);
      if (media && onMetadata) media.removeEventListener('loadedmetadata', onMetadata);
      pill.classList.remove('on');
      setTimeout(() => pill.remove(), 400);
    },
  };
  return follow;
}
