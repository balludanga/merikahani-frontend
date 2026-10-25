import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { commentsAPI, followsAPI, postsAPI, usersAPI, bookmarksAPI, highlightsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags, generateStructuredData, resetMetaTags } from '../utils/seo';
import { formatDate, readingMinutes, initials } from '../utils/format';
import { topicLabel } from '../brand';
import ssmlTTS from '../utils/ssmlTTS';
import useFocusScroll from '../utils/useFocusScroll';
import { useAccentStyle } from '../utils/accent';
import useTextSelection from '../utils/useTextSelection';
import {
  MAX_HIGHLIGHT, anchorFromRange, applyMarks, clearMarks, elementAt, indexBody, locate,
} from '../utils/textAnchors';
import FocusHeader from '../components/FocusHeader';
import HindiTextarea, { useHinglish } from '../components/HindiTextarea';
import PassageComposer from '../components/PassageComposer';
import Lightbox from '../components/Lightbox';
import MoreStories from '../components/MoreStories';
import { NotFound } from '../components/NotFound';
import './PostView.css';
import { mediaUrl } from '../utils/media';

// "राम और 2 अन्य ने हाइलाइट किया" for the readers behind one stretch of text.
function readerNames(found, myId) {
  const seen = new Map();
  found.forEach((item) => {
    if (!seen.has(item.user_id)) {
      seen.set(item.user_id, {
        id: item.user_id,
        mine: item.user_id === myId,
        name: (item.user && (item.user.full_name || item.user.username)) || 'पाठक',
        highlightIds: [],
      });
    }
    seen.get(item.user_id).highlightIds.push(item.id);
  });
  const readers = Array.from(seen.values());
  readers.sort((a, b) => Number(b.mine) - Number(a.mine));
  return readers;
}

function whoHighlighted(found, myId) {
  const readers = readerNames(found, myId);
  const names = readers.map((reader) => (reader.mine ? 'आपने' : reader.name));
  if (names.length <= 2) return `${names.join(' और ')} ने हाइलाइट किया`;
  return `${names.slice(0, 2).join(', ')} और ${names.length - 2} अन्य ने हाइलाइट किया`;
}

