import React from 'react';
import { Link } from 'react-router-dom';
import { categoryLabel } from '../utils/review';
import './Review.css';

const clip = (text, limit = 220) => (text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text);

/**
 * The notes on a story, in reading order. Shared by the story page (reviewer and writer) and the
 * editor (writer). `actions` decides which buttons show; every handler is optional.
 */
const ReviewNoteList = ({
  notes,
  missing = new Set(),
  reviewer = false,
  editLink = null,
  onJump,
  onEdit,
  onRemove,
  onToggleFixed,
  onApply,
}) => (
  <ol className="review-notes">
    {notes.map((note) => {
      const gone = missing.has(note.id);
      return (
        <li
          key={note.id}
          id={`review-note-${note.id}`}
          className={`review-note ${note.status === 'fixed' ? 'fixed' : ''} ${note.draft ? 'draft' : ''}`}
        >
          <div className="review-note-top">
            <span className="review-tag">{categoryLabel(note.category)}</span>
            {note.draft && <span className="review-draft">मसौदा · अभी लेखक को नहीं दिखता</span>}
            {note.status === 'fixed' && <span className="review-done">ठीक किया ✓</span>}
          </div>
          <blockquote className="review-note-quote">{clip(note.text)}</blockquote>
          {gone && <p className="review-gone">यह अंश अब पाठ में नहीं मिला — शायद बदल दिया गया है।</p>}
          <p className="review-note-comment">{note.comment}</p>
          {note.suggestion && (
            <div className="review-suggestion">
              <span>सुझाया गया पाठ</span>
              <p>{note.suggestion}</p>
            </div>
          )}
          <div className="review-note-actions">
            {onJump && !gone && (
              <button type="button" onClick={() => onJump(note)}>अंश पर जाएँ</button>
            )}
            {editLink && <Link to={editLink}>संपादक में खोलें</Link>}
            {onApply && note.suggestion && !gone && note.status !== 'fixed' && (
              <button type="button" className="review-apply" onClick={() => onApply(note)}>सुझाव लागू करें</button>
            )}
            {onToggleFixed && !note.draft && (
              <button type="button" onClick={() => onToggleFixed(note)}>
                {note.status === 'fixed' ? 'फिर से खोलें' : 'ठीक किया ✓'}
              </button>
            )}
            {reviewer && onEdit && <button type="button" onClick={() => onEdit(note)}>बदलें</button>}
            {reviewer && onRemove && (
              <button type="button" className="review-danger" onClick={() => onRemove(note)}>हटाएँ</button>
            )}
          </div>
        </li>
      );
    })}
  </ol>
);

export default ReviewNoteList;
