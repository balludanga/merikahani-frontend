import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { postsAPI, commentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags, generateStructuredData, resetMetaTags } from '../utils/seo';
import './PostView.css';

const PostView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  
  // Comment states
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isListeningComment, setIsListeningComment] = useState(false);
  const [commentLanguage, setCommentLanguage] = useState('hi-IN');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    fetchPost();
    
    // Cleanup: Reset meta tags when component unmounts
    return () => {
      resetMetaTags();
    };
  }, [slug]);

  // Handle redirect back to comment section after login
  useEffect(() => {
    if (!loading && post) {
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && redirectPath.includes('#comments')) {
        // eslint-disable-next-line no-console
        console.log('Redirecting to comments section');
        sessionStorage.removeItem('redirectAfterLogin');
        // Scroll to comment section after a brief delay to ensure DOM is ready
        setTimeout(() => {
          const commentSection = document.querySelector('.comment-section');
          // eslint-disable-next-line no-console
          console.log('Comment section found:', commentSection);
          if (commentSection) {
            commentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Auto-focus on the record button
            const recordButton = document.querySelector('.voice-button-comment');
            if (recordButton) {
              recordButton.focus();
            }
          }
        }, 500);
      }
    }
  }, [loading, post]);

  const fetchPost = async () => {
    try {
      const response = await postsAPI.getBySlug(slug);
      setPost(response.data);
      
      // Update SEO meta tags
      updateMetaTags({
        title: response.data.title,
        description: response.data.subtitle || response.data.content.substring(0, 160),
        keywords: `${response.data.title}, कहानी, hindi story, ${response.data.author.username}`,
        image: response.data.cover_image || 'https://merikahani.com/default-image.jpg',
        url: `https://merikahani.com/post/${response.data.slug}`,
        type: 'article',
      });
      
      // Generate structured data
      generateStructuredData(response.data, response.data.author);
      
      // Fetch comments for this post
      await fetchComments(response.data.id);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch post:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId) => {
    try {
      const response = await commentsAPI.getByPost(postId);
      setComments(response.data);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    setDeleting(true);
    try {
      await postsAPI.delete(post.id);
      navigate('/');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setDeleting(false);
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

  const startReading = () => {
    if (!post || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in your browser.');
      return;
    }

    // If paused, resume
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsReading(true);
      return;
    }

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    // Combine title and content
    const textToRead = `${post.title}. ${post.subtitle ? post.subtitle + '. ' : ''}${post.content}`;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    
    // Find Lekha or other Indian English voice
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('lekha')
    ) || voices.find(voice => 
      voice.lang === 'en-IN' && voice.name.toLowerCase().includes('female')
    ) || voices.find(voice => 
      voice.lang === 'en-IN'
    ) || voices.find(voice => 
      voice.name.toLowerCase().includes('indian')
    );

    if (indianVoice) {
      utterance.voice = indianVoice;
      // eslint-disable-next-line no-console
      console.log('Using voice:', indianVoice.name);
    }

    // Voice characteristics - gentle, warm tone
    utterance.rate = 0.9;  // Slightly slower for clarity
    utterance.pitch = 1.1;  // Slightly higher for feminine tone
    utterance.volume = 1.0;  // Full volume

    utterance.onstart = () => {
      setIsReading(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsReading(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      // eslint-disable-next-line no-console
      console.error('Speech synthesis error:', event);
      setIsReading(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    speechSynthesisRef.current = window.speechSynthesis;
    window.speechSynthesis.speak(utterance);
  };

  const pauseReading = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsReading(false);
    }
  };

  const stopReading = () => {
    window.speechSynthesis.cancel();
    setIsReading(false);
    setIsPaused(false);
    utteranceRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Initialize comment voice recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = commentLanguage;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcriptPart + ' ';
          } else {
            interimText += transcriptPart;
          }
        }

        setInterimTranscript(interimText);

        if (finalText) {
          setCommentText(prev => prev + (prev ? ' ' : '') + finalText.trim());
        }
      };

      recognition.onerror = (event) => {
        // eslint-disable-next-line no-console
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access.');
        }
        setIsListeningComment(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setIsListeningComment(false);
            isListeningRef.current = false;
          }
        } else {
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        isListeningRef.current = false;
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Already stopped
        }
      }
    };
  }, [commentLanguage]);

  const startCommentVoice = async () => {
    // Check if user is logged in
    if (!user) {
      // Save current location to redirect back after login
      const currentPath = window.location.pathname;
      sessionStorage.setItem('redirectAfterLogin', currentPath + '#comments');
      navigate('/login');
      return;
    }

    if (!recognitionRef.current) return;

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert('Please allow microphone access to use voice input.');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListeningComment(true);
      isListeningRef.current = true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error starting recognition:', e);
    }
  };

  const stopCommentVoice = () => {
    if (recognitionRef.current && isListeningComment) {
      isListeningRef.current = false;
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Already stopped
      }
      setIsListeningComment(false);
      setInterimTranscript('');
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user || !post) return;

    setSubmittingComment(true);
    try {
      // Stop voice input if active
      if (isListeningComment) {
        stopCommentVoice();
      }

      // Save comment to backend
      const response = await commentsAPI.create({
        content: commentText,
        post_id: post.id
      });
      
      // Add the new comment to the list
      setComments(prev => [...prev, response.data]);
      setCommentText('');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit comment:', error);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm(commentLanguage === 'hi-IN' ? 'क्या आप यह टिप्पणी हटाना चाहते हैं?' : 'Are you sure you want to delete this comment?')) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      await commentsAPI.delete(commentId);
      // Remove comment from local state
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete comment:', error);
      alert(commentLanguage === 'hi-IN' ? 'टिप्पणी हटाने में विफल। कृपया पुनः प्रयास करें।' : 'Failed to delete comment. Please try again.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  if (loading) {
    return <div className="post-view-loading">Loading...</div>;
  }

  if (!post) {
    return null;
  }

  const isAuthor = user && user.id === post.author_id;

  return (
    <div className="post-view">
      <article className="post-view-container">
        <header className="post-view-header">
          <h1 className="post-view-title">{post.title}</h1>
          {post.subtitle && (
            <p className="post-view-subtitle">{post.subtitle}</p>
          )}
          <div className="post-view-meta">
            <div className="post-view-author">
              <Link to={`/user/${post.author.id}`} className="author-link">
                {post.author.full_name || post.author.username}
              </Link>
              <span className="post-view-date">{formatDate(post.created_at)}</span>
            </div>
            <div className="post-view-controls">
              <div className="voice-controls">
                {!isReading && !isPaused && (
                  <button onClick={startReading} className="voice-control-button play">
                    <span className="voice-icon">🔊</span>
                    Listen to Article
                  </button>
                )}
                {isReading && (
                  <button onClick={pauseReading} className="voice-control-button pause">
                    <span className="voice-icon">⏸️</span>
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button onClick={startReading} className="voice-control-button resume">
                    <span className="voice-icon">▶️</span>
                    Resume
                  </button>
                )}
                {(isReading || isPaused) && (
                  <button onClick={stopReading} className="voice-control-button stop">
                    <span className="voice-icon">⏹️</span>
                    Stop
                  </button>
                )}
              </div>
              {isAuthor && (
                <div className="post-view-actions">
                  <Link to={`/edit/${post.id}`} className="post-action-button">
                    Edit
                  </Link>
                  <button
                    onClick={handleDelete}
                    className="post-action-button delete"
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="post-view-content">
          {post.content.split('\n').map((paragraph, index) => (
            <p key={index} className="post-paragraph">
              {paragraph}
            </p>
          ))}
        </div>
      </article>

      {/* Comment Section */}
      <section className="comment-section">
        <h2 className="comment-section-title">Comments</h2>
        
        {/* Add Comment Form */}
        <div className="comment-form">
          <h3 className="comment-form-title">Add a Comment</h3>
          
          {/* Language Selector */}
          <div className="language-selector">
            <button
              onClick={() => setCommentLanguage('hi-IN')}
              className={`language-button ${commentLanguage === 'hi-IN' ? 'active' : ''}`}
            >
              हिंदी
            </button>
            <button
              onClick={() => setCommentLanguage('en-IN')}
              className={`language-button ${commentLanguage === 'en-IN' ? 'active' : ''}`}
            >
              English
            </button>
          </div>

          {/* Voice Recording Button */}
          <div className="comment-voice-controls">
            <button
              onClick={isListeningComment ? stopCommentVoice : startCommentVoice}
              className={`voice-button-comment ${isListeningComment ? 'recording' : ''}`}
            >
              {isListeningComment ? '⏹️ Stop Recording' : '🎤 Record Comment'}
            </button>
          </div>

          {/* Comment Text Display */}
          <div className="comment-input-container">
            <textarea
              className="comment-textarea"
              value={commentText + interimTranscript}
              readOnly
              placeholder={`${commentLanguage === 'hi-IN' ? 'अपनी टिप्पणी बोलें...' : 'Speak your comment...'}`}
              rows="4"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleCommentSubmit}
            className="comment-submit-button"
            disabled={submittingComment || !commentText.trim()}
          >
            {submittingComment ? 'Submitting...' : (commentLanguage === 'hi-IN' ? 'टिप्पणी जोड़ें' : 'Add Comment')}
          </button>
        </div>

        {/* Comments List */}
        <div className="comments-list">
          <h3 className="comments-list-title">
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </h3>
          
          {comments.length === 0 ? (
            <p className="no-comments">
              {commentLanguage === 'hi-IN' ? 'अभी तक कोई टिप्पणी नहीं है। पहले टिप्पणी करें!' : 'No comments yet. Be the first to comment!'}
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <div className="comment-author-info">
                    <span className="comment-author">
                      {comment.author?.username || comment.author?.full_name || 'Anonymous'}
                    </span>
                    <span className="comment-date">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  {user && (comment.author_id === user.id || post?.author_id === user.id) && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="comment-delete-button"
                      disabled={deletingCommentId === comment.id}
                      title={commentLanguage === 'hi-IN' ? 'टिप्पणी हटाएं' : 'Delete comment'}
                    >
                      {deletingCommentId === comment.id ? '⏳' : '🗑️'}
                    </button>
                  )}
                </div>
                <p className="comment-content">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default PostView;

