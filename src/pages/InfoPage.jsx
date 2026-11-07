import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_PAGES } from '../content/sitePages';
import { updateMetaTags, resetMetaTags, buildDescription } from '../utils/seo';
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
    updateMetaTags({
      // Unique per page: kicker + title ("परिचय — हिंदी लेखकों का अपना मंच").
      title: doc.title.includes(doc.kicker) ? doc.title : `${doc.kicker} — ${doc.title}`,
      description: buildDescription(
        doc.intro,
        doc.sections[0] && doc.sections[0].body ? doc.sections[0].body[0] : ''
      ),
      type: 'website',
      // The live-status page is not search material.
      noindex: page === 'status',
    });
    return () => resetMetaTags();
  }, [doc, page]);

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
    if (!location.hash) return undefined;
    const id = location.hash.slice(1);
    // An instant jump, like a plain link: a smooth scroll still animating when the page re-flows is
    // overtaken by the correction below and lands in the wrong place.
    const goToSection = () => {
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    };
    goToSection();

    // Web fonts arrive after the first paint and re-flow the page, which moves the heading we just
    // scrolled to. For a few seconds, land on it again whenever a font finishes loading - unless
    // the reader has already taken over the scrolling.
    const opened = Date.now();
    let readerMoved = false;
    const takeOver = () => { readerMoved = true; };
    const settle = () => {
      if (!readerMoved && Date.now() - opened < 4000) goToSection();
    };
    window.addEventListener('wheel', takeOver, { passive: true });
    window.addEventListener('touchmove', takeOver, { passive: true });
    window.addEventListener('keydown', takeOver);
    const fonts = document.fonts;
    if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', settle);
    return () => {
      window.removeEventListener('wheel', takeOver);
      window.removeEventListener('touchmove', takeOver);
      window.removeEventListener('keydown', takeOver);
      if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', settle);
    };
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
