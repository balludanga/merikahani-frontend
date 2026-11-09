import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { transliterateLastWord } from '../utils/transliterate';
import { convertWord } from '../typing/convert';
import { useHindiInput } from '../typing/useHindiInput';
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
      const done = transliterateLastWord(text, text.length, true, convertWord);
      return done ? done.value : text;
    },
    [on]
  );
  return [on, toggle, finish];
}

/**
 * A textarea where Latin letters turn into Devanagari as you type: "kahani" shows कहानी at once,
 * with other spellings and longer words offered under the caret (see src/typing). Two spaces end a
 * sentence with "।". `value` / `onChange(text)` work on plain strings; `hinglish` and `onToggle` come
 * from `useHinglish`.
 */
const HindiTextarea = React.forwardRef(function HindiTextarea(
  {
    value,
    onChange,
    hinglish,
    onToggle,
    onSubmitKey,
    singleLine = false,
    hideBar = false,
    className = '',
    maxLength,
    onKeyDown,
    onBlur,
    ...rest
  },
  ref
) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  const handlers = useHindiInput(innerRef, {
    enabled: hinglish,
    onValue: onChange,
    maxLength,
    singleLine,
    onBlur,
    onKeyDown: (event) => {
      // A one-line field never takes a new line.
      if (singleLine && event.key === 'Enter') {
        event.preventDefault();
        return;
      }
      if (onSubmitKey && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onSubmitKey();
        return;
      }
      if (onKeyDown) onKeyDown(event);
    },
  });

  return (
    <div className={`hindi-field ${singleLine ? 'single' : ''} ${className}`}>
      <textarea
        ref={innerRef}
        lang="hi"
        rows={singleLine ? 1 : undefined}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        {...rest}
        {...handlers}
      />
      {!hideBar && (
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
              ? 'हिंदी टाइपिंग चालू: (kahani) लिखें, कहानी दिखेगा'
              : 'हिंदी टाइपिंग बंद'}
          </span>
        </div>
      )}
    </div>
  );
});

export default HindiTextarea;
