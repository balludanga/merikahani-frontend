import {
  apiMessage,
  daysUntil,
  formatRupees,
  isUpiLike,
  monthLabel,
  paiseToRupeeText,
  progressPercent,
  rupeesToPaise,
  signalFlags,
  weightsSentence,
} from './partner';

describe('formatRupees', () => {
  it('writes rupees with Indian digit grouping and shows paise only when there are some', () => {
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(99)).toBe('₹0.99');
    expect(formatRupees(10000)).toBe('₹100');
    expect(formatRupees(123450)).toBe('₹1,234.50');
    expect(formatRupees(100000000)).toBe('₹10,00,000');
    expect(formatRupees(1234567800)).toBe('₹1,23,45,678');
    expect(formatRupees(100500)).toBe('₹1,005');
    expect(formatRupees(5)).toBe('₹0.05');
  });

  it('copes with missing or negative values', () => {
    expect(formatRupees(undefined)).toBe('₹0');
    expect(formatRupees(null)).toBe('₹0');
    expect(formatRupees(-250000)).toBe('-₹2,500');
  });
});

describe('rupeesToPaise', () => {
  it('reads what a person types', () => {
    expect(rupeesToPaise('1500')).toBe(150000);
    expect(rupeesToPaise('1,500')).toBe(150000);
    expect(rupeesToPaise('₹ 250.5')).toBe(25050);
    expect(rupeesToPaise('99.99')).toBe(9999);
    expect(rupeesToPaise('0.05')).toBe(5);
  });

  it('refuses anything that is not an amount', () => {
    for (const bad of ['', ' ', 'abc', '12.345', '-5', '1e3', '12.', '.5', null, undefined]) {
      expect(rupeesToPaise(bad)).toBeNull();
    }
  });

  it('round-trips with paiseToRupeeText', () => {
    for (const paise of [0, 5, 99, 100, 10050, 123456, 100000000]) {
      expect(rupeesToPaise(paiseToRupeeText(paise))).toBe(paise);
    }
    expect(paiseToRupeeText(10050)).toBe('100.50');
  });
});

describe('monthLabel', () => {
  it('names the month in Hindi', () => {
    expect(monthLabel('2026-10')).toBe('अक्टूबर 2026');
    expect(monthLabel('2026-01')).toBe('जनवरी 2026');
    expect(monthLabel('2026-12')).toBe('दिसंबर 2026');
  });

  it('is empty for anything that is not a month key', () => {
    for (const bad of ['', '2026-13', '2026-00', '2026-1', 'abc', null, undefined]) {
      expect(monthLabel(bad)).toBe('');
    }
  });
});

describe('progressPercent', () => {
  it('is a whole number between 0 and 100', () => {
    expect(progressPercent(0, 200)).toBe(0);
    expect(progressPercent(137, 200)).toBe(68);
    expect(progressPercent(199, 200)).toBe(99);
    expect(progressPercent(200, 200)).toBe(100);
    expect(progressPercent(450, 200)).toBe(100);
    expect(progressPercent(-3, 200)).toBe(0);
  });

  it('counts a requirement of nothing as met', () => {
    expect(progressPercent(0, 0)).toBe(100);
  });
});

describe('daysUntil', () => {
  const now = Date.UTC(2026, 10, 6, 12, 0, 0);

  it('rounds up to whole days and never goes below zero', () => {
    expect(daysUntil('2026-11-07T12:00:00', now)).toBe(1);
    expect(daysUntil('2026-11-07T12:00:01', now)).toBe(2);
    expect(daysUntil('2026-12-06T12:00:00', now)).toBe(30);
    expect(daysUntil('2026-11-01T12:00:00', now)).toBe(0);
    expect(daysUntil(null, now)).toBe(0);
    expect(daysUntil('not a date', now)).toBe(0);
  });
});

describe('isUpiLike', () => {
  it('accepts name@bank and rejects the rest', () => {
    expect(isUpiLike('kavi.lekhak@okaxis')).toBe(true);
    expect(isUpiLike('9876543210@ybl')).toBe(true);
    expect(isUpiLike(' name-1@sbi ')).toBe(true);
    for (const bad of ['', 'kavi', 'kavi@', '@bank', 'a@b', 'kavi lekhak@okaxis', 'kavi@@x']) {
      expect(isUpiLike(bad)).toBe(false);
    }
  });
});

