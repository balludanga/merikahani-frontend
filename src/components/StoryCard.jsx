import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate, readingMinutes, excerpt, initials } from '../utils/format';
import { topicLabel } from '../brand';
import './StoryCard.css';

const StoryCard = ({ post }) => {
  const authorName = post.author?.full_name || post.author?.username || 'लेखक';
  const mins = readingMinutes(post.content);

  return (
    <article className="story-card">
      <div className="story-card-body">
        <Link to={`/user/${post.author?.id}`} className="story-card-author">
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="avatar-sm" width="22" height="22" loading="lazy" decoding="async" />
          ) : (
            <span className="avatar-sm avatar-fallback">{initials(authorName)}</span>
          )}
          <span>{authorName}</span>
        </Link>
        <Link to={`/post/${post.slug}`} className="story-card-link">
          <h2>{post.title}</h2>
          {(post.subtitle || post.content) && (
            <p>{post.subtitle || excerpt(post.content)}</p>
          )}
        </Link>
        <div className="story-card-meta">
          <span>{formatDate(post.created_at)}</span>
          <span>·</span>
          <span>{mins} मिनट</span>
          {post.topic && (
            <>
              <span>·</span>
              <span className="story-chip">{topicLabel(post.topic)}</span>
            </>
          )}
          {post.clap_count > 0 && (
            <>
              <span>·</span>
              <span>👏 {post.clap_count}</span>
            </>
          )}
        </div>
        {(post.tags || []).length > 0 && (
          <div className="story-card-tags">
            {(post.tags || []).slice(0, 3).map((name, index) => (
              <Link
                key={name}
                to={`/tag/${encodeURIComponent((post.tag_slugs || [])[index] || name)}`}
                className="tag-chip"
              >
                #{name}
              </Link>
            ))}
          </div>
        )}
      </div>
      {post.cover_image && (
        <Link to={`/post/${post.slug}`} className="story-card-thumb">
          <img src={post.cover_image} alt="" width="112" height="112" loading="lazy" decoding="async" />
        </Link>
      )}
    </article>
  );
};

export default StoryCard;
