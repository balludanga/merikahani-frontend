// Writes public/_bot/*.html: complete, server-rendered copies of the static pages
// (/about /help /rules /privacy /terms /blog /blog/<guide>) for search-engine crawlers.
// Runs before `npm run build` (the "prebuild" script) and reads the same content files the
// React pages render, so the text a crawler gets is the text a reader sees.
//
// vercel.json rewrites crawler user agents (never people) from the real URL to these files,
// the same way /post, /tag and /user already go to the backend. Each file names the REAL
// address as its canonical, so these copies are never indexed under their own path.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/_bot');
const ORIGIN = 'https://lekhanii.vercel.app';
const SITE = 'लेखनी';

// The content files are ES modules inside a CommonJS package: import temporary .mjs copies.
const tmp = mkdtempSync(join(tmpdir(), 'botpages-'));
copyFileSync(join(root, 'src/content/guides.js'), join(tmp, 'guides.mjs'));
copyFileSync(join(root, 'src/content/sitePages.js'), join(tmp, 'sitePages.mjs'));
const { GUIDES } = await import(pathToFileURL(join(tmp, 'guides.mjs')).href);
const { SITE_PAGES } = await import(pathToFileURL(join(tmp, 'sitePages.mjs')).href);
rmSync(tmp, { recursive: true, force: true });

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON inside <script>: "<" must never close the tag.
const jsonLd = (data) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

// Same rule as buildDescription() in src/utils/seo.js: 120-160 characters, cut at a word.
const buildDescription = (...texts) => {
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

const NAV = [
  ['/', 'मुखपृष्ठ'],
  ['/blog', 'ब्लॉग'],
  ['/about', 'परिचय'],
  ['/help', 'सहायता'],
  ['/rules', 'नियम'],
  ['/privacy', 'गोपनीयता'],
  ['/terms', 'शर्तें'],
];

const sectionsHtml = (sections) =>
  sections
    .map(
      (s) =>
        `<section>\n<h2>${esc(s.heading)}</h2>\n` +
        (s.body || []).map((p) => `<p>${esc(p)}</p>\n`).join('') +
        (s.list ? `<ul>\n${s.list.map((i) => `<li>${esc(i)}</li>\n`).join('')}</ul>\n` : '') +
        '</section>\n'
    )
    .join('');

const page = ({ path, title, description, type, heading, kicker, intro, meta, body, graph }) => {
  const url = `${ORIGIN}${path}`;
  const fullTitle = `${title} - ${SITE}`;
  const ld = { '@context': 'https://schema.org', '@graph': graph };
  return `<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<link rel="icon" href="${ORIGIN}/favicon.ico">
<link rel="alternate" type="application/rss+xml" title="${SITE}" href="${ORIGIN}/rss.xml">
<meta property="og:site_name" content="${SITE}">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="hi_IN">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ORIGIN}/og-image.png">
<script type="application/ld+json">${jsonLd(ld)}</script>
</head>
<body>
<header><a href="/">${SITE}</a>
<nav aria-label="मुख्य सूची">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join(' ')}</nav></header>
<main>
${kicker ? `<p>${esc(kicker)}</p>\n` : ''}<h1>${esc(heading)}</h1>
${meta ? `<p>${esc(meta)}</p>\n` : ''}<p>${esc(intro)}</p>
${body}</main>
<footer><p>© 2026 ${SITE}</p>
<nav aria-label="पाद सूची">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join(' ')}</nav></footer>
</body>
</html>
`;
};

const crumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name,
    item: `${ORIGIN}${path}`,
  })),
});

const org = { '@type': 'Organization', '@id': `${ORIGIN}/#organization`, name: SITE, url: ORIGIN };

