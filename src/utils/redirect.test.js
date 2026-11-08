import { safeRedirect } from './redirect';

const HERE = 'https://lekhanii.vercel.app';
const go = (raw) => safeRedirect(raw, HERE);

describe('where a reader is sent after signing in', () => {
  it.each([
    ['/post/meri-kahani', '/post/meri-kahani'],
    ['/post/%E0%A4%95%E0%A4%B9%E0%A4%BE%E0%A4%A8%E0%A5%80', '/post/%E0%A4%95%E0%A4%B9%E0%A4%BE%E0%A4%A8%E0%A5%80'],
    ['/search?q=%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A5%87%E0%A4%AE', '/search?q=%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A5%87%E0%A4%AE'],
    ['/user/7#stories', '/user/7#stories'],
    ['/', '/'],
    ['/a/../b', '/b'],
  ])('keeps a path on this site: %s', (raw, expected) => {
    expect(go(raw)).toBe(expected);
  });

  it.each([
    ['//evil.example', 'protocol-relative'],
    ['/\\evil.example', 'backslash'],
    ['/\t/evil.example', 'tab between the slashes'],
    ['/\n/evil.example', 'newline between the slashes'],
    ['/\\/evil.example', 'slash, backslash, slash'],
    ['\\\\evil.example', 'leading backslashes'],
    ['https://evil.example', 'absolute address'],
    ['http://evil.example/x', 'absolute http address'],
    ['javascript:alert(1)', 'script address'],
    ['data:text/html,x', 'data address'],
    ['evil.example', 'no leading slash'],
    ['', 'empty'],
    [null, 'missing'],
    [undefined, 'undefined'],
    [42, 'not text'],
  ])('sends %j to the home page (%s)', (raw) => {
    expect(go(raw)).toBe('/');
  });

  it.each(['/.//evil.example', '/a/..//evil.example', '/./\\evil.example', '/////evil.example'])(
    'never hands on a path that starts with two slashes: %s',
    (raw) => {
      const out = go(raw);
      expect(out.startsWith('//')).toBe(false);
      expect(out.startsWith('/')).toBe(true);
      // and whatever it is, a browser resolves it to this site
      expect(new URL(out, HERE).origin).toBe(HERE);
    }
  );
});
