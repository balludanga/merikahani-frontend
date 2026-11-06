import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { earningsAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { apiMessage, formatRupees, paiseToRupeeText, rupeesToPaise } from '../utils/partner';

/** Recording money that has already been sent: this page never moves any money itself. */
const PayForm = ({ row, onDone, onCancel }) => {
  const [amount, setAmount] = useState(paiseToRupeeText(row.balance_paise));
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const paise = rupeesToPaise(amount);

  const submit = async (event) => {
    event.preventDefault();
    if (!paise) {
      setProblem('राशि सही नहीं है — जैसे 250 या 250.50');
      return;
    }
    if (paise > row.balance_paise) {
      setProblem(`राशि बकाया (${formatRupees(row.balance_paise)}) से ज़्यादा नहीं हो सकती`);
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      await earningsAPI.pay(row.user.id, paiseToRupeeText(paise), reference.trim());
      onDone(`${formatRupees(paise)} का भुगतान दर्ज हो गया ✓ — लेखक को सूचना भेज दी गई।`);
    } catch (error) {
      setProblem(apiMessage(error, 'भुगतान दर्ज नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'));
      setBusy(false);
    }
  };

  return (
    <form className="desk-pay" onSubmit={submit}>
      <p className="earn-note">
        यह केवल दर्ज करता है कि आपने पैसा भेज दिया है — पैसा आपको अलग से यूपीआई (UPI) से भेजना है। पहले भेजें, फिर यहाँ दर्ज करें।
      </p>
      <label htmlFor={`pay-amount-${row.user.id}`}>भेजी गई राशि (₹)</label>
      <input
        id={`pay-amount-${row.user.id}`}
        className="earn-input"
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <label htmlFor={`pay-ref-${row.user.id}`}>यूपीआई (UPI) लेन-देन संख्या (वैकल्पिक)</label>
      <input
        id={`pay-ref-${row.user.id}`}
        className="earn-input"
        autoComplete="off"
        dir="ltr"
        maxLength={80}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      {problem && <p className="earn-problem" role="alert">{problem}</p>}
      <div className="earn-actions">
        <button type="submit" className="earn-btn primary" disabled={busy}>{busy ? 'दर्ज हो रहा है…' : 'भुगतान दर्ज करें'}</button>
        <button type="button" className="earn-btn" onClick={onCancel}>रद्द करें</button>
      </div>
    </form>
  );
};

const CopyUpi = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      // Clipboard blocked: the address is on the screen to select by hand.
    }
  };
  return (
    <span className="desk-upi">
      <span dir="ltr">{value}</span>
      <button type="button" className="desk-copy" onClick={copy} aria-label="यूपीआई (UPI) आईडी कॉपी करें">
        {copied ? 'कॉपी हुई ✓' : 'कॉपी'}
      </button>
    </span>
  );
};

const PartnerPayouts = () => {
  const [rows, setRows] = useState(null);
  const [history, setHistory] = useState([]);
  const [failed, setFailed] = useState(false);
  const [paying, setPaying] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [balances, payouts] = await Promise.all([earningsAPI.balances(), earningsAPI.payouts({ limit: 30 })]);
      setRows(balances.data);
      setHistory(payouts.data);
    } catch (error) {
      setFailed(true);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const done = (message) => {
    setPaying(null);
    setNotice(message);
    load();
  };

  return (
    <>
      <p className="review-hint">
        यहाँ साझेदार लेखकों की बकाया राशि है। पहले उन्हें यूपीआई (UPI) से पैसा भेजें, फिर यहाँ दर्ज करें; बकाया उतना घट जाएगा।
      </p>
      {notice && <p className="earn-ok" role="status">{notice}</p>}
      {rows === null && <p className="review-hint">लोड हो रहा है…</p>}
      {failed && (
        <p className="empty-state">
          लोड नहीं हो सका। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}
      {rows && !failed && rows.length === 0 && <p className="empty-state">अभी कोई साझेदार लेखक नहीं है।</p>}
      {rows && rows.length > 0 && (
        <ul className="desk-rows">
          {rows.map((row) => (
            <li key={row.user.id} className="desk-row open">
              <div className="desk-pay-head">
                <div>
                  <Link to={`/user/${row.user.id}`} target="_blank" rel="noopener noreferrer" className="desk-row-name">
                    {row.user.full_name || row.user.username}
                  </Link>
                  <div className="desk-row-meta">
                    <span>कमाई {formatRupees(row.earned_paise)}</span>
                    <span>भुगतान {formatRupees(row.paid_paise)}</span>
                    {row.last_paid_at && <span>पिछला भुगतान {formatDate(row.last_paid_at)}</span>}
                  </div>
                  <div className="desk-row-meta">
                    {row.payout_upi ? <CopyUpi value={row.payout_upi} /> : <span className="desk-muted">यूपीआई (UPI) आईडी अभी दर्ज नहीं</span>}
                  </div>
                </div>
                <div className="desk-owed">
                  <strong>{formatRupees(row.balance_paise)}</strong>
                  <span className={row.due ? 'desk-due' : 'desk-muted'}>{row.due ? 'भुगतान देय' : 'न्यूनतम से कम'}</span>
                  {row.balance_paise > 0 && paying !== row.user.id && (
                    <button type="button" className="earn-btn" onClick={() => { setNotice(''); setPaying(row.user.id); }}>भुगतान दर्ज करें…</button>
                  )}
                </div>
              </div>
              {paying === row.user.id && <PayForm row={row} onDone={done} onCancel={() => setPaying(null)} />}
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <>
          <h3 className="desk-sub">हाल के भुगतान</h3>
          <ul className="earn-rows desk-history">
            {history.map((payout) => (
              <li key={payout.id} className="earn-row">
                <div className="earn-row-main">
                  <strong>{payout.user.full_name || payout.user.username}</strong>
                  <span className="earn-row-sub">
                    {formatDate(payout.paid_at)}
                    {payout.reference ? ' · ' : ''}
                    {payout.reference && <span dir="ltr">{payout.reference}</span>}
                  </span>
                </div>
                <strong className="earn-row-amount">{formatRupees(payout.amount_paise)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};

export default PartnerPayouts;
