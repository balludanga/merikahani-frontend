/**
 * A writer picks one colour; the pages that carry it must stay readable.
 *
 * `accentTokens(hex, theme)` nudges the lightness of the chosen colour until it
 * reads as text on the page surface (WCAG AA, 4.5:1) in the active theme, then
 * derives the hover shade, a soft tint, and whichever of white / near-black
 * reads best on top of it. Any input gives a usable result.
 */
import { useEffect, useMemo, useState } from 'react';
import { getTheme } from './theme';

export const DEFAULT_ACCENT = '#0f766e';
// The page surfaces the accent has to stand out from (App.css --bg).
const SURFACE = { light: '#faf9f7', dark: '#1b1b1f' };
const WHITE = '#ffffff';
const NEAR_BLACK = '#111111';
const AA = 4.5;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;

export function luminance([r, g, b]) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);

export function accentTokens(hex, theme = 'light') {
  const surface = parseHex(SURFACE[theme] || SURFACE.light);
  const base = parseHex(hex) || parseHex(DEFAULT_ACCENT);
  const [h, s, l0] = rgbToHsl(base);

  // Darker on a light page, lighter on a dark one, until it reads as text.
  const direction = theme === 'dark' ? 1 : -1;
  let l = l0;
  let rgb = base;
  for (let i = 0; i < 100 && contrast(rgb, surface) < AA; i += 1) {
    l = clamp(l + direction * 0.01, 0, 1);
    // Measure the colour as it will really be drawn: whole-number channels.
    rgb = hslToRgb([h, s, l]).map(Math.round);
  }

  // Text on the accent: white or near-black, whichever is clearer.
  const white = parseHex(WHITE);
  const black = parseHex(NEAR_BLACK);
  const onWhite = contrast(rgb, white) >= contrast(rgb, black);
  // Hover shade moves toward the text colour, so its contrast only improves.
  const strong = hslToRgb([h, s, clamp(l + (onWhite ? -0.07 : 0.07), 0, 1)]);
  const soft = mix(surface, rgb, theme === 'dark' ? 0.22 : 0.12);

  return {
    accent: toHex(rgb),
    strong: toHex(strong),
    soft: toHex(soft),
    onAccent: onWhite ? WHITE : NEAR_BLACK,
  };
}

/** CSS variables that re-tint everything inside an element; undefined for no accent. */
export function accentVars(hex, theme) {
  if (!hex) return undefined;
  const t = accentTokens(hex, theme);
  return {
    '--accent': t.accent,
    '--accent-strong': t.strong,
    '--accent-soft': t.soft,
    '--on-accent': t.onAccent,
  };
}

/** The same, following light/dark switches live. */
export function useAccentStyle(hex) {
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => {
    const watcher = new MutationObserver(() => setTheme(getTheme()));
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watcher.disconnect();
  }, []);
  return useMemo(() => accentVars(hex, theme), [hex, theme]);
}
