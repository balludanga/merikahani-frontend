import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authAPI } from '../services/api';
import { trackEvent } from '../utils/analytics';
import { getEnv } from '../utils/env';

const AuthContext = createContext();

// FastAPI sends `detail` as a string for our errors but as an array of objects
// for validation errors (422); rendering that array would crash the page.
const errorText = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (error.response?.status === 422) return 'दर्ज की गई जानकारी सही नहीं है। पासवर्ड कम से कम ८ अक्षरों का रखें।';
  return typeof detail === 'string' && detail ? detail : fallback;
};

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

  const logout = useCallback(() => {
    // Track logout event
    trackEvent('logout');
    
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

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
            logout();
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
  }, [logout]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

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

  const googleLogin = async (accessToken) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    return { success: true };
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
    googleLogin,
    handleGoogleCredential,
    handleGoogleAccessToken,
    handleGoogleCallback,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

