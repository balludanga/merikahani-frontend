/**
 * Global soft-dark-mode theme helpers. The active theme lives in a
 * `data-theme` attribute on <html>, set before first paint by an inline
 * script in public/index.html so there is never a flash of the wrong theme.
 */

export const getTheme = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

export const setTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('lekhani_theme', theme);
  } catch (err) {
    // Storage unavailable — the theme still applies for this session.
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1B1B1F' : '#FAF9F7');
};

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');
