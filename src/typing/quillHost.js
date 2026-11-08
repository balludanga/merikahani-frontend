/**
 * Lets the composer (composer.js) work inside a Quill editor.
 *
 * Every change is one Delta (delete the old preview, insert the new one), so the editor, its undo
 * history and React's onChange each see a single change per key. The inserted text keeps the bold /
 * italic / underline / strike of the text around it, as native typing would.
 */
import Quill from 'quill';

const Delta = Quill.import('delta');
const INLINE = ['bold', 'italic', 'underline', 'strike'];

export class QuillHost {
  constructor(quill) {
    this.quill = quill;
    this.element = quill.root;
    this.busy = false; // true while the host itself is changing the text
  }

  caret() {
    const range = this.quill.getSelection();
    return range && range.length === 0 ? range.index : null;
  }

  /** Typing over a selection replaces it; returns where the caret is afterwards. */
  collapse() {
    const range = this.quill.getSelection();
    if (!range) return null;
    if (range.length) {
      this.change(() => this.quill.deleteText(range.index, range.length, 'user'));
      this.quill.setSelection(range.index, 0, 'api');
    }
    return range.index;
  }

  text(from, to) {
    return this.quill.getText(from, to - from);
  }

  fits() {
    return true;
  }

  /** Not inside code, a link or a web address: those stay exactly as typed. */
  canCompose(index) {
    const quill = this.quill;
    if (index > 0) {
      const before = quill.getFormat(index - 1, 1);
      if (before.code || before.link) return false;
    }
    return !this.inCodeBlock(index);
  }

  /** A code block is a <pre> (Quill 1.3 gives it no class of its own). */
  inCodeBlock(index) {
    const [line] = this.quill.getLine(index);
    const node = line && line.domNode;
    return !!node && (node.nodeName === 'PRE' || (node.className || '').indexOf('ql-code-block') !== -1);
  }

  /**
   * The bold / italic / underline / strike that native typing would give at the caret: those of the
   * element the caret sits in. That includes a bold just switched on for an empty line, which Quill keeps
   * in a temporary element at the caret rather than in the text.
   */
  caretFormats() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;
    const anchor = selection.anchorNode;
    if (!anchor || !this.quill.root.contains(anchor)) return null;
    const found = {};
    for (let el = anchor.nodeType === 1 ? anchor : anchor.parentNode; el && el !== this.quill.root; el = el.parentNode) {
      const tag = el.nodeName;
      if (tag === 'STRONG' || tag === 'B') found.bold = true;
      else if (tag === 'EM' || tag === 'I') found.italic = true;
      else if (tag === 'U') found.underline = true;
      else if (tag === 'S' || tag === 'STRIKE') found.strike = true;
    }
    return found;
  }

  inlineAt(from, to) {
    const quill = this.quill;
    let found;
    if (to > from) found = quill.getFormat(from, to - from);
    else found = this.caretFormats() || (from > 0 && quill.getText(from - 1, 1) !== '\n' ? quill.getFormat(from - 1, 1) : {});
    const out = {};
    INLINE.forEach((name) => {
      if (found[name]) out[name] = found[name];
    });
    return out;
  }

  change(fn) {
    const was = this.busy;
    this.busy = true;
    try {
      fn();
    } finally {
      this.busy = was;
    }
  }

  replace(from, to, text) {
    const quill = this.quill;
    const formats = this.inlineAt(from, to);
    const delta = new Delta().retain(from);
    if (to > from) delta.delete(to - from);
    if (text) delta.insert(text, Object.keys(formats).length ? formats : undefined);
    this.change(() => {
      quill.updateContents(delta, 'user');
      quill.setSelection(from + text.length, 0, 'api'); // also scrolls the caret into view
    });
  }

  /** Viewport position of an index. */
  rect(index) {
    const bounds = this.quill.getBounds(index);
    const box = this.quill.container.getBoundingClientRect();
    return { left: box.left + bounds.left, top: box.top + bounds.top, bottom: box.top + bounds.bottom };
  }

  focus() {
    this.quill.focus();
  }
}
