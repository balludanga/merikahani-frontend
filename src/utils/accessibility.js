// Accessibility helpers: safely toggle aria-hidden and make focusable descendants unfocusable.
// Usage:
// import { setAriaHidden } from '../utils/accessibility';
// setAriaHidden(document.getElementById('my-overlay'), true); // hide and remove focus
// setAriaHidden(document.getElementById('my-overlay'), false); // restore

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]'
].join(',');

export function setAriaHidden(root, hidden = true) {
  if (!root) return;

  // Set aria-hidden on the root
  root.setAttribute('aria-hidden', hidden ? 'true' : 'false');

  // Walk focusable descendants
  const focusables = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));

  focusables.forEach((el) => {
    // If element is already inert/hidden by display:none, skip
    const style = window.getComputedStyle(el);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return;

    if (hidden) {
      // Save previous tabindex and aria-hidden state so we can restore later
      if (el.hasAttribute('tabindex')) {
        el.dataset.__prevTabindex = el.getAttribute('tabindex');
      } else {
        el.dataset.__prevTabindex = '';
      }
      if (el.hasAttribute('aria-hidden')) {
        el.dataset.__prevAriaHidden = el.getAttribute('aria-hidden');
      } else {
        el.dataset.__prevAriaHidden = '';
      }

      // Make unfocusable
      try {
        el.setAttribute('tabindex', '-1');
        el.setAttribute('aria-hidden', 'true');
      } catch (err) {
        // ignore setAttribute errors
      }
    } else {
      // Restore previous values
      try {
        if (el.dataset.__prevTabindex === '') {
          el.removeAttribute('tabindex');
        } else if (el.dataset.__prevTabindex !== undefined) {
          el.setAttribute('tabindex', el.dataset.__prevTabindex);
        }

        if (el.dataset.__prevAriaHidden === '') {
          el.removeAttribute('aria-hidden');
        } else if (el.dataset.__prevAriaHidden !== undefined) {
          el.setAttribute('aria-hidden', el.dataset.__prevAriaHidden);
        }

        // Clean up data attributes
        delete el.dataset.__prevTabindex;
        delete el.dataset.__prevAriaHidden;
      } catch (err) {
        // ignore
      }
    }
  });
}

// Observe DOM for known overlay/modal selectors and automatically manage
// aria-hidden on the rest of the page while any overlay is present.
export function observeOverlays(selectors = [
  '.grammar-popup',
  '.spelling-overlay',
  '.correction-tooltip',
  '.grammar-tooltip',
  '.voice-status',
  '.interim-transcript',
  '.voice-preview',
  '.tooltip-correction',
  '.correction-tooltip',
  '.grammar-popup'
]) {
  if (typeof window === 'undefined' || !document || !document.body) return;

  let activeCount = 0;

  const getOverlays = () => {
    const found = new Set();
    selectors.forEach((s) => {
      document.querySelectorAll(s).forEach((el) => found.add(el));
    });
    return Array.from(found);
  };

  const update = () => {
    const overlays = getOverlays().filter(el => !!(el.offsetParent || el.getClientRects().length));
    if (overlays.length > 0 && activeCount === 0) {
      // hide everything except the overlays
      const bodyChildren = Array.from(document.body.children);
      bodyChildren.forEach((child) => {
        if (!overlays.some(o => o === child || child.contains(o))) {
          setAriaHidden(child, true);
        }
      });
      activeCount = overlays.length;
    } else if (overlays.length === 0 && activeCount > 0) {
      // restore
      const bodyChildren = Array.from(document.body.children);
      bodyChildren.forEach((child) => setAriaHidden(child, false));
      activeCount = 0;
    }
  };

  // Observe mutations and run an initial update
  const observer = new MutationObserver(() => update());
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // initial run in case overlays already present
  setTimeout(update, 50);

  return () => {
    try {
      observer.disconnect();
    } catch (e) {
      // ignore disconnect errors
    }
  };
}
