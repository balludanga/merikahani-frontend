import React, { useCallback, useEffect, useRef, useState } from 'react';
import './ImageCropper.css';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));

/**
 * Pick the part of a photo that becomes a profile picture (round) or banner
 * (wide): drag to move, slide or scroll to zoom, arrow keys to nudge. Produces a
 * compressed image the right size, so nothing huge is ever uploaded.
 *
 * Props: `file`, `shape` ('circle' | 'wide'), `outWidth`/`outHeight` in pixels,
 * `maxBytes`, `title`, `onCancel()`, `onDone(blob)`.
 */
export default function ImageCropper({ file, shape, outWidth, outHeight, maxBytes, title, onCancel, onDone }) {
  const stageRef = useRef(null);
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const openerRef = useRef(null);
  const [img, setImg] = useState(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    stageRef.current?.focus();
    return () => {
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (failed) cancelRef.current?.focus();
  }, [failed]);

  // Load the chosen photo.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setFailed(true);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const minScale = img && stage.w ? Math.max(stage.w / img.naturalWidth, stage.h / img.naturalHeight) : 1;

  // Keep the photo covering the whole frame.
  const fit = useCallback(
    (nextPos, nextScale) => {
      if (!img) return nextPos;
      const w = img.naturalWidth * nextScale;
      const h = img.naturalHeight * nextScale;
      return { x: clamp(nextPos.x, stage.w - w, 0), y: clamp(nextPos.y, stage.h - h, 0) };
    },
    [img, stage]
  );

  // Once both are known, start centred and as small as allowed (the whole frame filled).
  useEffect(() => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setStage({ w: rect.width, h: rect.height });
  }, [img, shape]);

  useEffect(() => {
    if (!img || !stage.w) return;
    const s = Math.max(stage.w / img.naturalWidth, stage.h / img.naturalHeight);
    setScale(s);
    setPos({ x: (stage.w - img.naturalWidth * s) / 2, y: (stage.h - img.naturalHeight * s) / 2 });
  }, [img, stage]);

  const zoomTo = (nextScale) => {
    if (!img) return;
    const s = clamp(nextScale, minScale, minScale * 4);
    // Zoom around the middle of the frame.
    const cx = (stage.w / 2 - pos.x) / scale;
    const cy = (stage.h / 2 - pos.y) / scale;
    setScale(s);
    setPos(fit({ x: stage.w / 2 - cx * s, y: stage.h / 2 - cy * s }, s));
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: pos };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setPos(fit({ x: drag.current.start.x + e.clientX - drag.current.x, y: drag.current.start.y + e.clientY - drag.current.y }, scale));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e) => {
    e.preventDefault();
    zoomTo(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  };
  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    const step = 12;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setPos(fit({ x: pos.x + moves[e.key][0], y: pos.y + moves[e.key][1] }, scale));
    } else if (e.key === '+' || e.key === '=') zoomTo(scale * 1.1);
    else if (e.key === '-') zoomTo(scale / 1.1);
    else if (e.key === 'Escape') onCancel();
  };

  // The stage is a fixed-size frame; keep the wheel from also scrolling the page.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const handler = (e) => e.preventDefault();
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [img]);

  const finish = async () => {
    setBusy(true);
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, stage.w / scale, stage.h / scale, 0, 0, outWidth, outHeight);
    // WebP where the browser can, else JPEG; lower the quality until it fits.
    let blob = await toBlob(canvas, 'image/webp', 0.86);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.86);
    let quality = 0.86;
    while (blob && blob.size > maxBytes && quality > 0.4) {
      quality -= 0.1;
      blob = await toBlob(canvas, blob.type, quality);
    }
    setBusy(false);
    if (!blob || blob.size > maxBytes) {
      setFailed(true);
      return;
    }
    onDone(blob);
  };

  return (
    <div
      className="crop-overlay"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-dialog-title"
      onKeyDown={onKeyDown}
    >
      <div className="crop-card">
        <h3 id="crop-dialog-title">{title}</h3>
        {failed ? (
          <p className="crop-error">यह चित्र खोला नहीं जा सका। कृपया कोई दूसरा चित्र चुनें।</p>
        ) : (
          <>
            <div
              ref={stageRef}
              className={`crop-stage ${shape}`}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
              aria-label="चित्र को खिसकाकर सही जगह लाएँ"
            >
              {img && (
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  style={{ width: img.naturalWidth, height: img.naturalHeight, transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
                />
              )}
              <span className="crop-frame" aria-hidden="true" />
            </div>
            <label className="crop-zoom">
              <span>छोटा</span>
              <input
                type="range"
                min={minScale}
                max={minScale * 4}
                step={minScale / 100 || 0.001}
                value={scale}
                onChange={(e) => zoomTo(Number(e.target.value))}
                aria-label="चित्र बड़ा या छोटा करें"
              />
              <span>बड़ा</span>
            </label>
            <p className="crop-hint">चित्र को खिसकाएँ, और स्लाइडर से बड़ा-छोटा करें।</p>
          </>
        )}
        <div className="crop-actions">
          <button ref={cancelRef} type="button" className="crop-cancel" onClick={onCancel}>रहने दें</button>
          {!failed && (
            <button type="button" className="crop-ok" onClick={finish} disabled={!img || busy}>
              {busy ? 'तैयार हो रहा है…' : 'यही रखें'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
