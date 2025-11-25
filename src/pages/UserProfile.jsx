import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { updateMetaTags } from '../utils/seo';
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
      
      // Update SEO meta tags with author information
      if (response.data.length > 0) {
        const author = response.data[0].author;
        const authorName = author.full_name || author.username;
        const postCount = response.data.length;
        const latestPost = response.data[0];
        
        const description = `${authorName} has written ${postCount} ${postCount === 1 ? 'story' : 'stories'} on Meri Kahani. Read their latest: "${latestPost.title}". Voice-enabled Hindi storytelling platform.`;
        const keywords = `${authorName}, hindi stories, kahani, voice blogging, author profile, ${author.username}, ${latestPost.title}`;
        
        updateMetaTags({
          title: `${authorName} - Author Profile | Meri Kahani`,
          description: description,
          keywords: keywords,
          image: author.profile_image || 'https://kahanighargharki.vercel.app/default-author.jpg',
          url: `https://kahanighargharki.vercel.app/profile/${author.username}`,
          type: 'profile',
        });
      }
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

