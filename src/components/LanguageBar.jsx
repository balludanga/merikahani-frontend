import React, { useState } from 'react';
import { languageName } from '../languages/registry';
import { useLanguages } from '../languages/useLanguages';
import LanguagePicker from './LanguagePicker';
import '../languages/languages.css';

/** "भाषाएँ: हिंदी · तमिल  [बदलें]" above a feed: which languages the stories shown are in. */
const LanguageBar = () => {
  const { read, primary, setReading } = useLanguages();
  const [open, setOpen] = useState(false);

  return (
    <div className="lang-bar">
      <span className="lang-bar-label">भाषाएँ</span>
      {read.length === 0 ? (
        <span className="lang-chip all">सभी भाषाएँ</span>
      ) : (
        read.map((code) => (
          <span className={`lang-chip${code === primary ? ' main' : ''}`} key={code} title={code === primary ? 'मुख्य भाषा' : undefined}>
            {languageName(code)}
            <button
              type="button"
              aria-label={`${languageName(code)} हटाएँ`}
              onClick={() => setReading(read.filter((c) => c !== code), primary)}
            >
              ×
            </button>
          </span>
        ))
      )}
      <button type="button" className="lang-change" onClick={() => setOpen(true)}>
        {read.length === 0 ? 'चुनें' : 'बदलें'}
      </button>
      {open && (
        <LanguagePicker
          multiple
          allowNone
          title="आप किन भाषाओं में पढ़ते हैं?"
          hint="चुनी हुई भाषाओं की रचनाएँ ही आपके पन्ने पर आएँगी। कई चुनें तो एक को मुख्य भाषा बनाइए: ऐप उसी भाषा में दिखेगा और उसकी रचनाएँ पहले आएँगी। कुछ न चुनें तो सभी भाषाओं की रचनाएँ दिखेंगी।"
          value={read}
          primary={primary}
          onChange={setReading}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default LanguageBar;
