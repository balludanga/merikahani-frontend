import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../services/api';
import { transliterateLastWord } from '../utils/transliterate';
import { BRAND, TOPICS } from '../brand';
import './Editor.css';

const Editor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [hinglishOn, setHinglishOn] = useState(
    () => localStorage.getItem('lekhani_hinglish') !== 'off'
  );
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    content: '',
    cover_image: '',
    topic: '',
    tags: '',
    published: 0,
  });

  useEffect(() => {
    if (authLoading) return;
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
        topic: post.topic || '',
        tags: (post.tags || []).join(', '),
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

  // Live Hinglish→Devanagari: convert the finished word just before the caret
  // (fires when a space/newline/punctuation lands, never mid-word).
  const handleFieldInput = (field) => (e) => {
    const el = e.target;
    let value = e.target.value;
    if (hinglishOn) {
      const result = transliterateLastWord(value, el.selectionStart);
      if (result) {
        value = result.value;
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = result.caret;
        });
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Finish any word left unconverted when the field loses focus.
  const handleFieldBlur = (field) => (e) => {
    if (!hinglishOn) return;
    const el = e.target;
    const result = transliterateLastWord(e.target.value, el.selectionStart, true);
    if (result) {
      setFormData((prev) => ({ ...prev, [field]: result.value }));
    }
  };

  const toggleHinglish = () => {
    setHinglishOn((prev) => {
      const next = !prev;
      localStorage.setItem('lekhani_hinglish', next ? 'on' : 'off');
      return next;
    });
  };

  const save = async (published) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('शीर्षक और लेख दोनों लिखें।');
      return;
    }

    setSaving(true);
    const payload = {
      ...formData,
      tags: formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5),
      published,
    };
    try {
      if (isEdit) {
        const response = await postsAPI.update(id, payload);
        if (published) {
          navigate(`/post/${response.data.slug}`);
        } else {
          setShowPublish(false);
          setFormData((prev) => ({ ...prev, published: 0 }));
        }
      } else {
        const response = await postsAPI.create(payload);
        if (published) {
          navigate(`/post/${response.data.slug}`);
        } else {
          navigate(`/edit/${response.data.id}`);
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        alert(error.response?.data?.detail || 'सहेजने में समस्या हुई।');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return <div className="page-loading">लोड हो रहा है…</div>;
  }

  return (
    <div className="editor">
      <header className="editor-bar">
        <Link to="/" className="editor-logo">{BRAND.name}</Link>
        <div className="editor-bar-actions">
          <button
            type="button"
            className={`editor-translit${hinglishOn ? ' on' : ''}`}
            onClick={toggleHinglish}
            aria-pressed={hinglishOn}
            title="अंग्रेज़ी अक्षरों से लिखे शब्द स्पेस दबते ही देवनागरी में बदलें"
          >
            अ
          </button>
          <button type="button" className="editor-draft" onClick={() => save(0)} disabled={saving}>
            {saving ? 'सहेज रहे हैं…' : 'ड्राफ्ट सहेजें'}
          </button>
          <button type="button" className="editor-publish" onClick={() => setShowPublish(true)}>
            प्रकाशित करें
          </button>
        </div>
      </header>

      <form className="editor-sheet" onSubmit={(e) => e.preventDefault()}>
        <textarea
          className="editor-title"
          rows={1}
          placeholder="शीर्षक"
          value={formData.title}
          lang="hi"
          onChange={handleFieldInput('title')}
          onBlur={handleFieldBlur('title')}
        />
        <textarea
          className="editor-subtitle"
          rows={1}
          placeholder="उपशीर्षक — पाठक को एक पंक्ति में बताएँ"
          value={formData.subtitle}
          lang="hi"
          onChange={handleFieldInput('subtitle')}
          onBlur={handleFieldBlur('subtitle')}
        />
        <textarea
          className="editor-body"
          placeholder="अपनी कहानी यहाँ लिखें…"
          value={formData.content}
          lang="hi"
          onChange={handleFieldInput('content')}
          onBlur={handleFieldBlur('content')}
        />
        <p className="editor-hint">
          आसान टाइपिंग: अंग्रेज़ी अक्षरों में लिखिए — स्पेस दबते ही पूरा शब्द देवनागरी बन जाता है।
          लंबे स्वर के लिए अक्षर दोहराइए — (baar) से बार, (sitaare) से सितारे। ऊपर "अ" बटन से यह
          सुविधा बंद भी कर सकते हैं।
        </p>
      </form>

      {showPublish && (
        <div className="publish-modal" role="dialog" aria-labelledby="publish-title">
          <div className="publish-card">
            <h2 id="publish-title">प्रकाशित करने की तैयारी</h2>
            <label>
              विषय
              <select
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              >
                <option value="">चुनें</option>
                {TOPICS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              टैग (अल्पविराम से अलग करें, अधिकतम 5)
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="जैसे: कहानी, गाँव, यादें"
              />
            </label>
            <label>
              कवर चित्र की कड़ी (वैकल्पिक)
              <input
                type="url"
                value={formData.cover_image}
                onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                placeholder="(https://…)"
              />
            </label>
            <div className="publish-actions">
              <button type="button" className="editor-draft" onClick={() => setShowPublish(false)}>रद्द</button>
              <button type="button" className="editor-publish" onClick={() => save(1)} disabled={saving}>
                {saving ? 'प्रकाशित हो रहा है…' : 'अभी प्रकाशित करें'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
