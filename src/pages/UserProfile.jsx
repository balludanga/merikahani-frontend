import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { postsAPI } from '../services/api';
import './UserProfile.css';

const UserProfile = () => {
  const { userId } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserPosts();
  }, [userId]);

  const fetchUserPosts = async () => {
    try {
      const response = await postsAPI.getByUser(userId);
      setPosts(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return <div className="user-profile-loading">Loading...</div>;
  }

  const author = posts.length > 0 ? posts[0].author : null;

  return (
    <div className="user-profile">
      <div className="user-profile-container">
        {author && (
          <div className="user-profile-header">
            <h1>{author.full_name || author.username}</h1>
            {author.bio && <p className="user-bio">{author.bio}</p>}
          </div>
        )}
        <div className="user-posts">
          <h2>Posts</h2>
          {posts.length === 0 ? (
            <p className="no-posts">No posts yet.</p>
          ) : (
            <div className="user-posts-list">
              {posts.map((post) => (
                <Link key={post.id} to={`/post/${post.slug}`} className="user-post-item">
                  <h3>{post.title}</h3>
                  {post.subtitle && <p className="post-subtitle">{post.subtitle}</p>}
                  <span className="post-date">{formatDate(post.created_at)}</span>
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

