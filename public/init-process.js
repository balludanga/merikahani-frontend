// Fix for React Router process.env error - must run before the app bundle.
// Kept as a file (not an inline <script>) so the Content-Security-Policy can refuse inline scripts.
window.process = window.process || {};
window.process.env = window.process.env || {};
window.process.env.NODE_ENV = window.process.env.NODE_ENV || 'development';
// Additional polyfill for global process access
if (typeof process === 'undefined') {
  window.process = window.process || { env: {} };
}
// Set on globalThis for iframes
if (typeof globalThis !== 'undefined') {
  globalThis.process = window.process;
}
