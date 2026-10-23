// SEO Utility Functions

// Tags we manage. Their original values come from public/index.html; they are
// snapshotted once so resetMetaTags() can restore the exact defaults.
const META_SELECTORS = [
  'meta[name="description"]',
  'meta[name="keywords"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:image"]',
  'meta[property="og:url"]',
  'meta[property="og:type"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
  'meta[name="twitter:url"]',
  'meta[property="article:author"]',
  'meta[property="article:published_time"]',
  'meta[property="article:modified_time"]',
];

let defaults = null;

const takeSnapshot = () => {
  if (defaults) return;
  defaults = { title: document.title, meta: {}, canonical: null };
  META_SELECTORS.forEach((selector) => {
    const el = document.querySelector(selector);
    defaults.meta[selector] = el ? el.getAttribute('content') : null;
  });
  const canonical = document.querySelector('link[rel="canonical"]');
  defaults.canonical = canonical ? canonical.getAttribute('href') : null;
};

const setMeta = (selector, content) => {
  let element = document.querySelector(selector);
  if (content === null || content === undefined) {
    if (element) element.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    const match = selector.match(/\[(name|property)="([^"]+)"\]/);
    element.setAttribute(match[1], match[2]);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
};

const setCanonical = (href) => {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (href === null || href === undefined) {
    if (canonical) canonical.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
};

const setNoindex = (on) => {
  const existing = document.querySelector('meta[data-noindex]');
  if (!on) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  const element = document.createElement('meta');
  element.setAttribute('name', 'robots');
  element.setAttribute('content', 'noindex,nofollow');
  element.setAttribute('data-noindex', 'true');
  document.head.appendChild(element);
};

const removePostStructuredData = () => {
  const script = document.querySelector('script[type="application/ld+json"][data-post]');
  if (script) script.remove();
};

// Canonical URL of the page being shown: origin + pathname only (never the query
// string, no trailing slash). Home returns null so it keeps the exact index.html defaults.
const currentPageUrl = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path ? `${window.location.origin}${path}` : null;
};

const restoreDefaults = () => {
  if (!defaults) return;
  document.title = defaults.title;
  META_SELECTORS.forEach((selector) => setMeta(selector, defaults.meta[selector]));
  setCanonical(defaults.canonical);
  setNoindex(false);
};

export const updateMetaTags = ({ title, description, keywords, image, url, type = 'article', author, publishedTime, modifiedTime, noindex = false }) => {
  takeSnapshot();
  // Start from the index.html defaults so nothing from the previous page
  // (image, article:* tags, canonical, noindex) leaks into this one.
  restoreDefaults();
  removePostStructuredData();

  // Without an explicit url, every page declares itself canonical (not the home page).
  const pageUrl = url || currentPageUrl();

  if (title) {
    document.title = `${title} - लेखनी`;
  }

  const metaTags = [
    ['meta[name="description"]', description],
    ['meta[name="keywords"]', keywords],
    ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description],
    ['meta[property="og:image"]', image],
    ['meta[property="og:url"]', pageUrl],
    ['meta[property="og:type"]', type],
    ['meta[name="twitter:title"]', title],
    ['meta[name="twitter:description"]', description],
    ['meta[name="twitter:image"]', image],
    ['meta[name="twitter:url"]', pageUrl],
  ];

  // Add article-specific meta tags
  if (type === 'article' && author) {
    metaTags.push(
      ['meta[property="article:author"]', author],
      ['meta[property="article:published_time"]', publishedTime],
      ['meta[property="article:modified_time"]', modifiedTime]
    );
  }

  metaTags.forEach(([selector, content]) => {
    if (content) setMeta(selector, content);
  });

  if (pageUrl) setCanonical(pageUrl);
  setNoindex(noindex);
};

/**
 * Meta description of 120-160 characters: joins the given texts until long enough,
 * then cuts cleanly at a word boundary (adding an ellipsis when it had to cut).
 */
