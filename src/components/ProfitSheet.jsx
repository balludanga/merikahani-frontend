import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ownerAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { apiMessage, formatRupees, monthLabel, paiseToRupeeText, rupeesToPaise } from '../utils/partner';
import {
  ACCOUNT_LABELS,
  EXPENSE_ACCOUNTS,
  INCOME_ACCOUNTS,
  MANUAL_EXPENSE,
  MANUAL_INCOME,
  TRANSACTION_LABELS,
  entryDate,
  recentMonths,
} from '../utils/payments';
import './ProfitSheet.css';

const Lines = ({ title, codes, values, total, totalLabel }) => {
  const shown = codes.filter((code) => values[code]);
  return (
    <div className="sheet-block">
      <h3 className="desk-sub">{title}</h3>
      {shown.length === 0 ? (
        <p className="desk-muted">इस महीने कुछ दर्ज नहीं।</p>
      ) : (
        <ul className="sheet-lines">
          {shown.map((code) => (
            <li key={code}>
              <span>{ACCOUNT_LABELS[code]}</span>
              <strong>{formatRupees(values[code])}</strong>
            </li>
          ))}
        </ul>
      )}
      <p className="sheet-total"><span>{totalLabel}</span><strong>{formatRupees(total)}</strong></p>
    </div>
  );
};

