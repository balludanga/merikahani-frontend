import React, { useState } from 'react';
import { partnerAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { apiMessage, formatRupees, isUpiLike, monthLabel } from '../utils/partner';

const Stat = ({ label, value, hint }) => (
  <div className="earn-stat">
    <span className="earn-stat-label">{label}</span>
    <strong className="earn-stat-value">{value}</strong>
    {hint && <span className="earn-stat-hint">{hint}</span>}
  </div>
);

/** The month so far: points and what they would pay once a pool is set. */
const LiveMonth = ({ live }) => (
  <section className="earn-card" aria-labelledby="earn-live">
    <h2 id="earn-live">इस महीने अब तक · {monthLabel(live.month)}</h2>
    <div className="earn-live">
      <div className="earn-points">
        <strong>{live.points}</strong>
        <span>अंक</span>
      </div>
      <ul className="earn-breakdown">
        <li><strong>{live.claps}</strong> तालियाँ</li>
        <li><strong>{live.highlights}</strong> हाइलाइट</li>
        <li><strong>{live.responses}</strong> प्रतिक्रियाएँ</li>
        <li><strong>{live.readers}</strong> पाठक</li>
      </ul>
    </div>
    <p className="earn-note">
      {live.estimate_paise != null
        ? `अभी के अंकों पर अनुमानित हिस्सा: ${formatRupees(live.estimate_paise)}। यह महीना पूरा होने तक बदल सकता है।`
        : 'इस महीने का कोष तय होते ही यहाँ आपका अनुमानित हिस्सा दिखेगा।'}
    </p>
  </section>
);

/** Where the owner sends the money. Private: only the writer and the review team see it. */
const PayoutAddress = ({ current, onSaved }) => {
  const [value, setValue] = useState(current || '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState(false);
  const changed = value.trim() !== (current || '');

  const save = async (event) => {
    event.preventDefault();
    const text = value.trim();
    if (text && !isUpiLike(text)) {
      setProblem('यूपीआई (UPI) आईडी सही नहीं लगती — सही रूप: नाम@बैंक (name@bank)');
      return;
    }
    setBusy(true);
    setProblem('');
    setSaved(false);
    try {
      const response = await partnerAPI.setUpi(text);
      onSaved(response.data);
      setSaved(true);
    } catch (error) {
      setProblem(apiMessage(error, 'आईडी सहेजी नहीं जा सकी। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="earn-card" aria-labelledby="earn-upi">
      <h2 id="earn-upi">भुगतान का तरीका</h2>
      <form className="earn-upi" onSubmit={save}>
        <label htmlFor="earn-upi-input">आपकी यूपीआई (UPI) आईडी</label>
        <div className="earn-upi-row">
          <input
            id="earn-upi-input"
            className="earn-input"
            type="text"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            maxLength={80}
            placeholder="नाम@बैंक"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
          />
          <button type="submit" className="earn-btn" disabled={busy || !changed}>
            {busy ? 'सहेज रहे हैं…' : 'सहेजें'}
          </button>
        </div>
        <p className="earn-note">
          भुगतान इसी आईडी पर भेजा जाता है। इसे केवल आप और समीक्षा टीम देख सकती है — प्रोफ़ाइल पर यह कभी नहीं दिखती।
        </p>
        {problem && <p className="earn-problem" role="alert">{problem}</p>}
        {saved && !problem && <p className="earn-ok" role="status">सहेज ली गई ✓</p>}
      </form>
    </section>
  );
};

/** A partner's whole picture: what they are owed, the month so far, every month, every payout. */
const EarnPanel = ({ status, earnings, onStatus }) => {
  const rules = status.rules;
  const minimum = rules.min_payout_paise;
  const owed = earnings.balance_paise;

  return (
    <>
      <section className="earn-card" aria-labelledby="earn-balance">
        <h2 id="earn-balance">आपकी कमाई</h2>
        <div className="earn-stats">
          <Stat
            label="बकाया राशि"
            value={formatRupees(owed)}
            hint={owed >= minimum && owed > 0 ? 'अगले भुगतान में आएगी' : `${formatRupees(minimum)} होने पर भुगतान`}
          />
          <Stat label="अब तक की कमाई" value={formatRupees(earnings.earned_paise)} />
          <Stat label="अब तक का भुगतान" value={formatRupees(earnings.paid_paise)} />
        </div>
      </section>

      {earnings.live && <LiveMonth live={earnings.live} />}

      <PayoutAddress current={status.payout_upi} onSaved={onStatus} />

      <section className="earn-card" aria-labelledby="earn-months">
        <h2 id="earn-months">महीनों का हिसाब</h2>
        {earnings.months.length === 0 ? (
          <p className="earn-note">अभी कोई महीना पूरा नहीं हुआ। महीना बीतने पर समीक्षा टीम हिसाब पक्का करती है, और वह यहाँ दिखता है।</p>
        ) : (
          <ul className="earn-rows">
            {earnings.months.map((line) => (
              <li key={line.month} className="earn-row">
                <div className="earn-row-main">
                  <strong>{monthLabel(line.month)}</strong>
                  <span className="earn-row-sub">
                    {line.points} अंक · {line.claps} तालियाँ · {line.highlights} हाइलाइट · {line.responses} प्रतिक्रियाएँ · {line.readers} पाठक
                  </span>
                  {line.held_reason && <span className="earn-row-held">इस महीने रोका गया: {line.held_reason}</span>}
                </div>
                <strong className="earn-row-amount">{formatRupees(line.amount_paise)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      {earnings.payouts.length > 0 && (
        <section className="earn-card" aria-labelledby="earn-paid">
          <h2 id="earn-paid">भुगतान</h2>
          <ul className="earn-rows">
            {earnings.payouts.map((payout) => (
              <li key={payout.id} className="earn-row">
                <div className="earn-row-main">
                  <strong>{formatDate(payout.paid_at)}</strong>
                  {payout.reference && <span className="earn-row-sub" dir="ltr">{payout.reference}</span>}
                </div>
                <strong className="earn-row-amount">{formatRupees(payout.amount_paise)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

export default EarnPanel;
