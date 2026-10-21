export const BRAND = {
  name: 'लेखनी',
  nameEn: 'Lekhani',
  tagline: 'मानवीय कहानियाँ। हिंदी में।',
  description: 'हिंदी लेखकों का अपना घर — कहानी, कविता, निबंध और संस्मरण लिखें, पढ़ें और ताली बजाएँ। बिना कृत्रिम लेखन के।',
};

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
