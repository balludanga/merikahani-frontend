import React, { useEffect, useRef } from 'react';

/**
 * Immersive image viewer: the page fades into a dark, blurred backdrop
 * while the image scales smoothly into place. Closes on click or Escape;
 * page scroll is locked while open, focus moves into the dialog, Tab stays
 * inside it, and focus returns to the opener on close.
 */
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const Lightbox = ({ src, alt, onClose }) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  // Parents pass an inline callback; a ref keeps the effect (and focus) stable.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    if (closeRef.current) closeRef.current.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  return (
    <div
      className="lightbox-overlay"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="चित्र देखें"
      onClick={onClose}
    >
      <button type="button" ref={closeRef} className="lightbox-close" onClick={onClose} aria-label="बंद करें">
        ×
      </button>
      <img
        className="lightbox-img"
        src={src}
        alt={alt || ''}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default Lightbox;
