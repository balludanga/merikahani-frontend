/**
 * Lists the interface strings in the source: every Hindi piece of text a person can see.
 * Used by the coverage test (every one has a translation) and by `node scripts/i18n/list.mjs`
 * when a translator needs the list. Not part of the app.
 *
 * A string is found as a JSX text, a string or template literal. A template with ${...} in it becomes a
 * pattern with {*1}, {*2}... in place of the parts that change; digits become {0}, {1}... (normalize.js).
 */
const fs = require('fs');
const path = require('path');

const DEVANAGARI = /[ऀ-ॿ]/;
const SRC = path.join(__dirname, '..');

// Not interface text: typing data, the language list (named in code), the translations themselves
const SKIP_DIRS = ['typing', 'i18n', 'languages/registry.js'];
// seo.js holds the text of <meta> tags and page descriptions, not the page
const SKIP_FILES = new Set(['utils/transliterate.js', 'utils/seo.js']);
// Pages and tools only the owner and the review team use stay in Hindi
const STAFF = new Set([
  'pages/Ops.jsx', 'components/ProfitSheet.jsx', 'components/PartnerMonths.jsx', 'components/PartnerPayouts.jsx',
  'components/OwnerPayments.jsx', 'components/PartnerApplications.jsx', 'components/ReviewerTeam.jsx',
  'pages/PartnerDesk.jsx', 'components/ReviewPanel.jsx', 'components/ReviewNoteComposer.jsx',
  'components/ReviewNoteList.jsx', 'pages/Review.jsx', 'utils/review.js',
]);

function walk(dir, out = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) && !/fixture/.test(entry.name)) out.push(full);
  });
  return out;
}

const normalizeDigits = (text) => {
  let n = 0;
  return text.replace(/\d+(?:[.,]\d+)*/g, () => `{${n++}}`);
};

// Comments are not interface text: drop them (a line comment starts with // that is not part of "https://")
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ${...} may hold a nested template or a ternary: find the matching brace
function maskExpressions(text) {
  let out = '';
  let slot = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '$' && text[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth += 1;
        else if (text[j] === '}') depth -= 1;
        j += 1;
      }
      slot += 1;
      out += `\u0001${String.fromCharCode(96 + slot)}\u0001`; // a letter, so numbers stay numbers
      i = j - 1;
    } else {
      out += text[i];
    }
  }
  return out;
}

// JSX text is shown with its HTML entities decoded
const ENTITIES = { '&ldquo;': '\u201c', '&rdquo;': '\u201d', '&lsquo;': '\u2018', '&rsquo;': '\u2019', '&amp;': '&', '&nbsp;': '\u00a0', '&mdash;': '\u2014', '&hellip;': '\u2026' };
const decode = (text) => text.replace(/&[a-z]+;/g, (entity) => ENTITIES[entity] || entity);

function pieces(rawSource) {
  const source = withoutComments(rawSource);
  const found = [];
  const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = literal.exec(source))) {
    const text = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
    if (!DEVANAGARI.test(text)) continue;
    const masked = maskExpressions(text).replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, ' ');
    // numbers first (so they are {0}, {1}), then the parts that change ({*1}, {*2})
    found.push(normalizeDigits(masked).replace(/\u0001([a-z])\u0001/g, (all, letter) => `{*${letter.charCodeAt(0) - 96}}`));
  }
  // text between tags, and the text a {expression} leaves on either side ("{minutes} मिनट")
  const jsx = /[>}]([^<>{}]*[ऀ-ॿ][^<>{}]*)[<{]/g;
  while ((m = jsx.exec(source))) found.push(normalizeDigits(decode(m[1]).replace(/\s+/g, ' ').trim()));
  return found;
}

/** { 'pages/Home.jsx': ['text', ...] } for the interface files (staff tools and typing data left out). */
function interfaceStrings() {
  const result = {};
  walk(SRC).forEach((file) => {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (SKIP_FILES.has(rel) || STAFF.has(rel) || SKIP_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`))) return;
    const found = pieces(fs.readFileSync(file, 'utf8'))
      .map((s) => s.trim())
      .filter((s) => s && DEVANAGARI.test(s) && !/[;=]\s|\)\)|\|\||="|=>|\?\s*['`]|`/.test(s));
    if (found.length) result[rel] = [...new Set(found)];
  });
  return result;
}

module.exports = { interfaceStrings, pieces, normalizeDigits };
