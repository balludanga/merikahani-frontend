export const BRAND = {
  name: 'लेखनी',
  tagline: 'मानवीय कहानियाँ। अपनी भाषा में।',
  description: 'लेखकों का अपना घर: हिंदी, अंग्रेज़ी और भारत की सभी भाषाओं में कहानी, कविता, निबंध और संस्मरण लिखें, पढ़ें और ताली बजाएँ। हर रचना इंसान की लिखी।',
};

/**
 * The brand written in the script of each language. It is the SAME word, sounded the same, never a
 * translation into a word of that language (नाम stays "लेखनी" in meaning everywhere). Devanagari languages
 * (Hindi, Marathi, Nepali, Sanskrit, Konkani, Maithili, Dogri, Bodo) keep लेखनी. The spellings follow the
 * typing writers in typing/scriptmap.js (languages.test.js checks they still agree), except Sindhi, which
 * writes ي (not the Persian ی), and English, which uses the Latin spelling the site already goes by
 * (lekhanii.vercel.app, "Lekhanii" in the search data).
 */
export const BRAND_IN = {
  en: 'Lekhanii',
  as: 'লেখনী',
  bn: 'লেখনী',
  gu: 'લેખની',
  kn: 'ಲೇಖನೀ',
  ks: 'لیکھنی',
  ml: 'ലേഖനീ',
  mni: 'ꯂꯦꯈꯅꯤ',
  or: 'ଲେଖନୀ',
  pa: 'ਲੇਖਨੀ',
  sat: 'ᱞᱮᱠᱷᱟᱱᱤ',
  sd: 'ليکني',
  ta: 'லேகனீ',
  te: 'లేఖనీ',
  ur: 'لیکھنی',
};

/** The brand as the people of this language write it (लेखनी for Devanagari and for no language at all). */
export const brandIn = (code) => BRAND_IN[code] || BRAND.name;

export const TOPICS = [
  { id: 'kahani', label: 'कहानी' },
  { id: 'kavita', label: 'कविता' },
  { id: 'nibandh', label: 'निबंध' },
  { id: 'sansmaran', label: 'संस्मरण' },
  { id: 'samiksha', label: 'समीक्षा' },
  { id: 'samaj', label: 'समाज' },
  { id: 'sanskriti', label: 'संस्कृति' },
  { id: 'anubhav', label: 'अनुभव' },
];

export const topicLabel = (id) => TOPICS.find((t) => t.id === id)?.label || id;
