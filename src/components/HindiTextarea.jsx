import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { transliterateLastWord } from '../utils/transliterate';
import { convertWord } from '../typing/convert';
import { useHindiInput } from '../typing/useHindiInput';
import { engineFor, prepareTyping, sentenceStop, typingKind } from '../typing/engines';
import { languageName } from '../languages/registry';
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
 * `language` is the language the box is written in (Hindi unless a page says otherwise).
 */
export function useHinglish(language = 'hi') {
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
      const done = transliterateLastWord(text, text.length, true, (word) =>
        language === 'hi' ? convertWord(word) : convertWord(word, engineFor(language))
      );
      return done ? done.value : text;
    },
    [on, language]
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
    language = 'hi',
    ...rest
  },
  ref
) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);

  // Hindi keeps the full word-list engine; another language gets its own engine and sentence end
  const other = language !== 'hi';
  const typing = useMemo(
    () =>
      other
        ? { engine: engineFor(language), stop: sentenceStop(language), prepare: () => prepareTyping(language) }
        : undefined,
    [other, language]
  );
  const enabled = hinglish && (!other || typingKind(language) !== 'none');

  const handlers = useHindiInput(innerRef, {
    enabled,
    typing,
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
        lang={language}
        dir="auto"
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
            aria-pressed={enabled}
            title="अंग्रेज़ी कीबोर्ड से अपनी भाषा लिखें"
          >
            अ
          </button>
          <span className="hindi-hint">
            {enabled
              ? other
                ? `${languageName(language)} टाइपिंग चालू: अंग्रेज़ी अक्षरों में लिखें`
                : 'हिंदी टाइपिंग चालू: (kahani) लिखें, कहानी दिखेगा'
              : other && typingKind(language) === 'none'
                ? 'अंग्रेज़ी में सीधे लिखें'
                : `${languageName(language)} टाइपिंग बंद`}
          </span>
        </div>
      )}
    </div>
  );
});

export default HindiTextarea;
