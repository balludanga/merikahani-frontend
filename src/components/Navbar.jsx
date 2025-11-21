import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          कहानी <span className="navbar-logo-small">घर घर की</span>
        </Link>
        <div className="navbar-menu">
          {isAuthenticated ? (
            <>
              <Link to="/new-story" className="navbar-link">
                Write
              </Link>
              <Link to={`/user/${user.id}`} className="navbar-link">
                {user.full_name || user.username}
              </Link>
              <button onClick={handleLogout} className="navbar-button">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-button-primary">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

