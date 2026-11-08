/**
 * Quill module: live Hinglish → Devanagari inside the story editor.
 *
 * Two ways in, because keyboards differ:
 *   - A physical keyboard reports each key, so the word is composed live (composer.js): the Devanagari
 *     is written as the letters are typed, with a list of other spellings and longer words.
 *   - A phone keyboard does not report keys. The letters arrive as plain text, and the word is
 *     converted when a space or punctuation ends it (the way it always worked), now through the same
 *     word list.
 * Code blocks, inline code, links and web addresses are left exactly as typed in both.
 */
import Quill from 'quill';
import { Composer } from './composer.js';
import { convertWord } from './convert.js';
import { QuillHost } from './quillHost.js';
import { engine, loadLexicon, showSuggestions } from './setup.js';
import { sharedBox } from './suggestBox.js';

const Module = Quill.import('core/module');

const TERMINATOR = /[\s.,;:!?)"'[\]]/;
const DANDA = '।';

class HindiTyping extends Module {
  constructor(quill, options = {}) {
    super(quill, options);
    this.isEnabled = options.isEnabled || (() => true);
    const host = new QuillHost(quill);
    const composer = new Composer(host, { box: sharedBox(), enabled: this.isEnabled, showList: showSuggestions });
    this.host = host;
    this.composer = composer;

    quill.root.setAttribute('aria-autocomplete', 'list');
    quill.root.setAttribute('aria-haspopup', 'listbox');

    // capture phase: run before Quill's own key bindings, which skip a key that has been handled
    quill.root.addEventListener('keydown', (e) => composer.keydown(e), true);
    quill.root.addEventListener('beforeinput', (e) => composer.guardInput(e), true);
    quill.root.addEventListener('mousedown', () => composer.interrupted());
    quill.root.addEventListener('blur', () => composer.interrupted());
    quill.root.addEventListener('compositionstart', () => composer.interrupted());
    quill.on('selection-change', (range) => {
      if (host.busy || !composer.active) return;
      if (!range || range.length > 0 || range.index !== composer.expectedCaret()) composer.interrupted();
    });

    // the words already in the story are offered first (a character's name, a place)
    const readStory = () => engine.setStoryText(quill.getText());
    let timer = null;
    quill.on('text-change', (delta, old, source) => {
      if (source === 'api' && !host.busy) {
        clearTimeout(timer);
        timer = setTimeout(readStory, 500); // the story was loaded or replaced
      }
      if (host.busy || composer.active) return;
      if (source === 'user' && this.isEnabled()) this.convertLater(quill, delta);
    });
    setTimeout(readStory, 300);
    if (this.isEnabled()) setTimeout(loadLexicon, 200);
  }

  /**
   * Put the caret somewhere once Quill is done with the change that called us. While it is still handling
   * a change it saves the caret, emits `text-change`, then puts the saved caret back - so a caret set from
   * inside the handler is overwritten a moment later. A microtask runs after all of that.
   */
  caretLater(quill, index) {
    Promise.resolve().then(() => this.host.change(() => quill.setSelection(index, 0, 'api')));
  }

  /**
   * Phone path: a space or punctuation just arrived as plain text; convert the word before it.
   * Where the text landed is read from the change itself: right then, the editor's own idea of the
   * caret can still be the position from before the key was pressed.
   */
  convertLater(quill, delta) {
    let caret = null;
    let at = 0;
    delta.ops.forEach((op) => {
      if (op.retain) at += op.retain;
      else if (op.insert !== undefined) {
        at += typeof op.insert === 'string' ? op.insert.length : 1;
        caret = at;
      }
    });
    if (caret === null || caret < 1) return;

    // two spaces end the sentence with the Hindi full stop
    if (caret >= 2 && quill.getText(caret - 2, 2) === '  ') {
      const before = caret >= 3 ? quill.getText(caret - 3, 1) : '';
      if (before && !/\s/.test(before) && before !== DANDA) {
        const fmt = quill.getFormat(caret - 2, 2);
        if (!(fmt.code || fmt.link || this.host.inCodeBlock(caret - 1))) {
          this.host.change(() => {
            quill.deleteText(caret - 2, 2, 'api');
            quill.insertText(caret - 2, `${DANDA} `, 'api');
          });
          this.caretLater(quill, caret);
          return;
        }
      }
    }

    const lastChar = quill.getText(caret - 1, 1);
    if (!TERMINATOR.test(lastChar)) return; // only when a terminator lands - never mid-word

    const wordEnd = caret - 1;
    const scanStart = Math.max(0, wordEnd - 40);
    const scan = quill.getText(scanStart, wordEnd - scanStart);
    const match = /[a-zA-Z]+$/.exec(scan);
    if (!match) return;

    const word = match[0];
    const wordStart = scanStart + match.index;
    const fmt = quill.getFormat(wordStart, word.length);
    if (fmt.link || fmt.code) return;
    if (this.host.inCodeBlock(wordStart)) return;
    const around = quill.getText(Math.max(0, wordStart - 6), Math.min(6, wordStart));
    if (around.indexOf('://') !== -1 || around.endsWith('@') || around.endsWith('.')) return;

    const converted = convertWord(word);
    if (converted === word) return;
    this.host.change(() => {
      quill.deleteText(wordStart, word.length, 'api');
      quill.insertText(wordStart, converted, 'api');
    });
    this.caretLater(quill, Math.max(0, caret + (converted.length - word.length)));
  }
}

Quill.register('modules/hindiTransliteration', HindiTyping);

export default HindiTyping;
