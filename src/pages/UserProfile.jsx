import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { followsAPI, postsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags } from '../utils/seo';
import { formatDate } from '../utils/format';
import { useAccentStyle } from '../utils/accent';
import { topicLabel } from '../brand';
import ProfileHeader from '../components/ProfileHeader';
import ProfileLibrary from '../components/ProfileLibrary';
import { useShare } from '../components/ShareSheet';
import './UserProfile.css';

const TABS = [
  { id: 'stories', label: 'रचनाएँ' },
  { id: 'saved', label: 'पढ़ने की सूची' },
  { id: 'highlights', label: 'हाइलाइट' },
];

const profileRedirect = (location) =>
  `${location.pathname}${location.search}${location.hash}`;

const PostRow = ({ post, pinned }) => (
  <Link to={`/post/${post.slug}`} className={`user-post-item ${pinned ? 'is-pinned' : ''}`}>
    <h3>{pinned && <span className="pin-mark" title="चुनी हुई रचना" aria-label="चुनी हुई रचना">📌</span>}{post.title}</h3>
    {post.subtitle && <p className="post-subtitle">{post.subtitle}</p>}
    <span className="post-date">
      {formatDate(post.created_at)}
      {post.topic && <> · {topicLabel(post.topic)}</>}
      {post.clap_count > 0 && <> · 👏 {post.clap_count}</>}
    </span>
  </Link>
);

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [postsFailed, setPostsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  // 'notfound' for a real 404; 'error' for anything else (network, 5xx, timeout)
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(location.state && location.state.saved ? 'प्रोफ़ाइल सहेज ली गई ✓' : '');
  const [noticeBad, setNoticeBad] = useState(false);

  // The one line this page speaks through. A problem uses the same line and the same timer, but
  // is announced rather than politely reported.
  const say = (text, bad = false) => {
    setNotice(text);
    setNoticeBad(bad);
  };
  const accentStyle = useAccentStyle(profile && profile.accent);
  const profileName = profile ? profile.full_name || profile.username : '';
  const { share: shareProfile, sheet: shareSheet } = useShare({
    url: `${window.location.origin}/user/${userId}`,
    title: profileName,
    text: `${profileName} की रचनाएँ लेखनी पर पढ़ें`,
    heading: 'यह प्रोफ़ाइल साझा करें',
  });

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const fetchProfile = async () => {
    setLoading(true);
    setLoadError(null);
    setPosts([]);
    setPostsFailed(false);
    let profileData;
    try {
      const profileRes = await usersAPI.getById(userId);
      profileData = profileRes.data;
      setProfile(profileData);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch profile:', error);
      setProfile(null);
      setLoadError(error.response?.status === 404 ? 'notfound' : 'error');
      setLoading(false);
      return;
    }

    // A failed posts list must not replace an already-loaded profile.
    try {
      const postsRes = await postsAPI.getByUser(userId, { published: 1 });
      setPosts(postsRes.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch author posts:', error);
      setPostsFailed(true);
    }

    const authorName = profileData.full_name || profileData.username;
    updateMetaTags({
      title: authorName,
      description: `${authorName} लेखनी पर ${profileData.post_count} रचनाएँ लिख चुके हैं। ${profileData.tagline || profileData.bio || ''}`.slice(0, 200),
      keywords: `${authorName}, हिंदी लेखक, लेखनी, ${authorName} की कहानियाँ`,
      image: /^https?:\/\//.test(profileData.avatar_url || '') ? profileData.avatar_url : undefined,
      url: `${window.location.origin}/user/${userId}`,
      type: 'profile',
    });
    setLoading(false);
  };

  const isSelf = user && profile && user.id === profile.id;
  // The reading list and highlights are private: only the writer sees these tabs.
  const requestedTab = searchParams.get('tab');
  const tab = isSelf && TABS.some((t) => t.id === requestedTab) ? requestedTab : 'stories';
  const chooseTab = (id) => setSearchParams(id === 'stories' ? {} : { tab: id }, { replace: true });

  const handleFollow = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(profileRedirect(location))}`);
      return;
    }
    try {
      const response = profile.is_following
        ? await followsAPI.unfollow(profile.id)
        : await followsAPI.follow(profile.id);
      setProfile((prev) => ({
        ...prev,
        is_following: response.data.following,
        follower_count: response.data.follower_count,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Follow failed:', error);
      say('फ़ॉलो नहीं बदल सकी। कृपया फिर कोशिश करें।', true);
    }
  };

  if (loading) {
    return <div className="page-loading">लोड हो रहा है…</div>;
  }

  if (!profile) {
    if (loadError === 'error') {
      return (
        <div className="user-profile">
          <p className="empty-state">
            कोई तकनीकी दिक्कत आई है, लेखक की जानकारी लोड नहीं हो सकी।{' '}
            <button type="button" onClick={fetchProfile}>फिर कोशिश करें</button>
          </p>
        </div>
      );
    }
    return (
      <div className="user-profile">
        <p className="empty-state">यह लेखक नहीं मिला। <Link to="/">मुख्य पृष्ठ पर जाएँ</Link>।</p>
      </div>
    );
  }

  const pinnedIds = profile.pinned_post_ids || [];
  const pinned = pinnedIds.map((id) => posts.find((post) => post.id === id)).filter(Boolean);
  const rest = posts.filter((post) => !pinnedIds.includes(post.id));

  const actions = (
    <>
      {isSelf ? (
        <Link to="/settings/profile" className="follow-btn profile-follow">प्रोफ़ाइल सजाएँ</Link>
      ) : (
        <button
          type="button"
          className={`follow-btn profile-follow ${profile.is_following ? 'following' : ''}`}
          onClick={handleFollow}
        >
          {profile.is_following ? 'फ़ॉलो हो रहे हैं ✓' : 'फ़ॉलो करें'}
        </button>
      )}
      <button type="button" className="profile-share" onClick={shareProfile} title="प्रोफ़ाइल साझा करें" aria-label="प्रोफ़ाइल साझा करें" aria-haspopup="dialog">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
          <path d="M8.3 10.7l7.4-4.2M8.3 13.3l7.4 4.2" />
        </svg>
      </button>
    </>
  );

  return (
    <div className="user-profile" style={accentStyle}>
      <div className="user-profile-container">
        <ProfileHeader profile={profile} actions={actions} />

        {isSelf && (
          <div className="profile-tabs" role="group" aria-label="आपकी सामग्री">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                className={`profile-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => chooseTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab !== 'stories' && (
          <div className="user-posts">
            <ProfileLibrary key={tab} tab={tab} />
          </div>
        )}

        {tab === 'stories' && !postsFailed && pinned.length > 0 && (
          <div className="user-posts user-pinned">
            <h2>चुनिंदा रचनाएँ</h2>
            <div className="user-posts-list">
              {pinned.map((post) => <PostRow key={post.id} post={post} pinned />)}
            </div>
          </div>
        )}

        {tab === 'stories' && (
        <div className="user-posts">
          <h2>{pinned.length > 0 ? 'सभी रचनाएँ' : 'रचनाएँ'}</h2>
          {postsFailed ? (
            <p className="empty-state">
              रचनाएँ लोड नहीं हो सकीं।{' '}
              <button type="button" onClick={fetchProfile}>फिर कोशिश करें</button>।
            </p>
          ) : posts.length === 0 ? (
            <p className="empty-state">
              अभी कोई प्रकाशित रचना नहीं।{' '}
              {isSelf && <Link to="/new-story">लिखना शुरू करें</Link>}
            </p>
          ) : rest.length === 0 ? (
            <p className="empty-state">बाकी सभी रचनाएँ ऊपर चुनिंदा में हैं।</p>
          ) : (
            <div className="user-posts-list">
              {rest.map((post) => <PostRow key={post.id} post={post} />)}
            </div>
          )}
        </div>
        )}
      </div>

      {shareSheet}

      {notice && (
        <div className={`profile-notice ${noticeBad ? 'bad' : ''}`} role={noticeBad ? 'alert' : 'status'}>
          {notice}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
