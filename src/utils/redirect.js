// Where to send a reader after they sign in: back to the page they came from.
//
// The address arrives in the link (?redirect=...), so anyone can write anything there, and a link
// to the sign-in page is easy to hand to a stranger. Only a path on this very site may come out.
// Checking that the text starts with "/" and not "//" is not enough: a browser reads a backslash
// or a tab like a slash, so "/\evil.example" and "/<tab>/evil.example" are other sites, and
// "/.//evil.example" becomes "//evil.example" once its dots are resolved. So the address is
// resolved the way a browser would, and what is kept is the resolved path, with any leading run
// of slashes collapsed to one.

export const safeRedirect = (raw, origin) => {
  const here = origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (typeof raw !== 'string' || raw.charAt(0) !== '/') return '/';
  try {
    const target = new URL(raw, here);
    if (target.origin !== here) return '/';
    return `${target.pathname.replace(/^\/{2,}/, '/')}${target.search}${target.hash}`;
  } catch (error) {
    return '/';
  }
};