export const buildDescription = (...texts) => {
  const MIN = 120;
  const MAX = 160;
  let out = '';
  for (const raw of texts) {
    const text = (raw || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    out = out ? `${out.replace(/[\s।.!?—-]+$/, '')}। ${text}` : text;
    if (out.length >= MIN) break;
  }
  if (out.length <= MAX) return out;
  const cut = out.slice(0, MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const clean = (lastSpace >= MIN ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:।—-]+$/, '');
  return `${clean}…`;
};

// Same selector the sign-in wall uses in PostView and in the server-rendered crawler page.
const GATE_SELECTOR = '.story-gate';

export const generateStructuredData = (post, author) => {
  const origin = window.location.origin;
  const storyUrl = `${origin}/post/${encodeURIComponent(post.slug)}`;
  // Never inline an uploaded (data:) cover into the JSON - use a real image URL or the logo.
  const hasRealCover = /^https?:\/\//.test(post.cover_image || '');
  const gated = !!post.is_preview;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: (post.title || '').slice(0, 110),
    ...(post.subtitle ? { alternativeHeadline: post.subtitle } : {}),
    image: hasRealCover ? post.cover_image : `${origin}/logo.png`,
    author: {
      '@type': 'Person',
      name: author.full_name || author.username,
      url: `${origin}/user/${author.id}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'लेखनी',
      logo: { '@type': 'ImageObject', url: `${origin}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': storyUrl },
    datePublished: post.created_at,
    dateModified: post.updated_at,
    description: post.subtitle || (post.content || '').substring(0, 160),
    articleBody: post.content,
    inLanguage: 'hi',
    keywords: (post.tags || []).join(', '),
    // Signed-out readers get a teaser; say so, so search engines don't read it as cloaking.
    isAccessibleForFree: !gated,
    ...(gated
      ? {
          hasPart: {
            '@type': 'WebPageElement',
            isAccessibleForFree: false,
            cssSelector: GATE_SELECTOR,
          },
        }
      : {}),
  };

  // Remove existing structured data
  const existingScript = document.querySelector('script[type="application/ld+json"][data-post]');
  if (existingScript) {
    existingScript.remove();
  }

  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-post', 'true');
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
};

const HI_MONTHS = {
  जनवरी: 1, फ़रवरी: 2, फरवरी: 2, मार्च: 3, अप्रैल: 4, मई: 5, जून: 6,
  जुलाई: 7, अगस्त: 8, सितंबर: 9, सितम्बर: 9, अक्टूबर: 10, नवंबर: 11, नवम्बर: 11, दिसंबर: 12, दिसम्बर: 12,
};

// "21 अक्टूबर 2026" -> "2026-10-21"; null when the text is not in that shape.
const guideDateToIso = (text) => {
  const match = /^\s*(\d{1,2})\s+(\S+)\s+(\d{4})\s*$/.exec(text || '');
  const month = match && HI_MONTHS[match[2]];
  if (!month) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${match[3]}-${pad(month)}-${pad(Number(match[1]))}`;
};

/**
 * Article + BreadcrumbList JSON-LD for a blog guide. Uses the same
 * script[data-post] slot as stories, so resetMetaTags() / the next
 * updateMetaTags() removes it.
 */
export const generateGuideStructuredData = (guide, description) => {
  const origin = window.location.origin;
  const guideUrl = `${origin}/blog/${guide.slug}`;
  const iso = guideDateToIso(guide.date);
  const organization = { '@type': 'Organization', name: 'लेखनी', url: origin };
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: guide.title.slice(0, 110),
        description,
        inLanguage: 'hi',
        mainEntityOfPage: { '@type': 'WebPage', '@id': guideUrl },
        author: organization,
        publisher: {
          ...organization,
          logo: { '@type': 'ImageObject', url: `${origin}/logo.png` },
        },
        image: `${origin}/logo.png`,
        ...(iso ? { datePublished: iso, dateModified: iso } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'लेखनी', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'ब्लॉग', item: `${origin}/blog` },
          { '@type': 'ListItem', position: 3, name: guide.title, item: guideUrl },
        ],
      },
    ],
  };

  removePostStructuredData();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-post', 'true');
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
};

export const generateHomepageStructuredData = (posts) => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'लेखनी',
    description: 'हिंदी लेखकों का अपना मंच — कहानी, कविता, निबंध और संस्मरण',
    inLanguage: 'hi',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://lekhanii.vercel.app/search?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  };

  // Add blog posts collection if posts exist
  if (posts && posts.length > 0) {
    structuredData.mainEntity = {
      '@type': 'ItemList',
      name: 'ताज़ा रचनाएँ',
      itemListElement: posts.slice(0, 10).map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'BlogPosting',
          headline: post.title,
          datePublished: post.created_at,
          author: {
            '@type': 'Person',
            name: post.author.full_name || post.author.username
          }
        }
      }))
    };
  }

  // Remove existing homepage structured data
  const existingScript = document.querySelector('script[type="application/ld+json"][data-homepage]');
  if (existingScript) {
    existingScript.remove();
  }

  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-homepage', 'true');
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
};

export const resetMetaTags = () => {
  takeSnapshot();
  restoreDefaults();
  removePostStructuredData();
};
