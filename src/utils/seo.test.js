import {
  generateHomepageStructuredData,
  generateStructuredData,
  resetMetaTags,
  updateMetaTags,
} from './seo';

const readJsonLd = (attribute) => {
  const node = document.querySelector(`script[type="application/ld+json"][${attribute}]`);
  return node ? JSON.parse(node.textContent) : null;
};

const AUTHOR = { id: 3, username: 'lekhaak', full_name: 'लेखक जी' };
const POST = {
  id: 7,
  slug: 'एक-कहानी',
  title: 'एक कहानी',
  subtitle: '',
  content: 'एक बार की बात है।',
  cover_image: null,
  tags: ['कहानी'],
  is_preview: false,
  created_at: '2026-01-01T18:30:00',
  updated_at: '2026-01-02T05:00:00',
  author: AUTHOR,
};

beforeEach(() => {
  resetMetaTags();
  document.head
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((node) => node.remove());
});

test('the home page describes the site the reader is actually on', () => {
  // A hard-coded production host in a preview deploy tells crawlers to search somewhere else.
  generateHomepageStructuredData([POST]);
  const data = readJsonLd('data-homepage');
  expect(data.url).toBe(`${window.location.origin}/`);
  expect(data.potentialAction.target).toBe(`${window.location.origin}/search?q={search_term_string}`);
  expect(data.potentialAction.target).not.toContain('vercel.app');
});

test('a listed story can actually be followed, and a missing author does not throw', () => {
  generateHomepageStructuredData([POST, { ...POST, id: 8, slug: 'दूसरी-कहानी', author: null }]);
  const items = readJsonLd('data-homepage').mainEntity.itemListElement;
  expect(items[0].item.url).toBe(`${window.location.origin}/post/${encodeURIComponent(POST.slug)}`);
  expect(items[0].item.author.url).toBe(`${window.location.origin}/user/${AUTHOR.id}`);
  // An item with no author object at all used to raise inside the fetch callback.
  expect(items[1].item.author.name).toBe('लेखक');
});

test('story dates keep the UTC offset the API left out', () => {
  // "2026-01-01T18:30:00" is UTC here; without the Z a crawler reads it in its own zone.
  generateStructuredData(POST, AUTHOR);
  const data = readJsonLd('data-post');
  expect(data.datePublished).toBe('2026-01-01T18:30:00.000Z');
  expect(data.dateModified).toBe('2026-01-02T05:00:00.000Z');
});

test('leaving the home page takes its structured data along', () => {
  // Otherwise the WebSite/ItemList block sits in <head> next to a story's own BlogPosting.
  generateHomepageStructuredData([POST]);
  expect(readJsonLd('data-homepage')).not.toBeNull();
  updateMetaTags({ title: 'खोज', description: 'रचनाएँ खोजें', type: 'website' });
  expect(readJsonLd('data-homepage')).toBeNull();
});
