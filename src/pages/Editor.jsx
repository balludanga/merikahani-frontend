import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../services/api';
import { getGrammarSuggestions } from '../services/aiService';
import ssmlTTS from '../utils/ssmlTTS';
import './Editor.css';

const Editor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [correctingTitle, setCorrectingTitle] = useState(false);
  const [correctingContent, setCorrectingContent] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    content: '',
    cover_image: '',
    published: 0,
  });
  
  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState('title'); // 'title', 'content', 'rewrite_line', etc.
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN'); // 'hi-IN' for Hindi, 'en-IN' for English
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const voiceModeRef = useRef('title'); // Keep ref in sync with state for immediate reads

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage; // Use selected language
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        // eslint-disable-next-line no-console
        console.log('Speech recognition started');
        setStatusMessage('Listening...');
      };

      recognition.onresult = (event) => {
        // Don't process if assistant is speaking
        if (isSpeakingRef.current) {
          return;
        }

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
          const trimmedText = finalText.trim();
          
          // Filter out ONLY exact assistant phrases (not partial matches)
          const assistantPhrases = [
            'please say the title of your post',
            'say done when finished',
            'continue dictating your story',
            'now tell me your story',
            'listening',
            'title saved',
            'subtitle saved',
            'content saved',
            'added to title',
            'added to content',
            'great now tell me your story'
          ];
          
          const shouldIgnore = assistantPhrases.some(phrase => 
            trimmedText.toLowerCase() === phrase || 
            trimmedText.toLowerCase().startsWith(phrase + '.')
          );
          
          if (!shouldIgnore) {
            finalTranscriptRef.current += finalText;
            handleVoiceCommand(trimmedText);
          }
        }
      };

      recognition.onerror = (event) => {
        // eslint-disable-next-line no-console
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setStatusMessage('Microphone access denied. Please allow microphone access and try again.');
          setIsListening(false);
          isListeningRef.current = false;
        } else if (event.error === 'no-speech') {
          // Just continue listening, don't stop
          setStatusMessage('Listening... (no speech detected yet)');
        } else if (event.error === 'network') {
          setStatusMessage('Network error. Please check your internet connection.');
          setIsListening(false);
          isListeningRef.current = false;
        } else {
          setStatusMessage(`Error: ${event.error}. Click to try again.`);
        }
      };

      recognition.onend = () => {
        // eslint-disable-next-line no-console
        console.log('Speech recognition ended. Should restart?', isListeningRef.current);
        
        // Auto-restart if we're supposed to be listening
        if (isListeningRef.current) {
          try {
            // eslint-disable-next-line no-console
            console.log('Restarting recognition...');
            recognition.start();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to restart:', e);
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setInterimTranscript('');
        }
      };

      recognitionRef.current = recognition;
    } else {
      setStatusMessage('Voice recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
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
  }, [selectedLanguage]); // Re-initialize when language changes

  // Handle voice commands
  const handleVoiceCommand = (command) => {
    // eslint-disable-next-line no-console
    console.log('Voice command received:', command, 'Mode:', voiceMode);
    
    const lowerCommand = command.toLowerCase();

    // Check for explicit title command
    if (lowerCommand.startsWith('title is ') || lowerCommand.startsWith('title: ')) {
      const titleText = command.substring(command.indexOf('is ') + 3).trim() || command.substring(command.indexOf(': ') + 2).trim();
      setFormData(prev => ({ ...prev, title: titleText }));
      setStatusMessage(`Title set to: "${titleText}". Say "start writing" to begin content.`);
      return;
    }

    // Check for explicit subtitle command
    if (lowerCommand.startsWith('subtitle is ') || lowerCommand.startsWith('subtitle: ')) {
      const subtitleText = command.substring(command.indexOf('is ') + 3).trim() || command.substring(command.indexOf(': ') + 2).trim();
      setFormData(prev => ({ ...prev, subtitle: subtitleText }));
      setStatusMessage(`Subtitle set to: "${subtitleText}".`);
      return;
    }

    // Check for explicit content command
    if (lowerCommand.startsWith('content is ') || lowerCommand.startsWith('content: ')) {
      const contentText = command.substring(command.indexOf('is ') + 3).trim() || command.substring(command.indexOf(': ') + 2).trim();
      setFormData(prev => ({ ...prev, content: contentText }));
      setStatusMessage('Content added.');
      return;
    }

    // Check for add to title command
    if (lowerCommand.startsWith('add to title ') || lowerCommand.includes('append to title')) {
      const textToAdd = command.substring(command.indexOf('title ') + 6).trim();
      setFormData(prev => ({ ...prev, title: prev.title + (prev.title ? ' ' : '') + textToAdd }));
      setStatusMessage(`Added to title: "${textToAdd}".`);
      return;
    }

    // Check for add to content command
    if (lowerCommand.startsWith('add to content ') || lowerCommand.includes('append to content')) {
      const textToAdd = command.substring(command.indexOf('content ') + 8).trim();
      setFormData(prev => ({ ...prev, content: prev.content + (prev.content ? ' ' : '') + textToAdd }));
      setStatusMessage('Added to content.');
      return;
    }

    // Check for clear/reset commands
    if (lowerCommand === 'clear title' || lowerCommand === 'reset title') {
      setFormData(prev => ({ ...prev, title: '' }));
      setStatusMessage('Title cleared.');
      return;
    }

    if (lowerCommand === 'clear content' || lowerCommand === 'reset content' || lowerCommand === 'clear all content') {
      setFormData(prev => ({ ...prev, content: '' }));
      setStatusMessage('Content cleared.');
      return;
    }

    if (lowerCommand === 'clear subtitle' || lowerCommand === 'reset subtitle') {
      setFormData(prev => ({ ...prev, subtitle: '' }));
      setStatusMessage('Subtitle cleared.');
      return;
    }

    // Check for rewrite commands
    if (lowerCommand.includes('rewrite')) {
      if (lowerCommand.includes('last line')) {
        rewriteLastLine();
        return;
      } else if (lowerCommand.includes('last paragraph') || lowerCommand.includes('last para')) {
        rewriteLastParagraph();
        return;
      } else if (lowerCommand.includes('last sentence')) {
        rewriteLastSentence();
        return;
      }
    }

    // Check for delete commands
    if (lowerCommand.includes('delete')) {
      if (lowerCommand.includes('last line')) {
        deleteLastLine();
        return;
      } else if (lowerCommand.includes('last paragraph') || lowerCommand.includes('last para')) {
        deleteLastParagraph();
        return;
      } else if (lowerCommand.includes('last sentence')) {
        deleteLastSentence();
        return;
      }
    }

    // Check for new paragraph command (exact match to avoid false triggers)
    if (lowerCommand === 'new paragraph' || lowerCommand === 'new para' || lowerCommand === 'paragraph') {
      addNewParagraph();
      return;
    }

    // Check for switching to content mode
    if (lowerCommand.includes('start writing') || lowerCommand.includes('start story') || lowerCommand.includes('begin content') || lowerCommand.includes('start content')) {
      voiceModeRef.current = 'content';
      setVoiceMode('content');
      setStatusMessage('Now writing content. Dictate your story.');
      return;
    }

    // Check for switching to title mode
    if (lowerCommand.includes('switch to title') || lowerCommand.includes('edit title') || lowerCommand.includes('change title')) {
      voiceModeRef.current = 'title';
      setVoiceMode('title');
      setStatusMessage('Now editing title. Dictate your title.');
      return;
    }

    // Check for done with title
    if (voiceMode === 'title' && (lowerCommand.includes('done') || lowerCommand.includes('next'))) {
      voiceModeRef.current = 'content';
      setVoiceMode('content');
      setStatusMessage('Great! Now tell me your story. Say "new paragraph" to start a new paragraph.');
      return;
    }

    // Handle rewrite modes
    if (voiceMode.startsWith('rewrite_')) {
      if (voiceMode === 'rewrite_line') {
        const lines = formData.content.split('\n');
        lines[lines.length - 1] = command;
        setFormData(prev => ({ ...prev, content: lines.join('\n') }));
        setVoiceMode('content');
        setStatusMessage('Line rewritten. Continue dictating.');
      } else if (voiceMode === 'rewrite_sentence') {
        setFormData(prev => ({ ...prev, content: prev.content + command + '. ' }));
        setVoiceMode('content');
        setStatusMessage('Sentence rewritten. Continue dictating.');
      } else if (voiceMode === 'rewrite_paragraph') {
        setFormData(prev => ({ ...prev, content: prev.content + command }));
        setVoiceMode('content');
        setStatusMessage('Paragraph rewritten. Continue dictating.');
      }
      return;
    }

    // Regular dictation - use ref for immediate mode check
    if (voiceModeRef.current === 'title') {
      setFormData(prev => ({
        ...prev,
        title: prev.title + (prev.title ? ' ' : '') + command,
      }));
      setStatusMessage(`Title: "${formData.title} ${command}". Say "done" when finished, or keep adding to the title.`);
    } else {
      // Add to content with proper spacing - use prev state to avoid overwriting
      setFormData(prev => {
        const needsSpace = prev.content && !prev.content.endsWith('\n\n') && !prev.content.endsWith('. ');
        const newContent = prev.content + (needsSpace ? ' ' : '') + command;
        return {
          ...prev,
          content: newContent,
        };
      });
      setStatusMessage('Dictating...');
    }
  };

  const rewriteLastLine = () => {
    const lines = formData.content.split('\n');
    if (lines.length > 0) {
      lines.pop();
      setFormData(prev => ({ ...prev, content: lines.join('\n') + (lines.length > 0 ? '\n' : '') }));
      setVoiceMode('rewrite_line');
      setStatusMessage('Rewriting last line. Please dictate the new line.');
      speak('Rewriting last line. Please dictate the new line.');
    }
  };

  const rewriteLastSentence = () => {
    const content = formData.content;
    const lastPeriod = Math.max(content.lastIndexOf('. '), content.lastIndexOf('! '), content.lastIndexOf('? '));
    if (lastPeriod > -1) {
      setFormData(prev => ({ ...prev, content: content.substring(0, lastPeriod + 2) }));
      setVoiceMode('rewrite_sentence');
      setStatusMessage('Rewriting last sentence. Please dictate the new sentence.');
      speak('Rewriting last sentence. Please dictate the new sentence.');
    }
  };

  const rewriteLastParagraph = () => {
    const content = formData.content;
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 0) {
      const withoutLast = paragraphs.slice(0, -1).join('\n\n');
      setFormData(prev => ({ ...prev, content: withoutLast + (withoutLast ? '\n\n' : '') }));
      setVoiceMode('rewrite_paragraph');
      setStatusMessage('Rewriting last paragraph. Please start dictating.');
      speak('Rewriting last paragraph. Please start dictating.');
    }
  };

  const deleteLastLine = () => {
    const lines = formData.content.split('\n');
    if (lines.length > 0) {
      lines.pop();
      setFormData(prev => ({ ...prev, content: lines.join('\n') }));
      setStatusMessage('Last line deleted.');
      speak('Last line deleted.');
    }
  };

  const deleteLastSentence = () => {
    const content = formData.content;
    const lastPeriod = Math.max(content.lastIndexOf('. '), content.lastIndexOf('! '), content.lastIndexOf('? '));
    if (lastPeriod > -1) {
      setFormData(prev => ({ ...prev, content: content.substring(0, lastPeriod + 2) }));
      setStatusMessage('Last sentence deleted.');
      speak('Last sentence deleted.');
    }
  };

  const deleteLastParagraph = () => {
    const content = formData.content;
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 0) {
      const withoutLast = paragraphs.slice(0, -1).join('\n\n');
      setFormData(prev => ({ ...prev, content: withoutLast }));
      setStatusMessage('Last paragraph deleted.');
      speak('Last paragraph deleted.');
    }
  };

  const addNewParagraph = () => {
    setFormData(prev => ({
      ...prev,
      content: prev.content + '\n\n',
    }));
    setStatusMessage('New paragraph started. Continue dictating.');
    // Don't speak to avoid loop - just show status
  };

  const speak = (text, useSSML = false) => {
    if (!ssmlTTS.isSupported()) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    ssmlTTS.cancel();
    isSpeakingRef.current = true;

    ssmlTTS.speak(text, {
      lang: selectedLanguage,
      voicePreferences: ['lekha', 'heera', 'veena', 'rishi'],
      rate: 0.9,
      pitch: 1.1,
      volume: 0.9,
      useSSML: useSSML,
      onEnd: () => {
        isSpeakingRef.current = false;
        setTimeout(() => {
          setInterimTranscript('');
        }, 300);
      },
      onError: () => {
        isSpeakingRef.current = false;
      }
    });
  };

  // Load voices when they become available
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Voices might not be loaded immediately
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // eslint-disable-next-line no-console
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
      };
      
      loadVoices();
      
      // Some browsers load voices asynchronously
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const startListening = async (mode = voiceMode) => {
    if (recognitionRef.current && !isListening) {
      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Microphone permission denied:', err);
        setStatusMessage('Please allow microphone access to use voice input.');
        return;
      }

      finalTranscriptRef.current = '';
      try {
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
        
        if (mode === 'title') {
          setStatusMessage('Listening for title... Say "done" when finished.');
        } else {
          setStatusMessage('Listening... Dictate your story.');
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error starting recognition:', e);
        setStatusMessage('Failed to start voice recognition. Please try again.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      isListeningRef.current = false;
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Already stopped
      }
      setIsListening(false);
      setInterimTranscript('');
      setStatusMessage('Voice input stopped.');
    }
  };

  const startTitleVoice = async () => {
    // Stop any ongoing speech immediately
    if (ssmlTTS.speaking) {
      ssmlTTS.cancel();
      isSpeakingRef.current = false;
    }
    
    voiceModeRef.current = 'title';
    setVoiceMode('title');
    await startListening('title');
  };

  const startContentVoice = async () => {
    // Stop any ongoing speech immediately
    if (ssmlTTS.speaking) {
      ssmlTTS.cancel();
      isSpeakingRef.current = false;
    }
    
    voiceModeRef.current = 'content';
    setVoiceMode('content');
    await startListening('content');
  };

  const deleteLastWord = (field) => {
    if (field === 'title') {
      const words = formData.title.trim().split(/\s+/);
      if (words.length > 0) {
        words.pop();
        setFormData(prev => ({ ...prev, title: words.join(' ') }));
      }
    } else if (field === 'content') {
      const words = formData.content.trim().split(/\s+/);
      if (words.length > 0) {
        words.pop();
        setFormData(prev => ({ ...prev, content: words.join(' ') }));
      }
    }
  };

  const correctTitle = async () => {
    if (!formData.title.trim()) {
      setStatusMessage('Title is empty. Nothing to correct.');
      return;
    }

    setCorrectingTitle(true);
    setStatusMessage('Correcting title with AI...');
    
    try {
      const correctedTitle = await getGrammarSuggestions(formData.title);
      if (correctedTitle && correctedTitle !== formData.title) {
        setFormData(prev => ({ ...prev, title: correctedTitle }));
        setStatusMessage('Title corrected!');
      } else {
        setStatusMessage('No changes needed or AI unavailable.');
      }
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Title correction error:', error);
      setStatusMessage(error.message || 'Failed to correct title. Please try again.');
      setTimeout(() => setStatusMessage(''), 5000);
    } finally {
      setCorrectingTitle(false);
    }
  };

  const correctContent = async () => {
    if (!formData.content.trim()) {
      setStatusMessage('Content is empty. Nothing to correct.');
      return;
    }

    setCorrectingContent(true);
    setStatusMessage('Correcting content with AI... This may take a moment.');
    
    try {
      const correctedContent = await getGrammarSuggestions(formData.content);
      if (correctedContent && correctedContent !== formData.content) {
        setFormData(prev => ({ ...prev, content: correctedContent }));
        setStatusMessage('Content corrected!');
      } else {
        setStatusMessage('No changes needed or AI unavailable.');
      }
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Content correction error:', error);
      setStatusMessage(error.message || 'Failed to correct content. Please try again.');
      setTimeout(() => setStatusMessage(''), 5000);
    } finally {
      setCorrectingContent(false);
    }
  };

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
      console.error('Failed to fetch post:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Please add a title to your post.');
      return;
    }
    
    if (!formData.content.trim()) {
      alert('Please add content to your post.');
      return;
    }

    setSaving(true);

    try {
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

  if (!voiceSupported) {
    return (
      <div className="editor">
        <div className="editor-container">
          <div className="voice-not-supported">
            <h2>Voice Recognition Not Supported</h2>
            <p>Please use Chrome, Edge, or Safari to use voice-powered writing.</p>
            <button onClick={() => navigate('/')} className="editor-back">Go Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor voice-editor">
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

          {statusMessage && (
            <div className="voice-status">
              {statusMessage}
            </div>
          )}

          {interimTranscript && (
            <div className="interim-transcript">
              <em>Hearing: {interimTranscript}...</em>
            </div>
          )}

          <div className="language-selector">
            <label className="language-label">Voice Language:</label>
            <div className="language-options">
              <button
                type="button"
                onClick={() => setSelectedLanguage('hi-IN')}
                className={`language-button ${selectedLanguage === 'hi-IN' ? 'active' : ''}`}
              >
                हिंदी (Hindi)
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage('en-IN')}
                className={`language-button ${selectedLanguage === 'en-IN' ? 'active' : ''}`}
              >
                English
              </button>
            </div>
          </div>

          <div className="editor-content voice-content">
            <div className="voice-preview">
              <div className="preview-section">
                <div className="preview-label-row">
                  <div className="preview-label">Title:</div>
                  <div className="preview-buttons-group">
                    <button
                      type="button"
                      onClick={isListening && voiceMode === 'title' ? stopListening : startTitleVoice}
                      className={`voice-button-small ${isListening && voiceMode === 'title' ? 'listening' : ''}`}
                    >
                      <span className="mic-icon">🎤</span>
                      {isListening && voiceMode === 'title' ? 'Stop' : 'Record'}
                    </button>
                    <button
                      type="button"
                      onClick={correctTitle}
                      className="ai-button small"
                      disabled={!formData.title || correctingTitle}
                    >
                      {correctingTitle ? 'Correcting...' : '✨ AI Correct'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, title: '' })}
                      className="delete-button small"
                      disabled={!formData.title}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  className="editor-title-input"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter your post title..."
                  style={{ width: '100%', fontSize: '1.2em', margin: '8px 0' }}
                />
              </div>
              
              <div className="preview-section">
                <div className="preview-label-row">
                  <div className="preview-label">Content:</div>
                  <div className="preview-buttons-group">
                    <button
                      type="button"
                      onClick={isListening && voiceMode === 'content' ? stopListening : startContentVoice}
                      className={`voice-button-small ${isListening && voiceMode === 'content' ? 'listening' : ''}`}
                    >
                      <span className="mic-icon">🎤</span>
                      {isListening && voiceMode === 'content' ? 'Stop' : 'Record'}
                    </button>
                    <button
                      type="button"
                      onClick={correctContent}
                      className="ai-button small"
                      disabled={!formData.content || correctingContent}
                    >
                      {correctingContent ? 'Correcting...' : '✨ AI Correct'}
                    </button>
                    <button
                      type="button"
                      onClick={addNewParagraph}
                      className="paragraph-button small"
                      disabled={!formData.content}
                      title="Add new paragraph"
                    >
                      ¶ New Para
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLastWord('content')}
                      className="delete-button small"
                      disabled={!formData.content}
                    >
                      Delete Word
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, content: '' })}
                      className="delete-button small"
                      disabled={!formData.content}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <textarea
                  className="editor-content-input"
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write your story here..."
                  rows={12}
                  style={{ width: '100%', fontSize: '1em', margin: '8px 0' }}
                />
              </div>
            </div>
          </div>

          <div className="voice-commands-help collapsed">
            <details>
              <summary>Additional Voice Commands (Optional)</summary>
              <div className="commands-section">
                <ul>
                  <li><strong>"New paragraph"</strong> - Start a new paragraph</li>
                  <li><strong>"Add to title/content [text]"</strong> - Append text</li>
                  <li><strong>"Rewrite last line/sentence/paragraph"</strong> - Replace content</li>
                </ul>
              </div>
            </details>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Editor;
