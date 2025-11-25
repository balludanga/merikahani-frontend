// SEO Utility Functions

export const updateMetaTags = ({ title, description, keywords, image, url, type = 'article', author, publishedTime, modifiedTime }) => {
  // Update title
  if (title) {
    document.title = `${title} - Meri Kahani`;
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
      { property: 'article:modified_time', content: modifiedTime },
      { property: 'article:section', content: 'Stories' },
      { property: 'article:tag', content: 'Hindi Stories' },
      { property: 'article:tag', content: 'Voice Blogging' }
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
    image: post.cover_image || 'https://kahanighargharki.vercel.app/default-image.jpg',
    author: {
      '@type': 'Person',
      name: author.full_name || author.username,
      url: `https://kahanighargharki.vercel.app/profile/${author.username}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Meri Kahani',
      logo: {
        '@type': 'ImageObject',
        url: 'https://kahanighargharki.vercel.app/logo.png',
      },
    },
    datePublished: post.created_at,
    dateModified: post.updated_at,
    description: post.subtitle || post.content.substring(0, 160),
    articleBody: post.content,
    inLanguage: 'hi',
    url: `https://kahanighargharki.vercel.app/post/${post.slug}`,
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
    name: 'Meri Kahani',
    alternateName: 'कहानी घर घर की',
    url: 'https://kahanighargharki.vercel.app',
    description: 'Voice-enabled Hindi and English storytelling platform',
    inLanguage: ['hi', 'en'],
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://kahanighargharki.vercel.app/search?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  };

  // Add blog posts collection if posts exist
  if (posts && posts.length > 0) {
    structuredData.mainEntity = {
      '@type': 'ItemList',
      name: 'Latest Stories',
      itemListElement: posts.slice(0, 10).map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'BlogPosting',
          headline: post.title,
          url: `https://kahanighargharki.vercel.app/post/${post.slug}`,
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
  document.title = 'कहानी घर घर की - Meri Kahani | Voice-Enabled Hindi Storytelling';
  
  const defaultDescription = 'अपनी कहानियां हिंदी और अंग्रेजी में आवाज़ के माध्यम से लिखें और साझा करें। Voice-enabled Hindi storytelling platform.';
  
  updateMetaTags({
    title: 'कहानी घर घर की',
    description: defaultDescription,
    keywords: 'hindi stories, kahani, voice blogging, hindi blog, storytelling, कहानी, हिंदी कहानियां',
    url: 'https://kahanighargharki.vercel.app',
    type: 'website',
  });
};
