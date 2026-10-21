import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Editor from './pages/Editor';
import PostView from './pages/PostView';
import UserProfile from './pages/UserProfile';
import Stories from './pages/Stories';
import Search from './pages/Search';
import Bookmarks from './pages/Bookmarks';
import InfoPage from './pages/InfoPage';
import { BlogIndex, GuidePage } from './pages/Blog';
import { pageview } from './utils/analytics';
import './App.css';

const AppContent = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const isEditor = location.pathname.startsWith('/new-story') || location.pathname.startsWith('/edit');
  const isReading = location.pathname.startsWith('/post/');
  const isLanding = location.pathname === '/' && !isAuthenticated;

  useEffect(() => {
    pageview(location.pathname + location.search);
  }, [location]);

  return (
    <div className="app">
      {/* Reading pages manage their own distraction-free header */}
      {!isEditor && !isReading && <Navbar landing={isLanding} />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
        <Route path="/new-story" element={<Editor />} />
        <Route path="/edit/:id" element={<Editor />} />
        <Route path="/post/:slug" element={<PostView />} />
        <Route path="/user/:userId" element={<UserProfile />} />
        <Route path="/stories" element={<Stories />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/search" element={<Search />} />
        <Route path="/topic/:topic" element={<Search />} />
        <Route path="/tag/:slug" element={<Search />} />
        <Route path="/about" element={<InfoPage page="about" />} />
        <Route path="/help" element={<InfoPage page="help" />} />
        <Route path="/rules" element={<InfoPage page="rules" />} />
        <Route path="/privacy" element={<InfoPage page="privacy" />} />
        <Route path="/terms" element={<InfoPage page="terms" />} />
        <Route path="/status" element={<InfoPage page="status" />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<GuidePage />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  </AuthProvider>
);

export default App;
