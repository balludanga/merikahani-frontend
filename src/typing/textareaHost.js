/**
 * Lets the composer (composer.js) work inside a plain <textarea> or <input> whose value is owned by
 * React: every change is handed back through `apply(value, caret)` and React writes it into the box.
 *
 * The element's own value is only read at the start of each key press (`sync`); during the press the
 * host keeps its own copy, because React has not written the previous change yet.
 */

const MIRRORED = [
  'direction', 'boxSizing', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderStyle', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant',
  'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily', 'textAlign',
  'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
];

/** Viewport position of the character at `index` in a textarea/input (a hidden copy of the box is measured). */
export function caretRect(el, value, index) {
  const box = el.getBoundingClientRect();
  const computed = window.getComputedStyle(el);
  const mirror = document.createElement('div');
  const style = mirror.style;
  MIRRORED.forEach((name) => {
    style[name] = computed[name];
  });
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '0';
  style.left = '-9999px';
  style.overflow = 'hidden';
  style.whiteSpace = el.nodeName === 'INPUT' ? 'pre' : 'pre-wrap';
  style.wordWrap = 'break-word';
  style.boxSizing = 'border-box';
  style.width = `${el.offsetWidth}px`;
  mirror.textContent = value.slice(0, index);
  const marker = document.createElement('span');
  marker.textContent = value.slice(index) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5;
  const left = box.left + marker.offsetLeft + parseFloat(computed.borderLeftWidth || 0) - el.scrollLeft;
  const top = box.top + marker.offsetTop + parseFloat(computed.borderTopWidth || 0) - el.scrollTop;
  document.body.removeChild(mirror);
  // keep the point inside the box when the text scrolls
  const clampedTop = Math.min(Math.max(top, box.top), box.bottom);
  return { left: Math.min(Math.max(left, box.left), box.right), top: clampedTop, bottom: clampedTop + lineHeight };
}

export class TextareaHost {
  /**
   * @param {HTMLTextAreaElement|HTMLInputElement} element
   * @param {{ apply: (value: string, caret: number) => void, maxLength?: () => (number|undefined) }} io
   */
  constructor(element, io) {
    this.element = element;
    this.io = io;
    this.value = element.value;
    this.pos = element.selectionStart;
    this.end = element.selectionEnd;
  }

  /** Read the box as it is now; call at the start of every key press. */
  sync() {
    this.value = this.element.value;
    this.pos = this.element.selectionStart;
    this.end = this.element.selectionEnd;
  }

  caret() {
    return this.pos === this.end ? this.pos : null;
  }

  collapse() {
    if (this.pos === this.end) return this.pos;
    this.replace(this.pos, this.end, '');
    return this.pos;
  }

  text(from, to) {
    return this.value.slice(from, to);
  }

  canCompose() {
    return true;
  }

  fits(from, to, text) {
    const max = this.io.maxLength ? this.io.maxLength() : undefined;
    return max === undefined || max === null || this.value.length - (to - from) + text.length <= max;
  }

  replace(from, to, text) {
    this.value = this.value.slice(0, from) + text + this.value.slice(to);
    this.pos = from + text.length;
    this.end = this.pos;
    this.io.apply(this.value, this.pos);
  }

  rect(index) {
    return caretRect(this.element, this.value, index);
  }

  focus() {
    this.element.focus();
  }
}
