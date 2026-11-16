import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authAPI } from '../services/api';
import { trackEvent } from '../utils/analytics';
import { getEnv } from '../utils/env';
import { errorText } from '../utils/authErrors';
import { RENEW_CHECK_EVERY_MS, renewalDue } from '../utils/session';

const AuthContext = createContext();


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // The sign-in is over (or was never good): forget it here. Nothing is sent to the server, because
  // it is the server that said so.
  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  // The reader pressed "sign out". Sign-ins last weeks now, so the server is told to end this device's
  // sign-in as well (other devices stay signed in); if it cannot be reached the reader is still signed
  // out here.
  const logout = useCallback(() => {
    // Track logout event
    trackEvent('logout');

    const used = localStorage.getItem('token');
    clearSession();
    if (used) {
      authAPI.logout(used).catch(() => {});
    }
  }, [clearSession]);

  const fetchUser = useCallback(async () => {
    // Network errors, timeouts and 5xx (e.g. Render cold start) must not sign
    // the reader out — only a real 401 means the token is bad.
    const RETRIES = 3;
    const RETRY_DELAY_MS = 4000;
    try {
      for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data);
          return;
        } catch (error) {
          if (error.response?.status === 401) {
            clearSession();
            return;
          }
          // eslint-disable-next-line no-console
          console.error('Failed to fetch user:', error);
          if (attempt === RETRIES) return;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  // Any call that comes back 401 means the session is over. Whichever one found it, the
  // answer is the same: drop it, so no page is left showing a signed-in view that cannot
  // save anything.
  useEffect(() => {
    const onSignedOut = () => clearSession();
    window.addEventListener('lekhani:signed-out', onSignedOut);
    return () => window.removeEventListener('lekhani:signed-out', onSignedOut);
  }, [clearSession]);

  // Stay signed in. A sign-in lasts weeks and is swapped for a fresh one once it is a day old: right
  // away when the app opens, then every half hour and whenever the tab comes back to the front, so a
  // tab left open for days keeps its sign-in too. A failed renewal (offline, the server waking up)
  // is simply tried again at the next check; a real 401 is announced by the api layer.
  const userId = user ? user.id : null;
  useEffect(() => {
    if (!userId) return undefined;
    let running = false;
    const renew = async () => {
      const used = localStorage.getItem('token');
      if (running || !used || !renewalDue(used)) return;
      running = true;
      try {
        const { data } = await authAPI.refresh();
        // Keep the new token only if the reader did not sign out or in again while it was on its way.
        if (data && data.access_token && localStorage.getItem('token') === used) {
          localStorage.setItem('token', data.access_token);
        }
      } catch (error) {
        // Not now; the next check tries again.
      } finally {
        running = false;
      }
    };
    renew();
    const timer = setInterval(renew, RENEW_CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') renew();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  // Handle Google OAuth response from popup
  const handleGoogleCallback = async (response) => {
    await handleGoogleCredential(response.credential);
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      // Set user directly from login response, don't fetch again
      setUser(userData);
      setLoading(false);
      
      // Track login event
      trackEvent('login', {
        method: 'email',
        user_id: userData.id
      });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: errorText(error, 'साइन इन नहीं हो सका'),
      };
    }
  };

  // Google sign-in: `payload` is { token } (ID token) or { access_token } (pop-up flow).
  const signInWithGoogle = async (payload) => {
    try {
      const apiUrl = getEnv('REACT_APP_API_URL', 'http://localhost:8000/api');
      const res = await fetch(`${apiUrl.replace(/\/?$/, '')}/auth/google-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        // The answer already carries the account: use it now, like the email sign-in does, so the
        // reader is not held on the login page for a second /auth/me round trip.
        if (data.user) {
          setUser(data.user);
          setLoading(false);
        }

        // Track Google login event
        trackEvent('login', {
          method: 'google'
        });
        
        return { success: true };
      } else {
        return { success: false, error: typeof data.detail === 'string' && data.detail ? data.detail : 'गूगल (Google) से साइन इन नहीं हो सका' };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Google login error:', err);
      return { success: false, error: 'गूगल (Google) से साइन इन नहीं हो सका' };
    }
  };

  const handleGoogleCredential = (credential) => signInWithGoogle({ token: credential });
  const handleGoogleAccessToken = (accessToken) => signInWithGoogle({ access_token: accessToken });

  const register = async (email, password, username, fullName) => {
    try {
      await authAPI.register({
        email,
        password,
        username,
        full_name: fullName,
      });
      // Auto-login after registration
      const loginResponse = await authAPI.login({ email, password });
      const { access_token, user: userData } = loginResponse.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      // Set user directly from login response, don't fetch again
      setUser(userData);
      setLoading(false);
      
      // Track registration event
      trackEvent('sign_up', {
        method: 'email',
        user_id: userData.id
      });
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: errorText(error, 'खाता नहीं बन सका, कृपया दोबारा कोशिश करें'),
      };
    }
  };


  // After the writer edits their profile: show the new name / photo / colour at once.
  const updateUser = useCallback((changes) => setUser((prev) => (prev ? { ...prev, ...changes } : prev)), []);

  const value = {
    user,
    updateUser,
    loading,
    login,
    handleGoogleCredential,
    handleGoogleAccessToken,
    handleGoogleCallback,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

