import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import { updateMetaTags, resetMetaTags } from '../utils/seo';

export const NotFound = () => {
  useEffect(() => {
    updateMetaTags({ title: 'पृष्ठ नहीं मिला', type: 'website', noindex: true });
    return () => resetMetaTags();
  }, []);

  return (
    <div className="notfound-page">
      <div className="notfound-mark" aria-hidden="true">
        <svg viewBox="0 0 280 280" width="120" height="120">
          <circle cx="140" cy="140" r="120" className="art-disc" />
          <text x="140" y="178" textAnchor="middle" className="art-glyph">अ</text>
        </svg>
      </div>
      <h1>यह पृष्ठ नहीं मिला</h1>
      <p>शायद रचना हटा दी गई है, या पता (link) अधूरा रह गया है।</p>
      <Link to="/" className="landing-cta">मुख्य पृष्ठ पर जाएँ</Link>
      <Footer />
    </div>
  );
};

export default NotFound;
