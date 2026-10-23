import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import PostView from './pages/PostView';
import { NotFound } from './components/NotFound';
import SlowServerNotice from './components/SlowServerNotice';
import { pageview } from './utils/analytics';
import { getEnv } from './utils/env';
import './App.css';

// Rare / heavy routes load on demand. Editor pulls in Quill, so writers pay
// for it only when they open the editor; readers never download it.
const Editor = lazy(() => import('./pages/Editor'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Stories = lazy(() => import('./pages/Stories'));
const Search = lazy(() => import('./pages/Search'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const Highlights = lazy(() => import('./pages/Highlights'));
const Ops = lazy(() => import('./pages/Ops'));

// The owner's status page lives at an address only the owner knows, set at build time in
// REACT_APP_OPS_PATH (never committed). The server is what really guards it: anyone else gets
// a "not found". Without a valid value the page is not routed at all.
const OPS_PATH = String(getEnv('REACT_APP_OPS_PATH', '')).replace(/^\/+|\/+$/g, '');
const OPS_ROUTE = /^[A-Za-z0-9_-]{20,}$/.test(OPS_PATH) ? `/${OPS_PATH}` : null;
const InfoPage = lazy(() => import('./pages/InfoPage'));
const BlogIndex = lazy(() => import('./pages/Blog').then((m) => ({ default: m.BlogIndex })));
const GuidePage = lazy(() => import('./pages/Blog').then((m) => ({ default: m.GuidePage })));

// Every navigation starts at the top of the page — otherwise a new story
// opens half-way down the previous one.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="notfound-page">
        <h1>कुछ गलत हो गया</h1>
        <p>पृष्ठ दिखाते समय कोई दिक्कत आई। कृपया पृष्ठ दोबारा लोड करें।</p>
        <button type="button" className="landing-cta" onClick={() => window.location.reload()}>
          पृष्ठ दोबारा लोड करें
        </button>
      </div>
    );
  }
}

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
      <SlowServerNotice />
      {/* Reading pages manage their own distraction-free header */}
      {!isEditor && !isReading && <Navbar landing={isLanding} />}
      <Suspense fallback={<div className="page-loading" role="status">लोड हो रहा है…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login />} />
          <Route path="/new-story" element={<Editor />} />
          <Route path="/edit/:id" element={<Editor />} />
          <Route path="/post/:slug" element={<PostView />} />
          <Route path="/user/:userId" element={<UserProfile />} />
          <Route path="/settings/profile" element={<EditProfile />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/highlights" element={<Highlights />} />
          {OPS_ROUTE && <Route path={OPS_ROUTE} element={<Ops />} />}
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
      </Suspense>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </Router>
  </AuthProvider>
);

export default App;
