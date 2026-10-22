import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bookmarksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags } from '../utils/seo';
import StoryCard from '../components/StoryCard';
import './Home.css';

const Bookmarks = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchBookmarks();
  }, [authLoading, isAuthenticated]);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const response = await bookmarksAPI.list();
      setPosts(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateMetaTags({
      title: 'पढ़ने की सूची',
      description: 'लेखनी पर आपके द्वारा सहेजी गई रचनाएँ।',
      type: 'website',
      noindex: true,
    });
  }, []);

  return (
    <div className="layout">
      <div className="layout-main">
        <h1 className="list-heading">पढ़ने की सूची</h1>
        {loading || authLoading ? (
          <div className="page-loading">लोड हो रहा है…</div>
        ) : posts.length === 0 ? (
          <p className="empty-state">
            अभी कुछ सहेजा नहीं गया। किसी रचना पर <strong>सहेजें</strong> दबाकर यहाँ जोड़ें।{' '}
            <Link to="/">रचनाएँ देखें</Link>।
          </p>
        ) : (
          posts.map((post) => <StoryCard key={post.id} post={post} />)
        )}
      </div>
      <aside className="layout-aside">
        <h3 className="aside-title">बाद के लिए सहेजें</h3>
        <p className="aside-note">
          जब पढ़ने का समय न हो, रचना को सहेज लें — वह यहाँ इंतज़ार करेगी।
        </p>
      </aside>
    </div>
  );
};

export default Bookmarks;
