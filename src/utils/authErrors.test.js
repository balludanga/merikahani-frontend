import { USERNAME_OK, USERNAME_RULE, errorText } from './authErrors';

const refused = (field, type = 'string_pattern_mismatch') => ({
  response: { status: 422, data: { detail: [{ loc: ['body', field], type, msg: 'x' }] } },
});

describe('a refused sign-up names the field that was refused', () => {
  it('blames the username, not the password, when the username is the problem', () => {
    const text = errorText(refused('username'), 'fallback');
    expect(text).toBe(USERNAME_RULE);
    expect(text).not.toContain('पासवर्ड');
  });

  it('blames the email for a bad email', () => {
    expect(errorText(refused('email', 'value_error'), 'fallback')).toContain('ईमेल');
  });

  it('still explains the 8-character rule when the password really is too short', () => {
    expect(errorText(refused('password', 'string_too_short'), 'fallback')).toContain('८ अक्षरों');
  });

  it('says a too-long password is too long, not too short', () => {
    const text = errorText(refused('password', 'string_too_long'), 'fallback');
    expect(text).toContain('१२८');
    expect(text).not.toContain('कम से कम');
  });

  it('never talks about the password for a 422 it cannot place', () => {
    const odd = { response: { status: 422, data: { detail: [] } } };
    expect(errorText(odd, 'fallback')).not.toContain('पासवर्ड');
    expect(errorText({ response: { status: 422, data: {} } }, 'fallback')).not.toContain('पासवर्ड');
  });

  it('passes the server\'s own sentence through, and falls back when there is none', () => {
    expect(errorText({ response: { status: 400, data: { detail: 'यह ईमेल पहले से पंजीकृत है' } } }, 'f')).toBe('यह ईमेल पहले से पंजीकृत है');
    expect(errorText({ response: { status: 500, data: {} } }, 'फ़ॉलबैक')).toBe('फ़ॉलबैक');
    expect(errorText({}, 'फ़ॉलबैक')).toBe('फ़ॉलबैक');
  });
});

describe('the username check mirrors the server', () => {
  it.each(['raj_kumar', 'raj.kumar', 'Raj123', 'राजा', 'लेखक', 'कमल', 'abc', 'a'.repeat(30)])('accepts %s', (name) => {
    expect(USERNAME_OK.test(name)).toBe(true);
  });

  it.each(['raj kumar', 'raj-kumar', '@raj', 'ra', '', 'raj ', ' raj', 'a'.repeat(31), 'raj/kumar'])('refuses %j', (name) => {
    expect(USERNAME_OK.test(name)).toBe(false);
  });
});
