// Switch on the Google Fonts stylesheet that index.html preloads.
// This replaces an inline onload="" attribute on the <link>, which the Content-Security-Policy
// refuses. The stylesheet is added by script, so it never holds up the first paint.
(function () {
  var preload = document.querySelector('link[rel="preload"][as="style"][href*="fonts.googleapis.com"]');
  if (!preload) return;
  var sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = preload.href;
  document.head.appendChild(sheet);
})();
