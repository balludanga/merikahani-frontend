// Safe environment-reader for browser and build environments.
// Some bundlers define `process.env` at build time; in other environments
// `process` may be undefined. This helper returns the value baked in at build time,
// otherwise the provided fallback.
//
// It used to also read `window.__env` ("optional runtime injection"). Nothing set that, and a
// page-level foothold could have used it to repoint the API address, so it is gone: every value
// comes from the build, and a change means a rebuild.

export function getEnv(name, fallback = undefined) {
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[name] !== undefined) {
      return process.env[name];
    }
  } catch (e) {
    // ignore
  }

  return fallback;
}
