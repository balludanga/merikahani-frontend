import { getEnv } from './env';

/**
 * Profile photos and banners are served by the API at "/api/users/<id>/avatar".
 * On the live site that path is proxied (same origin); when the app runs on
 * localhost the API is on another port, so point the image there.
 */
export function mediaUrl(url) {
  if (!url || !url.startsWith('/api/')) return url;
  const here = typeof window !== 'undefined' ? window.location.hostname : '';
  if (here !== 'localhost' && here !== '127.0.0.1') return url;
  try {
    return new URL(getEnv('REACT_APP_API_URL', 'http://localhost:8000/api')).origin + url;
  } catch (error) {
    return url;
  }
}
