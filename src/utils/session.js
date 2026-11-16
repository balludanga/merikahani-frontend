// Staying signed in. The server's sign-in token lasts weeks and carries the moment it was issued
// ("ra", Unix seconds). The app swaps it for a fresh one once it is a day old, so anyone who keeps
// coming back is never asked to sign in again. These two functions only read the token (the server
// is the one that checks it); they never decide whether a sign-in is valid.

// Left in sessionStorage by the "delete account" section just before it reloads the site, so the
// notice bar can say the account is gone.
export const ACCOUNT_DELETED_FLAG = 'lekhani:account-deleted';

// Renew a token once it is this old (seconds).
export const RENEW_AFTER_SECONDS = 24 * 60 * 60;

// How often an open page looks at whether a renewal is due (milliseconds).
export const RENEW_CHECK_EVERY_MS = 30 * 60 * 1000;

// The readable part of a token, or null when it is not one we can read.
export const readClaims = (token) => {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(window.atob(padded));
    return claims && typeof claims === 'object' ? claims : null;
  } catch (error) {
    return null;
  }
};

// True when the token is a day old, or was issued before tokens carried their issue time (those
// last only minutes, so they should be swapped at once). An unreadable token is left alone: the
// server will say what is wrong with it the next time it is used.
export const renewalDue = (token, nowSeconds = Date.now() / 1000) => {
  const claims = readClaims(token);
  if (!claims) return false;
  if (typeof claims.ra !== 'number') return true;
  return nowSeconds - claims.ra >= RENEW_AFTER_SECONDS;
};
