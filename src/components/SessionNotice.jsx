import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './SessionNotice.css';

// A session ends on its own sometimes: tokens live 30 minutes, signing out on another
// device invalidates them, and a password account turned Google-only retires its old
// token. Whatever call notices first tells the reader here, so the page never keeps
// pretending to be signed in while every save quietly fails.
const SessionNotice = () => {
  const [backTo, setBackTo] = useState('');
  const timer = useRef(null);

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
