import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { postsAPI } from '../services/api';
import './Home.css';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await postsAPI.getAll({ limit: 20 });
      setPosts(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return <div className="home-loading">Loading...</div>;
  }

  return (
    <div className="home">
      <div className="home-container">
        <div className="home-header">
          <h1>अपनी कहानी, अपनी आवाज़</h1>
          <p>हर दिल की बात, हर सपने की उड़ान - यहाँ बोलो, दुनिया सुनेगी</p>
        </div>
        <div className="posts-grid">
          {posts.map((post) => (
            <Link key={post.id} to={`/post/${post.slug}`} className="post-card">
              <div className="post-card-header">
                <div className="post-author">
                  <span className="post-author-name">
                    {post.author.full_name || post.author.username}
                  </span>
                  <span className="post-date">{formatDate(post.created_at)}</span>
                </div>
              </div>
              <h2 className="post-title">{post.title}</h2>
              {post.subtitle && (
                <p className="post-subtitle">{post.subtitle}</p>
              )}
              <div className="post-footer">
                <span className="post-read-time">5 min read</span>
              </div>
            </Link>
          ))}
        </div>
        {posts.length === 0 && (
          <div className="no-posts">
            <p>No posts yet. Be the first to write!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

