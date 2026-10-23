import { accentTokens, contrast, parseHex, toHex } from './accent';

const SURFACE = { light: '#faf9f7', dark: '#1b1b1f' };
const rgb = (hex) => parseHex(hex);

test('every colour a writer could pick stays readable, in both themes', () => {
  // A sweep across the whole colour cube, including the awkward ones (yellow, white, black, pastels).
  const samples = ['#000000', '#ffffff', '#ffff00', '#00ffff', '#ff00ff', '#fde68a', '#fefce8', '#0f0f0f', '#7f7f7f'];
  for (let r = 0; r <= 255; r += 51) {
    for (let g = 0; g <= 255; g += 51) {
      for (let b = 0; b <= 255; b += 51) samples.push(toHex([r, g, b]));
    }
  }
  samples.forEach((hex) => {
    ['light', 'dark'].forEach((theme) => {
      const t = accentTokens(hex, theme);
      // as link / text colour on the page
      expect(contrast(rgb(t.accent), rgb(SURFACE[theme]))).toBeGreaterThanOrEqual(4.5);
      // as a button: its label on top of it, and on its hover shade
      expect(contrast(rgb(t.accent), rgb(t.onAccent))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(t.strong), rgb(t.onAccent))).toBeGreaterThanOrEqual(4.5);
    });
  });
});

test('a colour that already reads well is left alone', () => {
  expect(accentTokens('#0f766e', 'light').accent).toBe('#0f766e');
  expect(accentTokens('#1d4ed8', 'light').accent).toBe('#1d4ed8');
});

test('light colours get darker on a light page, dark ones lighter on a dark page', () => {
  const light = accentTokens('#fde68a', 'light').accent;
  expect(contrast(rgb(light), rgb(SURFACE.light))).toBeGreaterThanOrEqual(4.5);
  const dark = accentTokens('#1e1b4b', 'dark').accent;
  expect(contrast(rgb(dark), rgb(SURFACE.dark))).toBeGreaterThanOrEqual(4.5);
});

test('rubbish input falls back to the default colour instead of breaking', () => {
  expect(accentTokens('not a colour', 'light').accent).toBe('#0f766e');
  expect(accentTokens(undefined, 'dark').accent).toMatch(/^#[0-9a-f]{6}$/);
});
