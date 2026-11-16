import { RENEW_AFTER_SECONDS, readClaims, renewalDue } from './session';

// A token shaped like the server's: header.payload.signature, base64url without padding.
const tokenWith = (claims) => {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
};

const NOW = 1_800_000_000;

describe('reading a sign-in token', () => {
  it('reads the claims, whatever the padding of the encoded part', () => {
    expect(readClaims(tokenWith({ sub: '7', ra: 5 }))).toEqual({ sub: '7', ra: 5 });
    expect(readClaims(tokenWith({ a: 'xyz' }))).toEqual({ a: 'xyz' });
    expect(readClaims(tokenWith({ a: 'xy' }))).toEqual({ a: 'xy' });
  });

  it('gives null for anything that is not a token', () => {
    expect(readClaims(null)).toBeNull();
    expect(readClaims('')).toBeNull();
    expect(readClaims('plain')).toBeNull();
    expect(readClaims('a.%%%.c')).toBeNull();
    expect(readClaims('a.bm90LWpzb24.c')).toBeNull();
  });
});

describe('when a sign-in is renewed', () => {
  it('leaves a token issued today alone', () => {
    expect(renewalDue(tokenWith({ ra: NOW - 60 }), NOW)).toBe(false);
    expect(renewalDue(tokenWith({ ra: NOW - RENEW_AFTER_SECONDS + 1 }), NOW)).toBe(false);
  });

  it('renews a token that is a day old or older', () => {
    expect(renewalDue(tokenWith({ ra: NOW - RENEW_AFTER_SECONDS }), NOW)).toBe(true);
    expect(renewalDue(tokenWith({ ra: NOW - 20 * 24 * 3600 }), NOW)).toBe(true);
  });

  it('renews an old-style token that has no issue time, at once', () => {
    expect(renewalDue(tokenWith({ sub: '7', exp: NOW + 600 }), NOW)).toBe(true);
  });

  it('does nothing about a token it cannot read or that is missing', () => {
    expect(renewalDue('garbage', NOW)).toBe(false);
    expect(renewalDue(null, NOW)).toBe(false);
  });
});
