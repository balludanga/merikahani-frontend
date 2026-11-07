import React, { useCallback, useEffect, useState } from 'react';
import { ownerAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { formatRupees } from '../utils/partner';
import { PAYMENT_STATUS_LABELS, PURPOSE_LABELS } from '../utils/payments';
import './ProfitSheet.css';

const person = (who) => (who ? who.full_name || who.username : '—');

/** Whether payments are connected, how they stand, and the messages from the provider that went wrong. */
const OwnerPayments = () => {
  const [log, setLog] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setLog((await ownerAPI.payments()).data);
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
        भुगतान की जानकारी लोड नहीं हो सकी। <button type="button" onClick={load}>फिर कोशिश करें</button>
      </p>
    );
  }
  if (!log) return <p className="review-hint">लोड हो रहा है…</p>;

  return (
    <div className="sheet">
      <div className="sheet-block">
        <h3 className="desk-sub">भुगतान सेवा</h3>
        <p className={log.connected ? 'earn-ok' : 'earn-note'} role="status">
          {log.connected
            ? log.test_mode
              ? 'जुड़ी है — जाँच का रूप (नकली भुगतान, कोई असली पैसा नहीं)।'
              : 'जुड़ी है — असली भुगतान चालू हैं।'
            : 'अभी कोई भुगतान सेवा नहीं जुड़ी है, इसलिए साइट पर समर्थन और सदस्यता दिखती ही नहीं।'}
        </p>
        <ul className="sheet-lines">
          {Object.entries(PAYMENT_STATUS_LABELS).map(([status, label]) => (
            <li key={status}><span>{label}</span><strong>{log.counts[status] || 0}</strong></li>
          ))}
        </ul>
      </div>

      <div className="sheet-block">
        <h3 className="desk-sub">जिन संदेशों पर नज़र डालनी है</h3>
        {log.problems.length === 0 ? (
          <p className="desk-muted">कोई नहीं — सब संदेश ठीक से दर्ज हुए ✓</p>
        ) : (
          <ul className="sheet-txns">
            {log.problems.map((event) => (
              <li key={event.id}>
                <div className="sheet-txn-head">
                  <strong>{event.status === 'rejected' ? 'अस्वीकार किया गया' : 'हमारी ओर से दर्ज नहीं हो सका'}</strong>
                  <span className="desk-muted" dir="ltr">{event.type}</span>
                  <span className="desk-muted">{formatDate(event.received_at)}</span>
                </div>
                {event.detail && <p className="desk-muted">{event.detail}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="earn-note">
          “अस्वीकार” का मतलब आई हुई राशि माँगी गई राशि से अलग थी, इसलिए कुछ दर्ज नहीं किया गया। “दर्ज नहीं हो सका” वाले संदेश भुगतान सेवा बाद में
          दोबारा भेजती है।
        </p>
      </div>

      <div className="sheet-block">
        <h3 className="desk-sub">हाल के भुगतान</h3>
        {log.recent.length === 0 ? (
          <p className="desk-muted">अभी कोई भुगतान नहीं।</p>
        ) : (
          <ul className="sheet-txns">
            {log.recent.map((row) => (
              <li key={row.public_id}>
                <div className="sheet-txn-head">
                  <strong>{PURPOSE_LABELS[row.purpose] || row.purpose}</strong>
                  <span>{formatRupees(row.amount_paise)}</span>
                  <span className="sheet-tag">{PAYMENT_STATUS_LABELS[row.status] || row.status}</span>
                  <span className="desk-muted">{formatDate(row.captured_at || row.created_at)}</span>
                </div>
                <p className="desk-muted">
                  {person(row.payer)}{row.target ? ` → ${person(row.target)}` : ''}
                  {row.refunded_paise > 0 ? ` · ${formatRupees(row.refunded_paise)} लौटाया गया` : ''}
                  {row.failure_reason ? ` · ${row.failure_reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OwnerPayments;
