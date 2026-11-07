import { SITE_PAGES, NARRATION_TIER, NARRATION_TIER_NOTES, PAYMENTS_COPY, PAYMENTS_LIVE } from './sitePages';
import { GUIDES } from './guides';

// The public pages are written by hand, in Hindi, for the whole site. These checks hold them to the
// project's rules so a long edit cannot quietly break one.

const HI_MONTHS = [
  'जनवरी', 'फ़रवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त',
  'सितंबर', 'सितम्बर', 'अक्टूबर', 'नवंबर', 'नवम्बर', 'दिसंबर', 'दिसम्बर',
];

// Every string, with where it lives. `id` (an anchor) and `slug` (a URL) are Latin by nature and
// are never shown as text, so the "shown to people" list leaves them out.
const everything = [];
const shown = [];
const collect = (where, key, node) => {
  if (typeof node === 'string') {
    everything.push([where, node]);
    if (key !== 'id' && key !== 'slug') shown.push([where, node]);
  } else if (Array.isArray(node)) {
    node.forEach((item, i) => collect(`${where}[${i}]`, key, item));
  } else if (node && typeof node === 'object') {
    Object.entries(node).forEach(([k, v]) => collect(`${where}.${k}`, k, v));
  }
};
collect('SITE_PAGES', '', SITE_PAGES);
collect('GUIDES', '', GUIDES);
// Both tiers' wording is held to the same rules, including the one that is not showing today.
collect('NARRATION_TIER_NOTES', '', NARRATION_TIER_NOTES);
// The payment wording is held to them too, whether or not it is showing.
collect('PAYMENTS_COPY', '', PAYMENTS_COPY);

describe('public page content', () => {
  it('has something to check', () => {
    expect(shown.length).toBeGreaterThan(100);
  });

  it('uses Latin letters only inside brackets, like "गूगल (Google)" and "(baar) से बार"', () => {
    const offenders = shown
      .map(([where, text]) => [where, (text.replace(/\([^)]*\)/g, '').match(/[A-Za-z]+/g) || []).join(' ')])
      .filter(([, latin]) => latin);
    expect(offenders).toEqual([]);
  });

  it('never names the platform that inspired the design', () => {
    expect(everything.filter(([, text]) => /medium/i.test(text)).map(([where]) => where)).toEqual([]);
  });

  it('never contains the sentence the owner banned', () => {
    const banned = /उस\s*रात\s*को\s*कुछ\s*तो\s*हुआ\s*था|us\s*raat\s*ko\s*kuch\s*to+\s*hua\s*tha/i;
    expect(everything.filter(([, text]) => banned.test(text)).map(([where]) => where)).toEqual([]);
  });
});

describe('info pages', () => {
  const pages = Object.entries(SITE_PAGES);

  it.each(pages)('%s has its kicker, title, date label and introduction', (key, doc) => {
    for (const field of ['kicker', 'title', 'updated', 'intro']) {
      expect(typeof doc[field]).toBe('string');
      expect(doc[field].trim()).not.toBe('');
    }
    expect(Array.isArray(doc.sections)).toBe(true);
  });

  it.each(pages)('%s: every section has a heading and some text, and headings are unique', (key, doc) => {
    const headings = doc.sections.map((section) => section.heading);
    expect(headings.every((heading) => typeof heading === 'string' && heading.trim())).toBe(true);
    expect(new Set(headings).size).toBe(headings.length);
    for (const section of doc.sections) {
      const lines = [...(section.body || []), ...(section.list || [])];
      expect(lines.length).toBeGreaterThan(0);
    }
  });

  it.each(pages)('%s: paragraphs and list items never repeat (they are React keys)', (key, doc) => {
    for (const section of doc.sections) {
      for (const lines of [section.body || [], section.list || []]) {
        expect(new Set(lines).size).toBe(lines.length);
      }
    }
  });

  it.each(pages)('%s: anchors are unique plain words', (key, doc) => {
    const ids = doc.sections.map((section) => section.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z0-9-]*$/));
  });

  it('keeps the anchors other pages link to', () => {
    // Footer.jsx links "पाठ से वाणी" to /help#audio.
    expect(SITE_PAGES.help.sections.map((section) => section.id)).toContain('audio');
  });

  it('shows the features help readers ask about', () => {
    const anchors = SITE_PAGES.help.sections.map((section) => section.id);
    for (const id of ['khaata', 'likhna', 'hinglish', 'padhna', 'audio', 'suchna', 'profile', 'samiksha', 'kamai']) {
      expect(anchors).toContain(id);
    }
  });

  describe('the narration disclosure', () => {
    // The natural voice is made by a third party, so the privacy page has to say where the text goes
    // and which of Google's terms apply. NARRATION_TIER (sitePages.js) says which one is true.
    const privacy = JSON.stringify(SITE_PAGES.privacy);

    it('names the service that makes the natural voice', () => {
      expect(privacy).toContain('जेमिनी (Gemini)');
    });

    it('says what the configured tier means, and nothing from the other tier', () => {
      expect(['free', 'paid']).toContain(NARRATION_TIER);
      const other = NARRATION_TIER === 'free' ? 'paid' : 'free';
      expect(privacy).toContain(NARRATION_TIER_NOTES[NARRATION_TIER]);
      expect(privacy).not.toContain(NARRATION_TIER_NOTES[other]);
    });

    it('keeps each tier honest about Google using the text', () => {
      // Unpaid: Google may use it to improve its products, and its reviewers may read it.
      expect(NARRATION_TIER_NOTES.free).toContain('निःशुल्क श्रेणी');
      expect(NARRATION_TIER_NOTES.free).toContain('इस्तेमाल कर सकता है');
      expect(NARRATION_TIER_NOTES.free).toContain('समीक्षक');
      // Paid: Google does not use it to improve its products.
      expect(NARRATION_TIER_NOTES.paid).toContain('सशुल्क श्रेणी');
      expect(NARRATION_TIER_NOTES.paid).toContain('नहीं करता');
      expect(NARRATION_TIER_NOTES.paid).not.toContain('निःशुल्क');
    });
  });

  it('quotes the follower line the backend enforces', () => {
    // PARTNER_MIN_FOLLOWERS defaults to 200 (merikahani-backend/app/core/config.py).
    for (const page of ['about', 'help', 'terms']) {
      expect(JSON.stringify(SITE_PAGES[page])).toContain('200 फ़ॉलोअर्स');
    }
  });
});

