import React, { useEffect } from 'react';

/**
 * Immersive image viewer: the page fades into a dark, blurred backdrop
 * while the image scales smoothly into place. Closes on click or Escape;
 * page scroll is locked while open.
 */
const Lightbox = ({ src, alt, onClose }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="बंद करें">
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
