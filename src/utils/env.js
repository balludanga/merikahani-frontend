// Safe environment-reader for browser and build environments.
// Some bundlers define `process.env` at build time; in other environments
// `process` may be undefined. This helper safely returns values from either
// `process.env` (when available) or `window.__env` (optional runtime injection),
// otherwise returns the provided fallback.

export function getEnv(name, fallback = undefined) {
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[name] !== undefined) {
      return process.env[name];
    }
  } catch (e) {
    // ignore
  }

  if (typeof window !== 'undefined' && window.__env && window.__env[name] !== undefined) {
    return window.__env[name];
  }

  return fallback;
}
