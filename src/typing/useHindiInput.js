/**
 * Everything a React-controlled <textarea> needs for Hinglish typing, in one hook:
 *
 *   const props = useHindiInput(ref, { enabled, onValue, maxLength, singleLine, onKeyDown, onBlur });
 *   <textarea ref={ref} value={text} {...props} />
 *
 *   - live typing from a physical keyboard (fieldTyping.js): the Devanagari appears as you type;
 *   - the older "convert when the space arrives" path for phone keyboards, which cannot be watched
 *     key by key;
 *   - the caret put back where it belongs after React has written the new text into the box.
 */
import { useLayoutEffect, useRef } from 'react';
import { dandaOnDoubleSpace, transliterateLastWord } from '../utils/transliterate.js';
import { convertWord } from './convert.js';
import { useFieldTyping } from './fieldTyping.js';

export function useHindiInput(ref, { enabled, onValue, maxLength, singleLine = false, onKeyDown, onBlur }) {
  // Where the caret goes once React has put the new text in the box. It is set right after that
  // render, before the next key press, so fast typing can never land a letter in the wrong place.
  const pending = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const wanted = pending.current;
    pending.current = null;
    if (el && wanted && el.value === wanted.value) {
      el.selectionStart = el.selectionEnd = wanted.caret;
    }
  });

  const clean = (text) => (singleLine ? text.replace(/[\r\n]+/g, ' ') : text);

  const typing = useFieldTyping(ref, {
    enabled,
    maxLength,
    apply: (value, caret) => {
      const next = clean(value);
      pending.current = { value: next, caret: Math.min(caret, next.length) };
      onValue(next);
    },
  });

  const handleChange = (event) => {
    typing.interrupt();
    const el = event.target;
    let next = clean(el.value);
    if (enabled) {
      const done = dandaOnDoubleSpace(next, el.selectionStart) || transliterateLastWord(next, el.selectionStart, false, convertWord);
      if (done) {
        next = done.value;
        pending.current = { value: done.value, caret: done.caret };
      }
    }
    onValue(next);
  };

  const handleBlur = (event) => {
    typing.interrupt();
    if (enabled) {
      const el = event.target;
      const done = transliterateLastWord(el.value, el.selectionStart, true, convertWord);
      if (done) onValue(done.value);
    }
    if (onBlur) onBlur(event);
  };

  const handleKeyDown = (event) => {
    if (typing.onKeyDown(event)) return;
    if (onKeyDown) onKeyDown(event);
  };

  return { onChange: handleChange, onBlur: handleBlur, onKeyDown: handleKeyDown, onMouseDown: typing.onMouseDown };
}
