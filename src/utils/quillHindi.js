/**
 * Quill module: live Hinglish → Devanagari inside the rich-text editor.
 *
 * Reuses the shared transliteration engine (utils/transliterate). When the
 * user types a terminator (space, newline, punctuation), the Latin word that
 * just finished is converted in place — inside paragraphs, headings, lists
 * and quotes alike — preserving formatting, selection and the undo stack.
 * Code blocks, links, code spans and URL fragments are left untouched.
 */
import Quill from 'quill';
import { transliterateWord } from './transliterate';

const Module = Quill.import('core/module');

const TERMINATOR = /[\s.,;:!?)"'[\]]/;
const DANDA = '।';

class HindiTransliteration extends Module {
  constructor(quill, options = {}) {
    super(quill, options);
    this.isEnabled = options.isEnabled || (() => true);

    quill.on('text-change', (delta, oldDelta, source) => {
      if (source !== 'user' || !this.isEnabled()) return;
      const range = quill.getSelection();
      if (!range || range.length > 0 || range.index < 1) return;

      const caret = range.index;

      // Purna viram: pressing space twice ends the Hindi sentence with "।"
      // instead of leaving a stray double space. Runs before word handling.
      if (caret >= 2 && quill.getText(caret - 2, 2) === '  ') {
        const before = caret >= 3 ? quill.getText(caret - 3, 1) : '';
        if (before && !/\s/.test(before) && before !== DANDA) {
          const fmt = quill.getFormat(caret - 2, 2);
          const [line] = quill.getLine(caret - 1);
          const lineClass = line && line.domNode ? line.domNode.className || '' : '';
          const inProtected = fmt.code || fmt.link || lineClass.indexOf('ql-code-block') !== -1;
          if (!inProtected) {
            quill.deleteText(caret - 2, 2, 'api');
            quill.insertText(caret - 2, `${DANDA} `, 'api');
            quill.setSelection(caret, 0, 'api');
            return;
          }
        }
      }

      const lastChar = quill.getText(caret - 1, 1);
      // Only act the moment a terminator lands — never mid-word.
      if (!TERMINATOR.test(lastChar)) return;

      const wordEnd = caret - 1;
      const scanStart = Math.max(0, wordEnd - 40);
      const scan = quill.getText(scanStart, wordEnd - scanStart);
      const match = /[a-zA-Z]+$/.exec(scan);
      if (!match) return;

      const word = match[0];
      const wordStart = scanStart + match.index;

      // Protected content: links, inline code, code blocks, URL fragments.
      const fmt = quill.getFormat(wordStart, word.length);
      if (fmt.link || fmt.code) return;
      const [line] = quill.getLine(wordStart);
      const lineClass = line && line.domNode ? line.domNode.className || '' : '';
      if (lineClass.indexOf('ql-code-block') !== -1) return;
      const before = quill.getText(Math.max(0, wordStart - 6), Math.min(6, wordStart));
      if (before.indexOf('://') !== -1 || before.endsWith('@') || before.endsWith('.')) return;

      const converted = transliterateWord(word);
      if (converted === word) return;

      quill.deleteText(wordStart, word.length, 'api');
      quill.insertText(wordStart, converted, 'api');
      // Caret returns to where it was, shifted by the length difference.
      const nextCaret = Math.max(0, caret + (converted.length - word.length));
      quill.setSelection(nextCaret, 0, 'api');
    });
  }
}

Quill.register('modules/hindiTransliteration', HindiTransliteration);

export default HindiTransliteration;
