import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [error, setError] = useState('');
  const { googleLogin, isAuthenticated } = useAuth();
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
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        { theme: 'outline', size: 'large', text: 'signin_with' }
      );
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: response.credential }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.setItem('token', data.access_token);
        // Update auth context
        await googleLogin(data.access_token);
        navigate('/');
      } else {
        setError(data.detail || 'Google login failed');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Google login error:', err);
      setError('Google login failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-title">Sign in or Sign up</h1>
        <p className="auth-subtitle">Continue with Google to access your account.</p>
        <div id="google-signin-button"></div>
        {error && <div className="auth-error">{error}</div>}
      </div>
    </div>
  );
};

export default Login;

