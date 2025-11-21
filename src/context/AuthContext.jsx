import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { authAPI } from '../services/api';

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

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user:', error);
      logout();
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
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  const googleLogin = async (accessToken) => {
    localStorage.setItem('token', accessToken);
    setToken(accessToken);
    return { success: true };
  };

  const handleGoogleCredential = async (credential) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8001';
      const res = await fetch(`${apiUrl}/auth/google-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: credential }),
      });
      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Google login failed' };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Google login error:', err);
      return { success: false, error: 'Google login failed' };
    }
  };

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
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Registration failed',
      };
    }
  };


  const value = {
    user,
    loading,
    login,
    googleLogin,
    handleGoogleCredential,
    handleGoogleCallback,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

