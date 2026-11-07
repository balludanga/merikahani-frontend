import { useEffect, useState } from 'react';
import { paymentsAPI } from '../services/api';
import { formatRupees } from './partner';

// Money from readers: tips to a writer and a membership. Everything the page shows about it comes from
// /payments/config, and with no payment provider connected that says "off" and the app shows nothing.

// --------------------------------------------------------------------------- the config, fetched once

let cached = null; // the promise for the answer, shared by every component that asks

export const loadPaymentsConfig = (force = false) => {
  if (!cached || force) {
    cached = paymentsAPI
      .config()
      .then((response) => response.data)
      .catch(() => {
        cached = null; // a failure is not remembered: the next page may succeed
        return { enabled: false };
      });
  }
  return cached;
};

export const forgetPaymentsConfig = () => {
  cached = null;
};

// null while the answer is on its way, then the config. A page that needs it renders nothing about money until then.
export const usePaymentsConfig = () => {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    let live = true;
    loadPaymentsConfig().then((value) => {
      if (live) setConfig(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return config;
};

// --------------------------------------------------------------------------- amounts

// What the site keeps of a tip, as the words people read: 1000 -> "10%", 750 -> "7.5%".
export const feePercent = (bps) => {
  const value = Math.round(Number(bps) || 0) / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '')}%`;
};

// The same split the server makes (the site's share rounds half up; the two add up to the tip exactly).
export const tipSplit = (grossPaise, bps) => {
  const gross = Math.max(0, Math.round(Number(grossPaise) || 0));
  const site = Math.floor((gross * Math.round(Number(bps) || 0) + 5000) / 10000);
  return { writer: gross - site, site };
};

// A tip typed by a person, checked against the limits the server sent: { paise } or { problem }.
export const checkTip = (paise, tips) => {
  if (paise == null) return { problem: 'राशि सही नहीं है — जैसे 50 या 75.50' };
  if (paise < tips.min_paise) return { problem: `कम से कम ${formatRupees(tips.min_paise)} का समर्थन भेजा जा सकता है` };
  if (paise > tips.max_paise) return { problem: `एक बार में अधिकतम ${formatRupees(tips.max_paise)} का समर्थन भेजा जा सकता है` };
  return { paise };
};

// --------------------------------------------------------------------------- words for codes

export const PLAN_NAMES = { monthly: 'मासिक', yearly: 'वार्षिक' };

// "1 महीना" / "12 महीने" -> what a plan covers.
export const planLength = (months) => (months === 12 ? '1 वर्ष' : months === 1 ? '1 महीना' : `${months} महीने`);

// The owner's books, in the owner's words. The codes are the server's own account names.
export const ACCOUNT_LABELS = {
  cash: 'नकद',
  owed_to_writers: 'लेखकों को देय',
  gst_payable: 'जीएसटी (GST) देय',
  writer_pool: 'लेखक कोष',
  income_membership: 'सदस्यता',
  income_tip_fee: 'समर्थन पर लेखनी का हिस्सा',
  income_sponsor: 'प्रायोजक',
  income_grant: 'अनुदान',
  income_other: 'अन्य आय',
  expense_provider_fee: 'भुगतान शुल्क',
  expense_hosting: 'होस्टिंग',
  expense_narration: 'आवाज़ (नैरेशन)',
  expense_accountant: 'लेखाकार',
  expense_domain: 'डोमेन',
  expense_other: 'अन्य खर्च',
};

export const INCOME_ACCOUNTS = ['income_membership', 'income_tip_fee', 'income_sponsor', 'income_grant', 'income_other'];
export const EXPENSE_ACCOUNTS = [
  'expense_provider_fee',
  'expense_hosting',
  'expense_narration',
  'expense_accountant',
  'expense_domain',
  'expense_other',
];
// The ones the owner may type in by hand (the rest are written by the payment code).
export const MANUAL_INCOME = ['income_sponsor', 'income_grant', 'income_other'];
export const MANUAL_EXPENSE = ['expense_hosting', 'expense_narration', 'expense_accountant', 'expense_domain', 'expense_other'];

export const PURPOSE_LABELS = { tip: 'समर्थन', membership: 'सदस्यता' };

export const PAYMENT_STATUS_LABELS = {
  created: 'शुरू हुआ, पैसा नहीं आया',
  captured: 'मिल गया',
  failed: 'विफल',
  part_refunded: 'आंशिक वापसी',
  refunded: 'पूरा लौटाया',
};

export const TRANSACTION_LABELS = {
  tip: 'समर्थन',
  membership: 'सदस्यता',
  provider_fee: 'भुगतान शुल्क',
  tip_refund: 'समर्थन की वापसी',
  membership_refund: 'सदस्यता की वापसी',
  pool: 'लेखक कोष',
  payout: 'लेखक को भुगतान',
  manual: 'हाथ से दर्ज',
  reversal: 'उलटी गई प्रविष्टि',
};

// --------------------------------------------------------------------------- the browser's side of paying

// A payment is "settled" once the provider has answered one way or the other.
export const isSettled = (status) => status !== 'created';

// The first of the month's days to the last, for the owner's month picker: the last `count` months, newest first,
// as "2026-11" keys (Indian time is not needed here: the server has the final say on what a month is).
export const recentMonths = (current, count = 12) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(current || '');
  if (!match) return [];
  let year = Number(match[1]);
  let month = Number(match[2]);
  const keys = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return keys;
};

// The day a hand-typed entry belongs to, inside the month the sheet is showing (so it can never land in another month).
// Empty means today if that is the sheet's month, otherwise the month's last day. Returns { on, day, fallback } or { problem }.
export const entryDate = (month, dayText, now = Date.now()) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month || '');
  if (!match) return { problem: 'महीना सही नहीं है' };
  const year = Number(match[1]);
  const number = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const india = new Date(now + 5.5 * 3600 * 1000); // Indian time: the server counts months that way
  const isThisMonth = india.getUTCFullYear() === year && india.getUTCMonth() + 1 === number;
  const fallback = isThisMonth ? india.getUTCDate() : lastDay;
  const typed = String(dayText == null ? '' : dayText).trim();
  if (typed !== '' && !/^\d{1,2}$/.test(typed)) return { problem: `तारीख 1 से ${lastDay} के बीच की संख्या होनी चाहिए` };
  const day = typed === '' ? fallback : Number(typed);
  if (day < 1 || day > lastDay) return { problem: `तारीख 1 से ${lastDay} के बीच होनी चाहिए` };
  if (isThisMonth && day > india.getUTCDate()) return { problem: 'आगे की तारीख नहीं डाली जा सकती' };
  return { on: `${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`, day, fallback };
};