const HI_MONTHS = {
  जनवरी: 1, फ़रवरी: 2, फरवरी: 2, मार्च: 3, अप्रैल: 4, मई: 5, जून: 6,
  जुलाई: 7, अगस्त: 8, सितंबर: 9, सितम्बर: 9, अक्टूबर: 10, नवंबर: 11, नवम्बर: 11, दिसंबर: 12, दिसम्बर: 12,
};
const guideDateToIso = (text) => {
  const m = /^\s*(\d{1,2})\s+(\S+)\s+(\d{4})\s*$/.exec(text || '');
  const month = m && HI_MONTHS[m[2]];
  if (!month) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${m[3]}-${pad(month)}-${pad(Number(m[1]))}`;
};

const files = new Map(); // relative path under _bot -> html

// /about /help /rules /privacy /terms (the live-status page is noindex, so it gets none)
for (const key of ['about', 'help', 'rules', 'privacy', 'terms']) {
  const doc = SITE_PAGES[key];
  const title = doc.title.includes(doc.kicker) ? doc.title : `${doc.kicker} — ${doc.title}`;
  const description = buildDescription(doc.intro, doc.sections[0]?.body?.[0]);
  const path = `/${key}`;
  files.set(
    `${key}.html`,
    page({
      path,
      title,
      description,
      type: 'website',
      heading: doc.title,
      kicker: doc.kicker,
      intro: doc.intro,
      meta: doc.updated,
      body: sectionsHtml(doc.sections),
      graph: [
        { '@type': 'WebPage', '@id': `${ORIGIN}${path}`, url: `${ORIGIN}${path}`, name: title, description, inLanguage: 'hi', isPartOf: { '@id': `${ORIGIN}/#website` } },
        crumbs([[SITE, '/'], [doc.kicker, path]]),
      ],
    })
  );
}

// /blog
{
  const title = 'ब्लॉग — लेखनी कैसे इस्तेमाल करें';
  const description = buildDescription(
    'लेखनी की हर सुविधा का मार्गदर्शक लेख — शुरुआत से प्रकाशन तक, हाइलाइट से सुनने तक',
    GUIDES.map((g) => g.title).join(', ')
  );
  const list =
    '<ul>\n' +
    GUIDES.map(
      (g) => `<li><h2><a href="/blog/${g.slug}">${esc(g.title)}</a></h2><p>${esc(g.subtitle)}</p><p>${esc(g.date)} · ${g.minutes} मिनट का पढ़ना</p></li>\n`
    ).join('') +
    '</ul>\n';
  files.set(
    'blog.html',
    page({
      path: '/blog',
      title,
      description,
      type: 'website',
      heading: 'लेखनी कैसे इस्तेमाल करें',
      kicker: 'ब्लॉग',
      intro: 'लेखनी की हर सुविधा का मार्गदर्शक लेख — शुरुआत से प्रकाशन तक, हाइलाइट से सुनने तक।',
      body: list,
      graph: [
        {
          '@type': 'CollectionPage',
          '@id': `${ORIGIN}/blog`,
          url: `${ORIGIN}/blog`,
          name: title,
          description,
          inLanguage: 'hi',
          isPartOf: { '@id': `${ORIGIN}/#website` },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/blog/${g.slug}`, name: g.title })),
          },
        },
        crumbs([[SITE, '/'], ['ब्लॉग', '/blog']]),
      ],
    })
  );
}

// /blog/<guide>
for (const guide of GUIDES) {
  const path = `/blog/${guide.slug}`;
  const description = buildDescription(guide.subtitle, guide.sections[0]?.body?.[0]);
  const iso = guideDateToIso(guide.date);
  files.set(
    `blog/${guide.slug}/index.html`,
    page({
      path,
      title: guide.title,
      description,
      type: 'article',
      heading: guide.title,
      kicker: 'मार्गदर्शक',
      intro: guide.subtitle,
      meta: `${guide.date} · ${guide.minutes} मिनट का पढ़ना`,
      body: `<p><a href="/blog">← ब्लॉग</a></p>\n${sectionsHtml(guide.sections)}`,
      graph: [
        {
          '@type': 'Article',
          headline: guide.title.slice(0, 110),
          description,
          inLanguage: 'hi',
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}${path}` },
          author: org,
          publisher: { ...org, logo: { '@type': 'ImageObject', url: `${ORIGIN}/logo.png` } },
          image: `${ORIGIN}/og-image.png`,
          ...(iso ? { datePublished: iso, dateModified: iso } : {}),
        },
        crumbs([[SITE, '/'], ['ब्लॉग', '/blog'], [guide.title, path]]),
      ],
    })
  );
}

rmSync(OUT, { recursive: true, force: true });
for (const [rel, html] of files) {
  const target = join(OUT, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}
console.log(`_bot: ${files.size} crawler pages`);
