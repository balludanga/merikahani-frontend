import React, { useEffect, useMemo, useRef, useState } from 'react';
import { findLanguages, languageLabel } from '../languages/registry';
import { needAllFonts } from '../languages/fonts';
import '../languages/languages.css';

/**
 * A sheet to choose languages: all 22 scheduled languages and English, searchable by their name in
 * Devanagari, in their own script, or in English letters.
 *
 *   multiple   several can be ticked (what you read); otherwise one is chosen and the sheet closes
 *   value      the codes chosen now
 *   onChange   called with the new list when the person presses "हो गया" (or with [code] when single);
 *              a list that asked for a preferred language gets it as the second argument
 *   allowNone  "सभी भाषाएँ": an empty choice is allowed (reading); a story's language is never empty
 *   primary    the preferred language now; when given, each ticked language can be starred as the main one
 *              (the interface is shown in it, its stories come first)
 */
const LanguagePicker = ({ title, hint, multiple = false, value = [], onChange, onClose, allowNone = false, primary }) => {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(value);
  const withMain = multiple && primary !== undefined;
  const [main, setMain] = useState(primary && value.includes(primary) ? primary : value[0] || null);
  const searchRef = useRef(null);
  const listed = useMemo(() => findLanguages(query), [query]);

  useEffect(() => {
    needAllFonts();
    if (searchRef.current) searchRef.current.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (code) => {
    if (!multiple) {
      onChange([code]);
      onClose();
      return;
    }
    const next = picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code];
    setPicked(next);
    // the first one ticked is the main one until another is starred; taking the main one off passes it on
    if (!next.includes(main)) setMain(next[0] || null);
  };

  const star = (code) => {
    if (!picked.includes(code)) setPicked((prev) => [...prev, code]);
    setMain(code);
  };

  const done = () => {
    if (withMain) onChange(picked, picked.includes(main) ? main : picked[0] || null);
    else onChange(picked);
    onClose();
  };

  return (
    <div className="lang-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lang-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="lang-head">
          <h2>{title}</h2>
          <button type="button" className="lang-close" onClick={onClose} aria-label="बंद करें">×</button>
        </div>
        {hint && <p className="lang-hint">{hint}</p>}
        <input
          ref={searchRef}
          type="search"
          className="lang-search"
          placeholder="भाषा खोजें…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="भाषा खोजें"
        />
        <ul className="lang-list" role={multiple ? 'group' : 'listbox'} aria-label={title}>
          {listed.map((language) => {
            const on = picked.includes(language.code);
            return (
              <li key={language.code} className="lang-item">
                <button
                  type="button"
                  className={`lang-row${on ? ' on' : ''}`}
                  role={multiple ? 'checkbox' : 'option'}
                  aria-checked={multiple ? on : undefined}
                  aria-selected={multiple ? undefined : value[0] === language.code}
                  onClick={() => toggle(language.code)}
                >
                  <span className="lang-mark" aria-hidden="true">{on ? '✓' : ''}</span>
                  <span className="lang-name">{languageLabel(language.code)}</span>
                </button>
                {withMain && on && (
                  <button
                    type="button"
                    className={`lang-star${main === language.code ? ' on' : ''}`}
                    aria-pressed={main === language.code}
                    title="इसे मुख्य भाषा बनाएँ"
                    onClick={() => star(language.code)}
                  >
                    {main === language.code ? '★ मुख्य भाषा' : '☆ मुख्य बनाएँ'}
                  </button>
                )}
              </li>
            );
          })}
          {listed.length === 0 && <li className="lang-none">इस नाम की कोई भाषा नहीं मिली।</li>}
        </ul>
        {multiple && (
          <div className="lang-foot">
            {allowNone && (
              <button type="button" className="lang-link" onClick={() => setPicked([])} disabled={picked.length === 0}>
                सभी भाषाएँ दिखाएँ
              </button>
            )}
            <span className="lang-count">{picked.length ? `${picked.length} चुनी` : 'कोई नहीं चुनी'}</span>
            <button type="button" className="lang-done" onClick={done}>हो गया</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguagePicker;
