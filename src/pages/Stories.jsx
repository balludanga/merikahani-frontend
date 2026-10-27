import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags } from '../utils/seo';
import { formatDate } from '../utils/format';
import StoryCard from '../components/StoryCard';
import './Home.css';

const Stories = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('published');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchPosts();
  }, [authLoading, isAuthenticated, tab]);

  const fetchPosts = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const published = tab === 'published' ? 1 : 0;
      const response = await postsAPI.getMine({ published });
      setPosts(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch my posts:', error);
      // "You have written nothing" and "the list did not arrive" must not look the same here.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateMetaTags({
      title: 'मेरी रचनाएँ',
      description: 'लेखनी पर आपके ड्राफ्ट और प्रकाशित रचनाएँ।',
      type: 'website',
      noindex: true,
    });
  }, []);

  return (
    <div className="layout">
      <div className="layout-main">
        <div className="feed-tabs">
          <button
            type="button"
            className={tab === 'published' ? 'active' : ''}
            onClick={() => setTab('published')}
          >
            प्रकाशित
          </button>
          <button
            type="button"
            className={tab === 'drafts' ? 'active' : ''}
            onClick={() => setTab('drafts')}
          >
            ड्राफ्ट
          </button>
        </div>

        {loading || authLoading ? (
          <div className="page-loading">लोड हो रहा है…</div>
        ) : failed ? (
          <p className="empty-state">
            आपकी रचनाएँ लोड नहीं हो सकीं।{' '}
            <button type="button" onClick={fetchPosts}>फिर कोशिश करें</button>।
          </p>
        ) : posts.length === 0 ? (
          <p className="empty-state">
            {tab === 'published'
              ? 'अभी कोई प्रकाशित रचना नहीं। '
              : 'अभी कोई ड्राफ्ट नहीं। '}
            <Link to="/new-story">लिखना शुरू करें</Link>।
          </p>
        ) : tab === 'published' ? (
          posts.map((post) => <StoryCard key={post.id} post={post} />)
        ) : (
          posts.map((post) => (
            <article key={post.id} className="draft-row">
              <div>
                <h2>{post.title}</h2>
                <span className="draft-meta">
                  पिछला बदलाव: {formatDate(post.updated_at)}
                </span>
              </div>
              <div className="draft-actions">
                <Link to={`/edit/${post.id}`}>संपादित करें</Link>
                <Link to={`/post/${post.slug}`}>देखें</Link>
              </div>
            </article>
          ))
        )}
      </div>
      <aside className="layout-aside">
        <h3 className="aside-title">नमस्ते, {user?.full_name || user?.username || 'लेखक'} 👋</h3>
        <p className="aside-note">
          यहाँ आपकी सभी रचनाएँ हैं — प्रकाशित और ड्राफ्ट दोनों।
          लेखनी आपके शब्दों को नहीं लिखती; आप लिखते हैं।
        </p>
      </aside>
    </div>
  );
};

export default Stories;
