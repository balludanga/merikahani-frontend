import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { accentTokens } from '../utils/accent';
import { getTheme } from '../utils/theme';
import { COVER_STYLES, GENRES, LIMITS, PALETTE, coverBackground } from '../utils/profileStyle';
import { mediaUrl } from '../utils/media';
import { initials } from '../utils/format';
import HindiTextarea, { useHinglish } from '../components/HindiTextarea';
import ImageCropper from '../components/ImageCropper';
import ProfileHeader from '../components/ProfileHeader';
import './EditProfile.css';

const AVATAR = { shape: 'circle', outWidth: 512, outHeight: 512, maxBytes: 250 * 1024, title: 'प्रोफ़ाइल की तस्वीर' };
const COVER = { shape: 'wide', outWidth: 1500, outHeight: 500, maxBytes: 600 * 1024, title: 'ऊपर की पट्टी (बैनर)' };

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(blob);
  });

// A preview address pins its whole picture in memory until it is released, so every path that
// replaces or discards a preview revokes the one it drops. Idempotent: revoking twice is fine.
const release = (url) => {
  if (url) URL.revokeObjectURL(url);
};

const noImages = () => ({
  avatar: { blob: null, preview: null, remove: false },
  cover: { blob: null, preview: null, remove: false },
});

// The API's validation messages are already Hindi; drop pydantic's "Value error, " prefix.
const problem = (error) => {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => String(d.msg || '').replace(/^Value error, /, '')).filter(Boolean).join(' · ') ||
      'कुछ जानकारी सही नहीं है, कृपया जाँचें।';
  }
  return typeof detail === 'string' && detail ? detail : 'प्रोफ़ाइल सहेजी नहीं जा सकी। कृपया फिर कोशिश करें।';
};

