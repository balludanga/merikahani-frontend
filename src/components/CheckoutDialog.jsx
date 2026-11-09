import React, { useCallback, useEffect, useRef, useState } from 'react';
import { paymentsAPI } from '../services/api';
import { apiMessage, formatRupees } from '../utils/partner';
import { canLaunch, launchers } from '../utils/checkoutProviders';
import { isSettled } from '../utils/payments';
import './Pay.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])';
const POLL_MS = 2000;
const GIVE_UP_MS = 90000;

/** The frame every payment dialog sits in: focus goes in, Tab stays inside, Escape and the backdrop close it. */
export const PayModal = ({ title, subtitle, onClose, children }) => {
  const sheetRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const first = sheetRef.current && sheetRef.current.querySelector(FOCUSABLE);
    if (first) first.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const items = Array.from(sheetRef.current.querySelectorAll(FOCUSABLE));
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener && opener.focus) opener.focus();
    };
  }, [onClose]);

  return (
    <div className="pay-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="pay-sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheetRef}>
        <div className="pay-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="pay-sub">{subtitle}</p>}
          </div>
          <button type="button" className="pay-close" onClick={onClose} aria-label="बंद करें">×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

/**
 * Takes a payment that has been set up on the server through to its end.
 *
 * Whichever provider is connected opens its own window (see utils/checkoutProviders.js); the offline test
 * provider shows a screen with "pay" and "fail" buttons instead. Pressing either only starts the wait: the page
 * then asks the server, every couple of seconds, whether the provider's signed message has arrived, and only
 * that answer is believed.
 */
const CheckoutDialog = ({ started, title, summary, onSettled, onClose }) => {
  const { payment, checkout } = started;
  const [phase, setPhase] = useState('ready'); // ready | waiting | paid | failed | slow
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // A connected provider's window opens by itself; "waiting" begins when it says the person has paid.
  const open = useCallback(() => {
    const launch = launchers[checkout.provider];
    if (typeof launch === 'function') {
      launch({
        payment,
        checkout,
        finished: () => live.current && setPhase('waiting'),
        dismissed: () => live.current && setPhase('ready'),
      });
    }
  }, [checkout, payment]);

  useEffect(() => {
    if (checkout.provider !== 'sandbox' && canLaunch(checkout.provider)) open();
  }, [checkout.provider, open]);

  // The wait: ask the server until it knows.
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const startedAt = Date.now();
    let stopped = false;
    const ask = async () => {
      try {
        const status = (await paymentsAPI.order(payment.public_id)).data.status;
        if (stopped || !live.current) return;
        if (isSettled(status)) {
          stopped = true;
          const good = status === 'captured';
          setPhase(good ? 'paid' : 'failed');
          if (settled.current) settled.current(status);
          return;
        }
      } catch (error) {
        // a hiccup: try again at the next tick
      }
      if (!stopped && live.current && Date.now() - startedAt > GIVE_UP_MS) {
        stopped = true;
        setPhase('slow');
      }
    };
    ask();
    const timer = setInterval(ask, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [phase, payment.public_id]);

  const press = async (action) => {
    setBusy(true);
    setProblem('');
    try {
      await paymentsAPI.sandbox(payment.public_id, action);
      if (live.current) setPhase('waiting');
    } catch (error) {
      if (live.current) setProblem(apiMessage(error, 'यह नहीं हो सका। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      if (live.current) setBusy(false);
    }
  };

  return (
    <PayModal title={title} subtitle={summary} onClose={onClose}>
      <p className="pay-sub" aria-live="polite">राशि: <strong>{formatRupees(payment.amount_paise)}</strong></p>

      {phase === 'ready' && checkout.provider === 'sandbox' && (
        <>
          <p className="pay-test">
            यह असली भुगतान नहीं है — विकास के समय का नकली भुगतान-पर्दा है। नीचे के बटन वैसा ही संदेश भेजते हैं जैसा असली भुगतान
            करने वाली सेवा भेजती।
          </p>
          <div className="pay-actions">
            <button type="button" className="pay-btn primary" onClick={() => press('pay')} disabled={busy}>भुगतान सफल करें (टेस्ट)</button>
            <button type="button" className="pay-btn" onClick={() => press('fail')} disabled={busy}>भुगतान विफल करें (टेस्ट)</button>
          </div>
        </>
      )}

      {phase === 'ready' && checkout.provider !== 'sandbox' && canLaunch(checkout.provider) && (
        <div className="pay-actions">
          <button type="button" className="pay-btn primary" onClick={open}>भुगतान की खिड़की खोलें</button>
        </div>
      )}

      {phase === 'ready' && !canLaunch(checkout.provider) && (
        <p className="pay-error" role="alert">भुगतान की सुविधा अभी पूरी तरह जुड़ी नहीं है। कृपया बाद में कोशिश करें।</p>
      )}

      {problem && <p className="pay-error" role="alert">{problem}</p>}

      {phase === 'waiting' && (
        <p className="pay-wait" role="status"><span className="pay-spinner" aria-hidden="true" /> भुगतान की पुष्टि हो रही है…</p>
      )}

      {phase === 'paid' && (
        <>
          <p className="pay-ok" role="status">भुगतान हो गया ✓ धन्यवाद!</p>
          <div className="pay-actions"><button type="button" className="pay-btn primary" onClick={onClose}>ठीक है</button></div>
        </>
      )}

      {phase === 'failed' && (
        <>
          <p className="pay-error" role="alert">भुगतान पूरा नहीं हुआ। आपके खाते से पैसा नहीं कटा होगा।</p>
          <div className="pay-actions">
            <button type="button" className="pay-btn" onClick={() => setPhase('ready')}>फिर कोशिश करें</button>
            <button type="button" className="pay-btn" onClick={onClose}>बंद करें</button>
          </div>
        </>
      )}

      {phase === 'slow' && (
        <>
          <p className="pay-note" role="status">
            पुष्टि में देर हो रही है। अगर आपके खाते से पैसा कट गया है तो चिंता न करें। पुष्टि होते ही यह अपने-आप दर्ज हो जाएगा।
          </p>
          <div className="pay-actions"><button type="button" className="pay-btn" onClick={onClose}>बंद करें</button></div>
        </>
      )}
    </PayModal>
  );
};

export default CheckoutDialog;
