/**
 * Catalog keys are the Hindi text exactly as the page shows it, with every number replaced by a
 * numbered slot: "6 रचनाएँ" is looked up as "{0} रचनाएँ", so one entry serves every count. A
 * translation uses the same slots, in whatever order its language needs: "{0} stories".
 */
const NUMBER = /\d+(?:[.,]\d+)*/g;

/** { key, values } for a piece of text (numbers become {0}, {1}... and are kept aside). */
export function normalize(text) {
  const values = [];
  const key = String(text).replace(NUMBER, (number) => {
    values.push(number);
    return `{${values.length - 1}}`;
  });
  return { key, values };
}

/** Put the numbers back into a translated template. */
export function fill(template, values) {
  return template.replace(/\{(\d+)\}/g, (slot, index) => (values[index] !== undefined ? values[index] : slot));
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SLOT = /(\{\*\d+\})/;

// Catalog entries with {*1}, {*2}... are patterns: "{*1} फ़ॉलोअर्स" matches whatever stands in the slot
// (a name, a number). They are turned into regular expressions once per catalog.
const compiled = new WeakMap();
function patternsOf(catalog) {
  let list = compiled.get(catalog);
  if (list) return list;
  list = [];
  Object.keys(catalog).forEach((key) => {
    if (!/\{\*\d+\}/.test(key)) return;
    const parts = key.split(SLOT);
    const slots = [];
    const source = parts
      .map((part) => {
        const slot = part.match(/^\{\*(\d+)\}$/);
        if (slot) {
          slots.push(slot[1]);
          return '(.+?)';
        }
        return escapeRegExp(part);
      })
      .join('');
    list.push({ regex: new RegExp(`^${source}$`), slots, template: catalog[key], literal: key.replace(/\{\*\d+\}/g, '').length });
  });
  // the one with the most fixed text is the most specific
  list.sort((a, b) => b.literal - a.literal);
  compiled.set(catalog, list);
  return list;
}

function exact(catalog, key) {
  return Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : undefined;
}

/**
 * The translation of `source` in `catalog`, or null when it has none. Spaces at the ends are kept.
 * An exact entry wins; then a pattern, whose slots are filled with what stood there (translated too
 * when that is an entry itself: a language name, "चालू").
 */
export function translateWith(catalog, source) {
  if (!catalog || !source) return null;
  const lead = source.match(/^\s*/)[0];
  const trail = source.match(/\s*$/)[0];
  const core = source.slice(lead.length, source.length - trail.length);
  if (!core) return null;
  const { key, values } = normalize(core);
  const text = translateKey(catalog, key, values);
  return text === null ? null : lead + text + trail;
}

/** The same for a key that is already normalized (numbers are {0}, {1}...), as the catalog's own keys are. */
export function translateKey(catalog, key, values = []) {
  const hit = exact(catalog, key);
  if (hit !== undefined) return fill(hit, values);
  const patterns = patternsOf(catalog);
  for (let i = 0; i < patterns.length; i += 1) {
    const match = key.match(patterns[i].regex);
    if (!match) continue;
    const text = patterns[i].template.replace(/\{\*(\d+)\}/g, (all, n) => {
      const at = patterns[i].slots.indexOf(n);
      if (at === -1) return all;
      const piece = match[at + 1];
      const inner = exact(catalog, piece.trim());
      return inner !== undefined ? piece.replace(piece.trim(), inner) : piece;
    });
    return fill(text, values);
  }
  return null;
}
