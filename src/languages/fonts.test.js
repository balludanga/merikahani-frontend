import { FAMILY, familiesFor, needFonts } from './fonts';
import { LANGUAGES } from './registry';

afterEach(() => {
  document.head.querySelectorAll('link[data-fonts]').forEach((link) => link.remove());
});

describe('fonts for each script', () => {
  test('every script the site writes, except Devanagari and Latin, has a Google Fonts family', () => {
    const scripts = new Set(LANGUAGES.flatMap((l) => l.scripts));
    scripts.forEach((script) => {
      if (script !== 'Deva' && script !== 'Latn') expect(FAMILY[script]).toBeTruthy();
    });
  });

  test('a language needs only the families of its own scripts', () => {
    expect(familiesFor(['hi', 'en'])).toEqual([]);
    expect(familiesFor(['ta'])).toEqual(['Noto Serif Tamil']);
    expect(familiesFor(['ks'])).toEqual(['Noto Naskh Arabic']);
    expect(familiesFor(['mni'])).toEqual(['Noto Sans Meetei Mayek', 'Noto Serif Bengali']);
    expect(familiesFor(['ta', 'ta', 'ur'])).toEqual(['Noto Serif Tamil', 'Noto Naskh Arabic']);
  });

  test('a stylesheet is added once, and not at all for Hindi and English', () => {
    needFonts('hi');
    needFonts('en');
    expect(document.head.querySelectorAll('link[data-fonts]')).toHaveLength(0);
    needFonts('ta');
    needFonts(['ta']);
    const links = document.head.querySelectorAll('link[data-fonts]');
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://fonts.googleapis.com/css2?family=Noto+Serif+Tamil:wght@400;700&display=swap');
  });
});