describe('blog guides', () => {
  it('has at least one guide', () => {
    expect(GUIDES.length).toBeGreaterThan(0);
  });

  it('gives every guide a unique address made of plain lowercase words', () => {
    const slugs = GUIDES.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    slugs.forEach((slug) => expect(slug).toMatch(/^[a-z][a-z0-9-]*$/));
  });

  it.each(GUIDES.map((guide) => [guide.slug, guide]))('%s has a title, subtitle, readable date and sections', (slug, guide) => {
    expect(guide.title.trim()).not.toBe('');
    expect(guide.subtitle.trim()).not.toBe('');
    expect(Number.isInteger(guide.minutes) && guide.minutes > 0).toBe(true);
    // The crawler pages read this date ("21 अक्टूबर 2026") to fill datePublished.
    const match = /^\s*(\d{1,2})\s+(\S+)\s+(\d{4})\s*$/.exec(guide.date);
    expect(match).not.toBeNull();
    expect(HI_MONTHS).toContain(match[2]);
    expect(guide.sections.length).toBeGreaterThan(0);
    const headings = guide.sections.map((section) => section.heading);
    expect(new Set(headings).size).toBe(headings.length);
    for (const section of guide.sections) {
      const lines = [...(section.body || []), ...(section.list || [])];
      expect(lines.length).toBeGreaterThan(0);
      for (const group of [section.body || [], section.list || []]) {
        expect(new Set(group).size).toBe(group.length);
      }
    }
  });
});

describe('payments wording', () => {
  const strings = [];
  const gather = (node) => {
    if (typeof node === 'string') strings.push(node);
    else if (Array.isArray(node)) node.forEach(gather);
    else if (node && typeof node === 'object') Object.values(node).forEach(gather);
  };
  gather(PAYMENTS_COPY);
  // How a string appears inside JSON.stringify(SITE_PAGES) (quotes escaped the same way).
  const inPages = (text) => JSON.stringify(SITE_PAGES).includes(JSON.stringify(text).slice(1, -1));

  it('has words to show', () => {
    expect(strings.length).toBeGreaterThan(8);
  });

  it('appears only while payments are live, and every line of it appears once they are', () => {
    // Every helper string the pages could pull in, checked against the pages as they stand now.
    const showing = strings.filter((text) => text.length > 30).map(inPages);
    expect(showing.every((value) => value === PAYMENTS_LIVE)).toBe(true);
  });

  it('quotes the share of a tip the site keeps, as the server has it (TIP_SITE_FEE_BPS = 1000, 10%)', () => {
    const text = JSON.stringify(PAYMENTS_COPY);
    expect(text).toContain('10%');
    // ... and states no other share of a tip.
    expect((text.match(/\d+\s*%/g) || []).every((match) => match.startsWith('10'))).toBe(true);
  });

  it('would not clash with what is already on the pages once it is switched on', () => {
    // The pages as they are WITHOUT the payment sections, whichever way the switch is set.
    const base = (page, own) => SITE_PAGES[page].sections.filter((section) => section !== own);
    const helpIds = base('help', PAYMENTS_COPY.helpSection).map((section) => section.id).filter(Boolean);
    const helpHeadings = base('help', PAYMENTS_COPY.helpSection).map((section) => section.heading);
    const termsHeadings = base('terms', PAYMENTS_COPY.termsSection).map((section) => section.heading);
    expect(helpIds).not.toContain(PAYMENTS_COPY.helpSection.id);
    expect(PAYMENTS_COPY.helpSection.id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(helpHeadings).not.toContain(PAYMENTS_COPY.helpSection.heading);
    expect(termsHeadings).not.toContain(PAYMENTS_COPY.termsSection.heading);
    for (const list of [PAYMENTS_COPY.helpSection.body, PAYMENTS_COPY.termsSection.list, PAYMENTS_COPY.privacySeen]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

// The owner will share part of what the site earns with writers, and asked that this is not said to them. Nothing
// the public can read may discuss profit or name a share of it (the only percentage stated is the tip fee above).
describe('what the pages never say', () => {
  it('does not discuss profit or a half-share anywhere', () => {
    const offenders = everything
      .filter(([, text]) => /लाभ|मुनाफ़ा|मुनाफा|प्रॉफ़िट|प्रॉफिट|profit/i.test(text) || /(५०|50)\s*(%|प्रतिशत)/.test(text))
      .map(([where]) => where);
    expect(offenders).toEqual([]);
  });
});
