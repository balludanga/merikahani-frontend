import React, { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { transliterateLastWord, dandaOnDoubleSpace } from '../utils/transliterate';
import './HindiTextarea.css';

// Same switch the story editor uses, so one choice follows the writer around.
const STORAGE_KEY = 'lekhani_hinglish';

const readSetting = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch (error) {
    return true;
  }
};

/**
 * Hinglish typing switch. Returns [on, toggle, finish]: `finish(text)` converts
 * a last word that has not met a space yet, so send it through before saving.
 */
export function useHinglish() {
  const [on, setOn] = useState(readSetting);
  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch (error) {
        // Storage blocked: the choice just lasts for this visit.
      }
      return next;
    });
  }, []);
  const finish = useCallback(
    (text) => {
      if (!on) return text;
      const done = transliterateLastWord(text, text.length, true);
      return done ? done.value : text;
    },
    [on]
  );
  return [on, toggle, finish];
}

/**
 * A textarea where Latin letters turn into Devanagari as you type: "kahani " becomes
 * "कहानी ", and two spaces end a sentence with "।". `value` / `onChange(text)`
 * work on plain strings; `hinglish` and `onToggle` come from `useHinglish`.
 */
const HindiTextarea = React.forwardRef(function HindiTextarea(
  { value, onChange, hinglish, onToggle, onSubmitKey, className = '', ...rest },
  ref
) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  // Where the caret goes once React has put the converted text in the box. It is
  // set right after that render, before the next keystroke, so fast typing can
  // never land a letter in the wrong place.
  const pendingCaret = useRef(null);
  useLayoutEffect(() => {
    const el = innerRef.current;
    const pending = pendingCaret.current;
    pendingCaret.current = null;
    if (el && pending && el.value === pending.value) {
      el.selectionStart = el.selectionEnd = pending.caret;
    }
  });

  const handleChange = (event) => {
    const el = event.target;
    let next = el.value;
    if (hinglish) {
      const danda = dandaOnDoubleSpace(next, el.selectionStart);
      const done = danda || transliterateLastWord(next, el.selectionStart);
      if (done) {
        next = done.value;
        pendingCaret.current = { value: done.value, caret: done.caret };
      }
    }
    onChange(next);
  };

  const handleBlur = (event) => {
    if (!hinglish) return;
    const el = event.target;
    const done = transliterateLastWord(el.value, el.selectionStart, true);
    if (done) onChange(done.value);
  };

  const handleKeyDown = (event) => {
    if (onSubmitKey && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmitKey();
    }
  };

  return (
    <div className={`hindi-field ${className}`}>
      <textarea
        ref={innerRef}
        lang="hi"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...rest}
      />
      <div className="hindi-field-bar">
        <button
          type="button"
          className={`hindi-toggle ${hinglish ? 'on' : ''}`}
          onClick={onToggle}
          aria-pressed={hinglish}
          title="अंग्रेज़ी कीबोर्ड से हिंदी लिखें"
        >
          अ
        </button>
        <span className="hindi-hint">
          {hinglish
            ? 'हिंदी टाइपिंग चालू — (kahani) लिखें, कहानी बनेगा'
            : 'हिंदी टाइपिंग बंद'}
        </span>
      </div>
    </div>
  );
});

export default HindiTextarea;
