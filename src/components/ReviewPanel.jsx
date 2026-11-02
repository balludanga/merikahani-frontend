import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { reviewsAPI } from '../services/api';
import { STATE_LABELS } from '../utils/review';
import HindiTextarea from './HindiTextarea';
import ReviewNoteList from './ReviewNoteList';
import './Review.css';

const errorText = (error, fallback) => {
  const detail = error && error.response && error.response.data && error.response.data.detail;
  return typeof detail === 'string' && detail ? detail : fallback;
};

/**
 * The review box at the top of a story that a reviewer is reading or that a writer is fixing.
 * Reviewers see every note (drafts included) and decide: send back / approve. The writer sees the
 * notes that were sent, ticks them off, and sends the story back.
 */
const ReviewPanel = ({
  post,
  review,
  reviewer,
  missing,
  hinglish,
  onToggleHinglish,
  finish,
  onJump,
  onEditNote,
  onChange,
  onPostChange,
  onProblem,
}) => {
  const [sendAsk, setSendAsk] = useState(false);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const state = post.moderation_state || 'none';
  const notes = review ? review.notes : [];
  const drafts = notes.filter((n) => n.draft).length;
  const open = notes.filter((n) => !n.draft && n.status === 'open').length;
  const lastRound = review && review.rounds.length ? review.rounds[review.rounds.length - 1] : null;

  const act = async (call, after) => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await call();
      onChange(response.data);
      onPostChange({ published: response.data.post.published, moderation_state: response.data.post.moderation_state });
      if (after) after();
    } catch (error) {
      onProblem(errorText(error, 'यह काम नहीं हो सका। कृपया फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  const toggleFixed = async (note) => {
    try {
      const response = await reviewsAPI.setStatus(note.id, note.status === 'fixed' ? 'open' : 'fixed');
      onChange({ ...review, notes: review.notes.map((n) => (n.id === note.id ? response.data : n)) });
    } catch (error) {
      onProblem('टिप्पणी की स्थिति बदली नहीं जा सकी।');
    }
  };

  const remove = async (note) => {
    try {
      await reviewsAPI.removeNote(note.id);
      onChange({ ...review, notes: review.notes.filter((n) => n.id !== note.id) });
    } catch (error) {
      onProblem('टिप्पणी हटाई नहीं जा सकी।');
    }
  };

  // A reviewer on a story nobody has flagged yet: just the instructions.
  if (reviewer) {
    return (
      <section className="review-panel" aria-label="समीक्षा">
        <div className="review-panel-head">
          <strong>समीक्षा</strong>
          {state !== 'none' && <span className={`review-state ${state}`}>{STATE_LABELS[state]}</span>}
        </div>

        {state === 'none' && !notes.length && (
          <p className="review-hint">
            जिस अंश में समस्या हो उसे चुनें और ऊपर आए मेनू का टिप्पणी (समीक्षा) बटन दबाएँ।
            सभी टिप्पणियाँ जोड़ने के बाद “बदलाव माँगें” दबाएँ — रचना जनता से हट जाएगी और लेखक को टिप्पणियाँ दिखेंगी।
          </p>
        )}
        {state === 'changes_requested' && (
          <p className="review-hint">लेखक सुधार कर रहे हैं। दोबारा भेजने पर आपको सूचना मिलेगी।</p>
        )}
        {state === 'resubmitted' && (
          <p className="review-hint">लेखक ने सुधार कर रचना दोबारा भेजी है। पढ़ें; ठीक लगे तो स्वीकृत करें, नहीं तो और टिप्पणियाँ जोड़कर फिर बदलाव माँगें।</p>
        )}
        {lastRound && lastRound.summary && state !== 'none' && (
          <p className="review-summary"><span>आपका संदेश:</span> {lastRound.summary}</p>
        )}

        {notes.length > 0 && (
          <ReviewNoteList
            notes={notes}
            missing={missing}
            reviewer
            onJump={onJump}
            onEdit={onEditNote}
            onRemove={remove}
            onToggleFixed={toggleFixed}
          />
        )}

        <div className="review-panel-actions">
          <button
            type="button"
            className="review-primary"
            onClick={() => setSendAsk(true)}
            disabled={busy || (state === 'none' && !drafts)}
            title={state === 'none' && !drafts ? 'पहले कम से कम एक टिप्पणी जोड़ें' : ''}
          >
            बदलाव माँगें{drafts ? ` (${drafts} नई टिप्पणी${drafts > 1 ? 'याँ' : ''})` : ''}
          </button>
          {state !== 'none' && (
            <button
              type="button"
              className="review-approve"
              onClick={() => act(() => reviewsAPI.approve(post.id))}
              disabled={busy}
            >
              ✓ स्वीकृत करें और प्रकाशित करें
            </button>
          )}
          <Link to="/review" className="review-back">समीक्षा सूची</Link>
        </div>

        {sendAsk && (
          <div
            className="review-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSendAsk(false);
            }}
          >
            <div className="review-card" role="dialog" aria-modal="true" aria-label="बदलाव माँगें">
              <div className="review-card-head">
                <h3>लेखक से बदलाव माँगें</h3>
                <button type="button" className="review-x" onClick={() => setSendAsk(false)} aria-label="बंद करें">×</button>
              </div>
              <p className="review-hint">
                {state === 'none'
                  ? 'रचना अभी जनता से हट जाएगी और उसी पते पर तब तक नहीं दिखेगी जब तक आप उसे फिर स्वीकृत नहीं करते। '
                  : ''}
                लेखक को {drafts ? `${drafts} नई टिप्पणी${drafts > 1 ? 'याँ' : ''}` : 'आपका संदेश'} दिखेगी{drafts ? ' और सूचना मिलेगी' : ''}।
              </p>
              <div className="review-field">
                <span className="review-label">लेखक के लिए संक्षिप्त संदेश <em>(वैकल्पिक)</em></span>
                <HindiTextarea
                  value={summary}
                  onChange={setSummary}
                  hinglish={hinglish}
                  onToggle={onToggleHinglish}
                  placeholder="जैसे: कुछ अंश हमारे नियमों के अनुकूल नहीं हैं, कृपया उन्हें बदलकर दोबारा भेजें।"
                  rows={3}
                  maxLength={1000}
                />
              </div>
              <div className="review-card-foot">
                <span />
                <button
                  type="button"
                  className="review-primary"
                  disabled={busy}
                  onClick={() => act(() => reviewsAPI.requestChanges(post.id, finish(summary).trim()), () => { setSendAsk(false); setSummary(''); })}
                >
                  {busy ? 'भेज रहे हैं…' : 'लेखक को भेजें'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // The writer's view of their own story that is under review.
  if (state === 'none') return null;
  return (
    <section className="review-panel writer" aria-label="समीक्षा">
      <div className="review-panel-head">
        <strong>
          {state === 'changes_requested' ? 'आपकी रचना में बदलाव माँगे गए हैं' : 'आपकी रचना समीक्षा के लिए भेजी जा चुकी है'}
        </strong>
        <span className={`review-state ${state}`}>{STATE_LABELS[state]}</span>
      </div>
      <p className="review-hint">
        {state === 'changes_requested'
          ? 'जब तक बदलाव नहीं होते, यह रचना जनता को नहीं दिखेगी। नीचे दी टिप्पणियाँ देखें, रचना सुधारें और फिर समीक्षा के लिए भेजें।'
          : 'समीक्षक आपकी सुधरी हुई रचना देखेंगे। स्वीकृत होते ही यह उसी पते पर फिर से प्रकाशित हो जाएगी।'}
      </p>
      {lastRound && lastRound.summary && (
        <p className="review-summary"><span>समीक्षक का संदेश:</span> {lastRound.summary}</p>
      )}
      {notes.length > 0 && (
        <ReviewNoteList
          notes={notes}
          missing={missing}
          editLink={`/edit/${post.id}`}
          onJump={onJump}
          onToggleFixed={toggleFixed}
        />
      )}
      <div className="review-panel-actions">
        <Link to={`/edit/${post.id}`} className="review-primary">रचना सुधारें</Link>
        {state === 'changes_requested' && (
          <button
            type="button"
            className="review-approve"
            disabled={busy}
            onClick={() => act(() => reviewsAPI.resubmit(post.id))}
          >
            {busy ? 'भेज रहे हैं…' : open ? `समीक्षा के लिए भेजें (${open} टिप्पणी बाकी)` : 'समीक्षा के लिए भेजें'}
          </button>
        )}
      </div>
    </section>
  );
};

export default ReviewPanel;
