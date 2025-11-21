import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const { isAuthenticated, handleGoogleCallback } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    let isMounted = true;
    
    if (isAuthenticated && isMounted) {
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        navigate(redirectPath.replace('#comments', ''));
      } else {
        navigate('/');
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, navigate]);

  // Initialize Google Sign-In
  useEffect(() => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { theme: 'outline', size: 'large', text: 'continue_with' }
      );
    }
  }, [handleGoogleCallback]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Continue with Google to access your account.</p>
        <div id="google-signin-button"></div>
      </div>
    </div>
  );
};

export default Login;

