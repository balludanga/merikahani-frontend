import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { postsAPI, tagsAPI } from '../services/api';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
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
  const [failed, setFailed] = useState(false);
  const [tagName, setTagName] = useState('');

  useEffect(() => {
    fetchResults();
  }, [query, topic, tagSlug]);

  // Meta is set on its own (not after the fetch) so the canonical always matches
  // the page actually on screen. Free-text result pages are never indexed; the
  // plain listing, /topic/:topic and /tag/:slug are, each with its own title.
  useEffect(() => {
    let title = 'सभी रचनाएँ';
    let description = 'लेखनी पर प्रकाशित सभी हिंदी रचनाएँ — कहानी, कविता, निबंध और संस्मरण। अपनी पसंद की रचना खोजें और पढ़ें।';
    if (tagSlug) {
      const label = tagName || tagSlug;
      title = `#${label} टैग की रचनाएँ`;
      description = `लेखनी पर #${label} टैग वाली हिंदी रचनाएँ पढ़ें — कहानी, कविता, निबंध और संस्मरण, सीधे लेखकों की कलम से।`;
    } else if (topic) {
      const label = topicLabel(topic);
      title = `${label} विषय की रचनाएँ`;
      description = `लेखनी पर ${label} विषय की हिंदी रचनाएँ पढ़ें — नए और पुराने लेखकों की ताज़ा ${label} एक ही जगह।`;
    } else if (query) {
      title = `“${query}” के लिए खोज`;
      description = `लेखनी पर “${query}” के लिए खोज परिणाम।`;
    }
    updateMetaTags({ title, description, type: 'website', noindex: !!query });
    return () => resetMetaTags();
  }, [query, topic, tagSlug, tagName]);

  const fetchResults = async () => {
    setLoading(true);
    setFailed(false);
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
      if (tagSlug) {
        const first = response.data[0];
        const at = first && first.tag_slugs ? first.tag_slugs.indexOf(tagSlug) : -1;
        setTagName(at >= 0 && first.tags ? first.tags[at] || '' : '');
      } else {
        setTagName('');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch results:', error);
      setPosts([]);
      // "nothing matches this search" and "the search never ran" are different news.
      setFailed(true);
    } finally {
      setLoading(false);
    }

    // The tag rail beside the results is decoration: it must not be able to spoil a good search.
    try {
      if (!popularTags.length) {
        const tagsRes = await tagsAPI.list({ limit: 15 });
        setPopularTags(tagsRes.data);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch popular tags:', error);
    }
  };

  const heading = tagSlug
    ? `#${tagName || tagSlug}`
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
        ) : failed ? (
          <p className="empty-state">
            रचनाएँ लोड नहीं हो सकीं।{' '}
            <button type="button" onClick={fetchResults}>फिर कोशिश करें</button>।
          </p>
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
