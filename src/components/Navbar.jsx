import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTheme, toggleTheme } from '../utils/theme';
import { BRAND } from '../brand';
import NotificationBell from './NotificationBell';
import { mediaUrl } from '../utils/media';
import { initials } from '../utils/format';
import './Navbar.css';

const Navbar = ({ landing }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const menuRef = useRef(null);

  // The avatar menu must dismiss like any real menu: click-away or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const switchTheme = () => {
    toggleTheme();
    setThemeState(getTheme());
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const onSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  };

  const displayName = user?.full_name || user?.username || '';

  return (
    <header className={`navbar ${landing ? 'navbar-landing' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">{BRAND.name}</Link>

        {!landing && (
          <form className="navbar-search" onSubmit={onSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="खोजें"
              aria-label="खोजें"
            />
          </form>
        )}

        <div className="navbar-menu">
          <Link to="/search" className="navbar-search-link" aria-label="खोजें" title="खोजें">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </Link>
          <button
            type="button"
            className="navbar-theme"
            onClick={switchTheme}
            aria-label={theme === 'dark' ? 'सफ़ेद मोड चालू करें' : 'डार्क मोड चालू करें'}
            title={theme === 'dark' ? 'सफ़ेद मोड' : 'डार्क मोड'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
          {isAuthenticated ? (
            <>
              <Link to="/new-story" className="navbar-write">
                <span aria-hidden="true">✎</span> लिखें
              </Link>
              <NotificationBell />
              <div className="navbar-avatar-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="navbar-avatar"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="खाता मेनू"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                >
                  {user?.avatar_url ? (
                    <img src={mediaUrl(user.avatar_url)} alt="" />
                  ) : (
                    <span>{initials(displayName)}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="navbar-dropdown" role="menu">
                    {/* Nav search input is hidden below 700px — keep search reachable via the menu. */}
                    <Link to="/search" role="menuitem" onClick={() => setMenuOpen(false)}>खोजें</Link>
                    <Link to={`/user/${user.id}`} role="menuitem" onClick={() => setMenuOpen(false)}>प्रोफ़ाइल</Link>
                    <Link to="/settings/profile" role="menuitem" onClick={() => setMenuOpen(false)}>प्रोफ़ाइल सजाएँ</Link>
                    <Link to="/stories" role="menuitem" onClick={() => setMenuOpen(false)}>मेरी रचनाएँ</Link>
                    <Link to="/bookmarks" role="menuitem" onClick={() => setMenuOpen(false)}>पढ़ने की सूची</Link>
                    <button type="button" role="menuitem" onClick={handleLogout}>साइन आउट</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link">साइन इन</Link>
              <Link to="/register" className="navbar-cta">शुरू करें</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
