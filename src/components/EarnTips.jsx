import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentsAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { apiMessage, formatRupees } from '../utils/partner';
import { feePercent } from '../utils/payments';

/**
 * The partner's tips: whether readers may send them, the share the site keeps, and every tip received.
 * A sender appears by name unless they asked not to be named.
 */
const EarnTips = ({ payments }) => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const live = !!(payments && payments.enabled);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData((await paymentsAPI.tipsReceived()).data);
    } catch (error) {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (accepts) => {
    setBusy(true);
    setProblem('');
    try {
      await paymentsAPI.setAcceptsTips(accepts);
      setData((current) => ({ ...current, accepts_tips: accepts }));
    } catch (error) {
      setProblem(apiMessage(error, 'बदलाव सहेजा नहीं जा सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="earn-card" aria-labelledby="earn-tips">
      <h2 id="earn-tips">पाठकों का समर्थन</h2>

      {failed && (
        <p className="empty-state">
          समर्थन की सूची लोड नहीं हो सकी। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}
      {!data && !failed && <p className="earn-note">लोड हो रहा है…</p>}

      {data && (
        <>
          {live && (
            <>
              <label className="earn-check">
                <input type="checkbox" checked={data.accepts_tips} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
                <span>पाठक मुझे समर्थन भेज सकें</span>
              </label>
              <p className="earn-note">
                लेखनी हर समर्थन का {feePercent(data.site_fee_bps)} रखती है, भुगतान के खर्च और साइट चलाने के लिए। बाकी आपकी बकाया राशि में जुड़
                जाता है और कोष के हिस्से के साथ ही यूपीआई (UPI) से भेजा जाता है।
              </p>
            </>
          )}
          {problem && <p className="earn-problem" role="alert">{problem}</p>}

          {data.items.length === 0 ? (
            <p className="earn-note">अभी कोई समर्थन नहीं मिला।{live ? ' आपकी रचनाओं के पन्ने पर पाठकों को “समर्थन करें” का बटन दिखता है।' : ''}</p>
          ) : (
            <>
              <p className="earn-lead">अब तक का समर्थन: <strong>{formatRupees(data.total_paise)}</strong> · {data.count} बार</p>
              <ul className="earn-rows">
                {data.items.map((item) => (
                  <li key={item.id} className="earn-row">
                    <div className="earn-row-main">
                      <strong>{item.sender ? item.sender.full_name || item.sender.username : 'एक पाठक'}</strong>
                      <span className="earn-row-sub">
                        {formatDate(item.at)}
                        {item.story && (
                          <>
                            {' · '}
                            <Link to={`/post/${encodeURIComponent(item.story.slug)}`}>“{item.story.title}”</Link>
                          </>
                        )}
                      </span>
                      {item.message && <span className="earn-row-sub">“{item.message}”</span>}
                      {item.refunded_paise > 0 && <span className="earn-row-held">{formatRupees(item.refunded_paise)} लौटाया गया</span>}
                    </div>
                    <strong className="earn-row-amount">{formatRupees(item.writer_share_paise - item.refunded_paise)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
};

export default EarnTips;
