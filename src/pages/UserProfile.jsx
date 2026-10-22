import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { followsAPI, postsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags } from '../utils/seo';
import { formatDate, initials } from '../utils/format';
import { topicLabel } from '../brand';
import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  // 'notfound' for a real 404; 'error' for anything else (network, 5xx, timeout)
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    setLoadError(null);
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
    }

    const authorName = profileData.full_name || profileData.username;
    updateMetaTags({
      title: authorName,
      description: `${authorName} लेखनी पर ${profileData.post_count} रचनाएँ लिख चुके हैं। ${profileData.bio || ''}`,
      keywords: `${authorName}, हिंदी लेखक, लेखनी, ${authorName} की कहानियाँ`,
      image: profileData.avatar_url,
      url: `${window.location.origin}/user/${userId}`,
      type: 'profile',
    });
    setLoading(false);
  };

  const isSelf = user && profile && user.id === profile.id;

  const handleFollow = async () => {
    if (!isAuthenticated) {
      navigate('/login');
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
            <button type="button" className="follow-btn" onClick={fetchProfile}>फिर कोशिश करें</button>
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

  const authorName = profile.full_name || profile.username;

  return (
    <div className="user-profile">
      <div className="user-profile-container">
        <header className="profile-header">
          {profile.avatar_url ? (
            <img className="profile-avatar" src={profile.avatar_url} alt="" />
          ) : (
            <span className="profile-avatar profile-avatar-fallback">{initials(authorName)}</span>
          )}
          <div className="profile-info">
            <h1>{authorName}</h1>
            {profile.bio && <p className="user-bio">{profile.bio}</p>}
            <div className="profile-stats">
              <span><strong>{profile.follower_count}</strong> फ़ॉलोअर्स</span>
              <span><strong>{profile.following_count}</strong> फ़ॉलोइंग</span>
              <span><strong>{profile.post_count}</strong> रचनाएँ</span>
            </div>
          </div>
          {!isSelf && (
            <button
              type="button"
              className={`follow-btn profile-follow ${profile.is_following ? 'following' : ''}`}
              onClick={handleFollow}
            >
              {profile.is_following ? 'फ़ॉलो हो रहे हैं ✓' : 'फ़ॉलो करें'}
            </button>
          )}
        </header>

        <div className="user-posts">
          <h2>रचनाएँ</h2>
          {posts.length === 0 ? (
            <p className="empty-state">
              {isSelf ? 'अभी कोई प्रकाशित रचना नहीं। ' : 'अभी कोई प्रकाशित रचना नहीं। '}
              {isSelf && <Link to="/new-story">लिखना शुरू करें</Link>}.
            </p>
          ) : (
            <div className="user-posts-list">
              {posts.map((post) => (
                <Link key={post.id} to={`/post/${post.slug}`} className="user-post-item">
                  <h3>{post.title}</h3>
                  {post.subtitle && <p className="post-subtitle">{post.subtitle}</p>}
                  <span className="post-date">
                    {formatDate(post.created_at)}
                    {post.topic && <> · {topicLabel(post.topic)}</>}
                    {post.clap_count > 0 && <> · 👏 {post.clap_count}</>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
