// Apply the saved theme before first paint to avoid a flash.
// Kept as a file (not an inline <script>) so the Content-Security-Policy can refuse inline scripts;
// it is loaded without async/defer in <head>, so it still runs before the page is painted.
(function () {
  try {
    var stored = localStorage.getItem('lekhani_theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
