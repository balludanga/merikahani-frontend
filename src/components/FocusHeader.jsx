import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import { mediaUrl } from '../utils/media';

/**
 * Slim reader header: wordmark, author, account menu, bookmark. Slides fully
 * out of view while scrolling down and returns on the slightest upward scroll
 * — the transform transition is handled in CSS for a compositor-only animation.
 * The account menu keeps sign-out and navigation reachable without leaving the
 * distraction-free reading page.
 */
const FocusHeader = ({ post, hidden, saved, onBookmark }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const authorName = post.author.full_name || post.author.username;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/');
  };

  return (
    <header className={`focus-header${hidden ? ' is-hidden' : ''}`}>
      <div className="focus-header-inner">
        <Link to="/" className="focus-logo" aria-label="लेखनी होम">लेखनी</Link>
        <span className="focus-divider" aria-hidden="true" />
        <Link to={`/user/${post.author.id}`} className="focus-author">
          {post.author.avatar_url ? (
            <img src={mediaUrl(post.author.avatar_url)} alt="" />
          ) : (
            <span className="avatar-sm">{initials(authorName)}</span>
          )}
          <span className="focus-author-name">{authorName}</span>
        </Link>
        <div className="focus-spacer" />
        {user ? (
          <div className="focus-account" ref={menuRef}>
            <button
              type="button"
              className="focus-avatar"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="खाता मेनू"
            >
              {user.avatar_url ? (
                <img src={mediaUrl(user.avatar_url)} alt="" />
              ) : (
                <span>{initials(user.full_name || user.username)}</span>
              )}
            </button>
            {menuOpen && (
              /* A group, not a menu: nothing here moves between items with the arrow keys, and
                 role="menu" tells a screen reader to try. */
              <div className="focus-menu" role="group" aria-label="खाता मेनू">
                <Link to="/new-story" onClick={closeMenu}>नई रचना</Link>
                <Link to="/stories" onClick={closeMenu}>मेरी रचनाएँ</Link>
                <Link to="/bookmarks" onClick={closeMenu}>पढ़ने की सूची</Link>
                <Link to={`/user/${user.id}`} onClick={closeMenu}>मेरी प्रोफ़ाइल</Link>
                <button type="button" onClick={handleLogout}>साइन आउट</button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="focus-signin">साइन इन</Link>
        )}
        <button
          type="button"
          className={`focus-bookmark${saved ? ' saved' : ''}`}
          onClick={onBookmark}
          title={saved ? 'पढ़ने की सूची से हटाएँ' : 'पढ़ने की सूची में सहेजें'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z"
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {saved ? 'सहेजा गया' : 'सहेजें'}
        </button>
      </div>
    </header>
  );
};

export default FocusHeader;
