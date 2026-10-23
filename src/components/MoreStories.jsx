import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { postsAPI } from '../services/api';
import './MoreStories.css';

const COUNT = 6;

/**
 * "और रचनाएँ" - the latest other stories, as plain links under a story.
 * The server-rendered page that search crawlers get shows the same list.
 */
const MoreStories = ({ currentId }) => {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    postsAPI
      .getAll({ limit: COUNT + 1 })
      .then((response) => {
        if (!cancelled) setPosts(response.data.filter((post) => post.id !== currentId).slice(0, COUNT));
      })
      .catch(() => {
        // Optional extra: if it fails the story is simply shown without it.
      });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  if (!posts.length) return null;

  return (
    <section className="more-stories" aria-labelledby="more-stories-title">
      <h2 id="more-stories-title">और रचनाएँ</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <Link to={`/post/${encodeURIComponent(post.slug)}`}>{post.title || 'बिना शीर्षक'}</Link>
            <span> — {post.author.full_name || post.author.username}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MoreStories;
