import React, { useEffect, useRef, useState } from 'react';
import { getEnv } from '../utils/env';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../brand';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import './Auth.css';

// Google refuses sign-in inside the in-app browsers of social apps (disallowed_useragent).
const isInAppBrowser = () =>
  /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|Twitter|MicroMessenger|WhatsApp|; wv\)/i.test(navigator.userAgent || '');

const Login = () => {
  const { isAuthenticated, handleGoogleAccessToken, login, register } = useAuth();
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

  const tokenClientRef = useRef(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Pop-up sign-in: started directly by the button tap, so it works on phones where
  // Google's One Tap prompt is often not shown at all.
  useEffect(() => {
    if (!gsiReady || !(window.google && window.google.accounts && window.google.accounts.oauth2)) return;
    // No client id (a local build without it) or a refused setup must never take
    // the whole sign-in page down: email sign-in keeps working, Google says why.
    const clientId = getEnv('REACT_APP_GOOGLE_CLIENT_ID');
    if (!clientId) return;
    try {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response) => {
          if (!response || response.error || !response.access_token) {
            setError('गूगल (Google) से साइन इन नहीं हो सका। कृपया दोबारा कोशिश करें, या ईमेल से साइन इन करें।');
            return;
          }
          setGoogleBusy(true);
          const result = await handleGoogleAccessToken(response.access_token);
          setGoogleBusy(false);
          if (!result.success) setError(result.error);
        },
        error_callback: (err) => {
          // Closing the window is the user's own choice, not an error.
          if (err && err.type === 'popup_closed') return;
          setError('गूगल (Google) की खिड़की नहीं खुल सकी। कृपया पॉप-अप (pop-up) की अनुमति दें, या ईमेल से साइन इन करें।');
        },
      });
    } catch (error) {
      tokenClientRef.current = null;
    }
  }, [gsiReady, handleGoogleAccessToken]);

  const onGoogleClick = () => {
    setError('');
    if (isInAppBrowser()) {
      setError('यह ऐप का भीतरी ब्राउज़र है, जिसमें गूगल (Google) साइन इन नहीं चलता। कृपया पेज को क्रोम (Chrome) या सफ़ारी (Safari) में खोलें, या ईमेल से साइन इन करें।');
      return;
    }
    if (!getEnv('REACT_APP_GOOGLE_CLIENT_ID')) {
      setError('इस कंप्यूटर पर गूगल (Google) साइन इन चालू नहीं है। कृपया ईमेल से साइन इन करें।');
      return;
    }
    if (!tokenClientRef.current) {
      setError('गूगल (Google) अभी लोड हो रहा है, कृपया कुछ क्षण रुकें');
      return;
    }
    // Must run synchronously inside the tap handler, or the browser blocks the pop-up.
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
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
          disabled={googleBusy}
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
