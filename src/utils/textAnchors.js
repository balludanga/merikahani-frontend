/**
 * Find, mark and re-find passages of a story's text.
 *
 * A highlight is stored as the passage plus where it starts in the story's
 * "collapsed" text (runs of whitespace become one space and a paragraph, list
 * item or line break counts as a space) and a few words either side. That
 * collapsed text is the same wherever the passage crosses bold text, links or
 * paragraphs, so a highlight made across several paragraphs comes back after a
 * reload. If the story was edited since, the passage is found again by its
 * words, using the words around it to pick the right occurrence.
 *
 * The functions only read the text nodes under `root`; marks that are already
 * on the page do not change the collapsed text.
 */

// Same set of characters Python's str.split() treats as whitespace, so the text
// we send is exactly what the server stores.
const SPACES = new Set(
  '\t\n\v\f\r \x1c\x1d\x1e\x1f\x85\xa0\u1680\u2028\u2029\u202f\u205f\u3000'.split('')
);
const isSpace = (ch) => SPACES.has(ch) || (ch >= '\u2000' && ch <= '\u200a');
const BLOCKS = new Set([
  'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE',
  'DIV', 'TABLE', 'TR', 'TD', 'TH', 'FIGURE', 'FIGCAPTION', 'HR',
]);
const CONTEXT = 32;

export const MAX_HIGHLIGHT = 2000;

function blockOf(node, root) {
  let el = node.parentNode;
  while (el && el !== root) {
    if (BLOCKS.has(el.nodeName)) return el;
    el = el.parentNode;
  }
  return root;
}

/** Collapsed text of `root` plus the maps back to its text nodes. */
export function indexBody(root) {
  const nodes = [];
  const rawToFlat = []; // per node: collapsed length before each raw offset
  const charNode = []; // per collapsed char: node index, or -1 for a block break
  const charOff = [];
  const chars = [];
  let lastBlock = null;
  let pendingBreak = false;

  const pushSpace = (nodeIndex, offset) => {
    if (chars.length && chars[chars.length - 1] !== ' ') {
      chars.push(' ');
      charNode.push(nodeIndex);
      charOff.push(offset);
    }
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if (current.nodeType === 1) {
      if (current.nodeName === 'BR') pendingBreak = true;
      continue;
    }
    const value = current.nodeValue;
    const block = blockOf(current, root);
    const index = nodes.length;
    nodes.push(current);
    if (pendingBreak || (lastBlock && block !== lastBlock)) pushSpace(-1, 0);
    pendingBreak = false;
    lastBlock = block;

    const map = new Uint32Array(value.length + 1);
    for (let k = 0; k < value.length; k += 1) {
      map[k] = chars.length;
      if (isSpace(value[k])) {
        pushSpace(index, k);
      } else {
        chars.push(value[k]);
        charNode.push(index);
        charOff.push(k);
      }
    }
    map[value.length] = chars.length;
    rawToFlat.push(map);
  }

  return { root, text: chars.join(''), nodes, rawToFlat, charNode, charOff };
}

/**
 * Where `range` sits in the collapsed text, as { start, end, text, prefix,
 * suffix }; null if it holds no real text.
 */
export function anchorFromRange(index, range) {
  let start = Infinity;
  let end = -1;
  index.nodes.forEach((node, i) => {
    if (!range.intersectsNode(node)) return;
    const from = node === range.startContainer ? range.startOffset : 0;
    const to = node === range.endContainer ? range.endOffset : node.nodeValue.length;
    if (to <= from) return;
    start = Math.min(start, index.rawToFlat[i][from]);
    end = Math.max(end, index.rawToFlat[i][to]);
  });
  if (end < 0) return null;
  const { text } = index;
  while (start < end && text[start] === ' ') start += 1;
  while (end > start && text[end - 1] === ' ') end -= 1;
  if (end - start < 2) return null;
  return {
    start,
    end,
    text: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  };
}

function commonSuffix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
}

function commonPrefix(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

/**
 * Start of the stored highlight `item` ({ text, start_offset, prefix, suffix })
 * in the current text, or -1 when the passage is gone.
 */
export function locate(index, item) {
  const { text } = index;
  const needle = item.text;
  if (!needle) return -1;
  if (item.start_offset != null && text.startsWith(needle, item.start_offset)) {
    return item.start_offset;
  }
  let best = -1;
  let bestScore = -1;
  let from = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    const score =
      commonSuffix(item.prefix || '', text.slice(Math.max(0, at - CONTEXT), at)) +
      commonPrefix(item.suffix || '', text.slice(at + needle.length, at + needle.length + CONTEXT));
    if (score > bestScore) {
      best = at;
      bestScore = score;
    }
    from = at + 1;
  }
  return best;
}

/** Remove every highlight mark under `root`, leaving the text as it was. */
export function clearMarks(root) {
  const marks = root.querySelectorAll('mark.text-highlight');
  if (!marks.length) return;
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  root.normalize();
}

/** The text-node pieces [{ node, from, to }] that hold collapsed text [a, b). */
function piecesFor(index, a, b) {
  const pieces = [];
  let current = null;
  for (let k = a; k < b; k += 1) {
    const n = index.charNode[k];
    if (n < 0) continue;
    const off = index.charOff[k];
    if (current && current.n === n) {
      current.to = off + 1;
    } else {
      current = { n, node: index.nodes[n], from: off, to: off + 1 };
      pieces.push(current);
    }
  }
  return pieces;
}

/**
 * Mark every span covered by at least one item. `spans` is
 * [{ id, start, end }]; `describe(ids)` returns { className, title } for a
 * stretch covered by those ids. Overlaps never nest: each stretch gets one mark
 * that lists all the ids covering it in `data-hl`.
 */
export function applyMarks(index, spans, describe) {
  if (!spans.length) return;
  const points = Array.from(new Set(spans.flatMap((s) => [s.start, s.end]))).sort((x, y) => x - y);
  const wraps = [];
  for (let p = 0; p < points.length - 1; p += 1) {
    const a = points[p];
    const b = points[p + 1];
    const ids = spans.filter((s) => s.start <= a && s.end >= b).map((s) => s.id);
    if (!ids.length) continue;
    piecesFor(index, a, b).forEach((piece) => wraps.push({ ...piece, ids }));
  }
  // Right to left inside each text node, so a split never shifts a later offset.
  wraps.sort((x, y) => (x.n !== y.n ? y.n - x.n : y.from - x.from));
  wraps.forEach((wrap) => {
    const { className, title } = describe(wrap.ids);
    const mark = document.createElement('mark');
    mark.className = `text-highlight ${className}`;
    mark.dataset.hl = wrap.ids.join(',');
    if (title) mark.title = title;
    const range = document.createRange();
    range.setStart(wrap.node, wrap.from);
    range.setEnd(wrap.node, wrap.to);
    range.surroundContents(mark);
  });
}

/** First element holding the collapsed text [a, b), for scrolling to it. */
export function elementAt(index, a, b) {
  const [piece] = piecesFor(index, a, b);
  return piece ? piece.node.parentElement : null;
}
