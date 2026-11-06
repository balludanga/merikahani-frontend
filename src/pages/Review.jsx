import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { reviewsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import { timeAgo } from '../utils/format';
import '../components/Review.css';

const TABS = [
  ['resubmitted', 'समीक्षा की प्रतीक्षा'],
  ['changes_requested', 'बदलाव माँगे गए'],
  ['live', 'प्रकाशित रचनाएँ'],
];

const EMPTY = {
  resubmitted: 'अभी कोई रचना समीक्षा की प्रतीक्षा में नहीं है।',
  changes_requested: 'कोई रचना लेखक के पास सुधार के लिए नहीं है।',
  live: 'कोई प्रकाशित रचना नहीं मिली।',
};

/** The reviewer's desk: what is waiting, what is with the writer, and every live story to open. */
const Review = () => {
  const { user, loading: authLoading } = useAuth();
  const [view, setView] = useState('resubmitted');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState({ resubmitted: 0, changes_requested: 0 });
  const isReviewer = !!(user && user.is_admin);

  useEffect(() => {
    updateMetaTags({ title: 'समीक्षा', type: 'website', noindex: true });
    return () => resetMetaTags();
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    setFailed(false);
    try {
      const [list, count] = await Promise.all([
        reviewsAPI.queue({ view, q: view === 'live' ? query.trim() || undefined : undefined }),
        reviewsAPI.counts(),
      ]);
      setRows(list.data);
      setCounts(count.data);
    } catch (error) {
      setFailed(true);
      setRows([]);
    }
  }, [view, query]);

  // Typing in the search box waits a moment so each keystroke is not a request.
  useEffect(() => {
    if (!isReviewer) return undefined;
    const timer = setTimeout(load, view === 'live' ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, isReviewer, view]);

  if (authLoading) return <div className="page-loading">लोड हो रहा है…</div>;
  if (!isReviewer) return <Navigate to="/" replace />;

  return (
    <div className="review-page">
      <h1>रचनाओं की समीक्षा</h1>
      <p className="review-hint">
        किसी रचना को खोलकर अंश चुनें और टिप्पणी जोड़ें। “बदलाव माँगें” दबाने पर रचना जनता से हट जाती है और
        लेखक को टिप्पणियाँ दिखती हैं; सुधार के बाद आप उसे स्वीकृत कर फिर से प्रकाशित करते हैं।
      </p>
      <p className="review-hint">
        <Link to="/review/partners">“लिखें और कमाएँ” के आवेदन, मासिक कोष और भुगतान →</Link>
      </p>

      <div className="review-tabs" role="tablist" aria-label="समीक्षा सूची">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={`review-tab ${view === key ? 'on' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
            {key !== 'live' && counts[key] > 0 ? ` (${counts[key]})` : ''}
          </button>
        ))}
      </div>

      {view === 'live' && (
        <input
          type="search"
          className="review-search"
          placeholder="शीर्षक से खोजें"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="शीर्षक से खोजें"
        />
      )}

      {rows === null && <p className="review-hint">लोड हो रहा है…</p>}
      {failed && (
        <p className="empty-state">
          सूची लोड नहीं हो सकी। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}
      {rows && !failed && rows.length === 0 && <p className="empty-state">{EMPTY[view]}</p>}
      {rows && rows.length > 0 && (
        <ul className="review-rows">
          {rows.map((row) => (
            <li key={row.id} className="review-row">
              <Link to={`/post/${encodeURIComponent(row.slug)}`}>
                <div className="review-row-title">{row.title}</div>
                <div className="review-row-meta">
                  <span>{row.author.full_name || row.author.username}</span>
                  <span>{timeAgo(row.updated_at)}</span>
                  {row.draft_notes > 0 && <span>{row.draft_notes} मसौदा टिप्पणी</span>}
                  {row.open_notes > 0 && <span>{row.open_notes} टिप्पणी बाकी</span>}
                  {row.fixed_notes > 0 && <span>{row.fixed_notes} ठीक की गईं</span>}
                </div>
                {row.summary && view !== 'live' && <p className="review-row-summary">{row.summary}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Review;
