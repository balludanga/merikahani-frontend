import { asUtcDate } from './format';

// Write and earn. Money crosses the API as whole paise; people read and type rupees.

// Indian digit grouping (12,34,567), written out by hand so it never depends on the
// browser's locale data (which some builds ship without).
const group = (digits) => {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${digits.slice(-3)}`;
};

// 123450 -> "₹1,234.50"; 120000 -> "₹1,200" (paise are shown only when there are some).
export const formatRupees = (paise) => {
  const value = Math.round(Number(paise) || 0);
  const abs = Math.abs(value);
  const rest = abs % 100;
  const text = `₹${group(String(Math.floor(abs / 100)))}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
  return value < 0 ? `-${text}` : text;
};

// What a person types ("1,500", "₹ 250.5", "99.99") -> paise, or null when it is not an amount.
export const rupeesToPaise = (text) => {
  const cleaned = String(text == null ? '' : text).replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

// Paise -> the plain rupee string the API takes ("1234.50"): a string, so no float ever rounds it.
export const paiseToRupeeText = (paise) => {
  const value = Math.max(0, Math.round(Number(paise) || 0));
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
};

const MONTHS = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर',
];

// "2026-10" -> "अक्टूबर 2026" ('' for anything that is not a month key).
export const monthLabel = (key) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key || '');
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : '';
};

// 0-100, for a progress bar towards a requirement.
export const progressPercent = (have, need) => {
  if (!(need > 0)) return 100;
  return Math.max(0, Math.min(100, Math.floor((Number(have) * 100) / need)));
};

// Whole days until a moment (rounded up, never negative): "फिर आवेदन: 12 दिन बाद".
export const daysUntil = (stamp, now = Date.now()) => {
  if (!stamp) return 0;
  const target = asUtcDate(stamp).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - now) / 86400000));
};

export const STATUS_LABELS = {
  none: 'आवेदन नहीं किया',
  pending: 'समीक्षा में',
  approved: 'साझेदार लेखक',
  declined: 'स्वीकृत नहीं हुआ',
  withdrawn: 'वापस लिया गया',
  revoked: 'साझेदारी रोकी गई',
};

// The same shape the server accepts: name@bank. A hint only; the server decides.
export const isUpiLike = (value) => /^[A-Za-z0-9._-]{2,50}@[A-Za-z][A-Za-z0-9.-]{1,29}$/.test(String(value || '').trim());

// The Hindi sentence to show for a failed call. Our own server messages are already in Hindi;
// a validation error (422) carries one inside `detail[0].msg`. Anything else gets `fallback`.
export const apiMessage = (error, fallback) => {
  const detail = error && error.response && error.response.data && error.response.data.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail[0] && typeof detail[0].msg === 'string') {
    const message = detail[0].msg.replace(/^Value error,\s*/, '');
    if (/[ऀ-ॿ]/.test(message)) return message;
  }
  return fallback;
};

// Plain-language cautions for the review team, from the counts the server sends with an
// application. They are prompts to look closer, never a verdict: a person decides.
const share = (part, whole) => (whole > 0 ? (part * 100) / whole : 0);

export const signalFlags = (signals) => {
  if (!signals || !(signals.followers > 0)) return [];
  const flags = [];
  if (share(signals.followers_new, signals.followers) >= 30) {
    flags.push('कई फ़ॉलोअर्स बहुत नए खाते हैं (एक हफ़्ते से कम पुराने)');
  }
  if (share(signals.followers_inactive, signals.followers) >= 50) {
    flags.push('आधे से ज़्यादा फ़ॉलोअर्स ने साइट पर कभी कुछ लिखा, ताली दी या हाइलाइट नहीं किया');
  }
  if (share(signals.followers_mutual, signals.followers) >= 40) {
    flags.push('कई फ़ॉलोअर्स को लेखक ने भी फ़ॉलो किया है — आपसी फ़ॉलो का घेरा हो सकता है');
  }
  if (share(signals.followers_week, signals.followers) >= 50) {
    flags.push('ज़्यादातर फ़ॉलोअर्स पिछले एक हफ़्ते में जुड़े हैं');
  }
  return flags;
};

// One reader giving nearly all of a writer's points is the thing to look at before finalizing.
export const LOPSIDED_PERCENT = 70;
