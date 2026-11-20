import { dateEntries } from './catalogs';
import MONTH_NAMES from './months.json';

// A browser whose Intl lacks a language's calendar names prints "M11" (Chrome does for Punjabi, Konkani,
// Sindhi) or English month names; months.json holds CLDR names to use instead.
describe('month names', () => {
  test('every language in the table has twelve long and twelve short names, none of them "M11"', () => {
    Object.entries(MONTH_NAMES).forEach(([, names]) => {
      expect(names.long).toHaveLength(12);
      expect(names.short).toHaveLength(12);
      [...names.long, ...names.short].forEach((name) => {
        expect(name.trim()).not.toBe('');
        expect(name).not.toMatch(/^M\d+$/);
      });
    });
  });

  test('a date comes out with the language\'s month name and keeps its number slots', () => {
    ['ta', 'pa', 'ur', 'ne', 'sd'].forEach((code) => {
      const entries = dateEntries(code);
      expect(entries['{0} नव॰ {1}']).toMatch(/\{0\}.*\{1\}|\{1\}.*\{0\}/);
      expect(entries['नवंबर {0}']).toContain('{0}');
      expect(entries['नवंबर']).not.toMatch(/^M\d+$/);
    });
  });

  test('Meitei has no month table (the CLDR names are in Bengali script)', () => {
    expect(MONTH_NAMES.mni).toBeUndefined();
  });
});
