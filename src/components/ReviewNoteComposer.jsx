import React, { useEffect, useRef, useState } from 'react';
import HindiTextarea from './HindiTextarea';
import { CATEGORIES } from '../utils/review';
import './Review.css';

/**
 * The reviewer's form for one passage: why it is a problem, what to say to the writer, and
 * optionally the wording to use instead. Also used to edit a note that already exists.
 */
const ReviewNoteComposer = ({ quote, initial, hinglish, onToggleHinglish, finish, onSubmit, onClose }) => {
  const [category, setCategory] = useState(initial ? initial.category : 'language');
  const [comment, setComment] = useState(initial ? initial.comment : '');
  const [suggestion, setSuggestion] = useState(initial ? initial.suggestion || '' : '');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const commentRef = useRef(null);

  useEffect(() => {
    if (commentRef.current) commentRef.current.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    const text = finish(comment).trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSubmit({ category, comment: text, suggestion: finish(suggestion).trim() });
    } catch (error) {
      setBusy(false);
    }
  };

  return (
    <div
      className="review-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="review-card" role="dialog" aria-modal="true" aria-label="समीक्षा टिप्पणी" ref={cardRef}>
        <div className="review-card-head">
          <h3>{initial ? 'टिप्पणी बदलें' : 'इस अंश पर टिप्पणी'}</h3>
          <button type="button" className="review-x" onClick={onClose} aria-label="बंद करें">×</button>
        </div>
        <blockquote className="review-quote">{quote}</blockquote>

        <div className="review-field">
          <span className="review-label">समस्या किस तरह की है?</span>
          <div className="review-chips" role="group" aria-label="समस्या का प्रकार">
            {CATEGORIES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`review-chip ${category === key ? 'on' : ''}`}
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="review-field">
          <span className="review-label">लेखक के लिए टिप्पणी</span>
          <HindiTextarea
            ref={commentRef}
            value={comment}
            onChange={setComment}
            hinglish={hinglish}
            onToggle={onToggleHinglish}
            onSubmitKey={submit}
            placeholder="इस अंश में क्या दिक्कत है और क्यों?"
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="review-field">
          <span className="review-label">सुझाया गया पाठ <em>(वैकल्पिक — इस अंश की जगह लिखने के लिए)</em></span>
          <HindiTextarea
            value={suggestion}
            onChange={setSuggestion}
            hinglish={hinglish}
            onToggle={onToggleHinglish}
            hideBar
            placeholder="चाहें तो इस अंश का नया रूप लिखें; लेखक इसे एक दबाव में लागू कर सकेंगे।"
            rows={3}
            maxLength={2000}
          />
        </div>

        <div className="review-card-foot">
          <span>यह टिप्पणी तब तक सिर्फ़ आपको दिखेगी, जब तक आप “बदलाव माँगें” नहीं दबाते।</span>
          <button type="button" className="review-primary" onClick={submit} disabled={busy || !comment.trim()}>
            {busy ? 'सहेज रहे हैं…' : initial ? 'सहेजें' : 'टिप्पणी जोड़ें'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewNoteComposer;
