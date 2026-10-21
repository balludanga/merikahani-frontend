import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { commentsAPI, followsAPI, postsAPI, usersAPI, bookmarksAPI, highlightsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags, generateStructuredData, resetMetaTags } from '../utils/seo';
import { formatDate, readingMinutes, initials } from '../utils/format';
import { topicLabel } from '../brand';
import ssmlTTS from '../utils/ssmlTTS';
import useFocusScroll from '../utils/useFocusScroll';
import useTextSelection from '../utils/useTextSelection';
import FocusHeader from '../components/FocusHeader';
import Lightbox from '../components/Lightbox';
import './PostView.css';

const PostView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  // Signed-out readers hit the gate; after sign-in they come back to this story.
  const storyPath = `/post/${slug}`;
  const loginLink = `/login?redirect=${encodeURIComponent(storyPath)}`;
  const registerLink = `/register?redirect=${encodeURIComponent(storyPath)}`;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // In-app confirmation instead of window.confirm: { kind: 'post'|'comment', id, text }
  const [confirmBox, setConfirmBox] = useState(null);
  const [actionError, setActionError] = useState('');
  const [shareState, setShareState] = useState('idle'); // idle | copied
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [clapping, setClapping] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);
  const bodyRef = useRef(null);
  const { progress, hidden } = useFocusScroll();
  const [selectionMenu, setSelectionMenu] = useTextSelection(bodyRef);

  useEffect(() => {
    fetchPost();
    return () => {
      resetMetaTags();
      ssmlTTS.cancel();
    };
  }, [slug]);

  const fetchPost = async () => {
    try {
      const response = await postsAPI.getBySlug(slug);
      setPost(response.data);
      updateMetaTags({
        title: response.data.title,
        description: response.data.subtitle || response.data.content.substring(0, 160),
        keywords: `${response.data.title}, हिंदी, लेखनी, ${(response.data.tags || []).join(', ')}, ${response.data.author.username}`,
        image: response.data.cover_image,
        type: 'article',
        author: response.data.author.full_name || response.data.author.username,
        publishedTime: response.data.created_at,
        modifiedTime: response.data.updated_at,
      });
      generateStructuredData(response.data, response.data.author);
      const commentsRes = await commentsAPI.getByPost(response.data.id);
      setComments(commentsRes.data);

      // Follow state for the author (only meaningful for signed-in readers)
      if (!user || user.id !== response.data.author_id) {
        try {
          const profileRes = await usersAPI.getById(response.data.author_id);
          setIsFollowing(profileRes.data.is_following);
          setFollowerCount(profileRes.data.follower_count);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch author profile:', error);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch post:', error);
      // Don't silently bounce the reader home — say what happened and
      // offer a way back, so a broken link isn't a mystery.
      setPageError(true);
    } finally {
      setLoading(false);
    }
  };

  const runConfirm = async () => {
    if (!confirmBox) return;
    if (confirmBox.kind === 'post') {
      setDeleting(true);
      try {
        await postsAPI.delete(post.id);
        navigate('/stories');
      } catch (error) {
        setActionError('रचना हटाई नहीं जा सकी। कृपया फिर कोशिश करें।');
      } finally {
        setDeleting(false);
        setConfirmBox(null);
      }
    } else {
      try {
        await commentsAPI.delete(confirmBox.id);
        setComments((prev) => prev.filter((c) => c.id !== confirmBox.id));
      } catch (error) {
        setActionError('प्रतिक्रिया हटाई नहीं जा सकी।');
      } finally {
        setConfirmBox(null);
      }
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement('textarea');
        field.value = url;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        document.body.removeChild(field);
      }
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch (error) {
      setActionError('कड़ी कॉपी नहीं हो सकी।');
    }
  };

  const handleClap = async () => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    if (clapping || (post.my_claps || 0) >= 50) return;
    setClapping(true);
    try {
      const response = await postsAPI.clap(post.id);
      setPost((prev) => ({
        ...prev,
        clap_count: response.data.clap_count,
        my_claps: response.data.my_claps,
      }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Clap failed:', error);
    } finally {
      setClapping(false);
    }
  };

  const handleBookmark = async () => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    try {
      if (post.bookmarked) {
        await bookmarksAPI.remove(post.id);
        setPost((prev) => ({ ...prev, bookmarked: false }));
      } else {
        await bookmarksAPI.add(post.id);
        setPost((prev) => ({ ...prev, bookmarked: true }));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Bookmark failed:', error);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    try {
      const response = isFollowing
        ? await followsAPI.unfollow(post.author_id)
        : await followsAPI.follow(post.author_id);
      setIsFollowing(response.data.following);
      setFollowerCount(response.data.follower_count);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Follow failed:', error);
    }
  };

  const toggleListen = () => {
    if (speaking) {
      ssmlTTS.cancel();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    ssmlTTS.speak(post.content, {
      lang: 'hi-IN',
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const response = await commentsAPI.create({ content: commentText, post_id: post.id });
      setComments((prev) => [...prev, response.data]);
      setCommentText('');
    } catch (error) {
      setActionError('प्रतिक्रिया सहेजी नहीं जा सकी।');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    setConfirmBox({ kind: 'comment', id: commentId, text: 'यह प्रतिक्रिया हटाएँ?' });
  };

  // Wrap the current selection inside a <mark> and sync it to the account.
  const handleHighlightSelection = async () => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !bodyRef.current) return;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) return;

    try {
      await highlightsAPI.create({ post_id: post.id, text });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Highlight failed:', error);
      setActionError('हाइलाइट सहेजा नहीं जा सकी।');
      return;
    }

    const range = sel.getRangeAt(0);
    const mark = document.createElement('mark');
    mark.className = 'text-highlight';
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    sel.removeAllRanges();
    setSelectionMenu(null);
  };

  // Send the quoted passage into the responses composer.
  const handleCommentSelection = () => {
    const quoted = selectionMenu ? selectionMenu.text : '';
    setSelectionMenu(null);
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    setCommentText((prev) => `${prev}${quoted ? `❝ ${quoted} ❞\n\n` : ''}`);
    const responses = document.getElementById('responses');
    if (responses) responses.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const textarea = document.querySelector('.response-form textarea');
      if (textarea) textarea.focus();
    }, 450);
  };

  // Restore this reader's saved highlights once the body is on screen.
  // Client-era localStorage highlights are imported into the account once.
  useEffect(() => {
    if (!post || !isAuthenticated || !bodyRef.current) return undefined;
    let cancelled = false;

    const applySnippets = (snippets) => {
      const walker = document.createTreeWalker(bodyRef.current, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const snippet of snippets) {
        const node = nodes.find(
          (n) => n.parentElement && !n.parentElement.closest('mark') && n.textContent.includes(snippet)
        );
        if (!node) continue;
        const start = node.textContent.indexOf(snippet);
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + snippet.length);
        const mark = document.createElement('mark');
        mark.className = 'text-highlight';
        try {
          range.surroundContents(mark);
        } catch (err) {
          // Snippet spans several nodes — skip rather than mangle the DOM.
        }
      }
    };

    const restore = async () => {
      try {
        const localKey = `lekhani_hl_${post.id}`;
        const local = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (Array.isArray(local) && local.length) {
          for (const text of local) {
            await highlightsAPI.create({ post_id: post.id, text }).catch(() => {});
          }
          localStorage.removeItem(localKey);
        }
      } catch (err) {
        // localStorage unavailable — nothing to migrate.
      }
      try {
        const response = await highlightsAPI.list({ post_id: post.id });
        if (!cancelled) applySnippets(response.data.map((item) => item.text));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load highlights:', error);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [post, isAuthenticated]);

  if (loading) return <div className="page-loading">लोड हो रहा है…</div>;
  if (pageError) {
    return (
      <div className="notfound-page">
        <h1>रचना लोड नहीं हो सकी</h1>
        <p>कोई तकनीकी दिक्कत आई है। थोड़ी देर में फिर कोशिश करें।</p>
        <Link to="/" className="landing-cta">मुख्य पृष्ठ पर जाएँ</Link>
      </div>
    );
  }
  if (!post) return null;

  const authorName = post.author.full_name || post.author.username;
  const isAuthor = user && user.id === post.author_id;
  const paragraphs = post.content.split(/\n+/).filter((p) => p.trim());
  const tagLinks = (post.tags || []).map((name, index) => ({
    name,
    slug: (post.tag_slugs || [])[index] || encodeURIComponent(name),
  }));

  return (
    <div className="story-page">
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
      <FocusHeader post={post} hidden={hidden} saved={!!post.bookmarked} onBookmark={handleBookmark} />

      <article className="story-article">
        <h1>{post.title}</h1>
        {post.subtitle && <p className="story-dek">{post.subtitle}</p>}

        <div className="story-byline">
          <Link to={`/user/${post.author.id}`} className="story-author">
            {post.author.avatar_url ? (
              <img src={post.author.avatar_url} alt="" />
            ) : (
              <span className="avatar-lg">{initials(authorName)}</span>
            )}
            <div>
              <strong>{authorName}</strong>
              <div className="story-byline-meta">
                {formatDate(post.created_at)} · {readingMinutes(post.content)} मिनट पढ़ें
                {post.topic && <> · {topicLabel(post.topic)}</>}
                {followerCount > 0 && <> · {followerCount} फ़ॉलोअर्स</>}
              </div>
            </div>
          </Link>
          {isAuthor ? (
            <div className="story-owner">
              <Link to={`/edit/${post.id}`}>संपादित करें</Link>
              <button
                type="button"
                onClick={() => setConfirmBox({ kind: 'post', text: 'क्या आप इस रचना को हटाना चाहते हैं? यह वापस नहीं आएगी।' })}
                disabled={deleting}
              >
                {deleting ? 'हटा रहे हैं…' : 'हटाएँ'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`follow-btn ${isFollowing ? 'following' : ''}`}
              onClick={handleFollow}
            >
              {isFollowing ? 'फ़ॉलो हो रहे हैं ✓' : 'फ़ॉलो करें'}
            </button>
          )}
        </div>

        {post.cover_image && (
          <img
            className="story-cover zoomable"
            src={post.cover_image}
            alt=""
            onClick={() => setZoomImage({ src: post.cover_image, alt: post.title })}
          />
        )}

        <div
          className="story-body"
          ref={bodyRef}
          onClick={(e) => {
            if (e.target.tagName === 'IMG') {
              setZoomImage({ src: e.target.src, alt: post.title });
            }
          }}
        >
          {post.content_html ? (
            // Server-sanitized (bleach allowlist) rich text from the editor.
            <div dangerouslySetInnerHTML={{ __html: post.content_html }} />
          ) : (
            paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))
          )}
        </div>

        {post.is_preview && (
          <div className="story-gate">
            <div className="story-gate-card">
              <h2>पढ़ना जारी रखें</h2>
              <p>
                इस रचना को शुरू से अंत तक पढ़ने के लिए लेखनी से जुड़ें —
                पढ़ना और लिखना बिल्कुल मुफ़्त है।
              </p>
              <div className="story-gate-actions">
                <Link className="gate-cta primary" to={registerLink}>
                  मुफ़्त खाता बनाएँ
                </Link>
                <Link className="gate-cta" to={loginLink}>
                  साइन इन करें
                </Link>
              </div>
            </div>
          </div>
        )}

        {tagLinks.length > 0 && (
          <div className="story-tags">
            {tagLinks.map((tag) => (
              <Link key={tag.slug} to={`/tag/${encodeURIComponent(tag.slug)}`} className="tag-chip">
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        <div className="story-actions">
          <button type="button" className="clap-button" onClick={handleClap} disabled={clapping}>
            👏
            <span>{post.clap_count || 0}</span>
          </button>
          <button
            type="button"
            className={`bookmark-button ${post.bookmarked ? 'saved' : ''}`}
            onClick={handleBookmark}
            title={post.bookmarked ? 'पढ़ने की सूची से हटाएँ' : 'पढ़ने की सूची में सहेजें'}
          >
            {post.bookmarked ? 'सहेजा गया ✓' : 'सहेजें'}
          </button>
          <button
            type="button"
            className="share-button"
            onClick={handleShare}
            title="इस रचना की कड़ी कॉपी करें"
          >
            {shareState === 'copied' ? 'कॉपी हुआ ✓' : 'साझा करें'}
          </button>
          {!post.is_preview && (
            <button
              type="button"
              className={`listen-button ${speaking ? 'speaking' : ''}`}
              onClick={toggleListen}
            >
              {speaking ? '⏹ रोकें' : '▶ सुनें'}
            </button>
          )}
          {(post.my_claps || 0) > 0 && (
            <span className="my-claps">आपकी तालियाँ: {post.my_claps}/50</span>
          )}
        </div>
      </article>

      {selectionMenu && (
        <div
          className="selection-menu"
          style={{ left: selectionMenu.x, top: selectionMenu.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={handleHighlightSelection}
            title="हाइलाइट करें"
            aria-label="हाइलाइट करें"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="selection-menu-sep" aria-hidden="true" />
          <button
            type="button"
            onClick={handleCommentSelection}
            title="इस अंश पर प्रतिक्रिया लिखें"
            aria-label="इस अंश पर प्रतिक्रिया लिखें"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      <section className="responses" id="responses">
        <h2>प्रतिक्रियाएँ</h2>
        {isAuthenticated ? (
          <form onSubmit={handleCommentSubmit} className="response-form">
            <textarea
              lang="hi"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="अपनी प्रतिक्रिया लिखें…"
              rows={3}
            />
            <button type="submit" disabled={submittingComment || !commentText.trim()}>
              {submittingComment ? 'भेज रहे हैं…' : 'प्रकाशित करें'}
            </button>
          </form>
        ) : (
          <p className="response-login">
            प्रतिक्रिया लिखने के लिए <Link to={loginLink}>साइन इन</Link> करें।
          </p>
        )}

        {comments.length === 0 ? (
          <p className="empty-state">अभी कोई प्रतिक्रिया नहीं।</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="response-item">
              <div className="response-head">
                <strong>{comment.author?.full_name || comment.author?.username || 'पाठक'}</strong>
                <span>{formatDate(comment.created_at)}</span>
                {user && comment.author_id === user.id && (
                  <button type="button" onClick={() => handleDeleteComment(comment.id)}>हटाएँ</button>
                )}
              </div>
              <p>{comment.content}</p>
            </div>
          ))
        )}
      </section>

      {confirmBox && (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmBox(null);
          }}
        >
          <div className="confirm-card">
            <h3 id="confirm-title">{confirmBox.text}</h3>
            <div className="confirm-actions">
              <button type="button" className="confirm-cancel" onClick={() => setConfirmBox(null)}>
                रहने दें
              </button>
              <button type="button" className="confirm-danger" onClick={runConfirm} disabled={deleting}>
                {deleting ? 'हटा रहे हैं…' : 'हटाएँ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="action-toast" role="alert" onClick={() => setActionError('')}>
          {actionError}
        </div>
      )}

      {zoomImage && (
        <Lightbox
          src={zoomImage.src}
          alt={zoomImage.alt}
          onClose={() => setZoomImage(null)}
        />
      )}
    </div>
  );
};

export default PostView;
