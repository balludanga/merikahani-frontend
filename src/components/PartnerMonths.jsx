import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { earningsAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { LOPSIDED_PERCENT, apiMessage, formatRupees, monthLabel, paiseToRupeeText, rupeesToPaise } from '../utils/partner';

const monthState = (month) => {
  if (month.finalized) return 'हिसाब पक्का';
  return month.ended ? 'पूरा हुआ — हिसाब बाकी' : 'चल रहा है';
};

/** One month: its pool, what finalizing it would store, and the button that stores it. */
const MonthPanel = ({ month, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [failed, setFailed] = useState(false);
  const [pool, setPool] = useState('');
  const [cap, setCap] = useState('');
  const [left, setLeft] = useState({}); // user id -> the reason typed so far
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const filled = useRef(false);
  const leftKey = Object.keys(left).sort().join(',');

  const load = useCallback(async () => {
    try {
      const response = await earningsAPI.month(month, leftKey ? leftKey.split(',').map(Number) : []);
      setDetail(response.data);
      setFailed(false);
    } catch (error) {
      setFailed(true);
    }
  }, [month, leftKey]);

  useEffect(() => {
    load();
  }, [load]);

  // The boxes start from what is saved, once.
  useEffect(() => {
    if (!detail || filled.current) return;
    filled.current = true;
    setPool(detail.pool_paise ? paiseToRupeeText(detail.pool_paise) : '');
    setCap(detail.max_per_point_paise ? paiseToRupeeText(detail.max_per_point_paise) : '');
  }, [detail]);

  const savePool = async (event) => {
    event.preventDefault();
    setProblem('');
    setNotice('');
    const poolPaise = rupeesToPaise(pool);
    if (poolPaise == null) {
      setProblem('कोष की राशि सही नहीं है — जैसे 5000 या 5000.50');
      return;
    }
    const capPaise = cap.trim() ? rupeesToPaise(cap) : null;
    if (cap.trim() && !capPaise) {
      setProblem('प्रति अंक अधिकतम राशि सही नहीं है — जैसे 5 या 2.50');
      return;
    }
    setBusy(true);
    try {
      await earningsAPI.setPool(month, paiseToRupeeText(poolPaise), capPaise ? paiseToRupeeText(capPaise) : null);
      await load();
      setNotice('कोष सहेज लिया गया ✓');
      onChanged();
    } catch (error) {
      setProblem(apiMessage(error, 'कोष सहेजा नहीं जा सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    setBusy(true);
    setProblem('');
    try {
      const exclude = Object.entries(left).map(([id, reason]) => ({ user_id: Number(id), reason: reason.trim() }));
      const response = await earningsAPI.finalize(month, exclude);
      setDetail(response.data);
      setLeft({});
      setConfirm(false);
      setNotice('हिसाब पक्का हो गया ✓');
      onChanged();
    } catch (error) {
      setProblem(apiMessage(error, 'हिसाब पक्का नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  const toggleLeft = (userId, on) =>
    setLeft((current) => {
      const next = { ...current };
      if (on) next[userId] = '';
      else delete next[userId];
      return next;
    });

  if (failed) {
    return (
      <p className="empty-state">
        इस महीने का ब्योरा लोड नहीं हो सका। <button type="button" onClick={load}>फिर कोशिश करें</button>
      </p>
    );
  }
  if (!detail) return <p className="review-hint">लोड हो रहा है…</p>;

  const distributed = detail.rows.reduce((sum, row) => sum + row.amount_paise, 0);
  const reasonsMissing = Object.values(left).some((reason) => reason.trim().length < 3);

  return (
    <div className="desk-month">
      <h3 className="desk-sub">{monthLabel(month)} · {monthState(detail)}</h3>

      {!detail.finalized && (
        <form className="desk-pool" onSubmit={savePool}>
          <label htmlFor="desk-pool-amount">इस महीने का कोष (₹)</label>
          <input
            id="desk-pool-amount"
            className="earn-input"
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            value={pool}
            onChange={(e) => setPool(e.target.value)}
            placeholder="5000"
          />
          <label htmlFor="desk-pool-cap">एक अंक की अधिकतम कीमत (₹, वैकल्पिक)</label>
          <input
            id="desk-pool-cap"
            className="earn-input"
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            placeholder="खाली = कोई सीमा नहीं"
          />
          <p className="earn-note">
            शुरुआत में साझेदार कम होते हैं, इसलिए सीमा लगाना ठीक रहता है — वरना एक-दो तालियों पर पूरा कोष एक लेखक को चला
            जाएगा। सीमा से जो राशि बचती है वह किसी और को नहीं बाँटी जाती।
          </p>
          <button type="submit" className="earn-btn" disabled={busy}>कोष सहेजें और देखें</button>
        </form>
      )}

      {problem && <p className="earn-problem" role="alert">{problem}</p>}
      {notice && <p className="earn-ok" role="status">{notice}</p>}

      {detail.rows.length === 0 ? (
        <p className="empty-state">इस महीने कोई साझेदार लेखक नहीं था।</p>
      ) : (
        <>
          <p className="desk-muted">
            {detail.finalized
              ? `पक्का किया गया: ${formatDate(detail.finalized_at)}।`
              : 'यह पूर्वावलोकन है — पक्का करने से पहले कुछ भी सहेजा नहीं गया है।'}{' '}
            बँटी राशि: {formatRupees(distributed)}
            {detail.pool_paise > 0 ? ` · कोष में से बची: ${formatRupees(Math.max(0, detail.pool_paise - distributed))}` : ''}
          </p>
          <div className="desk-table-wrap">
            <table className="desk-table" aria-label={`${monthLabel(month)} का हिसाब`}>
              <thead>
                <tr>
                  <th scope="col">लेखक</th>
                  <th scope="col">अंक</th>
                  <th scope="col">ब्योरा</th>
                  <th scope="col">पाठक</th>
                  <th scope="col">सबसे बड़ा पाठक</th>
                  <th scope="col">राशि</th>
                  {!detail.finalized && <th scope="col">इस बार रोकें</th>}
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => {
                  const lopsided = row.points > 0 && row.top_reader_pct >= LOPSIDED_PERCENT;
                  const isLeft = Object.prototype.hasOwnProperty.call(left, row.user.id);
                  return (
                    <tr key={row.user.id} className={isLeft || row.held_reason ? 'held' : ''}>
                      <th scope="row">
                        <Link to={`/user/${row.user.id}`} target="_blank" rel="noopener noreferrer">
                          {row.user.full_name || row.user.username}
                        </Link>
                        {row.held_reason && <span className="earn-row-held">रोका गया: {row.held_reason}</span>}
                      </th>
                      <td data-label="अंक">{row.points}</td>
                      <td className="desk-detail-cell" data-label="ब्योरा">
                        {row.claps} ताली · {row.highlights} हाइलाइट · {row.responses} प्रतिक्रिया
                      </td>
                      <td data-label="पाठक">{row.readers}</td>
                      <td className={lopsided ? 'warn' : ''} data-label="सबसे बड़ा पाठक">
                        {detail.finalized ? '—' : row.points > 0 ? `${row.top_reader_pct}%${lopsided ? ' ⚠' : ''}` : '—'}
                      </td>
                      <td data-label="राशि"><strong>{formatRupees(row.amount_paise)}</strong></td>
                      {!detail.finalized && (
                        <td data-label="इस बार रोकें">
                          <label className="desk-leave">
                            <input
                              type="checkbox"
                              checked={isLeft}
                              onChange={(e) => toggleLeft(row.user.id, e.target.checked)}
                              aria-label={`${row.user.full_name || row.user.username} को इस महीने रोकें`}
                            />
                          </label>
                          {isLeft && (
                            <input
                              className="earn-input desk-leave-reason"
                              placeholder="कारण (लेखक को दिखेगा)"
                              aria-label="रोकने का कारण"
                              maxLength={300}
                              value={left[row.user.id]}
                              onChange={(e) => setLeft((current) => ({ ...current, [row.user.id]: e.target.value }))}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!detail.finalized && detail.rows.length > 0 && (
        <div className="desk-finalize">
          {!detail.ended && <p className="earn-note">महीना पूरा होने पर ही हिसाब पक्का किया जा सकता है।</p>}
          {detail.ended && detail.pool_paise === 0 && <p className="earn-note">हिसाब पक्का करने से पहले ऊपर इस महीने का कोष सहेजें।</p>}
          {confirm ? (
            <div className="earn-actions">
              <span>पक्का करने के बाद कोष, अंक और राशि बदले नहीं जा सकेंगे। पक्का करें?</span>
              <button type="button" className="earn-btn primary" onClick={finalize} disabled={busy || reasonsMissing}>हाँ, पक्का करें</button>
              <button type="button" className="earn-btn" onClick={() => setConfirm(false)}>रहने दें</button>
            </div>
          ) : (
            <button
              type="button"
              className="earn-btn primary"
              disabled={!detail.ended || detail.pool_paise === 0 || busy || reasonsMissing}
              onClick={() => setConfirm(true)}
            >
              इस महीने का हिसाब पक्का करें
            </button>
          )}
          {reasonsMissing && <p className="earn-note">जिन्हें रोका है, उनका कारण लिखें।</p>}
        </div>
      )}
    </div>
  );
};

/** Every month that has a pool or a result, with this month and last month always at the top. */
const PartnerMonths = () => {
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await earningsAPI.months();
      setList(response.data);
      // Last month is usually what needs doing: open it first.
      setOpen((current) => current || (response.data.months[1] || response.data.months[0] || {}).month || null);
    } catch (error) {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) {
    return (
      <p className="empty-state">
        महीनों की सूची लोड नहीं हो सकी। <button type="button" onClick={load}>फिर कोशिश करें</button>
      </p>
    );
  }
  if (!list) return <p className="review-hint">लोड हो रहा है…</p>;

  return (
    <>
      <p className="review-hint">
        हर महीने: कोष तय करें, पूर्वावलोकन देखें, फिर महीना बीतने पर हिसाब पक्का करें। महीना भारतीय समय के अनुसार गिना जाता है।
      </p>
      <ul className="desk-month-list">
        {list.months.map((month) => (
          <li key={month.month}>
            <button
              type="button"
              className={`desk-month-chip ${open === month.month ? 'on' : ''}`}
              aria-pressed={open === month.month}
              onClick={() => setOpen(month.month)}
            >
              <strong>{monthLabel(month.month)}</strong>
              <span>{monthState(month)}{month.pool_paise ? ` · ${formatRupees(month.pool_paise)}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && <MonthPanel key={open} month={open} onChanged={load} />}
    </>
  );
};

export default PartnerMonths;
