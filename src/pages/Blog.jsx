import React, { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { GUIDES, findGuide } from '../content/guides';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import Footer from '../components/Footer';
import './Info.css';

/** Blog index — magazine table-of-contents style list of guide articles. */
export const BlogIndex = () => {
  useEffect(() => {
    updateMetaTags({ title: 'लेखनी ब्लॉग', description: 'लेखनी का इस्तेमाल सीखिए — शुरुआत से प्रकाशन तक मार्गदर्शक लेख।' });
    return () => resetMetaTags();
  }, []);

  return (
    <div className="info-page">
      <div className="info-shell">
        <span className="info-kicker">ब्लॉग</span>
        <h1 className="info-title">लेखनी कैसे इस्तेमाल करें</h1>
        <p className="info-intro">
          लेखनी की हर सुविधा का मार्गदर्शक लेख — शुरुआत से प्रकाशन तक, हाइलाइट से सुनने तक।
        </p>
        <div className="info-guide-list">
          {GUIDES.map((guide) => (
            <Link key={guide.slug} to={`/blog/${guide.slug}`} className="info-guide-row">
              <h2>{guide.title}</h2>
              <p>{guide.subtitle}</p>
              <span className="info-guide-meta">{guide.date} · {guide.minutes} मिनट का पढ़ना</span>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

/** One full guide article. */
export const GuidePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const guide = findGuide(slug);

  useEffect(() => {
    if (!guide) { navigate('/blog', { replace: true }); return undefined; }
    updateMetaTags({ title: guide.title, description: guide.subtitle });
    window.scrollTo(0, 0);
    return () => resetMetaTags();
  }, [guide, navigate]);

  if (!guide) return null;

  return (
    <div className="info-page">
      <div className="info-shell">
        <Link to="/blog" className="info-back">← ब्लॉग</Link>
        <span className="info-kicker">मार्गदर्शक</span>
        <h1 className="info-title">{guide.title}</h1>
        <p className="info-intro">{guide.subtitle}</p>
        <p className="info-updated">{guide.date} · {guide.minutes} मिनट का पढ़ना</p>

        {guide.sections.map((section) => (
          <section className="info-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body && section.body.map((para) => <p key={para}>{para}</p>)}
            {section.list && (
              <ul className="info-list">
                {section.list.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>
      <Footer />
    </div>
  );
};
