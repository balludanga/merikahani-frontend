import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { postsAPI, tagsAPI } from '../services/api';
import { updateMetaTags } from '../utils/seo';
import { topicLabel } from '../brand';
import StoryCard from '../components/StoryCard';
import './Home.css';

const Search = () => {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const query = searchParams.get('q') || '';
  const topic = params.topic || '';
  const tagSlug = params.slug || '';

  const [posts, setPosts] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [query, topic, tagSlug]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      let response;
      if (tagSlug) {
        response = await tagsAPI.posts(tagSlug, { limit: 30 });
      } else {
        response = await postsAPI.getAll({
          limit: 30,
          q: query || undefined,
          topic: topic || undefined,
        });
      }
      setPosts(response.data);

      if (!popularTags.length) {
        const tagsRes = await tagsAPI.list({ limit: 15 });
        setPopularTags(tagsRes.data);
      }

      const heading = tagSlug
        ? `#${tagSlug} टैग की रचनाएँ`
        : topic
          ? `${topicLabel(topic)} विषय की रचनाएँ`
          : query
            ? `“${query}” के लिए खोज`
            : 'सभी रचनाएँ';
      updateMetaTags({
        title: heading,
        description: `लेखनी पर ${heading}।`,
        type: 'website',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch results:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const heading = tagSlug
    ? `#${tagSlug}`
    : topic
      ? topicLabel(topic)
      : query
        ? `“${query}” के लिए खोज परिणाम`
        : 'सभी रचनाएँ';

  return (
    <div className="layout">
      <div className="layout-main">
        <h1 className="list-heading">{heading}</h1>
        {loading ? (
          <div className="page-loading">लोड हो रहा है…</div>
        ) : posts.length === 0 ? (
          <p className="empty-state">कुछ नहीं मिला। दूसरे शब्दों से खोजें या विषय बदलें।</p>
        ) : (
          posts.map((post) => <StoryCard key={post.id} post={post} />)
        )}
      </div>
      <aside className="layout-aside">
        <h3 className="aside-title">लोकप्रिय टैग</h3>
        <div className="topic-list">
          {popularTags.map((tag) => (
            <Link key={tag.id} to={`/tag/${encodeURIComponent(tag.slug)}`}>
              #{tag.name}
            </Link>
          ))}
        </div>
        <h3 className="aside-title aside-gap">विषय</h3>
        <div className="topic-list">
          <Link to="/search">सभी</Link>
        </div>
        <p className="aside-note">
          टैग और विषय से अपनी पसंद की रचनाएँ खोजें।
        </p>
      </aside>
    </div>
  );
};

export default Search;
