import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerAPI } from '../services/api';
import HindiTextarea, { useHinglish } from './HindiTextarea';
import { formatDate, timeAgo } from '../utils/format';
import { apiMessage, signalFlags } from '../utils/partner';

const VIEWS = [
  ['pending', 'प्रतीक्षा में'],
  ['approved', 'स्वीकृत'],
  ['declined', 'अस्वीकृत'],
  ['revoked', 'रोके गए'],
];

const EMPTY = {
  pending: 'अभी कोई आवेदन समीक्षा की प्रतीक्षा में नहीं है।',
  approved: 'अभी कोई साझेदार लेखक नहीं है।',
  declined: 'कोई आवेदन अस्वीकृत नहीं हुआ।',
  revoked: 'किसी की साझेदारी रोकी नहीं गई।',
};

const percent = (part, whole) => (whole > 0 ? ` (${Math.round((part * 100) / whole)}%)` : '');

const Fact = ({ label, value }) => (
  <div className="desk-fact">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

/** Everything a reviewer should know about one writer before deciding. */
const Detail = ({ id, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState(null); // null | 'decline' | 'revoke'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [hinglish, toggleHinglish, finish] = useHinglish();

  useEffect(() => {
    let live = true;
    setDetail(null);
    setFailed(false);
    partnerAPI
      .detail(id)
      .then((response) => live && setDetail(response.data))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  const act = async (call, fallback) => {
    setBusy(true);
    setProblem('');
    let result = null;
    try {
      result = (await call()).data;
    } catch (error) {
      setProblem(apiMessage(error, fallback));
    }
    setBusy(false);
    // Last: telling the list may remove this very row, which unmounts this component.
    if (result) {
      setDetail(result);
      setMode(null);
      setReason('');
      onChanged(result);
    }
  };

  if (failed) return <p className="empty-state">विवरण लोड नहीं हो सका।</p>;
  if (!detail) return <p className="review-hint">लोड हो रहा है…</p>;

  const { signals } = detail;
  const flags = signalFlags(signals);
  const writtenReason = finish(reason).trim();

  return (
    <div className="desk-detail">
      {detail.tagline && <p className="desk-tagline">{detail.tagline}</p>}
      {detail.bio && <p className="desk-bio">{detail.bio}</p>}
      {detail.note ? (
        <blockquote className="desk-quote">{detail.note}</blockquote>
      ) : (
        <p className="desk-muted">लेखक ने टीम के लिए कोई संदेश नहीं लिखा।</p>
      )}

      {flags.length > 0 && (
        <ul className="desk-flags" aria-label="ध्यान देने योग्य बातें">
          {flags.map((flag) => <li key={flag}>⚠ {flag}</li>)}
        </ul>
      )}

      <dl className="desk-facts">
        <Fact label="फ़ॉलोअर्स" value={`${signals.followers} (आवेदन के समय ${detail.followers_at_apply})`} />
        <Fact label="गूगल (Google) से सत्यापित" value={`${signals.followers_verified}${percent(signals.followers_verified, signals.followers)}`} />
        <Fact label="एक हफ़्ते से नए खाते" value={`${signals.followers_new}${percent(signals.followers_new, signals.followers)}`} />
        <Fact label="जिन्होंने साइट पर कुछ नहीं किया" value={`${signals.followers_inactive}${percent(signals.followers_inactive, signals.followers)}`} />
        <Fact label="जिन्हें लेखक ने भी फ़ॉलो किया" value={`${signals.followers_mutual}${percent(signals.followers_mutual, signals.followers)}`} />
        <Fact label="पिछले 7 / 30 दिनों में जुड़े" value={`${signals.followers_week} / ${signals.followers_month}`} />
        <Fact label="प्रकाशित रचनाएँ" value={signals.stories} />
        <Fact label="कुल तालियाँ" value={signals.claps_total} />
        <Fact label="दूसरों की प्रतिक्रियाएँ" value={signals.responses_received} />
        <Fact label="सबसे नई रचना" value={signals.latest_story_at ? formatDate(signals.latest_story_at) : '—'} />
        <Fact label="खाता" value={`${signals.account_days} दिन पुराना`} />
        {detail.payout_upi && <Fact label="यूपीआई (UPI) आईडी" value={<span dir="ltr">{detail.payout_upi}</span>} />}
      </dl>

      {detail.top_stories.length > 0 && (
        <>
          <h3 className="desk-sub">सबसे ज़्यादा सराही गई रचनाएँ</h3>
          <ul className="desk-stories">
            {detail.top_stories.map((story) => (
              <li key={story.id}>
                <Link to={`/post/${encodeURIComponent(story.slug)}`} target="_blank" rel="noopener noreferrer">
                  {story.title}
                </Link>
                <span className="desk-muted"> · {story.claps} तालियाँ</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {detail.decision_note && (
        <p className="desk-muted">
          पिछला निर्णय ({detail.decided_at ? formatDate(detail.decided_at) : ''}): {detail.decision_note}
        </p>
      )}

      {problem && <p className="earn-problem" role="alert">{problem}</p>}

      {mode ? (
        <div className="desk-decide">
          <label htmlFor={`desk-reason-${id}`}>
            {mode === 'decline'
              ? 'कारण (लेखक को ज्यों का त्यों दिखेगा — सहानुभूति से लिखें)'
              : 'साझेदारी रोकने का कारण (लेखक को दिखेगा)'}
          </label>
          <HindiTextarea
            id={`desk-reason-${id}`}
            value={reason}
            onChange={setReason}
            hinglish={hinglish}
            onToggle={toggleHinglish}
            maxLength={1000}
            rows={3}
          />
          {mode === 'revoke' && (
            <p className="earn-note">
              ध्यान दें: जिन महीनों का हिसाब अभी पक्का नहीं हुआ (चालू महीना भी), उनकी कमाई इस लेखक को नहीं मिलेगी। पक्के हो
              चुके महीनों की कमाई और बकाया राशि उन्हीं की रहेगी।
            </p>
          )}
          <div className="earn-actions">
            <button
              type="button"
              className="earn-btn danger"
              disabled={busy || writtenReason.length < 5}
              onClick={() =>
                act(
                  () => (mode === 'decline' ? partnerAPI.decline(id, writtenReason) : partnerAPI.revoke(id, writtenReason)),
                  'निर्णय दर्ज नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'
                )
              }
            >
              {mode === 'decline' ? 'अस्वीकृत करें' : 'साझेदारी रोकें'}
            </button>
            <button type="button" className="earn-btn" onClick={() => { setMode(null); setReason(''); }}>रद्द करें</button>
          </div>
        </div>
      ) : (
        <div className="earn-actions">
          {['pending', 'declined', 'revoked'].includes(detail.status) && (
            <button
              type="button"
              className="earn-btn primary"
              disabled={busy}
              onClick={() => act(() => partnerAPI.approve(id), 'स्वीकृति दर्ज नहीं हो सकी। थोड़ी देर में फिर कोशिश करें।')}
            >
              {detail.status === 'pending' ? 'स्वीकृत करें' : 'फिर से स्वीकृत करें'}
            </button>
          )}
          {detail.status === 'pending' && (
            <button type="button" className="earn-btn" disabled={busy} onClick={() => setMode('decline')}>अस्वीकृत करें…</button>
          )}
          {detail.status === 'approved' && (
            <button type="button" className="earn-btn danger" disabled={busy} onClick={() => setMode('revoke')}>साझेदारी रोकें…</button>
          )}
        </div>
      )}
    </div>
  );
};

/** The queue: who applied, oldest first; open one to read it and decide. */
const PartnerApplications = () => {
  const [view, setView] = useState('pending');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null); // null = loading
  const [counts, setCounts] = useState({ pending: 0, approved: 0, declined: 0, revoked: 0 });
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setRows(null);
    setFailed(false);
    try {
      const [list, count] = await Promise.all([
        partnerAPI.queue({ view, q: query.trim() || undefined, limit: 100 }),
        partnerAPI.counts(),
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
    const timer = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  // A decision moves the application to another list: refresh the counts, drop it from this one.
  const decided = (item) => {
    partnerAPI.counts().then((response) => setCounts(response.data)).catch(() => {});
    if (item.status !== view) {
      setRows((current) => (current || []).filter((row) => row.id !== item.id));
      setOpen(null);
    }
  };

  return (
    <>
      <div className="review-tabs desk-views" role="tablist" aria-label="आवेदनों की सूची">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={`review-tab ${view === key ? 'on' : ''}`}
            onClick={() => { setView(key); setOpen(null); }}
          >
            {label}
            {counts[key] > 0 ? ` (${counts[key]})` : ''}
          </button>
        ))}
      </div>

      <input
        type="search"
        className="review-search"
        placeholder="नाम या यूज़रनेम से खोजें"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="नाम या यूज़रनेम से खोजें"
      />

      {rows === null && <p className="review-hint">लोड हो रहा है…</p>}
      {failed && (
        <p className="empty-state">
          सूची लोड नहीं हो सकी। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}
      {rows && !failed && rows.length === 0 && <p className="empty-state">{EMPTY[view]}</p>}
      {rows && rows.length > 0 && (
        <ul className="desk-rows">
          {rows.map((row) => {
            const isOpen = open === row.id;
            return (
              <li key={row.id} className={`desk-row ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="desk-row-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : row.id)}
                >
                  <span className="desk-row-name">{row.user.full_name || row.user.username}</span>
                  <span className="desk-row-meta">
                    <span>{row.followers_now} फ़ॉलोअर्स</span>
                    <span>{row.stories_now} रचनाएँ</span>
                    <span>{view === 'pending' ? `आवेदन ${timeAgo(row.applied_at)}` : timeAgo(row.decided_at || row.applied_at)}</span>
                    {row.attempts > 1 && <span>{row.attempts} बार आवेदन</span>}
                  </span>
                </button>
                {isOpen && (
                  <>
                    <p className="desk-profile-link">
                      <Link to={`/user/${row.user.id}`} target="_blank" rel="noopener noreferrer">प्रोफ़ाइल खोलें</Link>
                      <span className="desk-muted" dir="ltr"> · @{row.user.username}</span>
                    </p>
                    <Detail id={row.id} onChanged={decided} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

export default PartnerApplications;
