import React, { useCallback, useEffect, useRef, useState } from 'react';
import { canNativeShare, copyText, nativeShare, prefersNativeSheet, shareTargets } from '../utils/share';
import './ShareSheet.css';

// Plain geometric marks (no letters): the brand colour carries the recognition.
const ICONS = {
  whatsapp: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.9L3.5 20.5l4.2-1.1A8.5 8.5 0 1 0 12 3.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.3 8.6c.3-.5.8-.4 1 .1l.5 1.2c.1.3 0 .5-.2.8l-.4.5c.6 1.2 1.6 2.1 2.8 2.7l.5-.5c.2-.2.5-.3.8-.2l1.2.6c.4.2.5.7.1 1.1-.6.7-1.6 1-2.6.6a8.2 8.2 0 0 1-4.3-4.1c-.4-.9-.1-1.9.6-2.8z" fill="currentColor" />
    </>
  ),
  telegram: <path d="M20.5 4.2 3.7 10.8c-.6.2-.6 1 0 1.2l4.2 1.4 1.6 5c.2.5.8.6 1.2.3l2.3-1.9 4.2 3.1c.5.3 1.1.1 1.2-.5l2.6-14.2c.1-.6-.5-1.1-1.1-.8zM9.2 13.1l8.2-5.2-6.3 6.6-.4 3z" fill="currentColor" />,
  facebook: <path d="M13.6 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.4 1.5-1.4h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3h2.6V21z" fill="currentColor" />,
  x: <path d="M5 4.5h3.4l10.6 15H15.6zM18.6 4.5l-5.5 6.2M5.4 19.5l5.6-6.3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  linkedin: (
    <>
      <circle cx="6.6" cy="6.8" r="1.9" fill="currentColor" />
      <path d="M4.9 9.8h3.4V19H4.9zM10.2 9.8h3.2v1.3c.5-.9 1.6-1.5 3-1.5 2.7 0 3.5 1.7 3.5 4.1V19h-3.4v-4.6c0-1.1-.3-1.8-1.3-1.8s-1.6.7-1.6 1.8V19h-3.4z" fill="currentColor" />
    </>
  ),
  email: <path d="M4 6.5h16v11H4zM4.4 7l7.6 6 7.6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />,
  sms: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-7l-4 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="18" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  check: <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
};

const Icon = ({ name }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>
);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';

export function ShareSheet({ url, title, text, heading, onClose }) {
  const [copied, setCopied] = useState(false);
  const sheetRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const data = { title, text, url };
  const touch = prefersNativeSheet();
  const targets = shareTargets({ url, title, text }).filter((target) => !target.touchOnly || touch);

  // Focus moves in on open and back to the button that opened it on close; Tab stays inside.
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
      clearTimeout(timerRef.current);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, [onClose]);

  const copy = async () => {
    const done = await copyText(url);
    if (done) {
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2200);
    } else if (inputRef.current) {
      // Nothing could write to the clipboard: leave the address selected so Ctrl/Cmd+C finishes it.
      inputRef.current.focus();
      inputRef.current.select();
    }
  };

  const more = async () => {
    const result = await nativeShare(data);
    if (result === 'shared') onClose();
  };

  return (
    <div
      className="share-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="share-sheet" role="dialog" aria-modal="true" aria-label={heading} ref={sheetRef}>
        <div className="share-head">
          <div>
            <h3>{heading}</h3>
            <p className="share-title">{title}</p>
          </div>
          <button type="button" className="share-close" onClick={onClose} aria-label="बंद करें">×</button>
        </div>

        <div className="share-grid">
          {targets.map((target) => (
            <a
              key={target.id}
              className={`share-app share-${target.id}`}
              href={target.href}
              {...(target.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              aria-label={`${target.full} पर साझा करें`}
              onClick={() => {
                // The app opens in its own tab/window; the sheet's job is done.
                setTimeout(onClose, 150);
              }}
            >
              <span className="share-icon"><Icon name={target.id} /></span>
              <span className="share-label">{target.label}</span>
            </a>
          ))}
          {canNativeShare(data) && (
            <button type="button" className="share-app share-more" onClick={more} aria-label="फ़ोन के अन्य ऐप में साझा करें">
              <span className="share-icon"><Icon name="more" /></span>
              <span className="share-label">अन्य ऐप</span>
            </button>
          )}
        </div>

        <div className="share-link">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={url}
            aria-label="रचना की कड़ी"
            dir="ltr"
            onFocus={(event) => event.target.select()}
          />
          <button type="button" className={`share-copy ${copied ? 'done' : ''}`} onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} />
            <span>{copied ? 'कॉपी हुआ' : 'कड़ी कॉपी करें'}</span>
          </button>
        </div>
        <p className="share-live" role="status" aria-live="polite">{copied ? 'कड़ी कॉपी हो गई।' : ''}</p>
      </div>
    </div>
  );
}

/**
 * One tap on a share button: phones get the device's own sheet straight away (WhatsApp, Instagram,
 * Messages... whatever is installed); everywhere else - and if the device sheet is missing or
 * fails - the in-page sheet opens. Closing the device sheet is not an error and does nothing more.
 *
 *   const { share, sheet } = useShare({ url, title, text, heading });
 *   <button onClick={share}>...</button> {sheet}
 */
export function useShare({ url, title, text, heading = 'साझा करें' }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const share = useCallback(async () => {
    const data = { title, text, url };
    // Must be reached synchronously from the tap: browsers refuse navigator.share otherwise.
    if (prefersNativeSheet() && canNativeShare(data)) {
      const result = await nativeShare(data);
      if (result !== 'unavailable') return;
    }
    setOpen(true);
  }, [url, title, text]);

  const sheet = open ? <ShareSheet url={url} title={title} text={text} heading={heading} onClose={close} /> : null;
  return { share, sheet };
}

export default ShareSheet;
