import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookmarksAPI, highlightsAPI } from '../services/api';
import { formatDate } from '../utils/format';

/**
 * The signed-in writer's private shelves on their own profile: stories saved to read
 * later ('saved') and passages they marked while reading ('highlights').
 */
const ProfileLibrary = ({ tab }) => {
  const [items, setItems] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);

  const load = async () => {
    setItems(null);
    setFailed(false);
    setRemoveFailed(false);
    try {
      const response = tab === 'saved' ? await bookmarksAPI.list() : await highlightsAPI.list();
      setItems(response.data);
    } catch (error) {
      setFailed(true);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const removeHighlight = async (id) => {
    setRemoveFailed(false);
    try {
      await highlightsAPI.remove(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      // The passage is still on the shelf, so this is not a broken list: say what failed and let
      // the same button be pressed again.
      setRemoveFailed(true);
    }
  };

  if (failed) {
    return (
      <p className="empty-state">
        यह सूची लोड नहीं हो सकी।{' '}
        <button type="button" onClick={load}>फिर कोशिश करें</button>
      </p>
    );
  }
  if (items === null) return <div className="page-loading">लोड हो रहा है…</div>;

  if (tab === 'saved') {
    if (items.length === 0) {
      return (
        <p className="empty-state">
          अभी कुछ सहेजा नहीं गया। किसी रचना पर <strong>सहेजें</strong> दबाएँ, वह यहाँ इंतज़ार करेगी।{' '}
          <Link to="/">रचनाएँ देखें</Link>।
        </p>
      );
    }
    return (
      <div className="user-posts-list">
        {items.map((post) => (
          <Link key={post.id} to={`/post/${post.slug}`} className="user-post-item">
            <h3>{post.title}</h3>
            {post.subtitle && <p className="post-subtitle">{post.subtitle}</p>}
            <span className="post-date">
              {post.author && <>{post.author.full_name || post.author.username} · </>}
              {formatDate(post.created_at)}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="empty-state">
        अभी कोई हाइलाइट नहीं। पढ़ते समय कोई अंश चुनकर <strong>हाइलाइट</strong> दबाएँ, वह यहाँ जुड़ जाएगा।
      </p>
    );
  }

  // Newest first overall; a story's passages stay together under its title.
  const groups = [];
  items.forEach((item) => {
    let group = groups.find((g) => g.post.id === item.post_id);
    if (!group) {
      group = { post: item.post, rows: [] };
      groups.push(group);
    }
    group.rows.push(item);
  });

  return (
    <div className="user-posts-list">
      {removeFailed && (
        <p className="library-note" role="alert">अंश हटाया नहीं जा सका। कृपया फिर कोशिश करें।</p>
      )}
      {groups.map(({ post, rows }) => (
        <section key={post.id} className="library-group">
          <h3><Link to={`/post/${post.slug}`}>{post.title}</Link></h3>
          {rows.map((row) => (
            <blockquote key={row.id} className="library-passage">
              <p>
                <Link to={`/post/${encodeURIComponent(post.slug)}#passage-${row.id}`} title="कहानी में यह अंश देखें">{row.text}</Link>
              </p>
              <footer>
                <span>{formatDate(row.created_at)}</span>
                <button type="button" onClick={() => removeHighlight(row.id)}>हटाएँ</button>
              </footer>
            </blockquote>
          ))}
        </section>
      ))}
    </div>
  );
};

export default ProfileLibrary;