const PostView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  // Signed-out readers hit the gate; after sign-in they come back to this story.
  const storyPath = `/post/${slug}`;
  const loginLink = `/login?redirect=${encodeURIComponent(storyPath)}`;
  const registerLink = `/register?redirect=${encodeURIComponent(storyPath)}`;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  // null | 'notfound' (real 404) | 'error' (network, 5xx, timeout)
  const [pageError, setPageError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // In-app confirmation instead of window.confirm: { kind: 'post'|'comment', id, text }
  const [confirmBox, setConfirmBox] = useState(null);
  const [actionError, setActionError] = useState('');
  const [shareState, setShareState] = useState('idle'); // idle | copied
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  // The response being answered, with its draft: { id, name } | null
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [clapping, setClapping] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);
  // Every reader's highlights on this story, each with who made it.
  const [highlights, setHighlights] = useState([]);
  // Who highlighted the passage the reader tapped: { x, y, ids } | null
  const [hlInfo, setHlInfo] = useState(null);
  // The response popup for a selected passage: { range, quote } | null
  const [composer, setComposer] = useState(null);
  const [notice, setNotice] = useState('');
  const [hinglish, toggleHinglish, finishHinglish] = useHinglish();
  const bodyRef = useRef(null);
  const jumpedTo = useRef(null);
  const { progress, hidden } = useFocusScroll();
  // The writer's own colour tints their story (progress bar, links, buttons).
  const accentStyle = useAccentStyle(post && post.author && post.author.accent);
  const [selectionMenu, setSelectionMenu] = useTextSelection(bodyRef);

  // Error toast: dismiss on Escape and automatically after ~6 seconds.
  useEffect(() => {
    if (!actionError) return undefined;
    const timer = setTimeout(() => setActionError(''), 6000);
    const onKey = (e) => {
      if (e.key === 'Escape') setActionError('');
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [actionError]);

  useEffect(() => {
    fetchPost();
    return () => {
      resetMetaTags();
      ssmlTTS.cancel();
    };
  }, [slug]);

  const fetchPost = async () => {
    // Moving to another story (same component, new slug): the cleanup above stopped the
    // voice, so the button must go back to "सुनें" too.
    setSpeaking(false);
    setPageError(null);
    setLoading(true);
    let loaded;
    try {
      const response = await postsAPI.getBySlug(slug);
      loaded = response.data;
      setPost(loaded);
      updateMetaTags({
        title: loaded.title,
        description: loaded.subtitle || loaded.content.substring(0, 160),
        keywords: `${loaded.title}, हिंदी, लेखनी, ${(loaded.tags || []).join(', ')}, ${loaded.author.username}`,
        // An uploaded (data:) cover is far too big for a meta tag; fall back to the logo.
        image: /^https?:\/\//.test(loaded.cover_image || '') ? loaded.cover_image : undefined,
        url: `${window.location.origin}/post/${encodeURIComponent(loaded.slug)}`,
        type: 'article',
        author: loaded.author.full_name || loaded.author.username,
        publishedTime: loaded.created_at,
        modifiedTime: loaded.updated_at,
      });
      generateStructuredData(loaded, loaded.author);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch post:', error);
      // Don't silently bounce the reader home — a real 404 gets the not-found
      // page; anything else is a technical error with a retry button.
      setPageError(error.response?.status === 404 ? 'notfound' : 'error');
      setLoading(false);
      return;
    }
    setLoading(false);

    // Comments and author follow-state are secondary: if they fail, the
    // already-loaded post must stay on screen.
    try {
      const commentsRes = await commentsAPI.getByPost(loaded.id);
      setComments(commentsRes.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch comments:', error);
    }

    // Follow state for the author (only meaningful for signed-in readers)
    if (!user || user.id !== loaded.author_id) {
      try {
        const profileRes = await usersAPI.getById(loaded.author_id);
        setIsFollowing(profileRes.data.is_following);
        setFollowerCount(profileRes.data.follower_count);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch author profile:', error);
      }
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
        // Its answers go with it (the server deletes them too).
        setComments((prev) => prev.filter((c) => c.id !== confirmBox.id && c.parent_id !== confirmBox.id));
      } catch (error) {
        setActionError('प्रतिक्रिया हटाई नहीं जा सकी।');
      } finally {
        setConfirmBox(null);
      }
    }
  };

  const handleShare = async () => {
    // Share link serves per-story preview tags to crawlers, then redirects readers here.
    const url = `${window.location.origin}/api/share/post/${encodeURIComponent(slug)}`;
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
      useSSML: false,
      title: post.title,
      onEnd: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        setActionError('इस उपकरण पर रचना सुनाई नहीं जा सकी। हो सकता है हिंदी आवाज़ (वॉइस) उपलब्ध न हो।');
      },
    });
  };

  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    const content = finishHinglish(commentText).trim();
    if (!content || submittingComment) return;
    setSubmittingComment(true);
    try {
      const response = await commentsAPI.create({ content, post_id: post.id });
      setComments((prev) => [...prev, response.data]);
      setCommentText('');
    } catch (error) {
      setActionError('प्रतिक्रिया सहेजी नहीं जा सकी।');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    const hasAnswers = comments.some((c) => c.parent_id === commentId);
    setConfirmBox({
      kind: 'comment',
      id: commentId,
      text: hasAnswers ? 'यह प्रतिक्रिया और इसके सभी जवाब हटाएँ?' : 'यह प्रतिक्रिया हटाएँ?',
    });
  };

  const openReply = (comment) => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    setReplyTo({ id: comment.id, name: comment.author?.full_name || comment.author?.username || 'पाठक' });
    setReplyText('');
  };

  const handleReplySubmit = async (e) => {
    if (e) e.preventDefault();
    const content = finishHinglish(replyText).trim();
    if (!content || !replyTo || submittingReply) return;
    setSubmittingReply(true);
    try {
      const response = await commentsAPI.create({ content, post_id: post.id, parent_id: replyTo.id });
      setComments((prev) => [...prev, response.data]);
      setReplyTo(null);
      setReplyText('');
    } catch (error) {
      setActionError('जवाब सहेजा नहीं जा सका।');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Highlight the selected passage and share it with the account.
  const handleHighlightSelection = async () => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !bodyRef.current) return;
    const anchor = anchorFromRange(indexBody(bodyRef.current), sel.getRangeAt(0));
    if (!anchor) return;
    if (anchor.text.length > MAX_HIGHLIGHT) {
      setActionError('इतना लंबा अंश हाइलाइट नहीं हो सकता। कृपया छोटा अंश चुनें।');
      return;
    }
    sel.removeAllRanges();
    setSelectionMenu(null);

    try {
      const response = await highlightsAPI.create({
        post_id: post.id,
        text: anchor.text,
        start: anchor.start,
        prefix: anchor.prefix,
        suffix: anchor.suffix,
      });
      const saved = {
        ...response.data,
        user_id: user.id,
        user: { id: user.id, username: user.username, full_name: user.full_name },
      };
      setHighlights((prev) => [...prev.filter((item) => item.id !== saved.id), saved]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Highlight failed:', error);
      setActionError('हाइलाइट सहेजा नहीं जा सकी।');
    }
  };

  // Open the response popup on the spot, so the reader never leaves the page.
  const handleCommentSelection = () => {
    if (!isAuthenticated) {
      navigate(loginLink);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !bodyRef.current) return;
    const range = sel.getRangeAt(0).cloneRange();
    const anchor = anchorFromRange(indexBody(bodyRef.current), range);
    const quote = (anchor ? anchor.text : selectionMenu ? selectionMenu.text : '').slice(0, 1000);
    if (!quote) return;
    sel.removeAllRanges();
    setSelectionMenu(null);
    setComposer({ range, quote, start: anchor ? anchor.start : null });
  };

  const submitPassageResponse = async (content) => {
    try {
      const response = await commentsAPI.create({
        content, post_id: post.id, quote: composer.quote, quote_start: composer.start,
      });
      setComments((prev) => [...prev, response.data]);
      setComposer(null);
      setNotice('प्रतिक्रिया जुड़ गई — यह नीचे “प्रतिक्रियाएँ” में दिखेगी।');
    } catch (error) {
      setActionError('प्रतिक्रिया सहेजी नहीं जा सकी।');
      throw error;
    }
  };

  // Where the passage a response is about starts in the story's text: its recorded spot
  // when it is still there, else the best match by words; -1 when the passage is gone.
  const passageStart = (index, comment) => locate(index, { text: comment.quote, start_offset: comment.quote_start });

  // Scroll back to the passage a response is about.
  const jumpToPassage = (comment) => {
    if (!bodyRef.current) return;
    const index = indexBody(bodyRef.current);
    const at = passageStart(index, comment);
    const found = at < 0 ? null : elementAt(index, at, at + comment.quote.length);
    if (!found) {
      setNotice('यह अंश इस पृष्ठ पर नहीं दिख रहा।');
      return;
    }
    const block = found.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6') || found;
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
    block.classList.add('passage-flash');
    window.setTimeout(() => block.classList.remove('passage-flash'), 2400);
  };

  // From a marker in the story down to the response written about that passage.
  const jumpToResponse = (id) => {
    const target = document.getElementById(`response-${id}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('response-flash');
    window.setTimeout(() => target.classList.remove('response-flash'), 2400);
  };

  // Tapping a highlighted passage shows who highlighted it.
  const handleBodyClick = (e) => {
    if (e.target.tagName === 'IMG') {
      setZoomImage({ src: e.target.src, alt: post.title });
      return;
    }
    const marker = e.target.closest ? e.target.closest('.passage-marker') : null;
    if (marker) {
      jumpToResponse(Number(marker.dataset.first));
      return;
    }
    const mark = e.target.closest ? e.target.closest('mark.text-highlight') : null;
    const sel = window.getSelection();
    if (!mark || (sel && !sel.isCollapsed)) return;
    const ids = mark.dataset.hl.split(',').map(Number);
    setHlInfo({ x: e.clientX, y: e.clientY, ids });
  };

  const removeMyHighlights = async (ids) => {
    const mine = highlights.filter((item) => ids.includes(item.id) && user && item.user_id === user.id);
    setHlInfo(null);
    try {
      await Promise.all(mine.map((item) => highlightsAPI.remove(item.id)));
      const gone = new Set(mine.map((item) => item.id));
      setHighlights((prev) => prev.filter((item) => !gone.has(item.id)));
    } catch (error) {
      setActionError('हाइलाइट हटाई नहीं जा सकी।');
    }
  };

  // Everyone's highlights on this story. Signed-out visitors get the ones in
  // the teaser. Highlights kept on this device by an older version are moved
  // into the account once.
  useEffect(() => {
    if (!post) return undefined;
    let cancelled = false;
    const load = async () => {
      if (isAuthenticated) {
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
          // localStorage unavailable — nothing to move.
        }
      }
      try {
        const response = await highlightsAPI.forPost(post.id);
        if (!cancelled) setHighlights(response.data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load highlights:', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [post && post.id, isAuthenticated]);

  // Paint the highlights onto the story. This runs when the body is really on
  // screen (`loading` is false), not just when the post data arrives.
  useEffect(() => {
    const root = bodyRef.current;
    if (loading || !post || !root) return;
    clearMarks(root);
    if (!highlights.length) return;
    const index = indexBody(root);
    const byId = new Map(highlights.map((item) => [item.id, item]));
    const myId = user ? user.id : null;
    const spans = [];
    highlights.forEach((item) => {
      const start = locate(index, item);
      if (start >= 0) spans.push({ id: item.id, start, end: start + item.text.length });
    });
    applyMarks(index, spans, (ids) => {
      const found = ids.map((id) => byId.get(id));
      const mine = found.some((item) => item.user_id === myId);
      const others = new Set(found.filter((item) => item.user_id !== myId).map((item) => item.user_id));
      const className = [mine && 'hl-mine', others.size && `hl-others hl-n${Math.min(others.size, 3)}`]
        .filter(Boolean)
        .join(' ');
      return { className, title: whoHighlighted(found, myId) };
    });
  }, [highlights, post, loading, user && user.id]);

  // Mark where responses about a passage sit: a small bubble with a count at the end of
  // the paragraph that holds the passage. It is drawn by CSS (no text of its own), so it
  // never changes the story's collapsed text that highlights are anchored to.
  useEffect(() => {
    const root = bodyRef.current;
    if (loading || !post || !root) return;
    root.querySelectorAll('.passage-marker').forEach((el) => el.remove());
    const quoted = comments.filter((c) => c.quote);
    if (!quoted.length) return;
    const index = indexBody(root);
    const byBlock = new Map();
    quoted.forEach((comment) => {
      const at = passageStart(index, comment);
      if (at < 0) return;
      const last = elementAt(index, at + comment.quote.length - 1, at + comment.quote.length);
      if (!last) return;
      const block = last.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6') || root;
      if (!byBlock.has(block)) byBlock.set(block, []);
      byBlock.get(block).push(comment.id);
    });
    byBlock.forEach((ids, block) => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'passage-marker';
      marker.dataset.first = String(ids[0]);
      marker.dataset.count = String(ids.length);
      marker.setAttribute('aria-label', ids.length > 1 ? `इस अंश पर ${ids.length} प्रतिक्रियाएँ` : 'इस अंश पर एक प्रतिक्रिया');
      block.appendChild(marker);
    });
  }, [comments, highlights, post, loading]);

  // The "who highlighted" card closes on any outside tap, Escape, or scroll.
  useEffect(() => {
    if (!hlInfo) return undefined;
    const close = () => setHlInfo(null);
    const onDown = (e) => {
      if (!e.target.closest || !e.target.closest('.hl-info')) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
    };
  }, [hlInfo]);

  // Arriving from the highlights page (#passage-7): go to that highlighted passage.
  useEffect(() => {
    const match = /^#passage-(\d+)$/.exec(location.hash);
    if (!match || loading || !highlights.length) return undefined;
    if (jumpedTo.current === location.key) return undefined;
    const id = match[1];
    const mark = Array.from(bodyRef.current ? bodyRef.current.querySelectorAll('mark.text-highlight') : [])
      .find((el) => (el.dataset.hl || '').split(',').includes(id));
    if (!mark) return undefined;
    jumpedTo.current = location.key;
    const block = mark.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6') || mark;
    block.scrollIntoView({ block: 'center' });
    block.classList.add('passage-flash');
    const timer = setTimeout(() => block.classList.remove('passage-flash'), 2400);
    return () => clearTimeout(timer);
  }, [location.hash, loading, highlights]);

  // Arriving from a notification (#response-12): go to that response.
  useEffect(() => {
    const match = /^#response-(\d+)$/.exec(location.hash);
    if (!match || loading || !comments.length) return undefined;
    if (jumpedTo.current === location.key) return undefined;
    const target = document.getElementById(`response-${match[1]}`);
    if (!target) return undefined;
    jumpedTo.current = location.key; // once per arrival, not on every new response
    target.scrollIntoView({ block: 'center' });
    target.classList.add('response-flash');
    const timer = setTimeout(() => target.classList.remove('response-flash'), 2400);
    return () => clearTimeout(timer);
  }, [location.hash, loading, comments]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (loading) return <div className="page-loading">लोड हो रहा है…</div>;
  if (pageError === 'notfound') return <NotFound />;
  if (pageError) {
    return (
      <div className="notfound-page">
        <h1>रचना लोड नहीं हो सकी</h1>
        <p>कोई तकनीकी दिक्कत आई है। थोड़ी देर में फिर कोशिश करें।</p>
        <button type="button" className="landing-cta" onClick={fetchPost}>फिर कोशिश करें</button>{' '}
        <Link to="/" className="landing-cta">मुख्य पृष्ठ पर जाएँ</Link>
      </div>
    );
  }
  if (!post) return null;

  const authorName = post.author.full_name || post.author.username;
  const isAuthor = user && user.id === post.author_id;

  // One response (or one answer) with its author line, quoted passage, text and actions.
  const renderResponse = (comment) => (
    <div id={`response-${comment.id}`} className="response-item">
      <div className="response-head">
        <strong>{comment.author?.full_name || comment.author?.username || 'पाठक'}</strong>
        <span>{formatDate(comment.created_at)}</span>
        {user && (comment.author_id === user.id || isAuthor) && (
          <button type="button" onClick={() => handleDeleteComment(comment.id)}>हटाएँ</button>
        )}
      </div>
      {comment.quote && (
        <blockquote
          className="response-quote"
          role="button"
          tabIndex={0}
          title="रचना में यह अंश देखें"
          onClick={() => jumpToPassage(comment)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              jumpToPassage(comment);
            }
          }}
        >
          {comment.quote}
        </blockquote>
      )}
      <p>{comment.content}</p>
      <button type="button" className="response-reply" onClick={() => openReply(comment)}>जवाब दें</button>
    </div>
  );
  const paragraphs = post.content.split(/\n+/).filter((p) => p.trim());
  const tagLinks = (post.tags || []).map((name, index) => ({
    name,
    slug: (post.tag_slugs || [])[index] || encodeURIComponent(name),
  }));

  return (
    <div className="story-page" style={accentStyle}>
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
              <img src={mediaUrl(post.author.avatar_url)} alt="" />
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
          key={post.id}
          ref={bodyRef}
          onClick={handleBodyClick}
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

      <MoreStories currentId={post.id} />

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

      {hlInfo && (() => {
        const found = highlights.filter((item) => hlInfo.ids.includes(item.id));
        const readers = readerNames(found, user ? user.id : null);
        const mineIds = found.filter((item) => user && item.user_id === user.id).map((item) => item.id);
        if (!readers.length) return null;
        return (
          <div
            className="hl-info"
            style={{ left: Math.min(Math.max(hlInfo.x, 150), window.innerWidth - 150), top: Math.min(hlInfo.y + 16, window.innerHeight - 200) }}
            role="dialog"
            aria-label="हाइलाइट करने वाले पाठक"
          >
            <div className="hl-info-title">इस अंश को हाइलाइट किया</div>
            <ul>
              {readers.slice(0, 8).map((reader) => (
                <li key={reader.id}>
                  {reader.mine ? <strong>आपने</strong> : <Link to={`/user/${reader.id}`}>{reader.name}</Link>}
                </li>
              ))}
            </ul>
            {readers.length > 8 && <div className="hl-info-more">और {readers.length - 8} अन्य</div>}
            {mineIds.length > 0 && (
              <button type="button" className="hl-info-remove" onClick={() => removeMyHighlights(mineIds)}>
                मेरी हाइलाइट हटाएँ
              </button>
            )}
          </div>
        );
      })()}

      {composer && (
        <PassageComposer
          range={composer.range}
          quote={composer.quote}
          hinglish={hinglish}
          onToggleHinglish={toggleHinglish}
          finish={finishHinglish}
          onSubmit={submitPassageResponse}
          onClose={() => setComposer(null)}
        />
      )}

      {notice && (
        <div className="reading-notice" role="status">
          {notice}
        </div>
      )}

      <section className="responses" id="responses">
        <h2>प्रतिक्रियाएँ</h2>
        {isAuthenticated ? (
          <form onSubmit={handleCommentSubmit} className="response-form">
            <HindiTextarea
              value={commentText}
              onChange={setCommentText}
              hinglish={hinglish}
              onToggle={toggleHinglish}
              onSubmitKey={handleCommentSubmit}
              placeholder="अपनी प्रतिक्रिया लिखें…"
              rows={3}
              maxLength={5000}
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
          comments
            .filter((comment) => !comment.parent_id)
            .map((comment) => (
              <div key={comment.id} className="response-thread">
                {renderResponse(comment)}
                {comments
                  .filter((answer) => answer.parent_id === comment.id)
                  .map((answer) => (
                    <div key={answer.id} className="response-answer">{renderResponse(answer)}</div>
                  ))}
                {replyTo && (replyTo.id === comment.id || comments.some((a) => a.id === replyTo.id && a.parent_id === comment.id)) && (
                  <form onSubmit={handleReplySubmit} className="response-form response-answer reply-form">
                    <HindiTextarea
                      value={replyText}
                      onChange={setReplyText}
                      hinglish={hinglish}
                      onToggle={toggleHinglish}
                      onSubmitKey={handleReplySubmit}
                      placeholder={`${replyTo.name} को जवाब लिखें…`}
                      rows={2}
                      maxLength={5000}
                      autoFocus
                    />
                    <div className="reply-actions">
                      <button type="submit" disabled={submittingReply || !replyText.trim()}>
                        {submittingReply ? 'भेज रहे हैं…' : 'जवाब दें'}
                      </button>
                      <button type="button" className="reply-cancel" onClick={() => setReplyTo(null)}>रहने दें</button>
                    </div>
                  </form>
                )}
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
        <div className="action-toast" role="alert">
          <span>{actionError}</span>
          <button type="button" className="action-toast-close" onClick={() => setActionError('')} aria-label="बंद करें">
            ×
          </button>
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
