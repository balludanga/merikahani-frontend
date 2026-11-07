import { paymentsAPI } from '../services/api';
import {
  ACCOUNT_LABELS,
  EXPENSE_ACCOUNTS,
  INCOME_ACCOUNTS,
  MANUAL_EXPENSE,
  MANUAL_INCOME,
  PAYMENT_STATUS_LABELS,
  PLAN_NAMES,
  PURPOSE_LABELS,
  TRANSACTION_LABELS,
  checkTip,
  entryDate,
  feePercent,
  forgetPaymentsConfig,
  isSettled,
  loadPaymentsConfig,
  planLength,
  recentMonths,
  tipSplit,
} from './payments';

jest.mock('../services/api', () => ({ paymentsAPI: { config: jest.fn() } }));

describe('tipSplit', () => {
  // The same worked examples as the server's tests (tests/test_ledger.py): the page and the books must agree.
  test('gives the site its share, rounded half up, and the writer the rest', () => {
    expect(tipSplit(1000, 1000)).toEqual({ writer: 900, site: 100 });
    expect(tipSplit(15, 1000)).toEqual({ writer: 13, site: 2 }); // 1.5 paise -> 2
    expect(tipSplit(14, 1000)).toEqual({ writer: 13, site: 1 }); // 1.4 paise -> 1
    expect(tipSplit(5000, 1000)).toEqual({ writer: 4500, site: 500 });
  });

  test('always adds up to exactly the tip, for any amount and any share', () => {
    for (const bps of [0, 250, 1000, 1234, 10000]) {
      for (let gross = 0; gross < 600; gross += 1) {
        const { writer, site } = tipSplit(gross, bps);
        expect(writer + site).toBe(gross);
        expect(writer).toBeGreaterThanOrEqual(0);
        expect(site).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('treats nonsense as nothing rather than as NaN', () => {
    expect(tipSplit(undefined, undefined)).toEqual({ writer: 0, site: 0 });
    expect(tipSplit(-50, 1000)).toEqual({ writer: 0, site: 0 });
  });
});

describe('feePercent', () => {
  test('says the share the way people read it', () => {
    expect(feePercent(1000)).toBe('10%');
    expect(feePercent(750)).toBe('7.5%');
    expect(feePercent(1234)).toBe('12.34%');
    expect(feePercent(0)).toBe('0%');
    expect(feePercent(undefined)).toBe('0%');
  });
});

describe('checkTip', () => {
  const tips = { min_paise: 1000, max_paise: 1000000 };

  test('accepts an amount inside the limits, edges included', () => {
    expect(checkTip(1000, tips)).toEqual({ paise: 1000 });
    expect(checkTip(1000000, tips)).toEqual({ paise: 1000000 });
    expect(checkTip(5050, tips)).toEqual({ paise: 5050 });
  });

  test('says in Hindi what is wrong, quoting the limits the server sent', () => {
    expect(checkTip(null, tips).problem).toMatch(/राशि सही नहीं/);
    expect(checkTip(999, tips).problem).toContain('₹10');
    expect(checkTip(1000001, tips).problem).toContain('₹10,000');
  });
});

describe('the labels', () => {
  const everyLabel = () =>
    [ACCOUNT_LABELS, PLAN_NAMES, PURPOSE_LABELS, PAYMENT_STATUS_LABELS, TRANSACTION_LABELS].flatMap((map) => Object.values(map));

  test('follow the Devanagari-only rule: Latin letters only inside brackets', () => {
    const offenders = everyLabel().filter((text) => /[A-Za-z]/.test(text.replace(/\([^)]*\)/g, '')));
    expect(offenders).toEqual([]);
  });

  test('cover every account the server can show, with no two the same', () => {
    for (const code of [...INCOME_ACCOUNTS, ...EXPENSE_ACCOUNTS, 'cash', 'owed_to_writers', 'gst_payable', 'writer_pool']) {
      expect(typeof ACCOUNT_LABELS[code]).toBe('string');
    }
    const words = Object.values(ACCOUNT_LABELS);
    expect(new Set(words).size).toBe(words.length);
  });

  test('the accounts the owner may type into are a subset of income and costs', () => {
    MANUAL_INCOME.forEach((code) => expect(INCOME_ACCOUNTS).toContain(code));
    MANUAL_EXPENSE.forEach((code) => expect(EXPENSE_ACCOUNTS).toContain(code));
    expect(MANUAL_INCOME).not.toContain('income_membership'); // those come from the payment code
    expect(MANUAL_EXPENSE).not.toContain('expense_provider_fee');
  });

  test('plan lengths read naturally', () => {
    expect(planLength(1)).toBe('1 महीना');
    expect(planLength(12)).toBe('1 वर्ष');
    expect(planLength(3)).toBe('3 महीने');
  });

  test('a payment is settled once it is no longer waiting', () => {
    expect(isSettled('created')).toBe(false);
    ['captured', 'failed', 'refunded', 'part_refunded'].forEach((status) => expect(isSettled(status)).toBe(true));
  });
});

describe('recentMonths', () => {
  test('counts back from the current month, across a year end', () => {
    expect(recentMonths('2026-02', 4)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(recentMonths('2026-11', 1)).toEqual(['2026-11']);
  });

  test('gives nothing for something that is not a month', () => {
    expect(recentMonths('not-a-month')).toEqual([]);
    expect(recentMonths(undefined)).toEqual([]);
  });
});

describe('loadPaymentsConfig', () => {
  beforeEach(() => forgetPaymentsConfig());

  test('asks the server once however many pages ask', async () => {
    paymentsAPI.config.mockResolvedValue({ data: { enabled: true } });
    const [a, b] = await Promise.all([loadPaymentsConfig(), loadPaymentsConfig()]);
    expect(a).toEqual({ enabled: true });
    expect(b).toBe(a);
    expect(paymentsAPI.config).toHaveBeenCalledTimes(1);
  });

  test('treats a failure as "payments are off" and tries again next time', async () => {
    paymentsAPI.config.mockRejectedValueOnce(new Error('offline'));
    expect(await loadPaymentsConfig()).toEqual({ enabled: false });
    paymentsAPI.config.mockResolvedValue({ data: { enabled: true } });
    expect(await loadPaymentsConfig()).toEqual({ enabled: true });
    expect(paymentsAPI.config).toHaveBeenCalledTimes(2);
  });
});

describe('entryDate', () => {
  // 7 November 2026, 12:00 UTC = 17:30 in India.
  const now = Date.UTC(2026, 10, 7, 12, 0);

  test('an empty day means today for this month, and the last day for an earlier one', () => {
    expect(entryDate('2026-11', '', now)).toMatchObject({ on: '2026-11-07', day: 7 });
    expect(entryDate('2026-10', '', now)).toMatchObject({ on: '2026-10-31', day: 31 });
    expect(entryDate('2026-02', '', now).on).toBe('2026-02-28');
    expect(entryDate('2024-02', '', now).on).toBe('2024-02-29'); // a leap year
  });

  test('a typed day stays inside the month shown', () => {
    expect(entryDate('2026-10', '15', now).on).toBe('2026-10-15');
    expect(entryDate('2026-10', ' 3 ', now).on).toBe('2026-10-03');
    expect(entryDate('2026-11', '7', now).on).toBe('2026-11-07');
  });

  test('refuses a day that is not in that month', () => {
    for (const bad of ['0', '32', 'abc', '3.5', '1e1', '-2']) {
      expect(entryDate('2026-10', bad, now).problem).toBeTruthy();
    }
    expect(entryDate('2026-11', '31', now).problem).toBeTruthy(); // November has 30 days
    expect(entryDate('2026-02', '29', now).problem).toBeTruthy();
  });

  test('refuses a day that has not come yet this month', () => {
    expect(entryDate('2026-11', '8', now).problem).toBe('आगे की तारीख नहीं डाली जा सकती');
    expect(entryDate('2026-11', '7', now).problem).toBeUndefined();
  });

  test('counts the month the way India does: late on 31 October UTC is already 1 November', () => {
    const lateUtc = Date.UTC(2026, 9, 31, 20, 0); // 01:30 on 1 November in India
    expect(entryDate('2026-11', '', lateUtc)).toMatchObject({ on: '2026-11-01', day: 1 });
    expect(entryDate('2026-10', '', lateUtc).on).toBe('2026-10-31'); // October is over: its last day
  });

  test('says so for something that is not a month', () => {
    expect(entryDate('nonsense', '5', now).problem).toBeTruthy();
    expect(entryDate(undefined, '', now).problem).toBeTruthy();
  });

  test('its messages follow the Devanagari-only rule', () => {
    const texts = ['0', '99', 'x'].map((d) => entryDate('2026-10', d, now).problem).concat(entryDate('bad', '', now).problem);
    texts.forEach((text) => expect(/[A-Za-z]/.test(text)).toBe(false));
  });
});
