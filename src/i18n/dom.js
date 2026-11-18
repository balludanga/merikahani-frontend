/**
 * Puts a translation on the screen.
 *
 * The page is written in Hindi. When the interface language is another one, this walks the page
 * and swaps each piece of interface text (and the placeholder / title / aria-label of fields and
 * buttons) for its translation, then keeps watching, so whatever React draws next is translated too.
 * It changes the text of the same node and never moves or replaces nodes, so React's own bookkeeping
 * is untouched. What it remembers about each node (the Hindi it came from) lets a language change
 * go in any direction, back to Hindi included.
 *
 * Never translated: what people wrote (stories, titles, comments, names, tags). Those sit in
 * elements that carry a `lang` attribute (the page sets one on every story's text), a
 * translate="no" attribute (the page sets it on names, tags and comments), an editor, or a text box.
 */
import { translateWith } from './normalize';

const DEVANAGARI = /[ऀ-ॿ]/;
const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt', 'data-placeholder'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

const BRAND_HINDI = 'लेखनी';

let catalog = null; // null = Hindi: show the text as written
let brand = null; // how the brand name is written for this reader; null = as written (लेखनी)
let observer = null;

const textOriginal = new WeakMap(); // text node -> the Hindi it came from
const textShown = new WeakMap(); // text node -> what this module last wrote into it
const attributeState = new WeakMap(); // element -> { name: { original, shown } }

function translateString(source) {
  const hit = catalog ? translateWith(catalog, source) : null;
  const shown = hit === null ? source : hit;
  // the brand is written in the reader's script, wherever it stands (a catalog text, or Hindi left as it is)
  return brand ? shown.split(BRAND_HINDI).join(brand) : shown;
}

function inUserText(element) {
  return !!element.closest('[translate="no"], [lang]:not(html), [contenteditable="true"], .ql-editor');
}

function translateTextNode(node) {
  const value = node.nodeValue;
  // our own write coming back to us: the Hindi is what we kept; anything else is new text from the page
  const source = textShown.get(node) === value && textOriginal.has(node) ? textOriginal.get(node) : value;
  if (!source || !DEVANAGARI.test(source)) return;
  const element = node.parentElement;
  if (!element || SKIP_TAGS.has(element.tagName) || inUserText(element)) return;
  const shown = translateString(source);
  if (shown !== value) node.nodeValue = shown;
  textOriginal.set(node, source);
  textShown.set(node, shown);
}

function translateAttribute(element, name) {
  const value = element.getAttribute(name);
  if (value === null) return;
  let state = attributeState.get(element);
  if (!state) {
    state = {};
    attributeState.set(element, state);
  }
  const record = state[name];
  const source = record && record.shown === value ? record.original : value;
  if (!DEVANAGARI.test(source) || element.closest('[translate="no"]')) return;
  const shown = translateString(source);
  if (shown !== value) element.setAttribute(name, shown);
  state[name] = { original: source, shown };
}

function walk(root) {
  if (root.nodeType === 3) {
    translateTextNode(root);
    return;
  }
  if (root.nodeType !== 1) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(translateTextNode);
  const selector = ATTRIBUTES.map((a) => `[${a}]`).join(',');
  const elements = root.matches && root.matches(selector) ? [root] : [];
  root.querySelectorAll(selector).forEach((el) => elements.push(el));
  elements.forEach((el) => ATTRIBUTES.forEach((name) => translateAttribute(el, name)));
}

function onMutations(records) {
  records.forEach((record) => {
    if (record.type === 'characterData') translateTextNode(record.target);
    else if (record.type === 'attributes') translateAttribute(record.target, record.attributeName);
    else record.addedNodes.forEach(walk);
  });
}

/** Start watching the page (once). Safe to call before the catalog is known. */
export function startTranslating() {
  if (observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  observer = new MutationObserver(onMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
}

/**
 * Use this catalog (null for Hindi) and redo the whole page. `brandName` is the brand written in the
 * reader's script (null: leave लेखनी as it is); it is the same word, only its script changes.
 */
export function applyCatalog(next, brandName = null) {
  catalog = next;
  brand = brandName && brandName !== BRAND_HINDI ? brandName : null;
  if (typeof document !== 'undefined' && document.body) walk(document.body);
}

/** For tests and for text the page builds outside the DOM (a page title). */
export function translateLoose(source) {
  return translateString(source);
}
