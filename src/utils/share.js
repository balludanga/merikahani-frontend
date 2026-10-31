/**
 * Sharing helpers: the device's own share sheet where there is one, ready-made links for the
 * common apps everywhere else, and a clipboard copy that works on plain-http and old browsers too.
 *
 * Every app link is a plain https/mailto/sms address, so the sheet can render real <a> tags:
 * no pop-up blockers, middle-click works, and nothing here needs the app's scripts to be allowed
 * to talk to those sites (the page's CSP governs fetches, not navigation).
 */

const enc = encodeURIComponent;

/** True when the browser can hand this content to the device's share sheet. */
export function canNativeShare(data) {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare(data);
    } catch (error) {
      return false;
    }
  }
  return true;
}

/** A phone or tablet: the device sheet is the better first choice there. */
export function prefersNativeSheet() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (error) {
    return false;
  }
}

/**
 * Opens the device share sheet. Must be called straight from a tap/click.
 * Resolves 'shared', 'cancelled' (the person closed the sheet - not an error) or 'unavailable'
 * (not supported, or it failed - show the in-page sheet instead).
 */
export async function nativeShare(data) {
  if (!canNativeShare(data)) return 'unavailable';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (error) {
    if (error && error.name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}

/** The apps offered in the in-page sheet. `touchOnly` ones are hidden on desktop. */
export function shareTargets({ url, title, text }) {
  const line = text ? `${text}\n${url}` : `${title}\n${url}`;
  return [
    { id: 'whatsapp', label: 'व्हाट्सऐप', full: 'व्हाट्सऐप (WhatsApp)', href: `https://wa.me/?text=${enc(line)}`, external: true },
    { id: 'telegram', label: 'टेलीग्राम', full: 'टेलीग्राम (Telegram)', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text || title)}`, external: true },
    { id: 'facebook', label: 'फ़ेसबुक', full: 'फ़ेसबुक (Facebook)', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, external: true },
    { id: 'x', label: 'एक्स', full: 'एक्स (X)', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text || title)}`, external: true },
    { id: 'linkedin', label: 'लिंक्डइन', full: 'लिंक्डइन (LinkedIn)', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, external: true },
    { id: 'email', label: 'ईमेल', full: 'ईमेल', href: `mailto:?subject=${enc(title)}&body=${enc(line)}`, external: false },
    { id: 'sms', label: 'संदेश', full: 'संदेश (SMS)', href: `sms:?&body=${enc(line)}`, external: false, touchOnly: true },
  ];
}

/** Copies text. Returns true when it is on the clipboard. */
export async function copyText(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // fall through to the older route (permission denied, insecure frame, ...)
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, text.length);
    const done = document.execCommand('copy');
    document.body.removeChild(field);
    return Boolean(done);
  } catch (error) {
    return false;
  }
}