describe('apiMessage', () => {
  const failure = (status, detail) => ({ response: { status, data: { detail } } });

  it('shows the server\'s own Hindi sentence', () => {
    expect(apiMessage(failure(400, 'आपका आवेदन पहले से समीक्षा में है'), 'x')).toBe('आपका आवेदन पहले से समीक्षा में है');
  });

  it('digs the Hindi message out of a validation error', () => {
    const error = failure(422, [{ msg: 'Value error, कारण कम से कम 5 अक्षर का लिखें' }]);
    expect(apiMessage(error, 'x')).toBe('कारण कम से कम 5 अक्षर का लिखें');
  });

  it('falls back when there is nothing Hindi to show', () => {
    expect(apiMessage(failure(422, [{ msg: 'field required' }]), 'कुछ गड़बड़ हुई')).toBe('कुछ गड़बड़ हुई');
    expect(apiMessage(new Error('Network Error'), 'कुछ गड़बड़ हुई')).toBe('कुछ गड़बड़ हुई');
    expect(apiMessage(undefined, 'कुछ गड़बड़ हुई')).toBe('कुछ गड़बड़ हुई');
  });
});

describe('signalFlags', () => {
  const calm = {
    followers: 200,
    followers_verified: 90,
    followers_new: 10,
    followers_inactive: 60,
    followers_mutual: 20,
    followers_week: 12,
    followers_month: 40,
  };

  it('raises nothing for an ordinary-looking audience', () => {
    expect(signalFlags(calm)).toEqual([]);
  });

  it('flags each worrying pattern once the line is reached, not before', () => {
    expect(signalFlags({ ...calm, followers_new: 59 })).toHaveLength(0);
    expect(signalFlags({ ...calm, followers_new: 60 })).toHaveLength(1);
    expect(signalFlags({ ...calm, followers_inactive: 99 })).toHaveLength(0);
    expect(signalFlags({ ...calm, followers_inactive: 100 })).toHaveLength(1);
    expect(signalFlags({ ...calm, followers_mutual: 79 })).toHaveLength(0);
    expect(signalFlags({ ...calm, followers_mutual: 80 })).toHaveLength(1);
    expect(signalFlags({ ...calm, followers_week: 99 })).toHaveLength(0);
    expect(signalFlags({ ...calm, followers_week: 100 })).toHaveLength(1);
  });

  it('can raise several at once', () => {
    const bad = { ...calm, followers_new: 150, followers_inactive: 190, followers_mutual: 120, followers_week: 180 };
    expect(signalFlags(bad)).toHaveLength(4);
  });

  it('says nothing when there are no followers or no data', () => {
    expect(signalFlags({ ...calm, followers: 0 })).toEqual([]);
    expect(signalFlags(null)).toEqual([]);
    expect(signalFlags(undefined)).toEqual([]);
  });
});

describe('weightsSentence', () => {
  it('says nothing while every reader counts the same, so no rule is described that is not in force', () => {
    expect(weightsSentence({ member_weight: 1, nonmember_weight: 1 })).toBeNull();
    expect(weightsSentence({ member_weight: 3, nonmember_weight: 3 })).toBeNull();
    expect(weightsSentence(null)).toBeNull();
    expect(weightsSentence({})).toBeNull();
  });

  it('says when only members count', () => {
    expect(weightsSentence({ member_weight: 1, nonmember_weight: 0 })).toBe(
      'इस महीने केवल लेखनी के सदस्य पाठकों का जुड़ाव अंकों में गिना जा रहा है।'
    );
  });

  it('says how much more a member counts for', () => {
    const text = weightsSentence({ member_weight: 3, nonmember_weight: 1 });
    expect(text).toContain('3 गुना');
    expect(text).toContain('1 गुना');
  });

  it('follows the Devanagari-only rule', () => {
    for (const rules of [{ member_weight: 1, nonmember_weight: 0 }, { member_weight: 2, nonmember_weight: 1 }]) {
      expect(/[A-Za-z]/.test(weightsSentence(rules))).toBe(false);
    }
  });
});
