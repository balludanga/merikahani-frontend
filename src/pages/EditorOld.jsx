import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../services/api';
import './Editor.css';

const Editor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    content: '',
    cover_image: '',
    published: 0,
  });
  
  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState('title'); // 'title', 'content'
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const [currentParagraph, setCurrentParagraph] = useState('');

  // Debounced AI-powered suggestion generation
  useEffect(() => {
    if (formData.content.length > 10 && !isGeneratingSuggestion) {
      // Clear existing timeout
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }

      // Set new timeout for suggestion generation
      suggestionTimeoutRef.current = setTimeout(async () => {
        const cursorPos = textareaRef.current?.selectionStart || formData.content.length;
        setIsGeneratingSuggestion(true);
        
        try {
          const aiSuggestion = await getWritingSuggestion(formData.content, cursorPos);
          setSuggestion(aiSuggestion);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to get AI suggestion:', error);
        } finally {
          setIsGeneratingSuggestion(false);
        }
      }, 4000); // Wait 4 seconds after user stops typing
    }

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [formData.content]);

  // Debounced AI-powered spell checking
  useEffect(() => {
    // Only check spelling if not doing grammar check or generating suggestions
    if (formData.content.length > 3 && !isCheckingSpelling && !isCheckingGrammar && !isGeneratingSuggestion) {
      // Clear existing timeout
      if (spellCheckTimeoutRef.current) {
        clearTimeout(spellCheckTimeoutRef.current);
      }

      // Set new timeout for spell checking
      spellCheckTimeoutRef.current = setTimeout(async () => {
        setIsCheckingSpelling(true);
        
        try {
          const corrections = await checkSpellingWithAI(formData.content);
          
          if (corrections.length > 0) {
            let correctedText = formData.content;
            let offset = 0;
            
            // Sort corrections by position to apply them correctly
            corrections.sort((a, b) => a.position - b.position);
            
            corrections.forEach(correction => {
              const adjustedIndex = correction.position + offset;
              const before = correctedText.substring(0, adjustedIndex);
              const after = correctedText.substring(adjustedIndex + correction.original.length);
              
              // Preserve capitalization
              let correctedWord = correction.corrected;
              if (correction.original[0] === correction.original[0].toUpperCase()) {
                correctedWord = correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1);
              }
              
              correctedText = before + correctedWord + after;
              offset += correctedWord.length - correction.original.length;
            });
            
            setFormData(prev => ({
              ...prev,
              content: correctedText,
            }));
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          // eslint-disable-next-line no-console
          console.error('Failed to check spelling with AI:', error);
        } finally {
          setIsCheckingSpelling(false);
        }
      }, 5000); // Wait 5 seconds after user stops typing
    }

    return () => {
      if (spellCheckTimeoutRef.current) {
        clearTimeout(spellCheckTimeoutRef.current);
      }
    };
  }, [formData.content]);

  // Debounced AI-powered grammar checking
  useEffect(() => {
    // Only check grammar if not doing other checks
    if (formData.content.length > 20 && !isCheckingGrammar && !isCheckingSpelling && !isGeneratingSuggestion) {
      // Clear existing timeout
      if (grammarCheckTimeoutRef.current) {
        clearTimeout(grammarCheckTimeoutRef.current);
      }

      // Set new timeout for grammar checking
      grammarCheckTimeoutRef.current = setTimeout(async () => {
        setIsCheckingGrammar(true);
        
        try {
          const improvedText = await getGrammarSuggestions(formData.content);
          
          // Only apply if text is actually different
          if (improvedText && improvedText !== formData.content && improvedText.length > 0) {
            // Apply the improved text
            setFormData(prev => ({
              ...prev,
              content: improvedText,
            }));
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          // eslint-disable-next-line no-console
          console.error('Failed to check grammar with AI:', error);
        } finally {
          setIsCheckingGrammar(false);
        }
      }, 6000); // Wait 6 seconds after user stops typing for grammar check
    }

    return () => {
      if (grammarCheckTimeoutRef.current) {
        clearTimeout(grammarCheckTimeoutRef.current);
      }
    };
  }, [formData.content]);

  useEffect(() => {
    // Don't redirect while auth is still loading
    if (authLoading) {
      return;
    }
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (isEdit) {
      fetchPost();
    }
  }, [id, isAuthenticated, authLoading, navigate]);

  const fetchPost = async () => {
    try {
      const response = await postsAPI.getById(id);
      const post = response.data;
      setFormData({
        title: post.title || '',
        subtitle: post.subtitle || '',
        content: post.content || '',
        cover_image: post.cover_image || '',
        published: post.published || 0,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.error('Failed to fetch post:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Clear suggestions and grammar corrections when user modifies content
    if (name === 'content') {
      setSuggestion('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' && suggestion) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Check if cursor is at the end of current text
      const cursorPos = textarea.selectionStart;
      const content = formData.content;
      
      if (cursorPos === content.length || content[cursorPos] === ' ') {
        e.preventDefault();
        
        const beforeCursor = content.substring(0, cursorPos);
        const afterCursor = content.substring(cursorPos);
        const newContent = beforeCursor + suggestion + afterCursor;
        
        setFormData({
          ...formData,
          content: newContent,
        });

        setSuggestion('');
        
        // Set cursor position after the suggestion
        setTimeout(() => {
          const newPosition = cursorPos + suggestion.length;
          textarea.setSelectionRange(newPosition, newPosition);
          textarea.focus();
        }, 0);
      }
    } else if (e.key === 'Escape') {
      setSuggestion('');
    }
  };

  // Unused functions removed since visual feedback was removed
  // const revertCorrection = (correction) => { ... }
  // const revertGrammarCorrection = () => { ... }
  // const getHighlightedText = () => { ... } - removed since overlay was removed

  const handleGenerateTitle = async () => {
    if (!formData.content || formData.content.length < 50) {
      alert('Please write at least a few sentences before generating a title.');
      return;
    }

    setIsGeneratingTitle(true);
    try {
      const suggestedTitle = await generateTitleSuggestion(formData.content, formData.subtitle);
      if (suggestedTitle) {
        setFormData({
          ...formData,
          title: suggestedTitle,
        });
      } else {
        alert('Unable to generate title. The AI service may be temporarily overloaded. Please try again in a moment.');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.error('Failed to generate title:', error);
      const errorMsg = error.message || 'Please try again';
      alert(`Failed to generate title: ${errorMsg.includes('overloaded') ? 'AI service is busy, please wait a moment' : errorMsg}`);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.log('Submitting post with data:', formData);
      // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.log('Token:', localStorage.getItem('token'));
      
      if (isEdit) {
        await postsAPI.update(id, formData);
      } else {
        const response = await postsAPI.create(formData);
        navigate(`/post/${response.data.slug}`);
        return;
      }
      navigate('/');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save post:', error);
      // eslint-disable-next-line no-console
      console.error('Error response:', error.response?.data);
      // eslint-disable-next-line no-console
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Failed to save post. Please try again.';
      if (error.response?.status === 401) {
        errorMessage = 'You are not logged in. Please log in and try again.';
        navigate('/login');
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="editor-loading">Loading...</div>;
  }

  return (
    <div className="editor">
      <div className="editor-container">
        <form onSubmit={handleSubmit} className="editor-form">
          <div className="editor-header">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="editor-back"
            >
              ← Back
            </button>
            <div className="editor-actions">
              <label className="editor-publish-toggle">
                <input
                  type="checkbox"
                  checked={formData.published === 1}
                  onChange={(e) =>
                    setFormData({ ...formData, published: e.target.checked ? 1 : 0 })
                  }
                />
                Publish
              </label>
              <button type="submit" className="editor-save" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          <div className="editor-content">
            <div className="editor-title-wrapper">
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Title"
                className="editor-title"
                required
              />
              <button
                type="button"
                onClick={handleGenerateTitle}
                className="title-suggest-btn"
                disabled={isGeneratingTitle || !formData.content || formData.content.length < 50}
                title="Generate title from content (AI)"
              >
                {isGeneratingTitle ? (
                  <>
                    <span className="spinner">⟳</span> Generating...
                  </>
                ) : (
                  <>
                    <span className="magic-icon">✨</span> Suggest Title
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              name="subtitle"
              value={formData.subtitle}
              onChange={handleChange}
              placeholder="Subtitle (optional)"
              className="editor-subtitle"
            />
            <div className="editor-textarea-wrapper">
              <div className="editor-textarea-container-inline">
                <textarea
                  ref={textareaRef}
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell your story..."
                  className="editor-textarea"
                  required
                  rows={20}
                  spellCheck={false}
                />
              </div>
              {(isCheckingSpelling || isGeneratingSuggestion || isCheckingGrammar) && (
                <div className="ai-processing-badge">
                  {isCheckingSpelling ? 'AI checking spelling...' : isCheckingGrammar ? 'AI checking grammar...' : 'AI generating suggestion...'}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Editor;

