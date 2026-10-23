import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import HindiTextarea from './HindiTextarea';
import './PassageComposer.css';

const GAP = 12;
const EDGE = 12;
const WIDTH = 380;

/**
 * Where to put the popup so it sits next to the passage: under it when there is
 * room, above it otherwise, always fully on screen. `height` is the popup's real
 * height. Phones ignore this and use a bottom sheet (CSS).
 */
function place(range, height) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = range.getBoundingClientRect();
  // The text is not laid out right now (for example mid re-render): keep the old spot.
  if (!rect.width && !rect.height) return null;
  const width = Math.min(WIDTH, vw - EDGE * 2);
  const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, EDGE), vw - width - EDGE);
  const below = vh - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const top = below >= height || below >= above ? rect.bottom + GAP : rect.top - GAP - height;
  return { left, width, top: Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - height - EDGE)) };
}

/**
 * A small popup next to the selected passage for writing a response without
 * leaving the story. The response is saved with the passage as its quote and
 * shows up under "प्रतिक्रियाएँ".
 *
 * Props: `range` (a clone of the selection, so the popup can follow the text as
 * the page scrolls), `quote`, `hinglish`/`onToggleHinglish`/`finish` from
 * `useHinglish`, `onSubmit(text)` (returns a promise, rejects to keep the popup
 * open), `onClose`.
 */
export default function PassageComposer({
  range, quote, hinglish, onToggleHinglish, finish, onSubmit, onClose,
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState(() => place(range, 340) || { left: EDGE, width: WIDTH, top: EDGE });
  const [keyboard, setKeyboard] = useState(0);
  const textRef = useRef(null);
  const cardRef = useRef(null);
  const textValue = useRef('');
  textValue.current = text;

  // First paint at the real height, so the popup never starts off screen.
  useLayoutEffect(() => {
    setBox((prev) => place(range, cardRef.current.offsetHeight) || prev);
  }, [range]);

  // Follow the passage while the reader keeps scrolling.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBox((prev) => place(range, cardRef.current ? cardRef.current.offsetHeight : 340) || prev));
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [range]);

  // On phones the sheet rides above the on-screen keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const update = () =>
      setKeyboard(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (textRef.current) textRef.current.focus({ preventScroll: true });
  }, []);

  // Escape closes. A click elsewhere closes only an empty popup, so a half-written
  // response is never lost to a stray tap while reading.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const onDown = (event) => {
      if (cardRef.current && !cardRef.current.contains(event.target) && !textValue.current.trim()) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const submit = async () => {
    const finished = finish(text).trim();
    if (!finished || busy) return;
    setBusy(true);
    try {
      await onSubmit(finished);
    } catch (error) {
      setBusy(false);
    }
  };

  const style = {
    '--pc-left': `${box.left}px`,
    '--pc-width': `${box.width}px`,
    '--pc-keyboard': `${keyboard}px`,
    '--pc-top': `${box.top}px`,
  };

  return (
    <div
      ref={cardRef}
      className="passage-composer"
      style={style}
      role="dialog"
      aria-label="इस अंश पर प्रतिक्रिया"
    >
      <div className="passage-composer-head">
        <strong>इस अंश पर प्रतिक्रिया</strong>
        <button type="button" onClick={onClose} aria-label="बंद करें">×</button>
      </div>
      <blockquote className="passage-composer-quote">{quote}</blockquote>
      <HindiTextarea
        ref={textRef}
        value={text}
        onChange={setText}
        hinglish={hinglish}
        onToggle={onToggleHinglish}
        onSubmitKey={submit}
        placeholder="आपको यह अंश कैसा लगा?"
        rows={3}
        maxLength={5000}
      />
      <div className="passage-composer-foot">
        <span>आपकी प्रतिक्रिया नीचे “प्रतिक्रियाएँ” में भी सहेजी जाएगी।</span>
        <button type="button" className="passage-composer-send" onClick={submit} disabled={busy || !text.trim()}>
          {busy ? 'भेज रहे हैं…' : 'प्रकाशित करें'}
        </button>
      </div>
    </div>
  );
}
