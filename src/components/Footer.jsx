import React from 'react';
import { Link } from 'react-router-dom';
import { usePaymentsConfig } from '../utils/payments';
import './Footer.css';

const LINKS = [
  { to: '/help', label: 'सहायता' },
  { to: '/status', label: 'स्थिति' },
  { to: '/about', label: 'परिचय' },
  { to: '/blog', label: 'ब्लॉग' },
  { to: '/earn', label: 'लिखें और कमाएँ' },
  { to: '/rules', label: 'नियम' },
  { to: '/privacy', label: 'गोपनीयता' },
  { to: '/terms', label: 'शर्तें' },
  { to: '/help#audio', label: 'पाठ से वाणी' },
];

/** Thin publication-style footer strip with the platform's info links. */
const Footer = () => {
  // Membership is advertised only once the site can really take payments.
  const payments = usePaymentsConfig();
  const links = payments && payments.enabled && payments.membership ? [...LINKS.slice(0, 5), { to: '/member', label: 'सदस्यता' }, ...LINKS.slice(5)] : LINKS;
  return (
    <footer className="site-footer">
      <span className="site-footer-brand">© 2026 लेखनी</span>
      <nav className="site-footer-links" aria-label="पाद सूची">
        {links.map((link) => (
          <Link key={link.to} to={link.to}>{link.label}</Link>
        ))}
      </nav>
    </footer>
  );
};

export default Footer;
