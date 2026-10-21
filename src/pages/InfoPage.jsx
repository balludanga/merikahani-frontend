import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_PAGES } from '../content/sitePages';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import api from '../services/api';
import Footer from '../components/Footer';
import './Info.css';

/**
 * Shared editorial reading shell for the platform's info pages
 * (about / help / rules / privacy / terms / status).
 */
const InfoPage = ({ page }) => {
  const doc = SITE_PAGES[page];
  const location = useLocation();
  const [services, setServices] = useState(null); // null = checking

  useEffect(() => {
    if (!doc) return undefined;
    updateMetaTags({ title: doc.title, description: doc.intro });
    return () => resetMetaTags();
  }, [doc]);

  useEffect(() => {
    if (page !== 'status' || !doc) return undefined;
    let cancelled = false;
    setServices(null);
    // One light query: proves the API is up AND the database answers.
    api.get('/posts', { params: { limit: 1 } })
      .then(() => { if (!cancelled) setServices(true); })
      .catch(() => { if (!cancelled) setServices(false); });
    return () => { cancelled = true; };
  }, [page, doc]);

  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page, location.hash]);

  if (!doc) return null;

  return (
    <div className="info-page">
      <div className="info-shell">
        <span className="info-kicker">{doc.kicker}</span>
        <h1 className="info-title">{doc.title}</h1>
        {doc.updated && <p className="info-updated">{doc.updated}</p>}
        <p className="info-intro">{doc.intro}</p>

        {page === 'status' && (
          <ul className="info-status">
            <li>
              <span className="status-dot on" aria-hidden="true" />
              <span className="status-name">वेब ऐप</span>
              <span className="status-note">चालू — यह पृष्ठ खुला है</span>
            </li>
            <li>
              <span className={`status-dot ${services === null ? 'wait' : services ? 'on' : 'off'}`} aria-hidden="true" />
              <span className="status-name">एपीआई व डेटाबेस</span>
              <span className="status-note">
                {services === null ? 'जाँच चल रही है…' : services ? 'चालू — ताज़ा डेटा आ रहा है' : 'जवाब नहीं मिल रहा — कुछ देर बाद दोबारा देखें'}
              </span>
            </li>
          </ul>
        )}

        {doc.sections.map((section) => (
          <section className="info-section" key={section.heading} id={section.id}>
            <h2>{section.heading}</h2>
            {section.body && section.body.map((para) => (
              <p key={para}>{para}</p>
            ))}
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

export default InfoPage;
