import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postsAPI, usersAPI, followsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../brand';
import Footer from '../components/Footer';
import { updateMetaTags, generateHomepageStructuredData } from '../utils/seo';
import { formatDate, readingMinutes, excerpt, initials } from '../utils/format';
import StoryPlayer from '../components/StoryPlayer';
import './Home.css';
import { mediaUrl } from '../utils/media';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [feed, setFeed] = useState('for-you');
  const [spotlight, setSpotlight] = useState(null);
  const requestId = useRef(0);

  const fetchPosts = useCallback(async (selectedFeed = feed) => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setFailed(false);
    try {
      const params = { limit: 12 };
      if (selectedFeed === 'following') params.feed = 'following';
      const response = await postsAPI.getAll(params);
      if (activeRequest !== requestId.current) return;
      setPosts(response.data);
      updateMetaTags({
        title: `${BRAND.name} — ${BRAND.tagline}`,
        description: BRAND.description,
        keywords: 'हिंदी, लेखन, कहानी, कविता, निबंध, लेखनी',
        type: 'website',
      });
      generateHomepageStructuredData(response.data);
    } catch (error) {
      if (activeRequest !== requestId.current) return;
      // eslint-disable-next-line no-console
      console.error('Failed to fetch posts:', error);
      setFailed(true);
    } finally {
      if (activeRequest === requestId.current) setLoading(false);
    }
  }, [feed]);

  useEffect(() => {
    if (!isAuthenticated) {
      requestId.current += 1;
      // Logged-out visitors see no stories here — only the invitation to join.
      setPosts([]);
      setLoading(false);
      generateHomepageStructuredData([]);
      return undefined;
    }
    fetchPosts(feed);
    return () => {
      requestId.current += 1;
    };
  }, [feed, isAuthenticated, fetchPosts]);

  const hero = posts[0];
  const trending = posts.slice(1, 5);

  // Spotlight: the strongest trending voice that is not the hero author.
  useEffect(() => {
    if (posts.length < 2) {
      setSpotlight(null);
      return;
    }
    const pick = posts
      .slice(1)
      .filter((p) => p.author?.id !== hero?.author?.id)
      .sort((a, b) => (b.clap_count || 0) - (a.clap_count || 0))[0];
    if (!pick?.author?.id) {
      setSpotlight(null);
      return;
    }
    usersAPI
      .getById(pick.author.id)
      .then((response) => setSpotlight(response.data))
      .catch(() => setSpotlight(null));
  }, [posts]);

  const toggleSpotlightFollow = async () => {
    if (!spotlight) return;
    try {
      const response = spotlight.is_following
        ? await followsAPI.unfollow(spotlight.id)
        : await followsAPI.follow(spotlight.id);
      setSpotlight((prev) => ({
        ...prev,
        is_following: response.data.following,
        follower_count: response.data.follower_count,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Follow failed:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="landing">
        <div className="landing-board">
          <section className="landing-copy">
            <h1>{BRAND.tagline}</h1>
            <p>
              लेखनी हिंदी लेखकों के लिए एक साफ़, लंबी-फ़ॉर्म जगह है — पढ़ें और लिखें।
              आपकी कलम आपकी है। यहाँ लेख कृत्रिम बुद्धिमत्ता से नहीं बनते।
            </p>
            <div className="landing-actions">
              <button type="button" className="landing-cta" onClick={() => navigate('/register')}>
                मुफ़्त खाता बनाएँ
              </button>
              <Link to="/login" className="join-signin">साइन इन करें</Link>
            </div>
            <div className="landing-art" aria-hidden="true">
              <svg viewBox="0 0 280 280" width="180" height="180">
                <circle cx="140" cy="140" r="120" className="art-disc" />
                <text x="140" y="170" textAnchor="middle" className="art-glyph">अ</text>
              </svg>
            </div>
          </section>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-top">
        <div>
          <h1 className="dash-title">आज का चुनाव</h1>
          <p className="dash-sub">सर्वश्रेष्ठ हिंदी रचनाएँ — एक ही नज़र में</p>
        </div>
        <div className="dash-tabs">
          <button
            type="button"
            className={feed === 'for-you' ? 'active' : ''}
            onClick={() => setFeed('for-you')}
          >
            आपके लिए
          </button>
          <button
            type="button"
            className={feed === 'following' ? 'active' : ''}
            onClick={() => setFeed('following')}
          >
            फ़ॉलोइंग
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">लोड हो रहा है…</div>
      ) : failed ? (
        <p className="empty-state">
          रचनाएँ लोड नहीं हो सकीं।{' '}
          <button type="button" onClick={() => fetchPosts(feed)}>फिर कोशिश करें</button>।
        </p>
      ) : posts.length === 0 ? (
        <div className="dash-empty">
          {feed === 'following' ? (
            <>आपकी फ़ॉलोइंग सूची अभी खाली है। <Link to="/search">रचनाएँ देखें</Link> और किसी लेखक को फ़ॉलो करें।</>
          ) : (
            'अभी कोई रचना नहीं — लिखना शुरू करें।'
          )}
        </div>
      ) : (
        <div className="bento">
          {hero && (
            <article
              className="bento-hero"
              onClick={() => navigate(`/post/${hero.slug}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/post/${hero.slug}`);
                }
              }}
            >
              {hero.cover_image && <img className="hero-img" src={hero.cover_image} alt="" />}
              <div className="hero-overlay" aria-hidden="true" />
              <div className="hero-body">
                <span className="hero-chip">सुर्खी</span>
                <h2 className="hero-title">{hero.title}</h2>
                <p className="hero-excerpt">{excerpt(hero.content, 170)}</p>
                <div className="hero-meta">
                  {hero.author?.avatar_url ? (
                    <img src={mediaUrl(hero.author.avatar_url)} alt="" />
                  ) : (
                    <span className="hero-avatar">
                      {initials(hero.author?.full_name || hero.author?.username || '')}
                    </span>
                  )}
                  <div>
                    <strong>{hero.author?.full_name || hero.author?.username}</strong>
                    <span>
                      {formatDate(hero.created_at)} · {readingMinutes(hero.content)} मिनट पढ़ें
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )}

          <aside className="bento-trending">
            <h3 className="bento-label">ट्रेंडिंग</h3>
            <ol className="trend-list">
              {trending.map((post, index) => (
                <li
                  key={post.id}
                  onClick={() => navigate(`/post/${post.slug}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/post/${post.slug}`)}
                >
                  <span className="trend-num">{`0${index + 1}`}</span>
                  <div className="trend-copy">
                    <h4>{post.title}</h4>
                    <span className="trend-meta">
                      {post.author?.full_name || post.author?.username} ·{' '}
                      {readingMinutes(post.content)} मिनट
                    </span>
                  </div>
                </li>
              ))}
              {trending.length === 0 && <li className="trend-none">अभी और रचनाएँ नहीं।</li>}
            </ol>
          </aside>

          <div className="bento-bottom">
            <StoryPlayer stories={posts} />
            {spotlight && (
              <article className="bento-card bento-writer">
                <span className="bento-label">विशेष लेखक</span>
                <div className="writer-id">
                  {spotlight.avatar_url ? (
                    <img src={mediaUrl(spotlight.avatar_url)} alt="" width="46" height="46" loading="lazy" decoding="async" />
                  ) : (
                    <span className="writer-avatar">
                      {initials(spotlight.full_name || spotlight.username || '')}
                    </span>
                  )}
                  <div>
                    <h3>{spotlight.full_name || spotlight.username}</h3>
                    <p>{spotlight.bio || 'इस लेखक की रचनाएँ पढ़ें — नई आवाज़, नई कलम।'}</p>
                  </div>
                </div>
                <div className="writer-foot">
                  <span>{spotlight.follower_count || 0} फ़ॉलोअर्स</span>
                  <button
                    type="button"
                    className={spotlight.is_following ? 'following' : ''}
                    onClick={toggleSpotlightFollow}
                  >
                    {spotlight.is_following ? 'फ़ॉलो हो रहे हैं ✓' : 'फ़ॉलो करें'}
                  </button>
                </div>
              </article>
            )}

          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default Home;
