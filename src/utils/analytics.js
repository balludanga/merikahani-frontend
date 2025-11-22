// Google Analytics utility functions
export const GA_TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID;

// Initialize Google Analytics
export const initGA = () => {
  if (!GA_TRACKING_ID) {
    console.warn('Google Analytics tracking ID not found');
    return;
  }

  // Load gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_TRACKING_ID, {
    page_title: document.title,
    page_location: window.location.href
  });
};

// Track page views
export const pageview = (url) => {
  if (window.gtag && GA_TRACKING_ID) {
    window.gtag('config', GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Track custom events
export const event = ({ action, category, label, value }) => {
  if (window.gtag && GA_TRACKING_ID) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track user interactions
export const trackEvent = (eventName, parameters = {}) => {
  if (window.gtag && GA_TRACKING_ID) {
    window.gtag('event', eventName, parameters);
  }
};