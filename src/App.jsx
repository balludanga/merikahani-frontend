import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Editor from './pages/Editor';
import PostView from './pages/PostView';
import UserProfile from './pages/UserProfile';
import { initGA, pageview } from './utils/analytics';
import './App.css';

// Component to handle page tracking
const AppContent = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    pageview(location.pathname + location.search);
  }, [location]);

  return (
    <div className="app">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
        <Route path="/new-story" element={<Editor />} />
        <Route path="/edit/:id" element={<Editor />} />
        <Route path="/post/:slug" element={<PostView />} />
        <Route path="/user/:userId" element={<UserProfile />} />
      </Routes>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    // Initialize Google Analytics
    initGA();
  }, []);

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;