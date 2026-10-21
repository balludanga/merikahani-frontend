import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
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
import Footer from './components/Footer';
import { pageview } from './utils/analytics';
import './App.css';

// Every navigation starts at the top of the page — otherwise a new story
// opens half-way down the previous one.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const NotFound = () => (
  <div className="notfound-page">
    <div className="notfound-mark" aria-hidden="true">
      <svg viewBox="0 0 280 280" width="120" height="120">
        <circle cx="140" cy="140" r="120" className="art-disc" />
        <text x="140" y="178" textAnchor="middle" className="art-glyph">अ</text>
      </svg>
    </div>
    <h1>यह पृष्ठ नहीं मिला</h1>
    <p>शायद रचना हटा दी गई है, या पता (link) अधूरा रह गया है।</p>
    <Link to="/" className="landing-cta">मुख्य पृष्ठ पर जाएँ</Link>
    <Footer />
  </div>
);

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
      <ScrollToTop />
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
        <Route path="*" element={<NotFound />} />
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
