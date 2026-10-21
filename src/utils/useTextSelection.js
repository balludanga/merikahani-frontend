import { useEffect, useState } from 'react';

/**
 * Tracks text selections made inside `containerRef` and reports where a
 * floating action menu belongs: centered above the selection's bounding
 * box (fixed coordinates), clamped to the viewport. The menu position
 * clears on scroll/resize/collapse so it never floats over stale text.
 */
export default function useTextSelection(containerRef) {
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !containerRef.current) {
        setMenu(null);
        return;
      }
      const anchor = sel.anchorNode;
      const host = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentNode);
      if (!host || !containerRef.current.contains(host)) {
        setMenu(null);
        return;
      }
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!text || !rect.width) {
        setMenu(null);
        return;
      }
      const x = Math.min(Math.max(rect.left + rect.width / 2, 90), window.innerWidth - 90);
      setMenu({ x, y: rect.top, text });
    };

    const clear = () => setMenu(null);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('resize', clear, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', clear);
      window.removeEventListener('resize', clear);
    };
  }, [containerRef]);

  return [menu, setMenu];
}
