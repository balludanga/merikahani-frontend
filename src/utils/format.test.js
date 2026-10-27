import { formatDate, timeAgo, readingMinutes, excerpt, asUtcDate } from './format';

// What the reader's browser would print for a real UTC instant, computed straight from
// that instant. formatDate must agree with it for the bare (unmarked) API stamp.
const dayFor = (iso) =>
  new Date(iso).toLocaleDateString('hi-IN', { year: 'numeric', month: 'short', day: 'numeric' });

// The API writes naive UTC stamps ("2026-01-01T18:30:00"). Whatever timezone the
// reader's browser is in, a bare stamp and the same instant marked with "Z" have to
// render identically — before the fix the bare one was read as local time.
describe('formatDate', () => {
  it('treats a bare stamp as UTC', () => {
    expect(formatDate('2026-01-01T18:30:00')).toBe(formatDate('2026-01-01T18:30:00Z'));
  });

  it('anchors to the instant, not to the reader clock, on both sides of UTC', () => {
    // Evening stamps roll into the next day for readers east of UTC; early-morning
    // stamps roll back for readers west of it. Reading the text as local time hides it.
    expect(formatDate('2026-01-01T20:00:00')).toBe(dayFor('2026-01-01T20:00:00Z'));
    expect(formatDate('2026-01-01T02:00:00')).toBe(dayFor('2026-01-01T02:00:00Z'));
  });

  it('returns empty string for missing or unparseable values', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('asUtcDate', () => {
  it('does not double-append the zone when one is already present', () => {
    expect(asUtcDate('2026-01-01T18:30:00+05:30').getTime()).toBe(
      new Date('2026-01-01T18:30:00+05:30').getTime()
    );
    expect(asUtcDate('2026-01-01T13:00:00Z').getTime()).toBe(
      asUtcDate('2026-01-01T13:00:00').getTime()
    );
  });
});

describe('timeAgo', () => {
  const now = new Date();
  const stamp = (minutesAgo) =>
    new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString().replace('Z', '').slice(0, 19);

  it('buckets recent activity', () => {
    expect(timeAgo(stamp(0))).toBe('अभी');
    expect(timeAgo(stamp(5))).toBe('5 मिनट पहले');
    expect(timeAgo(stamp(120))).toBe('2 घंटे पहले');
    expect(timeAgo(stamp(60 * 24 * 3))).toBe('3 दिन पहले');
  });

  it('falls back to the date after a week', () => {
    expect(timeAgo(stamp(60 * 24 * 30))).toBe(formatDate(stamp(60 * 24 * 30)));
  });

  it('ignores clocks slightly in the future', () => {
    expect(timeAgo(new Date(now.getTime() + 5 * 60 * 1000).toISOString().replace('Z', ''))).toBe(
      'अभी'
    );
  });

  it('returns empty string for missing values', () => {
    expect(timeAgo('')).toBe('');
    expect(timeAgo(null)).toBe('');
  });
});

describe('readingMinutes', () => {
  it('never reports zero for a short piece', () => {
    expect(readingMinutes('एक दो तीन')).toBe(1);
    expect(readingMinutes('')).toBe(1);
  });

  it('scales with word count', () => {
    const words = Array.from({ length: 450 }, () => 'शब्द').join(' ');
    expect(readingMinutes(words)).toBe(3);
  });
});

describe('excerpt', () => {
  it('collapses whitespace and truncates on a word edge', () => {
    expect(excerpt('  क   ब  ख  ', 10)).toBe('क ब ख');
    expect(excerpt('कब ख गिरा', 4)).toBe('कब ख…');
  });
});