/** The suggestion: the chosen percent of the month's profit, what is held back, and the pool to set. */
const Pool = ({ month, sheet, onChanged }) => {
  const choice = sheet.choice;
  const [percent, setPercent] = useState(choice.pool_percent == null ? '' : String(choice.pool_percent));
  const [holdback, setHoldback] = useState(String(choice.holdback_percent || 0));
  const [note, setNote] = useState(choice.note || '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');

  const save = async (event) => {
    event.preventDefault();
    setProblem('');
    setNotice('');
    const pool = percent.trim() === '' ? null : Number(percent);
    const held = Number(holdback.trim() === '' ? 0 : holdback);
    if ((pool != null && (!Number.isInteger(pool) || pool < 0 || pool > 100)) || !Number.isInteger(held) || held < 0 || held > 50) {
      setProblem('प्रतिशत पूरी संख्या होना चाहिए — कोष का 0 से 100, रोकने का 0 से 50');
      return;
    }
    setBusy(true);
    try {
      await ownerAPI.choose(month, { pool_percent: pool, holdback_percent: held, note: note.trim() || null });
      await onChanged();
      setNotice('सहेज लिया गया ✓');
    } catch (error) {
      setProblem(apiMessage(error, 'सहेजा नहीं जा सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      await ownerAPI.apply(month);
      await onChanged();
      setNotice('इस महीने का कोष तय हो गया ✓');
    } catch (error) {
      setProblem(apiMessage(error, 'कोष तय नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-block">
      <h3 className="desk-sub">कोष का सुझाव</h3>
      <form className="desk-pool" onSubmit={save}>
        <label htmlFor="sheet-percent">लाभ का कितने प्रतिशत कोष में जाए</label>
        <input
          id="sheet-percent"
          className="earn-input"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          placeholder="खाली = कोई सुझाव नहीं"
        />
        <label htmlFor="sheet-holdback">कोष का कितना प्रतिशत अगले महीने तक रोकें (देर से आने वाली वापसियों के लिए)</label>
        <input
          id="sheet-holdback"
          className="earn-input"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          value={holdback}
          onChange={(e) => setHoldback(e.target.value)}
        />
        <label htmlFor="sheet-note">अपने लिए टिप्पणी (किसी और को नहीं दिखती)</label>
        <textarea id="sheet-note" className="earn-input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        {!choice.own && choice.pool_percent != null && (
          <p className="earn-note">यह प्रतिशत पिछले तय किए गए महीने से लिया गया है; सहेजने पर इस महीने का अपना बन जाएगा।</p>
        )}
        <button type="submit" className="earn-btn" disabled={busy}>सहेजें</button>
      </form>

      {problem && <p className="earn-problem" role="alert">{problem}</p>}
      {notice && <p className="earn-ok" role="status">{notice}</p>}

      {sheet.suggested == null ? (
        <p className="earn-note">प्रतिशत भरने पर यहाँ सुझाया गया कोष दिखेगा। लाभ न हो तो कोष शून्य रहता है, और घाटा आगे के महीनों पर नहीं डाला जाता।</p>
      ) : (
        <div className="sheet-suggestion">
          <ul className="sheet-lines">
            <li><span>इस महीने के लाभ पर कोष</span><strong>{formatRupees(sheet.pool_before_holdback)}</strong></li>
            <li><span>अगले महीने तक रोका गया</span><strong>− {formatRupees(sheet.held_back)}</strong></li>
            <li><span>पिछले महीने से रोका हुआ, अब जुड़ा</span><strong>+ {formatRupees(sheet.carried_in)}</strong></li>
          </ul>
          <p className="sheet-total big"><span>सुझाया गया कोष</span><strong>{formatRupees(sheet.suggested)}</strong></p>
          <p className="desk-muted">
            अभी “मासिक कोष” में तय: {sheet.pool_set ? formatRupees(sheet.pool_set) : 'कुछ नहीं'}
            {sheet.finalized ? ' · इस महीने का हिसाब पक्का हो चुका है' : ''}
          </p>
          <div className="earn-actions">
            <button type="button" className="earn-btn primary" disabled={busy || sheet.finalized} onClick={apply}>यही कोष तय करें</button>
            <Link to="/review/partners?tab=months" className="earn-btn">मासिक कोष खोलें</Link>
          </div>
          <p className="earn-note">यह केवल कोष की राशि भरता है; प्रति अंक की सीमा और पाठकों के वज़न जैसे बाकी फ़ैसले “मासिक कोष” में आपके ही रहते हैं।</p>
        </div>
      )}
    </div>
  );
};

/** Money that did not come through the payment provider: a sponsor's payment, the hosting bill. */
const AddEntry = ({ month, onAdded }) => {
  const [account, setAccount] = useState(MANUAL_INCOME[0]);
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setProblem('');
    const paise = rupeesToPaise(amount);
    if (!paise) {
      setProblem('राशि सही नहीं है — जैसे 3000 या 1250.50');
      return;
    }
    const when = entryDate(month, day);
    if (when.problem) {
      setProblem(when.problem);
      return;
    }
    setBusy(true);
    try {
      await ownerAPI.addEntry({
        account,
        amount_rupees: paiseToRupeeText(paise),
        memo: memo.trim() || null,
        on: when.on,
      });
      setAmount('');
      setMemo('');
      setDay('');
      await onAdded();
    } catch (error) {
      setProblem(apiMessage(error, 'दर्ज नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-block">
      <h3 className="desk-sub">हाथ से आय या खर्च दर्ज करें</h3>
      <form className="desk-pool" onSubmit={submit}>
        <label htmlFor="entry-account">मद</label>
        <select id="entry-account" className="earn-input" value={account} onChange={(e) => setAccount(e.target.value)}>
          <optgroup label="आय">
            {MANUAL_INCOME.map((code) => <option key={code} value={code}>{ACCOUNT_LABELS[code]}</option>)}
          </optgroup>
          <optgroup label="खर्च">
            {MANUAL_EXPENSE.map((code) => <option key={code} value={code}>{ACCOUNT_LABELS[code]}</option>)}
          </optgroup>
        </select>
        <label htmlFor="entry-amount">राशि (₹)</label>
        <input id="entry-amount" className="earn-input" inputMode="decimal" autoComplete="off" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3000" />
        <label htmlFor="entry-day">{monthLabel(month)} की कौन-सी तारीख</label>
        <input
          id="entry-day"
          className="earn-input"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          maxLength={2}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          placeholder={String(entryDate(month, '').fallback || '')}
        />
        <label htmlFor="entry-memo">विवरण (वैकल्पिक)</label>
        <input id="entry-memo" className="earn-input" maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} />
        {problem && <p className="earn-problem" role="alert">{problem}</p>}
        <button type="submit" className="earn-btn" disabled={busy}>दर्ज करें</button>
        <p className="earn-note">प्रविष्टि ऊपर चुने हुए महीने की ही होती है; तारीख खाली छोड़ें तो आज (या पिछले महीनों के लिए महीने का आख़िरी दिन) गिना जाता है। गलती हो तो नीचे की सूची में “उलटें” दबाएँ — कुछ मिटाया नहीं जाता।</p>
      </form>
    </div>
  );
};

const Books = ({ month, books, onChanged }) => {
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState('');

  const reverse = async (id) => {
    setBusy(id);
    setProblem('');
    try {
      await ownerAPI.reverse(id);
      await onChanged();
    } catch (error) {
      setProblem(apiMessage(error, 'उलटा नहीं जा सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(0);
    }
  };

  return (
    <div className="sheet-block">
      <h3 className="desk-sub">{monthLabel(month)} की बही</h3>
      <ul className="sheet-lines">
        <li><span>अभी कुल नकद (भुगतान सेवा और बैंक मिलाकर)</span><strong>{formatRupees(books.cash_paise)}</strong></li>
        <li><span>अभी लेखकों को देय</span><strong>{formatRupees(books.owed_paise)}</strong></li>
        <li><span>अभी जीएसटी (GST) देय</span><strong>{formatRupees(books.gst_payable_paise)}</strong></li>
      </ul>
      <p className={books.balanced ? 'earn-ok' : 'earn-problem'} role="status">
        {books.balanced ? 'बही संतुलित है ✓' : 'चेतावनी: बही संतुलित नहीं है — इसकी जाँच करें।'}
      </p>
      {problem && <p className="earn-problem" role="alert">{problem}</p>}
      {books.items.length === 0 ? (
        <p className="desk-muted">इस महीने कोई प्रविष्टि नहीं।</p>
      ) : (
        <ul className="sheet-txns">
          {books.items.map((txn) => (
            <li key={txn.id} className={txn.reversed || txn.reverses_id ? 'undone' : ''}>
              <div className="sheet-txn-head">
                <strong>{TRANSACTION_LABELS[txn.kind] || txn.kind}</strong>
                <span className="desk-muted">{formatDate(txn.posted_at)}</span>
                {txn.memo && <span className="desk-muted">{txn.memo}</span>}
                {txn.reversed && <span className="sheet-tag">उलटी गई</span>}
                {txn.reverses_id && <span className="sheet-tag">उलटी प्रविष्टि</span>}
                {txn.kind === 'manual' && !txn.reversed && (
                  <button type="button" className="earn-btn" disabled={busy === txn.id} onClick={() => reverse(txn.id)}>उलटें</button>
                )}
              </div>
              <ul className="sheet-entries">
                {txn.entries.map((entry, i) => (
                  // a transaction may touch the same account twice, so the position is part of the key
                  <li key={`${entry.account}-${entry.user_id || 0}-${i}`}>
                    <span>{ACCOUNT_LABELS[entry.account] || entry.account}{entry.user_id ? ` (लेखक ${entry.user_id})` : ''}</span>
                    <span dir="ltr">{entry.amount_paise > 0 ? '+' : '−'} {formatRupees(Math.abs(entry.amount_paise))}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** The owner's monthly sheet. Everything here is worked out from the books each time; only the owner can open it. */
const ProfitSheet = () => {
  const [months, setMonths] = useState(null);
  const [month, setMonth] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [books, setBooks] = useState(null);
  const [failed, setFailed] = useState(false);

  // Last month is the usual one to look at: the pool is decided after a month ends.
  useEffect(() => {
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const keys = recentMonths(current, 12);
    setMonths(keys);
    setMonth(keys[1] || keys[0]);
  }, []);

  const load = useCallback(async () => {
    if (!month) return;
    setFailed(false);
    try {
      const [s, b] = await Promise.all([ownerAPI.profit(month), ownerAPI.books(month)]);
      setSheet(s.data);
      setBooks(b.data);
    } catch (error) {
      setFailed(true);
    }
  }, [month]);

  useEffect(() => {
    setSheet(null);
    setBooks(null);
    load();
  }, [load]);

  const profitWord = useMemo(() => (sheet && sheet.profit < 0 ? 'घाटा' : 'लाभ'), [sheet]);

  return (
    <>
      <p className="review-hint">
        यह पन्ना केवल मालिक को दिखता है। हर आँकड़ा बही से हर बार नए सिरे से निकलता है, इसलिए बही से अलग नहीं हो सकता। पैसा मिलने के दिन की
        गिनती होती है; वार्षिक सदस्यता एक साथ मिलती है, इसलिए उसकी अलग पंक्ति दिखती है।
      </p>
      <div className="sheet-picker">
        <label htmlFor="sheet-month">महीना</label>
        <select id="sheet-month" className="earn-input" value={month || ''} onChange={(e) => setMonth(e.target.value)}>
          {(months || []).map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
        </select>
      </div>

      {failed && (
        <p className="empty-state">
          इस महीने का हिसाब लोड नहीं हो सका। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}
      {!sheet && !failed && <p className="review-hint">लोड हो रहा है…</p>}

      {sheet && books && (
        <div className="sheet">
          <div className="sheet-columns">
            <Lines title="आय" codes={INCOME_ACCOUNTS} values={sheet.income} total={sheet.income_total} totalLabel="कुल आय" />
            <Lines title="खर्च" codes={EXPENSE_ACCOUNTS} values={sheet.costs} total={sheet.cost_total} totalLabel="कुल खर्च" />
          </div>
          <p className={`sheet-total big ${sheet.profit < 0 ? 'loss' : ''}`}>
            <span>{monthLabel(month)} का {profitWord}</span>
            <strong>{formatRupees(Math.abs(sheet.profit))}</strong>
          </p>
          <ul className="sheet-lines aside">
            <li><span>इस महीने समर्थन में आया (कुल)</span><strong>{formatRupees(sheet.tips_gross)}</strong></li>
            <li><span>उसमें लेखकों का हिस्सा (आय में नहीं)</span><strong>{formatRupees(sheet.tips_to_writers)}</strong></li>
            <li><span>जीएसटी (GST) जो मिला (आय में नहीं)</span><strong>{formatRupees(sheet.gst_collected)}</strong></li>
            <li><span>वार्षिक सदस्यता में एक साथ मिला (आय में गिना गया)</span><strong>{formatRupees(sheet.yearly_received)}</strong></li>
          </ul>

          <Pool key={month} month={month} sheet={sheet} onChanged={load} />
          <AddEntry month={month} onAdded={load} />
          <Books month={month} books={books} onChanged={load} />
        </div>
      )}
    </>
  );
};

export default ProfitSheet;
