import React, { useState } from 'react';
import { paymentsAPI } from '../services/api';
import HindiTextarea, { useHinglish } from './HindiTextarea';
import CheckoutDialog, { PayModal } from './CheckoutDialog';
import { apiMessage, formatRupees, paiseToRupeeText, rupeesToPaise } from '../utils/partner';
import { checkTip, feePercent, tipSplit } from '../utils/payments';
import './Pay.css';

/**
 * Send a writer a tip. The reader picks an amount (or types one), may add a few words, and may keep their name
 * from the writer. The dialog says plainly how the money is shared; the server decides the real numbers.
 */
const TipDialog = ({ writerId, writerName, post, tips, onClose }) => {
  const [text, setText] = useState(tips.presets_paise.length ? String(tips.presets_paise[Math.min(1, tips.presets_paise.length - 1)] / 100) : '');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [started, setStarted] = useState(null);
  const [hinglish, toggleHinglish, finish] = useHinglish();

  const typed = rupeesToPaise(text);
  const checked = checkTip(typed, tips);
  const split = checked.paise ? tipSplit(checked.paise, tips.site_fee_bps) : null;

  const submit = async (event) => {
    event.preventDefault();
    if (!checked.paise) {
      setProblem(checked.problem);
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      const response = await paymentsAPI.startTip({
        writer_id: writerId,
        amount_rupees: paiseToRupeeText(checked.paise),
        post_id: post ? post.id : null,
        message: finish(message).trim() || null,
        anonymous,
      });
      setStarted(response.data);
    } catch (error) {
      setProblem(apiMessage(error, 'समर्थन शुरू नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  if (started) {
    return (
      <CheckoutDialog
        started={started}
        title="समर्थन भेजें"
        summary={`${writerName} के लिए`}
        onClose={onClose}
      />
    );
  }

  return (
    <PayModal
      title={`${writerName} को समर्थन भेजें`}
      subtitle={post ? `“${post.title}” पढ़कर अच्छा लगा? लेखक का हौसला बढ़ाएँ।` : 'लेखक का हौसला बढ़ाएँ।'}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <span className="pay-label" id="tip-amounts">राशि</span>
        <div className="pay-amounts" role="group" aria-labelledby="tip-amounts">
          {tips.presets_paise.map((paise) => (
            <button
              key={paise}
              type="button"
              className={`pay-chip ${typed === paise ? 'on' : ''}`}
              aria-pressed={typed === paise}
              onClick={() => setText(String(paise / 100))}
            >
              {formatRupees(paise)}
            </button>
          ))}
        </div>

        <label className="pay-label" htmlFor="tip-custom">या अपनी राशि (₹)</label>
        <input
          id="tip-custom"
          className="pay-input"
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="50"
        />

        {split && (
          <p className="pay-split" aria-live="polite">
            लेखक को <strong>{formatRupees(split.writer)}</strong> मिलेंगे। लेखनी इस समर्थन का {feePercent(tips.site_fee_bps)} (
            {formatRupees(split.site)}) रखती है — भुगतान के खर्च और साइट चलाने के लिए।
          </p>
        )}

        <label className="pay-label" htmlFor="tip-message">दो शब्द लेखक के लिए (वैकल्पिक)</label>
        <HindiTextarea
          id="tip-message"
          value={message}
          onChange={setMessage}
          hinglish={hinglish}
          onToggle={toggleHinglish}
          maxLength={200}
          rows={3}
          placeholder="आपकी रचना पढ़कर…"
        />

        <label className="pay-check">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span>लेखक को मेरा नाम न दिखाएँ</span>
        </label>

        {problem && <p className="pay-error" role="alert">{problem}</p>}

        <div className="pay-actions">
          <button type="submit" className="pay-btn primary" disabled={busy || !checked.paise}>
            {busy ? 'शुरू हो रहा है…' : checked.paise ? `${formatRupees(checked.paise)} भेजें` : 'आगे बढ़ें'}
          </button>
          <button type="button" className="pay-btn" onClick={onClose}>रहने दें</button>
        </div>
        <p className="pay-note">
          समर्थन स्वेच्छा से दिया गया उपहार है। भुगतान में कोई गड़बड़ी हो तो लेखनी से संपर्क करें।
        </p>
      </form>
    </PayModal>
  );
};

export default TipDialog;
