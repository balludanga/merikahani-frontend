// SEO Utility Functions

export const updateMetaTags = ({ title, description, keywords, image, url, type = 'article' }) => {
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
    image: post.cover_image || 'https://merikahani.com/default-image.jpg',
    author: {
      '@type': 'Person',
      name: author.full_name || author.username,
      url: `https://merikahani.com/profile/${author.username}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Meri Kahani',
      logo: {
        '@type': 'ImageObject',
        url: 'https://merikahani.com/logo.png',
      },
    },
    datePublished: post.created_at,
    dateModified: post.updated_at,
    description: post.subtitle || post.content.substring(0, 160),
    articleBody: post.content,
    inLanguage: 'hi',
    url: `https://merikahani.com/post/${post.slug}`,
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

export const resetMetaTags = () => {
  document.title = 'कहानी घर घर की - Meri Kahani | Voice-Enabled Hindi Storytelling';
  
  const defaultDescription = 'अपनी कहानियां हिंदी और अंग्रेजी में आवाज़ के माध्यम से लिखें और साझा करें। Voice-enabled Hindi storytelling platform.';
  
  updateMetaTags({
    title: 'कहानी घर घर की',
    description: defaultDescription,
    keywords: 'hindi stories, kahani, voice blogging, hindi blog, storytelling, कहानी, हिंदी कहानियां',
    url: 'https://merikahani.com',
    type: 'website',
  });
};
