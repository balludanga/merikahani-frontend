// SEO Utility Functions

export const updateMetaTags = ({ title, description, keywords, image, url, type = 'article', author, publishedTime, modifiedTime }) => {
  // Update title
  if (title) {
    document.title = `${title} - लेखनी`;
  }

  // Update or create meta tags
  const metaTags = [
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: url },
    { property: 'og:type', content: type },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];

  // Add article-specific meta tags
  if (type === 'article' && author) {
    metaTags.push(
      { property: 'article:author', content: author },
      { property: 'article:published_time', content: publishedTime },
      { property: 'article:modified_time', content: modifiedTime }
    );
  }

  metaTags.forEach(({ name, property, content }) => {
    if (!content) return;

    const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
    let element = document.querySelector(selector);

    if (!element) {
      element = document.createElement('meta');
      if (name) element.setAttribute('name', name);
      if (property) element.setAttribute('property', property);
      document.head.appendChild(element);
    }

    element.setAttribute('content', content);
  });

  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  if (url) {
    canonical.setAttribute('href', url);
  }
};

export const generateStructuredData = (post, author) => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    alternativeHeadline: post.subtitle,
    image: post.cover_image,
    author: {
      '@type': 'Person',
      name: author.full_name || author.username,
    },
    publisher: {
      '@type': 'Organization',
      name: 'लेखनी',
    },
    datePublished: post.created_at,
    dateModified: post.updated_at,
    description: post.subtitle || post.content.substring(0, 160),
    articleBody: post.content,
    inLanguage: 'hi',
    keywords: (post.tags || []).join(', '),
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

export const generateHomepageStructuredData = (posts) => {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'लेखनी',
    alternateName: 'Lekhani',
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
  document.title = 'लेखनी — हिंदी लेखकों का अपना मंच (Lekhani)';

  updateMetaTags({
    title: 'लेखनी',
    description: 'हिंदी लेखकों का अपना घर — कहानी, कविता, निबंध और संस्मरण लिखें, पढ़ें और ताली बजाएँ। बिना कृत्रिम लेखन के।',
    keywords: 'लेखनी, Lekhani, हिंदी लेखन, हिंदी कहानी, हिंदी कविता, निबंध, संस्मरण',
    type: 'website',
  });
};
