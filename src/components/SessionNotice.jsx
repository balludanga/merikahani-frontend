import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCOUNT_DELETED_FLAG } from '../utils/session';
import './SessionNotice.css';

// A session ends on its own sometimes: a token lasts 30 days and is renewed whenever the
// app is used, so it only runs out after a month away or at the 180-day limit; signing out
// on another device invalidates it, and a password account turned Google-only retires its
// old token. Whatever call notices first tells the reader here, so the page never keeps
// pretending to be signed in while every save quietly fails.
const SessionNotice = () => {
  const [backTo, setBackTo] = useState('');
  // Set by the "delete account" page just before it reloads the site: say the account is gone.
  const [deleted, setDeleted] = useState(() => {
    try {
      const flagged = sessionStorage.getItem(ACCOUNT_DELETED_FLAG) === '1';
      if (flagged) sessionStorage.removeItem(ACCOUNT_DELETED_FLAG);
      return flagged;
    } catch (error) {
      return false;
    }
  });
  const timer = useRef(null);

  useEffect(() => {
    if (!deleted) return undefined;
    const hide = setTimeout(() => setDeleted(false), 20000);
    return () => clearTimeout(hide);
  }, [deleted]);

  useEffect(() => {
    const onSignedOut = () => {
      setBackTo(`${window.location.pathname}${window.location.search}`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBackTo(''), 15000);
    };
    window.addEventListener('lekhani:signed-out', onSignedOut);
    return () => {
      window.removeEventListener('lekhani:signed-out', onSignedOut);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (deleted) {
    return (
      <div className="session-notice" role="status">
        आपका खाता हटा दिया गया है। आपकी रचनाएँ और जानकारी मिटा दी गई हैं।
        <button
          type="button"
          className="session-notice-close"
          onClick={() => setDeleted(false)}
          aria-label="सूचना बंद करें"
        >
          ×
        </button>
      </div>
    );
  }
  if (!backTo) return null;
  return (
    <div className="session-notice" role="status">
      आपकी साइन-इन अवधि समाप्त हुई।{' '}
      <Link to={`/login?redirect=${encodeURIComponent(backTo)}`}>फिर साइन इन करें</Link>
      <button
        type="button"
        className="session-notice-close"
        onClick={() => setBackTo('')}
        aria-label="सूचना बंद करें"
      >
        ×
      </button>
    </div>
  );
};

export default SessionNotice;
