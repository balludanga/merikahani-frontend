// What to tell a reader when sign-in or sign-up is refused.
//
// The server answers a refused field with a 422 whose `detail` is a list naming the field
// (`loc`) and the kind of problem (`type`). The old code ignored that and answered every 422
// with a sentence about the 8-character password, so a perfectly good password was blamed
// whenever the username (a space, a hyphen, under 3 letters) or the email was what the
// server actually refused.

export const USERNAME_RULE =
  'उपयोगकर्ता नाम ३ से ३० अक्षरों का होना चाहिए, और उसमें केवल अक्षर, अंक, _ या . हो सकते हैं — खाली जगह या - नहीं।';

// The same shape the server accepts for a username (letters of any script with their vowel
// signs, digits, "_" and "."; 3 to 30 long). Checked in the form first so the reader is told
// at once, in plain words, instead of after a round trip.
export const USERNAME_OK = /^[\p{L}\p{N}\p{M}_.‌‍]{3,30}$/u;

const FIELD_PROBLEMS = {
  username: USERNAME_RULE,
  email: 'ईमेल का पता सही नहीं लगता। कृपया उसे दोबारा जाँचें।',
  full_name: 'पूरा नाम १०० अक्षरों तक ही रखें।',
};

const GENERIC_422 = 'दर्ज की गई जानकारी सही नहीं है। कृपया हर खाने की जाँच करें।';

// FastAPI sends `detail` as a string for our own errors but as an array of objects for
// validation errors (422); rendering that array would crash the page.
export const errorText = (error, fallback) => {
  const detail = error && error.response && error.response.data && error.response.data.detail;
  if (error && error.response && error.response.status === 422) {
    const first = Array.isArray(detail) ? detail[0] : null;
    const where = first && Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null;
    if (where === 'password') {
      return first.type === 'string_too_long'
        ? 'पासवर्ड १२८ अक्षरों से लंबा नहीं हो सकता।'
        : 'पासवर्ड कम से कम ८ अक्षरों का रखें।';
    }
    return FIELD_PROBLEMS[where] || GENERIC_422;
  }
  return typeof detail === 'string' && detail ? detail : fallback;
};
