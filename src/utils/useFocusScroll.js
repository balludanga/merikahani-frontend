import { useEffect, useRef, useState } from 'react';

/**
 * Reading progress (0..1) plus a "hide while scrolling down" flag for the
 * reader header. One passive scroll listener, rAF-throttled, so consumers
 * only animate `transform` — everything stays on the compositor.
 */
export default function useFocusScroll() {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);

      const delta = y - lastY.current;
      if (y < 80) {
        // At the very top the header always stays visible.
        setHidden(false);
      } else if (delta > 6) {
        setHidden(true);
      } else if (delta < -4) {
        // Even a slight upward scroll brings it back.
        setHidden(false);
      }
      lastY.current = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return { progress, hidden };
}
