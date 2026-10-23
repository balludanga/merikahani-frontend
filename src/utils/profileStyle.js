/** Choices a writer has for their profile: banner designs, colours, kinds of writing, links. */

// Keys must match COVER_STYLES in the API (app/schemas/profile.py).
export const COVER_STYLES = [
  { key: 'dawn', label: 'भोर', css: 'linear-gradient(120deg, #f9d29d 0%, #f6a6a0 45%, #d9779a 100%)' },
  { key: 'sky', label: 'आसमान', css: 'linear-gradient(120deg, #a8c8f0 0%, #6f9fe0 50%, #3d6fb8 100%)' },
  { key: 'forest', label: 'वन', css: 'linear-gradient(135deg, #1f4d3a 0%, #2f7a55 60%, #6aa77d 100%)' },
  { key: 'ember', label: 'अंगार', css: 'linear-gradient(120deg, #7a1d1d 0%, #c2410c 55%, #f59e0b 100%)' },
  { key: 'ink', label: 'स्याही', css: 'linear-gradient(135deg, #111827 0%, #1f2937 55%, #4b5563 100%)' },
  { key: 'sand', label: 'रेत', css: 'linear-gradient(120deg, #efe0c8 0%, #d9bf94 55%, #b8935c 100%)' },
  { key: 'twilight', label: 'गोधूलि', css: 'linear-gradient(135deg, #2a1f4d 0%, #6b3fa0 55%, #e0749a 100%)' },
  { key: 'meadow', label: 'हरियाली', css: 'linear-gradient(120deg, #d8e9a8 0%, #8fc46b 55%, #3f9d6b 100%)' },
];

/** The banner background: their own picture is drawn separately; else a design; else their colour. */
export function coverBackground(coverStyle, accent) {
  const preset = COVER_STYLES.find((c) => c.key === coverStyle);
  if (preset) return preset.css;
  const base = accent || '#0f766e';
  return `linear-gradient(120deg, ${base} 0%, ${base}cc 55%, ${base}77 100%)`;
}

// Traditional colour names. Each is adjusted automatically so text stays readable.
export const PALETTE = [
  { hex: '#0f766e', label: 'पन्ना' },
  { hex: '#c2410c', label: 'सिंदूरी' },
  { hex: '#1d4ed8', label: 'नीलम' },
  { hex: '#be185d', label: 'गुलाबी' },
  { hex: '#a16207', label: 'केसरी' },
  { hex: '#6d28d9', label: 'जामुनी' },
  { hex: '#4d7c0f', label: 'मेहंदी' },
  { hex: '#374151', label: 'स्याही' },
];

// Must match GENRES in the API.
export const GENRES = [
  'कहानी', 'लघुकथा', 'कविता', 'ग़ज़ल', 'गीत', 'निबंध', 'संस्मरण', 'व्यंग्य',
  'उपन्यास', 'यात्रा-वृत्तांत', 'समीक्षा', 'नाटक', 'आत्मकथा', 'बाल साहित्य',
];

export const LIMITS = { tagline: 100, status: 100, location: 60, name: 60, bio: 600, genres: 5, links: 5, pins: 3 };

const PLATFORMS = [
  { match: /(^|\.)instagram\.com$/, label: 'इंस्टाग्राम', icon: 'camera' },
  { match: /(^|\.)(youtube\.com|youtu\.be)$/, label: 'यूट्यूब', icon: 'play' },
  { match: /(^|\.)(facebook\.com|fb\.com)$/, label: 'फ़ेसबुक', icon: 'people' },
  { match: /(^|\.)(x\.com|twitter\.com)$/, label: 'एक्स (X)', icon: 'bird' },
  { match: /(^|\.)linkedin\.com$/, label: 'लिंक्डइन', icon: 'people' },
  { match: /(^|\.)github\.com$/, label: 'गिटहब', icon: 'code' },
  { match: /(^|\.)(t\.me|telegram\.me)$/, label: 'टेलीग्राम', icon: 'send' },
  { match: /(^|\.)(amazon\.[a-z.]+|goodreads\.com|notionpress\.com)$/, label: 'पुस्तक', icon: 'book' },
  { match: /(^|\.)(medium\.com|substack\.com|blogspot\.com|wordpress\.com)$/, label: 'ब्लॉग', icon: 'pen' },
];

/** { label, icon, host } for a link: its own name if given, else a Devanagari name for the site. */
export function describeLink(link) {
  let host = '';
  try {
    host = new URL(link.url).hostname.replace(/^www\./, '');
  } catch (error) {
    host = '';
  }
  const known = PLATFORMS.find((p) => p.match.test(host));
  return { label: link.label || (known ? known.label : 'वेबसाइट'), icon: known ? known.icon : 'globe', host };
}
