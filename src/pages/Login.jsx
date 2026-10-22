import React, { useEffect, useState } from 'react';
import { getEnv } from '../utils/env';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../brand';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import './Auth.css';

const Login = () => {
  const { isAuthenticated, handleGoogleCallback, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isRegister = location.pathname === '/register';
  // After signing in, send readers back to the story they came from.
  const rawRedirect = searchParams.get('redirect');
  const redirectTo =
    rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : '/';
  const [form, setForm] = useState({ email: '', password: '', username: '', full_name: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [gsiReady, setGsiReady] = useState(
    () => !!(window.google && window.google.accounts && window.google.accounts.id)
  );

  useEffect(() => {
    updateMetaTags({ title: isRegister ? 'खाता बनाएँ' : 'साइन इन', type: 'website', noindex: true });
    return () => resetMetaTags();
  }, [isRegister]);

  // Load the Google sign-in script only on this page, and only once.
  useEffect(() => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      setGsiReady(true);
      return undefined;
    }
    let script = document.querySelector('script[data-gsi]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gsi', 'true');
      document.body.appendChild(script);
    }
    const onLoad = () => setGsiReady(true);
    script.addEventListener('load', onLoad);
    return () => script.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, navigate, redirectTo]);

  useEffect(() => {
    try {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: getEnv('REACT_APP_GOOGLE_CLIENT_ID'),
          callback: handleGoogleCallback,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Failed to initialize Google Sign-In:', e);
    }
  }, [handleGoogleCallback, gsiReady]);

  const onGoogleClick = () => {
    setError('');
    if (!(window.google && window.google.accounts && window.google.accounts.id)) {
      setError('गूगल (Google) अभी लोड हो रहा है, कृपया कुछ क्षण रुकें');
      return;
    }
    window.google.accounts.id.prompt((notification) => {
      const blocked =
        (typeof notification.isNotDisplayed === 'function' && notification.isNotDisplayed()) ||
        (typeof notification.isSkippedMoment === 'function' && notification.isSkippedMoment());
      if (blocked) {
        setError('गूगल (Google) साइन इन नहीं खुल सका। कृपया ईमेल से साइन इन करें, या पॉप-अप (pop-up) की अनुमति दें।');
      }
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = isRegister
      ? await register(form.email, form.password, form.username, form.full_name)
      : await login(form.email, form.password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'कुछ गलत हुआ');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-title">{isRegister ? 'लेखनी पर लिखना शुरू करें' : `${BRAND.name} में साइन इन`}</h1>
        <p className="auth-subtitle">हिंदी में अपनी रचनाएँ प्रकाशित करें। लेख कृत्रिम बुद्धिमत्ता से नहीं लिखे जाते।</p>
        <button
          type="button"
          className="auth-google"
          onClick={onGoogleClick}
        >
          गूगल (Google) से जारी रखें
        </button>
        <div className="auth-or">या</div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={onSubmit}>
          {isRegister && (
            <>
              <label>
                पूरा नाम
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                उपयोगकर्ता नाम
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  required
                />
              </label>
            </>
          )}
          <label>
            ईमेल
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label>
            पासवर्ड
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              maxLength={128}
              required
            />
          </label>
          <button type="submit" className="auth-button" disabled={submitting}>
            {submitting ? 'रुकिए…' : isRegister ? 'खाता बनाएँ' : 'साइन इन'}
          </button>
        </form>
        <p className="auth-footer">
          {isRegister ? (
            <>पहले से खाता है? <Link to={`/login${location.search}`}>साइन इन</Link></>
          ) : (
            <>नए हैं? <Link to={`/register${location.search}`}>शुरू करें</Link></>
          )}
        </p>
      </div>
    </div>
  );
};

export default Login;
