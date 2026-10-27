import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postsAPI, usersAPI, followsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../brand';
import Footer from '../components/Footer';
import { updateMetaTags, generateHomepageStructuredData } from '../utils/seo';
import { formatDate, readingMinutes, excerpt, initials } from '../utils/format';
import { useNarrationPlayer } from '../utils/narrationPlayer';
import './Home.css';
import { mediaUrl } from '../utils/media';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState('for-you');
  const [spotlight, setSpotlight] = useState(null);
  // The audio card: which story it is on, and the player that reads it (server voice, else the browser's).
  const [current, setCurrent] = useState(0);
  const [audioState, player] = useNarrationPlayer();

  useEffect(() => {
    if (!isAuthenticated) {
      // Logged-out visitors see no stories here — only the invitation to join.
      setPosts([]);
      setLoading(false);
      generateHomepageStructuredData([]);
      return undefined;
    }
    fetchPosts();
    return undefined;
  }, [feed, isAuthenticated]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = { limit: 12 };
      if (feed === 'following') params.feed = 'following';
      const response = await postsAPI.getAll(params);
      setPosts(response.data);
      updateMetaTags({
        title: `${BRAND.name} — ${BRAND.tagline}`,
        description: BRAND.description,
        keywords: 'हिंदी, लेखन, कहानी, कविता, निबंध, लेखनी',
        type: 'website',
      });
      generateHomepageStructuredData(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const hero = posts[0];
  const trending = posts.slice(1, 5);

  // A new list of stories (another feed): the audio card starts again from the first one.
  useEffect(() => {
    player.stop();
    setCurrent(0);
  }, [posts]);

  // The story the audio card is on, and the one after it. Asking the server about both ahead of the
  // tap means pressing "next" can start at once.
  const audioStory = posts[current] || posts[0];
  const nextStory = posts.length > 1 ? posts[(current + 1) % posts.length] : null;
  useEffect(() => {
    if (audioStory) player.warm(audioStory.id);
    if (nextStory) player.warm(nextStory.id);
  }, [audioStory && audioStory.id, nextStory && nextStory.id]);

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

  const audioActive = audioState.phase !== 'idle';

  const toggleAudio = () => {
    if (audioActive) {
      player.stop();
      return;
    }
    if (audioStory) player.play(audioStory);
  };

  // "Next": move the card to the next story; if it was reading, carry on reading the next one.
  // (It does not move on by itself when a story ends: each new narration spends part of a small
  // daily allowance, so listeners choose.)
  const playNext = () => {
    if (!nextStory) return;
    const wasActive = audioActive;
    const index = (current + 1) % posts.length;
    player.stop();
    setCurrent(index);
    if (wasActive) player.play(nextStory);
  };

  const audioLabel = () => {
    if (audioState.phase === 'playing') return '⏹ रोकें';
    if (audioState.phase === 'preparing') {
      return `⏳ आवाज़ तैयार हो रही है…${audioState.progress ? ` ${audioState.progress}%` : ''}`;
    }
    return '▶ सुनें';
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
      ) : posts.length === 0 ? (
        <div className="dash-empty">
          {feed === 'following' ? (
            <>अभी आप किसी को फ़ॉलो नहीं करते — किसी रचना पर लेखक का नाम दबाकर <strong>फ़ॉलो करें</strong>।</>
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

            <section className="bento-card bento-audio">
              <div className={`eq${audioState.phase === 'playing' ? ' on' : ''}`} aria-hidden="true">
                <span /><span /><span /><span /><span />
              </div>
              <h3>लेखनी ऑडियो</h3>
              <p>
                {audioStory
                  ? `${audioActive ? 'अभी सुन रहे हैं' : 'सुनें'}: ${audioStory.title}`
                  : 'प्रस्तुत रचना उपलब्ध नहीं।'}
              </p>
              {posts.length > 1 && <span className="audio-count">{current + 1} / {posts.length}</span>}
              <div className="audio-actions">
                <button type="button" className="audio-btn" onClick={toggleAudio} disabled={!audioStory}>
                  {audioLabel()}
                </button>
                {nextStory && (
                  <button
                    type="button"
                    className="audio-next"
                    onClick={playNext}
                    title={`अगली रचना: ${nextStory.title}`}
                    aria-label={`अगली रचना सुनें: ${nextStory.title}`}
                  >
                    अगली रचना ⏭
                  </button>
                )}
              </div>
              {audioState.error && <span className="audio-note" role="status">{audioState.error}</span>}
            </section>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default Home;
