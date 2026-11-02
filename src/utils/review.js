import { locate } from './textAnchors';

// Why a passage is flagged. The keys are the ones the server accepts.
export const CATEGORIES = [
  ['language', 'अशोभनीय भाषा'],
  ['violence', 'हिंसा'],
  ['hate', 'नफ़रत / भेदभाव'],
  ['adult', 'वयस्क सामग्री'],
  ['private', 'निजी जानकारी'],
  ['copyright', 'कॉपीराइट / नकल'],
  ['fact', 'तथ्य की जाँच'],
  ['style', 'भाषा-शैली / वर्तनी'],
  ['other', 'अन्य'],
];

const LABELS = Object.fromEntries(CATEGORIES);
export const categoryLabel = (key) => LABELS[key] || LABELS.other;

export const STATE_LABELS = {
  changes_requested: 'बदलाव माँगे गए',
  resubmitted: 'समीक्षा की प्रतीक्षा में',
};

// Review notes are painted with the same marker as reader highlights, so they take negative ids:
// a mark's data-hl list can then tell a note (< 0) from a reader's highlight (> 0).
export const noteMarkId = (note) => -note.id;
export const isNoteMarkId = (id) => id < 0;

const SPACE = /\s/;

/** Whitespace-collapsed copy of `raw` plus, for each collapsed character, where it came from. */
export function collapseWithMap(raw) {
  const chars = [];
  const map = [];
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i += 1) {
    if (SPACE.test(raw[i])) {
      if (chars.length) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      chars.push(' ');
      map.push(i - 1);
      pendingSpace = false;
    }
    chars.push(raw[i]);
    map.push(i);
  }
  return { text: chars.join(''), map };
}

/**
 * Where a note's passage sits in `raw` (the editor's plain text), as { start, end } offsets
 * into it, or null when the writer has since reworded it. Notes are anchored in whitespace-
 * collapsed text, so the editor's text is collapsed the same way before looking.
 */
export function findNoteInText(raw, note) {
  const { text, map } = collapseWithMap(raw || '');
  const at = locate({ text }, note);
  if (at < 0) return null;
  const last = at + note.text.length - 1;
  return { start: map[at], end: map[last] + 1 };
}
