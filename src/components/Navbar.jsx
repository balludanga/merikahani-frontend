import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTheme, toggleTheme } from '../utils/theme';
import { BRAND } from '../brand';
import { initials } from '../utils/format';
import './Navbar.css';

const Navbar = ({ landing }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme());

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
              <div className="navbar-avatar-wrap">
                <button
                  type="button"
                  className="navbar-avatar"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="खाता मेनू"
                >
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" />
                  ) : (
                    <span>{initials(displayName)}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="navbar-dropdown">
                    <Link to={`/user/${user.id}`} onClick={() => setMenuOpen(false)}>प्रोफ़ाइल</Link>
                    <Link to="/stories" onClick={() => setMenuOpen(false)}>मेरी रचनाएँ</Link>
                    <Link to="/bookmarks" onClick={() => setMenuOpen(false)}>पढ़ने की सूची</Link>
                    <button type="button" onClick={handleLogout}>साइन आउट</button>
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