const EditProfile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const [hinglish, toggleHinglish] = useHinglish();
  const [original, setOriginal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [snapshot, setSnapshot] = useState('');
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsFailed, setPostsFailed] = useState(false);
  const [images, setImages] = useState(noImages);
  const [cropping, setCropping] = useState(null); // { kind, file }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login?redirect=/settings/profile', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setLoadError(false);
    setPosts([]);
    setPostsLoading(true);
    setPostsFailed(false);
    (async () => {
      try {
        const profileRes = await usersAPI.getById(user.id);
        if (cancelled) return;
        const p = profileRes.data;
        const start = {
          full_name: p.full_name || '',
          tagline: p.tagline || '',
          status_line: p.status_line || '',
          location: p.location || '',
          bio: p.bio || '',
          accent: p.accent || null,
          cover_style: p.cover_style || null,
          genres: p.genres || [],
          links: (p.links || []).map((l) => ({ label: l.label || '', url: l.url })),
          pinned: p.pinned_post_ids || [],
        };
        setOriginal(p);
        setDraft(start);
        setSnapshot(JSON.stringify(start));
        try {
          const postsRes = await postsAPI.getByUser(user.id, { published: 1 });
          if (!cancelled) setPosts(postsRes.data);
        } catch (err) {
          if (!cancelled) setPostsFailed(true);
        } finally {
          if (!cancelled) setPostsLoading(false);
        }
      } catch (err) {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user && user.id, loadAttempt]);

  const dirty =
    !!draft &&
    (JSON.stringify(draft) !== snapshot ||
      !!(images.avatar.blob || images.avatar.remove || images.cover.blob || images.cover.remove));

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // A preview the writer never saved is still theirs to drop: release whatever is live when the
  // page goes away, since nothing else on it is left to revoke it.
  const liveImages = useRef(images);
  useEffect(() => {
    liveImages.current = images;
  }, [images]);
  useEffect(
    () => () => {
      release(liveImages.current.avatar.preview);
      release(liveImages.current.cover.preview);
    },
    [],
  );

  const set = (field) => (value) => setDraft((d) => ({ ...d, [field]: value }));

  const pickImage = (kind) => (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) setCropping({ kind, file });
  };

  const croppedImage = (blob) => {
    const { kind } = cropping;
    // The address is made here, not inside the updater: StrictMode may run an updater twice, and
    // the second pass would leave the first picture with no owner left to revoke it.
    const preview = URL.createObjectURL(blob);
    setImages((prev) => {
      release(prev[kind].preview);
      return { ...prev, [kind]: { blob, preview, remove: false } };
    });
    if (kind === 'cover') setDraft((d) => ({ ...d, cover_style: null }));
    setCropping(null);
  };

  const removeImage = (kind) =>
    setImages((prev) => {
      release(prev[kind].preview);
      return { ...prev, [kind]: { blob: null, preview: null, remove: true } };
    });

  const choosePreset = (key) => {
    setDraft((d) => ({ ...d, cover_style: key }));
    // A design replaces any picture.
    removeImage('cover');
  };

  const toggleGenre = (genre) =>
    setDraft((d) => {
      if (d.genres.includes(genre)) return { ...d, genres: d.genres.filter((g) => g !== genre) };
      return d.genres.length >= LIMITS.genres ? d : { ...d, genres: [...d.genres, genre] };
    });

  const setLink = (index, field, value) =>
    setDraft((d) => ({ ...d, links: d.links.map((l, i) => (i === index ? { ...l, [field]: value } : l)) }));

  const togglePin = (id) =>
    setDraft((d) => {
      if (d.pinned.includes(id)) return { ...d, pinned: d.pinned.filter((p) => p !== id) };
      return d.pinned.length >= LIMITS.pins ? d : { ...d, pinned: [...d.pinned, id] };
    });

  const movePin = (id, delta) =>
    setDraft((d) => {
      const i = d.pinned.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= d.pinned.length) return d;
      const next = [...d.pinned];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, pinned: next };
    });

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      // Pictures first, then the words; the last call returns the finished profile.
      if (images.avatar.remove && !images.avatar.blob) await usersAPI.removeAvatar();
      if (images.avatar.blob) await usersAPI.setAvatar(await readAsDataUrl(images.avatar.blob), images.avatar.blob.type);
      if (images.cover.remove && !images.cover.blob && original.cover_url) await usersAPI.removeCover();
      if (images.cover.blob) await usersAPI.setCover(await readAsDataUrl(images.cover.blob), images.cover.blob.type);

      const links = draft.links
        .filter((l) => l.url.trim())
        .map((l) => ({ label: l.label.trim() || null, url: /^[a-z]+:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}` }));
      const saved = (await usersAPI.updateProfile({
        full_name: draft.full_name,
        tagline: draft.tagline,
        status_line: draft.status_line,
        location: draft.location,
        bio: draft.bio,
        accent: draft.accent || '',
        cover_style: draft.cover_style || '',
        genres: draft.genres,
        links,
        pinned_post_ids: draft.pinned,
      })).data;
      updateUser({ full_name: saved.full_name, avatar_url: saved.avatar_url, accent: saved.accent });
      setSnapshot(JSON.stringify(draft));
      setImages((prev) => {
        release(prev.avatar.preview);
        release(prev.cover.preview);
        return noImages();
      });
      navigate(`/user/${user.id}`, { state: { saved: true } });
    } catch (err) {
      setError(problem(err));
      setSaving(false);
    }
  };

  const preview = useMemo(() => {
    if (!original || !draft) return null;
    return {
      ...original,
      full_name: draft.full_name,
      tagline: draft.tagline,
      status_line: draft.status_line,
      location: draft.location,
      bio: draft.bio,
      accent: draft.accent,
      cover_style: draft.cover_style,
      genres: draft.genres,
      links: draft.links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: /^[a-z]+:\/\//i.test(l.url) ? l.url : `https://${l.url}` })),
      avatar_url: images.avatar.remove ? null : images.avatar.preview || original.avatar_url,
      cover_url: images.cover.remove ? null : images.cover.preview || original.cover_url,
    };
  }, [original, draft, images]);

  if (loadError) {
    return (
      <div className="page-loading">
        <p>प्रोफ़ाइल लोड नहीं हो सकी।</p>
        <button type="button" className="landing-cta" onClick={() => {
          setLoadError(false);
          setLoadAttempt((attempt) => attempt + 1);
        }}>
          फिर कोशिश करें
        </button>
      </div>
    );
  }
  if (!draft || !preview) return <div className="page-loading">लोड हो रहा है…</div>;

  const adjusted = draft.accent ? accentTokens(draft.accent, getTheme()).accent : null;
  const hasCover = !images.cover.remove && (images.cover.preview || original.cover_url);
  const hasAvatar = !images.avatar.remove && (images.avatar.preview || original.avatar_url);
  const name = draft.full_name || original.username;
  const typing = { hinglish, onToggle: toggleHinglish, hideBar: true };

  return (
    <div className="ep">
      <div className="ep-head">
        <div>
          <h1>प्रोफ़ाइल सजाएँ</h1>
          <p>पाठक आपको यहीं से जानेंगे। दाईं ओर दिखता है कि आपका पन्ना कैसा लगेगा।</p>
        </div>
        <button type="button" className={`ep-typing ${hinglish ? 'on' : ''}`} onClick={toggleHinglish} aria-pressed={hinglish}>
          <span>अ</span> अंग्रेज़ी कीबोर्ड से हिंदी: {hinglish ? 'चालू' : 'बंद'}
        </button>
      </div>

      <div className="ep-grid">
        <div className="ep-form">
          <section className="ep-card">
            <h2>तस्वीरें</h2>
            <div className="ep-images">
              <div className="ep-avatar-edit">
                {hasAvatar ? (
                  <img src={images.avatar.preview || mediaUrl(original.avatar_url)} alt="" />
                ) : (
                  <span aria-hidden="true">{initials(name)}</span>
                )}
                <div>
                  <button type="button" className="ep-btn" onClick={() => avatarInput.current.click()}>
                    {hasAvatar ? 'तस्वीर बदलें' : 'तस्वीर चुनें'}
                  </button>
                  {hasAvatar && <button type="button" className="ep-link-btn" onClick={() => removeImage('avatar')}>हटाएँ</button>}
                  <p className="ep-help">चेहरा या कोई प्रतीक — गोल कटेगा।</p>
                </div>
                <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickImage('avatar')} />
              </div>
            </div>

            <h3>ऊपर की पट्टी</h3>
            <div className="ep-cover-actions">
              <button type="button" className="ep-btn" onClick={() => coverInput.current.click()}>
                {hasCover ? 'अपनी तस्वीर बदलें' : 'अपनी तस्वीर लगाएँ'}
              </button>
              {hasCover && <button type="button" className="ep-link-btn" onClick={() => removeImage('cover')}>हटाएँ</button>}
              <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickImage('cover')} />
            </div>
            <p className="ep-help">या इनमें से कोई डिज़ाइन चुनें। &ldquo;रंग से&rdquo; आपके चुने रंग से अपने आप बनता है।</p>
            <div className="ep-presets" role="radiogroup" aria-label="बैनर डिज़ाइन">
              <button
                type="button"
                role="radio"
                aria-checked={!hasCover && !draft.cover_style}
                className={`ep-preset ${!hasCover && !draft.cover_style ? 'on' : ''}`}
                style={{ background: coverBackground(null, draft.accent) }}
                onClick={() => {
                  setDraft((d) => ({ ...d, cover_style: null }));
                  removeImage('cover');
                }}
              >
                <span>रंग से</span>
              </button>
              {COVER_STYLES.map((style) => (
                <button
                  key={style.key}
                  type="button"
                  role="radio"
                  aria-checked={!hasCover && draft.cover_style === style.key}
                  className={`ep-preset ${!hasCover && draft.cover_style === style.key ? 'on' : ''}`}
                  style={{ background: style.css }}
                  onClick={() => choosePreset(style.key)}
                >
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="ep-card">
            <h2>आपका रंग</h2>
            <p className="ep-help">यह रंग आपके प्रोफ़ाइल और आपकी रचनाओं के पन्ने पर दिखेगा। पढ़ने में आसानी के लिए रंग अपने आप थोड़ा ठीक कर दिया जाता है।</p>
            <div className="ep-palette" role="radiogroup" aria-label="रंग">
              {PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={draft.accent === c.hex}
                  className={`ep-swatch ${draft.accent === c.hex ? 'on' : ''}`}
                  onClick={() => set('accent')(c.hex)}
                  title={c.label}
                >
                  <i style={{ background: c.hex }} />
                  <span>{c.label}</span>
                </button>
              ))}
              <label className={`ep-swatch custom ${draft.accent && !PALETTE.some((c) => c.hex === draft.accent) ? 'on' : ''}`}>
                <input type="color" value={draft.accent || '#0f766e'} onChange={(e) => set('accent')(e.target.value)} aria-label="अपना रंग चुनें" />
                <span>अपना रंग</span>
              </label>
              {draft.accent && <button type="button" className="ep-link-btn" onClick={() => set('accent')(null)}>रंग हटाएँ</button>}
            </div>
            {adjusted && adjusted !== draft.accent.toLowerCase() && (
              <p className="ep-help">पढ़ने लायक बनाने के लिए इसे <strong style={{ color: adjusted }}>इस रंग</strong> में बदला गया है।</p>
            )}
          </section>

          <section className="ep-card">
            <h2>परिचय</h2>
            <label className="ep-field">
              <span>नाम</span>
              <HindiTextarea singleLine value={draft.full_name} onChange={set('full_name')} maxLength={LIMITS.name} placeholder="आपका नाम" {...typing} />
            </label>
            <label className="ep-field">
              <span>एक पंक्ति में आप <em>{draft.tagline.length}/{LIMITS.tagline}</em></span>
              <HindiTextarea singleLine value={draft.tagline} onChange={set('tagline')} maxLength={LIMITS.tagline} placeholder="जैसे: गाँव की मिट्टी से कहानियाँ चुनता हूँ" {...typing} />
            </label>
            <label className="ep-field">
              <span>इन दिनों <em>{draft.status_line.length}/{LIMITS.status}</em></span>
              <HindiTextarea singleLine value={draft.status_line} onChange={set('status_line')} maxLength={LIMITS.status} placeholder="जैसे: उपन्यास का तीसरा अध्याय लिख रहा हूँ" {...typing} />
            </label>
            <label className="ep-field">
              <span>अपने बारे में <em>{draft.bio.length}/{LIMITS.bio}</em></span>
              <HindiTextarea value={draft.bio} onChange={set('bio')} maxLength={LIMITS.bio} rows={5} placeholder="आप क्या और क्यों लिखते हैं?" {...typing} />
            </label>
            <label className="ep-field">
              <span>शहर / जगह</span>
              <HindiTextarea singleLine value={draft.location} onChange={set('location')} maxLength={LIMITS.location} placeholder="जैसे: जयपुर" {...typing} />
            </label>
          </section>

          <section className="ep-card">
            <h2>आप क्या लिखते हैं <em>{draft.genres.length}/{LIMITS.genres}</em></h2>
            <div className="ep-chips">
              {GENRES.map((genre) => {
                const on = draft.genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    className={`ep-chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    disabled={!on && draft.genres.length >= LIMITS.genres}
                    onClick={() => toggleGenre(genre)}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ep-card">
            <h2>लिंक <em>{draft.links.length}/{LIMITS.links}</em></h2>
            <p className="ep-help">आपकी वेबसाइट, सोशल मीडिया या किताब। पता डालें, जैसे (instagram.com/नाम)</p>
            {draft.links.map((link, index) => (
              <div className="ep-link-row" key={index}>
                <input
                  type="text"
                  inputMode="url"
                  value={link.url}
                  onChange={(e) => setLink(index, 'url', e.target.value)}
                  placeholder="लिंक का पता"
                  aria-label="लिंक का पता"
                  maxLength={300}
                />
                <input
                  type="text"
                  lang="hi"
                  value={link.label}
                  onChange={(e) => setLink(index, 'label', e.target.value)}
                  placeholder="नाम (वैकल्पिक)"
                  aria-label="लिंक का नाम"
                  maxLength={30}
                />
                <button type="button" className="ep-icon-btn" onClick={() => setDraft((d) => ({ ...d, links: d.links.filter((_, i) => i !== index) }))} aria-label="यह लिंक हटाएँ">×</button>
              </div>
            ))}
            {draft.links.length < LIMITS.links && (
              <button type="button" className="ep-btn" onClick={() => setDraft((d) => ({ ...d, links: [...d.links, { label: '', url: '' }] }))}>
                + लिंक जोड़ें
              </button>
            )}
          </section>

          <section className="ep-card">
            <h2>चुनिंदा रचनाएँ <em>{draft.pinned.length}/{LIMITS.pins}</em></h2>
            <p className="ep-help">आपकी सबसे अच्छी रचनाएँ, जो प्रोफ़ाइल पर सबसे ऊपर दिखेंगी।</p>
            {postsLoading ? (
              <p className="ep-help">रचनाएँ लोड हो रही हैं…</p>
            ) : postsFailed ? (
              <p className="ep-help">
                रचनाएँ लोड नहीं हो सकीं।{' '}
                <button type="button" className="ep-btn" onClick={async () => {
                  setPostsLoading(true);
                  setPostsFailed(false);
                  try {
                    const response = await postsAPI.getByUser(user.id, { published: 1 });
                    setPosts(response.data);
                  } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to fetch profile editor posts:', err);
                    setPostsFailed(true);
                  } finally {
                    setPostsLoading(false);
                  }
                }}>
                  फिर कोशिश करें
                </button>
              </p>
            ) : posts.length === 0 ? (
              <p className="ep-help">अभी कोई प्रकाशित रचना नहीं। <Link to="/new-story">लिखना शुरू करें</Link></p>
            ) : (
              <ul className="ep-posts">
                {[...posts].sort((a, b) => {
                  const ia = draft.pinned.indexOf(a.id);
                  const ib = draft.pinned.indexOf(b.id);
                  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                  return 0;
                }).map((post) => {
                  const slot = draft.pinned.indexOf(post.id);
                  const on = slot >= 0;
                  return (
                    <li key={post.id} className={on ? 'on' : ''}>
                      <label>
                        <input type="checkbox" checked={on} disabled={!on && draft.pinned.length >= LIMITS.pins} onChange={() => togglePin(post.id)} />
                        <span>{post.title}</span>
                      </label>
                      {on && (
                        <span className="ep-order">
                          <button type="button" onClick={() => movePin(post.id, -1)} disabled={slot === 0} aria-label="ऊपर करें">▲</button>
                          <button type="button" onClick={() => movePin(post.id, 1)} disabled={slot === draft.pinned.length - 1} aria-label="नीचे करें">▼</button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="ep-preview" aria-label="प्रोफ़ाइल कैसी दिखेगी">
          <h2>ऐसी दिखेगी आपकी प्रोफ़ाइल</h2>
          <ProfileHeader profile={preview} compact />
        </aside>
      </div>

      <div className="ep-bar" role="region" aria-label="सहेजें">
        <span className={`ep-state ${error ? 'bad' : ''}`} role={error ? 'alert' : undefined}>
          {error || (dirty ? 'बदलाव अभी सहेजे नहीं गए' : 'कोई नया बदलाव नहीं')}
        </span>
        <Link to={`/user/${user.id}`} className="ep-btn ghost">रहने दें</Link>
        <button type="button" className="ep-save" onClick={save} disabled={saving || !dirty}>
          {saving ? 'सहेज रहे हैं…' : 'प्रोफ़ाइल सहेजें'}
        </button>
      </div>

      {cropping && (
        <ImageCropper
          file={cropping.file}
          {...(cropping.kind === 'avatar' ? AVATAR : COVER)}
          onCancel={() => setCropping(null)}
          onDone={croppedImage}
        />
      )}
    </div>
  );
};

export default EditProfile;
