// Writes public/sitemap-pages.xml: the fixed pages plus one URL per blog guide.
// Runs automatically before `npm run build` (the "prebuild" script) so the guide
// list is read from src/content/guides.js - the single source of truth.
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://lekhanii.vercel.app';
const FIXED_PAGES = ['/', '/about', '/help', '/rules', '/privacy', '/terms', '/blog'];

// guides.js is an ES module inside a CommonJS package: import a temporary .mjs copy of it.
const tmp = mkdtempSync(join(tmpdir(), 'sitemap-'));
copyFileSync(join(root, 'src/content/guides.js'), join(tmp, 'guides.mjs'));
const { GUIDES } = await import(pathToFileURL(join(tmp, 'guides.mjs')).href);

const paths = [...FIXED_PAGES, ...GUIDES.map((guide) => `/blog/${guide.slug}`)];
const entries = paths
  // No <lastmod>: these pages do not change on a schedule, and a date that is always "today"
  // teaches search engines to ignore the field.
  .map((path) => `  <url>\n    <loc>${ORIGIN}${path}</loc>\n  </url>`)
  .join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

writeFileSync(join(root, 'public/sitemap-pages.xml'), xml);
console.log(`sitemap-pages.xml: ${paths.length} URLs`);
