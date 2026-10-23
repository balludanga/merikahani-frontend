import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useNavigationType } from 'react-router-dom';
import ReactQuill from 'react-quill';
import Quill from 'quill';
import 'react-quill/dist/quill.bubble.css';
import { useAuth } from '../context/AuthContext';
import { postsAPI, uploadsAPI } from '../services/api';
import { transliterateLastWord, dandaOnDoubleSpace } from '../utils/transliterate';
import { initials } from '../utils/format';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import { compressImage, blobToDataUrl } from '../utils/imageCompress';
import '../utils/quillHindi';
import { BRAND, TOPICS } from '../brand';
import './Editor.css';
import { mediaUrl } from '../utils/media';

const EMPTY_DOC = '<p><br></p>';

// Horizontal-rule embed (block menu → विभाजक). Sanitizer keeps it as <hr class="ql-divider">.
const Embed = Quill.import('blots/embed');
class DividerBlot extends Embed {
  static create() {
    const node = super.create();
    node.setAttribute('role', 'separator');
    return node;
  }

  // Parchment's Embed has no static value(); matchBlot calls it on every
  // <hr> during paste conversion, so it must be defined or the whole paste
  // throws. The divider carries no data — any non-null value keeps it alive.
  static value() {
    return true;
  }
}
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
DividerBlot.className = 'ql-divider';
Quill.register(DividerBlot);

// Table block embed. Quill 1.3.7 has no editable-table support, so a table is
// an atomic read-only block: the ⊕ block menu or a double-click opens the cell
// dialog, and the blot renders real <table> DOM. react-quill serializes
// editor.root.innerHTML, so the stored HTML is a genuine table that bleach
// keeps and the reader page styles; on reload Parchment finds the registered
// TABLE tag and matchBlot rebuilds the embed from the cell text.
const BlockEmbed = Quill.import('blots/block/embed');
class TableBlot extends BlockEmbed {
  static create(value) {
    const node = super.create(value);
    const rows = (value && Array.isArray(value.rows) && value.rows.length) ? value.rows : [['']];
    node.setAttribute('class', 'ql-table');
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('data-table', JSON.stringify(value || { rows }));
    node.innerHTML = TableBlot.renderTable(rows);
    return node;
  }

  static renderTable(rows) {
    const cell = (tag, text) => `<${tag}>${TableBlot.escape(text)}</${tag}>`;
    const head = `<thead><tr>${rows[0].map((t) => cell('th', t)).join('')}</tr></thead>`;
    const bodyRows = rows.slice(1);
    const body = bodyRows.length
      ? `<tbody>${bodyRows.map((r) => `<tr>${r.map((t) => cell('td', t)).join('')}</tr>`).join('')}</tbody>`
      : '';
    return head + body;
  }

  static escape(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  static value(domNode) {
    // Prefer the live dataset; fall back to parsing cells (stored HTML has
    // no data-* attributes after server sanitization).
    const raw = domNode.getAttribute('data-table');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        // fall through to DOM parse
      }
    }
    const rows = Array.from(domNode.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.cells).map((c) => c.textContent)
    );
    return { rows: rows.length ? rows : [['']] };
  }
}
TableBlot.blotName = 'table';
TableBlot.tagName = 'TABLE';
Quill.register(TableBlot);

// Block embeds must end their line: append the newline the line model needs
// when pasted HTML is converted back to a delta.
const matchTableLine = (node, delta) => delta.insert('\n');

// Module-level bridges: Quill config must stay referentially stable, while
// these let the editor instance reach live React state (mode, dialogs).
const hindiMode = { on: true };
const editorHooks = {};

const MODULES = {
  toolbar: {
    // A whisper-quiet text row only — like the reference. Headings, lists,
    // code, media and dividers all live behind the gutter ⊕ block menu,
    // so the floating selection bar never crowds the words being written.
    container: [
      ['bold', 'italic', 'underline', 'strike'],
      ['link', 'blockquote'],
    ],
    handlers: {
      link: function linkHandler() {
        if (editorHooks.openLink) editorHooks.openLink(this.quill.getSelection());
      },
      image: function imageHandler() {
        // Never Quill's default base64 file input — route to the upload flow.
        if (editorHooks.pickImage) editorHooks.pickImage();
      },
    },
  },
  hindiTransliteration: { isEnabled: () => hindiMode.on },
  clipboard: {
    matchVisual: false,
    matchers: [['table', matchTableLine]],
  },
};

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Older articles stored plain text; present them as paragraphs.
const plainToHtml = (text) =>
  (text || '')
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line) => `<p>${escapeHtml(line.trim())}</p>`)
    .join('') || EMPTY_DOC;

// The block menu the gutter ⊕ opens — the single entry point for inserting
// headings, quotes, lists, code, dividers and media. (The old "/" keyboard
// trigger was removed; the ⊕ fully replaces it.) Each action is an icon button
// with a Devanagari tooltip; icons are plain SVG strokes — no Latin letters.
const BLOCK_ACTIONS = [
  {
    id: 'h1',
    label: 'शीर्षक 1',
    icon: (<><path d="M4 7h16" strokeWidth="2.4" /><path d="M4 13h16" /><path d="M4 18.5h10" /></>),
  },
  {
    id: 'h2',
    label: 'शीर्षक 2',
    icon: (<><path d="M4 8h16" strokeWidth="2" /><path d="M4 14h16" /><path d="M4 19h7" /></>),
  },
  {
    id: 'h3',
    label: 'शीर्षक 3',
    icon: (<><path d="M4 9h16" strokeWidth="1.6" /><path d="M4 15h16" /></>),
  },
  {
    id: 'quote',
    label: 'उद्धरण',
    icon: <path d="M6.5 7.5H11V13c0 2.4-1.6 3.9-4.5 4.5M13 7.5h4.5V13c0 2.4-1.6 3.9-4.5 4.5" />,
  },
  {
    id: 'bullet',
    label: 'सूची',
    icon: (<><circle cx="5" cy="7" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="5" cy="17" r="1.3" /><path d="M9.5 7H20M9.5 12H20M9.5 17H20" /></>),
  },
  {
    id: 'numbered',
    label: 'क्रमांकित सूची',
    icon: (<><path d="M9.5 7H20M9.5 12H20M9.5 17H20" /><text x="2.4" y="9" fontSize="6.5" fill="currentColor" stroke="none">१</text><text x="2.4" y="14" fontSize="6.5" fill="currentColor" stroke="none">२</text><text x="2.4" y="19" fontSize="6.5" fill="currentColor" stroke="none">३</text></>),
  },
  {
    id: 'code',
    label: 'कोड ब्लॉक',
    icon: <path d="M8.6 7L4.5 12l4.1 5M15.4 7l4.1 5-4.1 5" />,
  },
  {
    id: 'divider',
    label: 'विभाजक रेखा',
    icon: <path d="M4 12h16" />,
  },
  {
    id: 'image',
    label: 'चित्र जोड़ें',
    icon: (<><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.7" cy="10" r="1.5" /><path d="M21 15.5l-4.8-4.8L6 20" /></>),
  },
  {
    id: 'video',
    label: 'वीडियो जोड़ें',
    icon: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10.2 9.3l4.8 2.7-4.8 2.7z" /></>),
  },
  {
    id: 'table',
    label: 'सारणी जोड़ें',
    icon: (<><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15" /></>),
  },
];

const emptyCells = (rows, cols) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

const Editor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigationType = useNavigationType();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  // null | 'notfound' (403/404) | 'error' (network, 5xx, timeout)
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [autoStatus, setAutoStatus] = useState('idle'); // idle | saving | saved | error
  const [savedAt, setSavedAt] = useState('');
  const [showPublish, setShowPublish] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dialog, setDialog] = useState(null); // link/image/video: {kind, range, value} · table: {kind, cells, blot?}
  const [gutter, setGutter] = useState(null); // { index, top } — ⊕ button beside the active block
  const [addOpen, setAddOpen] = useState(false);
  const [barMenuOpen, setBarMenuOpen] = useState(false); // ⋯ overflow menu in the bar
  const [bodyFocused, setBodyFocused] = useState(false); // dims the title while writing the body
  const [uploading, setUploading] = useState(false);
  // Lightweight in-editor notice replaces jarring native alert() popups.
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const notify = (message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };
  const [hinglishOn, setHinglishOn] = useState(
    () => localStorage.getItem('lekhani_hinglish') !== 'off'
  );
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    content: '',
    content_html: '',
    cover_image: '',
    topic: '',
    tags: '',
    published: 0,
  });
  const quillRef = useRef(null);
  const autoTimer = useRef(null);
  const autosaveInFlight = useRef(false);
  const saveSeq = useRef(0);
  const fileInputRef = useRef(null);
  // Where a device-picked image should land (the gutter ⊕ block index), since
  // the Quill selection is lost while the OS file dialog is open.
  const pendingImageIndexRef = useRef(null);
  const coverInputRef = useRef(null);
  const bodyWrapRef = useRef(null);
  const barMenuRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);

  const getEditor = () => (quillRef.current ? quillRef.current.getEditor() : null);
  const mirrorKey = `lekhani_mirror_${isEdit ? id : `new_${user?.id ?? 'anon'}`}`;

  useEffect(() => {
    hindiMode.on = hinglishOn;
  }, [hinglishOn]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // The editor is private — keep it out of search indexes.
  useEffect(() => {
    updateMetaTags({ title: 'लिखें', type: 'website', noindex: true });
    return () => resetMetaTags();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isEdit) {
      fetchPost();
    } else if (navigationType === 'POP') {
      // Recover an interrupted compose ONLY on a genuine reload / back-nav into
      // the editor. A fresh "लिखें" click (PUSH) starts a blank new draft.
      restoreMirror();
    } else {
      clearMirror();
    }
  }, [id, isAuthenticated, authLoading, navigate, navigationType, isEdit]);

  const fetchPost = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const response = await postsAPI.getById(id);
      const post = response.data;
      setFormData({
        title: post.title || '',
        subtitle: post.subtitle || '',
        content: post.content || '',
        content_html: post.content_html || plainToHtml(post.content),
        cover_image: post.cover_image || '',
        topic: post.topic || '',
        tags: (post.tags || []).join(', '),
        published: post.published || 0,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch post:', error);
      const status = error.response?.status;
      setLoadError(status === 403 || status === 404 ? 'notfound' : 'error');
    } finally {
      setLoading(false);
    }
  };

  // A local mirror survives refreshes and failed saves; the newest content
  // always wins when the editor reopens in compose mode.
  const writeMirror = (data) => {
    try {
      localStorage.setItem(mirrorKey, JSON.stringify({ data, at: Date.now() }));
    } catch (err) {
      // storage full or blocked — autosave to the server still works.
    }
  };

  const restoreMirror = () => {
    try {
      const raw = localStorage.getItem(mirrorKey);
      if (!raw) return;
      const mirror = JSON.parse(raw);
      if (mirror && mirror.data && (mirror.data.title || mirror.data.content)) {
        setFormData((prev) => ({ ...prev, ...mirror.data }));
      }
    } catch (err) {
      // unreadable mirror — start fresh.
    }
  };

  // Drop any stale local draft so a fresh "लिखें" always opens a blank page.
  const clearMirror = () => {
    try {
      localStorage.removeItem(mirrorKey);
    } catch (err) {
      // storage blocked — nothing to clear.
    }
  };

  useEffect(() => {
    const flush = () => writeMirror(formData);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [formData]);

  // Global editor shortcut: Ctrl/Cmd+Shift+H toggles Hinglish→Devanagari.
  // (The old "/" block-menu trigger was removed — the gutter ⊕ replaces it.)
  useEffect(() => {
    const editor = getEditor();
    if (!editor || loading) return undefined;
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        toggleHinglish();
      }
    };
    editor.root.addEventListener('keydown', onKeyDown);
    return () => editor.root.removeEventListener('keydown', onKeyDown);
    // authLoading in deps: during the loading placeholder ReactQuill is not
    // mounted yet, so this effect must re-run once the editor actually exists.
  }, [loading, authLoading, hinglishOn]);

  // Track the caret's line so the gutter ⊕ button can hug the active block.
  useEffect(() => {
    const editor = getEditor();
    if (!editor || loading || authLoading) return undefined;
    const onSelectionChanged = (range) => {
      setBodyFocused(!!range);
      if (!range) {
        setGutter(null);
        setAddOpen(false);
        return;
      }
      const bounds = editor.getBounds(range.index, 0);
      if (bounds) {
        setGutter({ index: range.index, top: bounds.top + (bounds.height || 24) / 2 - 19 });
      }
    };
    // Quill 1.3.7's event is "selection-change" (not "selection-changed").
    editor.on('selection-change', onSelectionChanged);
    return () => editor.off('selection-change', onSelectionChanged);
  }, [loading, authLoading]);

  // The fanned-out add row behaves like a menu: Escape or a click anywhere
  // outside it folds the ⊕ back up.
  useEffect(() => {
    if (!addOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setAddOpen(false);
    };
    const onClick = () => setAddOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [addOpen]);

  // The ⋯ overflow menu dismisses like any menu: outside click or Escape.
  useEffect(() => {
    if (!barMenuOpen) return undefined;
    const onDocClick = (e) => {
      if (barMenuRef.current && !barMenuRef.current.contains(e.target)) setBarMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setBarMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [barMenuOpen]);

  // Modal dialogs (link/image/video/table and the publish sheet) close on
  // Escape, matching the in-app confirm modal elsewhere in the app.
  useEffect(() => {
    if (!dialog && !showPublish) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dialog) setDialog(null);
      else if (showPublish) setShowPublish(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, showPublish]);

  // Dialog hooks for Quill handlers (link/image buttons in the floating toolbar).
  useEffect(() => {
    editorHooks.openLink = (range) => {
      const editor = getEditor();
      const sel = range || (editor && editor.getSelection());
      if (!sel) return;
      setDialog({ kind: 'link', range: sel, value: '' });
    };
    editorHooks.pickImage = () => {
      if (fileInputRef.current) fileInputRef.current.click();
    };
  }, []);

  // Compress a device file and upload it; resolves to the stored image URL.
  const uploadImageFile = async (file) => {
    const blob = await compressImage(file);
    const dataUrl = await blobToDataUrl(blob);
    const response = await uploadsAPI.uploadImage(dataUrl, blob.type || 'image/jpeg');
    return response.data.url;
  };

  // Insert a device-picked image into the body at the block the ⊕ was opened
  // on (falling back to the current selection). Any failure falls back to the
  // URL dialog so writers are never stuck without an image.
  const insertImageFile = async (file) => {
    const editor = getEditor();
    if (!editor || !file) return;
    const sel = editor.getSelection();
    const index = pendingImageIndexRef.current != null
      ? pendingImageIndexRef.current
      : (sel ? sel.index : editor.getLength());
    pendingImageIndexRef.current = null;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      editor.insertEmbed(index, 'image', url, 'api');
      editor.setSelection(index + 1, 0, 'api');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        navigate('/login');
        return;
      }
      const detail = error.response && error.response.data && error.response.data.detail;
      notify(detail || 'चित्र अपलोड नहीं हो पाया — कड़ी (URL) से जोड़ सकते हैं।');
      setDialog({ kind: 'image', range: { index }, value: '' });
    } finally {
      setUploading(false);
    }
  };

  // Device upload for the story's cover image (publish sheet).
  const uploadCoverFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      setFormData((prev) => ({ ...prev, cover_image: url }));
    } catch (error) {
      if (error.response && error.response.status === 401) {
        navigate('/login');
        return;
      }
      const detail = error.response && error.response.data && error.response.data.detail;
      notify(detail || 'कवर चित्र अपलोड नहीं हो पाया।');
    } finally {
      setUploading(false);
    }
  };

  // Drag-and-drop and paste of image files, plus table re-editing.
  useEffect(() => {
    const editor = getEditor();
    const wrap = bodyWrapRef.current;
    if (!editor || !wrap || loading) return undefined;

    const imageFromTransfer = (e) => {
      const list = (e.dataTransfer && e.dataTransfer.files) || (e.clipboardData && e.clipboardData.files);
      if (!list || !list.length) return null;
      const file = list[0];
      return file.type && file.type.indexOf('image/') === 0 ? file : null;
    };
    // Capture phase on the wrapper beats Quill's own drop/paste handlers,
    // which would embed an uncompressed base64 monster.
    const onDrop = (e) => {
      const file = imageFromTransfer(e);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      insertImageFile(file);
    };
    const onPaste = (e) => {
      const file = imageFromTransfer(e);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      insertImageFile(file);
    };
    // Double-click a table to edit its cells.
    const onDblClick = (e) => {
      const table = e.target.closest && e.target.closest('table.ql-table');
      if (!table) return;
      const blot = Quill.find(table);
      const value = TableBlot.value(table);
      setDialog({ kind: 'table', cells: value.rows.map((row) => row.slice()), blot });
    };
    wrap.addEventListener('drop', onDrop, true);
    wrap.addEventListener('paste', onPaste, true);
    editor.root.addEventListener('dblclick', onDblClick);
    return () => {
      wrap.removeEventListener('drop', onDrop, true);
      wrap.removeEventListener('paste', onPaste, true);
      editor.root.removeEventListener('dblclick', onDblClick);
    };
    // Listeners bind once after mount; insertImageFile reads fresh state via refs.
    // authLoading in deps: the editor only exists after the auth gate clears.
  }, [loading, authLoading]);

  // Inserts a block at `index` — used by the gutter ⊕ block menu.
  const applyBlockAction = (action, index) => {
    const editor = getEditor();
    if (!editor) return;
    editor.focus();
    editor.setSelection(index, 0, 'api');
    if (action === 'h1' || action === 'h2' || action === 'h3') {
      // `header` is a block format — formatText ignores it; formatLine applies
      // it to the line under the caret (same as quote/list/code below).
      editor.formatLine(index, 0, 'header', Number(action.charAt(1)), 'api');
    } else if (action === 'quote') {
      editor.formatLine(index, 0, 'blockquote', true, 'api');
    } else if (action === 'bullet') {
      editor.formatLine(index, 0, 'list', 'bullet', 'api');
    } else if (action === 'numbered') {
      editor.formatLine(index, 0, 'list', 'ordered', 'api');
    } else if (action === 'code') {
      editor.formatLine(index, 0, 'code-block', true, 'api');
    } else if (action === 'divider') {
      editor.insertEmbed(index, 'divider', true, 'api');
      editor.insertText(index, '\n', 'api');
    } else if (action === 'table') {
      setDialog({ kind: 'table', cells: emptyCells(3, 3), index });
    } else if (action === 'image') {
      // Photos come from the device; the URL dialog is only a fallback on
      // upload failure (see insertImageFile). Remember where it should land.
      pendingImageIndexRef.current = index;
      if (editorHooks.pickImage) editorHooks.pickImage();
    } else if (action === 'video') {
      setDialog({ kind: 'video', range: { index }, value: '' });
    }
  };

  const confirmDialog = () => {
    const editor = getEditor();
    if (!editor || !dialog) return;

    if (dialog.kind === 'table') {
      const rows = dialog.cells && dialog.cells.length ? dialog.cells : emptyCells(2, 2);
      editor.focus();
      if (dialog.blot) {
        let start = 0;
        try {
          start = dialog.blot.offset(editor.scroll);
        } catch (err) {
          // Blot vanished under our feet — nothing to replace.
        }
        dialog.blot.remove();
        editor.insertEmbed(Math.min(start, editor.getLength()), 'table', { rows }, 'api');
      } else {
        const at = dialog.index != null ? dialog.index : editor.getLength();
        editor.insertEmbed(at, 'table', { rows }, 'api');
      }
      setDialog(null);
      return;
    }

    const value = (dialog.value || '').trim();
    if (!value || !/^https?:\/\//i.test(value)) {
      notify('सही कड़ी (URL) डालें।');
      return;
    }
    editor.focus();
    if (dialog.kind === 'link') {
      const { index, length } = dialog.range;
      editor.formatText(index, length || 1, 'link', value, 'api');
    } else {
      editor.insertEmbed(dialog.range.index, dialog.kind === 'video' ? 'video' : 'image', value, 'api');
      editor.setSelection(dialog.range.index + 1, 0, 'api');
    }
    setDialog(null);
  };

  // Live Hinglish→Devanagari for the plain title/subtitle fields.
  const handleFieldInput = (field) => (e) => {
    const el = e.target;
    let value = e.target.value;
    if (hinglishOn) {
      // Double space ends the sentence with the Hindi danda "।".
      const danda = dandaOnDoubleSpace(value, el.selectionStart);
      if (danda) {
        setFormData((prev) => ({ ...prev, [field]: danda.value }));
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = danda.caret;
        });
        return;
      }
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

  const handleFieldBlur = (field) => (e) => {
    if (!hinglishOn) return;
    const el = e.target;
    const result = transliterateLastWord(e.target.value, el.selectionStart, true);
    if (result) {
      setFormData((prev) => ({ ...prev, [field]: result.value }));
    }
  };

  // The title/subtitle are single-row textareas, so they must grow to fit
  // their own text — otherwise a long title gets an internal scrollbar. Runs
  // on every change and on load (editing an existing long title).
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [formData.title]);

  useEffect(() => {
    const el = subtitleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [formData.subtitle]);

  const handleBodyChange = (html) => {
    // react-quill 2.x no longer passes the editor instance to onChange, and
    // block embeds (tables) live outside Quill's text model, so the plain-text
    // projection used for search, TTS, previews and word count falls back to
    // the rendered DOM whenever a table is present.
    const editor = getEditor();
    const plain = editor
      ? (editor.root.querySelector('table') ? editor.root.innerText : editor.getText())
      : '';
    setFormData((prev) => ({
      ...prev,
      content_html: html === EMPTY_DOC ? '' : html,
      ...(editor ? { content: plain.replace(/\n+$/, '') } : null),
    }));
  };

  const toggleHinglish = () => {
    setHinglishOn((prev) => {
      const next = !prev;
      localStorage.setItem('lekhani_hinglish', next ? 'on' : 'off');
      return next;
    });
  };

  const buildPayload = (published) => ({
    title: formData.title,
    subtitle: formData.subtitle,
    content: formData.content,
    content_html: formData.content_html || null,
    cover_image: formData.cover_image,
    topic: formData.topic,
    tags: formData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 5),
    published,
  });

  // Auto-draft: two seconds after typing pauses, the piece saves itself —
  // created once, then silently updated. Published posts stay manual.
  const autoSave = async () => {
    if (autosaveInFlight.current) return;
    autosaveInFlight.current = true;
    setAutoStatus('saving');
    const seq = ++saveSeq.current;
    writeMirror(formData);
    try {
      const targetId = isEdit ? id : draftId;
      const payload = buildPayload(0);
      if (targetId) {
        await postsAPI.update(targetId, payload);
      } else {
        const response = await postsAPI.create(payload);
        setDraftId(response.data.id);
      }
      // Ignore stale responses — a newer save owns the status line.
      if (seq === saveSeq.current) {
        setAutoStatus('saved');
        setSavedAt(
          new Date().toLocaleTimeString('hi-IN', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: false,
          })
        );
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        navigate('/login');
        return;
      }
      if (seq === saveSeq.current) setAutoStatus('error');
    } finally {
      autosaveInFlight.current = false;
    }
  };

  useEffect(() => {
    const isLivePost = isEdit && formData.published === 1;
    const hasContent = (formData.title.trim() + formData.content.trim()).length >= 3;
    if (isLivePost || !hasContent) return undefined;
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(autoSave, 2000);
    return () => clearTimeout(autoTimer.current);
  }, [
    formData.title,
    formData.content,
    formData.content_html,
    formData.subtitle,
    formData.cover_image,
    formData.published,
    id,
    isEdit,
  ]);

  const save = async (published) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      notify('शीर्षक और लेख दोनों लिखें।');
      setShowPublish(false);
      return;
    }

    setSaving(true);
    const payload = buildPayload(published);
    try {
      const targetId = isEdit ? id : draftId;
      if (targetId) {
        const response = await postsAPI.update(targetId, payload);
        if (published) {
          try { localStorage.removeItem(mirrorKey); } catch (err) { /* noop */ }
          navigate(`/post/${response.data.slug}`);
        } else {
          setShowPublish(false);
          setFormData((prev) => ({ ...prev, published: 0 }));
        }
      } else {
        const response = await postsAPI.create(payload);
        if (published) {
          try { localStorage.removeItem(mirrorKey); } catch (err) { /* noop */ }
          navigate(`/post/${response.data.slug}`);
        } else {
          navigate(`/edit/${response.data.id}`);
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
      } else {
        notify(error.response?.data?.detail || 'सहेजने में समस्या हुई।');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return <div className="page-loading">लोड हो रहा है…</div>;
  }
  if (loadError) {
    return (
      <div className="notfound-page">
        <h1>{loadError === 'notfound' ? 'यह रचना नहीं मिली' : 'रचना लोड नहीं हो सकी'}</h1>
        <p>
          {loadError === 'notfound'
            ? 'हो सकता है रचना हटा दी गई हो, या यह आपकी न हो।'
            : 'कोई तकनीकी दिक्कत आई है। थोड़ी देर में फिर कोशिश करें।'}
        </p>
        {loadError === 'error' && (
          <button type="button" className="landing-cta" onClick={fetchPost}>फिर कोशिश करें</button>
        )}{' '}
        <Link to="/stories" className="landing-cta">मेरी रचनाएँ देखें</Link>
      </div>
    );
  }

  const words = formData.content.trim() ? formData.content.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / 200));

  return (
    <div className={`editor${focusMode ? ' editor-focus' : ''}`}>
      <header className="editor-bar">
        <div className="editor-bar-left">
          <Link to="/" className="editor-logo">{BRAND.name}</Link>
          <span className="editor-doctype">
            {isEdit && formData.published === 1 ? 'प्रकाशित' : 'मसौदा'}
          </span>
          <span
            className={`editor-saved${autoStatus === 'saved' ? ' saved' : ''}${autoStatus === 'error' ? ' error' : ''}`}
            aria-live="polite"
          >
            {uploading
              ? 'चित्र चढ़ाया जा रहा है…'
              : isEdit && formData.published === 1
                ? ''
                : autoStatus === 'saving'
                  ? 'सहेजा जा रहा है…'
                  : autoStatus === 'saved'
                    ? `सहेजा गया ${savedAt}`
                    : autoStatus === 'error'
                      ? 'सहेजा नहीं जा सका'
                      : ''}
          </span>
        </div>
        <div className="editor-bar-actions">
          {isEdit && formData.published === 1 && (
            <button type="button" className="editor-draft" onClick={() => save(0)} disabled={saving}>
              {saving ? 'सहेज रहे हैं…' : 'ड्राफ्ट सहेजें'}
            </button>
          )}
          <button type="button" className="editor-publish" onClick={() => setShowPublish(true)}>
            प्रकाशित करें
          </button>
          {/* Secondary tools live behind a ⋯ so the bar stays quiet. */}
          <div className="editor-bar-menu" ref={barMenuRef}>
            <button
              type="button"
              className={`editor-icon${barMenuOpen ? ' on' : ''}`}
              onClick={() => setBarMenuOpen((v) => !v)}
              title="और विकल्प"
              aria-label="और विकल्प"
              aria-haspopup="true"
              aria-expanded={barMenuOpen}
            >
              ⋯
            </button>
            {barMenuOpen && (
              <div className="bar-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { const e = getEditor(); if (e) e.history.undo(); setBarMenuOpen(false); }}
                >
                  ↶ वापस जाएँ
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { const e = getEditor(); if (e) e.history.redo(); setBarMenuOpen(false); }}
                >
                  ↷ आगे बढ़ें
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-pressed={hinglishOn}
                  onClick={toggleHinglish}
                >
                  अ अंग्रेज़ी→देवनागरी {hinglishOn ? 'चालू ✓' : 'बंद'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  aria-pressed={focusMode}
                  onClick={() => { setFocusMode((v) => !v); setBarMenuOpen(false); }}
                >
                  ◎ एकांत लेखन {focusMode ? 'चालू ✓' : 'बंद'}
                </button>
              </div>
            )}
          </div>
          {isAuthenticated && user && (
            <Link to={`/user/${user.id}`} className="editor-avatar" title="प्रोफ़ाइल" aria-label="प्रोफ़ाइल">
              {user.avatar_url ? (
                <img src={mediaUrl(user.avatar_url)} alt="" />
              ) : (
                <span>{initials(user.full_name || user.username || '')}</span>
              )}
            </Link>
          )}
        </div>
      </header>

      <form
        className={`editor-sheet${bodyFocused ? ' is-writing' : ''}`}
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="editor-field">
          <span className="editor-field-label" aria-hidden="true">शीर्षक</span>
          <textarea
            className="editor-title"
            rows={1}
            ref={titleRef}
            placeholder="शीर्षक लिखें…"
            value={formData.title}
            lang="hi"
            onChange={handleFieldInput('title')}
            onBlur={handleFieldBlur('title')}
          />
        </div>
        {/* Subtitle reveals itself only once a title exists — the empty page
            stays a single calm line, like the reference. */}
        {(formData.title.trim() || formData.subtitle.trim()) && (
          <textarea
            className="editor-subtitle"
            rows={1}
            ref={subtitleRef}
            placeholder="उपशीर्षक — पाठक को एक पंक्ति में बताएँ (वैकल्पिक)"
            value={formData.subtitle}
            lang="hi"
            onChange={handleFieldInput('subtitle')}
            onBlur={handleFieldBlur('subtitle')}
          />
        )}
        <div className="editor-body-wrap" ref={bodyWrapRef}>
          {uploading && (
            <div className="editor-uploading" role="status">चित्र अपलोड हो रहा है…</div>
          )}
          <ReactQuill
            ref={quillRef}
            theme="bubble"
            value={formData.content_html || EMPTY_DOC}
            onChange={handleBodyChange}
            modules={MODULES}
            placeholder="अपनी रचना यहाँ लिखें…"
          />
          {/* Gutter ⊕: hugs the active block and opens the block menu. */}
          {gutter && (
            <div className="gutter-add-zone" style={{ top: gutter.top }}>
              <button
                type="button"
                className={`gutter-add${addOpen ? ' on' : ''}`}
                title="ब्लॉक जोड़ें"
                aria-label="ब्लॉक जोड़ें"
                aria-haspopup="true"
                aria-expanded={addOpen}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => setAddOpen((v) => !v)}
              >
                {addOpen ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
              {addOpen && (
                <div
                  className="gutter-add-row"
                  role="menu"
                  aria-label="ब्लॉक जोड़ें"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {BLOCK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      role="menuitem"
                      className="gutter-add-item"
                      title={action.label}
                      aria-label={action.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setAddOpen(false);
                        applyBlockAction(action.id, gutter.index);
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="17"
                        height="17"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {action.icon}
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) insertImageFile(file);
              e.target.value = '';
            }}
          />
        </div>
        {words > 0 && (
          <p className="editor-stats" aria-live="off">
            {words} शब्द · {formData.content.length} अक्षर · ~{minutes} मिनट पढ़ें
          </p>
        )}
      </form>

      {dialog && (
        <div
          className="publish-modal"
          role="dialog"
          aria-label={dialog.kind === 'table' ? 'सारणी' : 'कड़ी जोड़ें'}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}
        >
          <div className={`publish-card dialog-card${dialog.kind === 'table' ? ' dialog-table' : ''}`}>
            <h2>
              {dialog.kind === 'link' && 'लिंक जोड़ें'}
              {dialog.kind === 'image' && 'चित्र जोड़ें'}
              {dialog.kind === 'video' && 'वीडियो जोड़ें'}
              {dialog.kind === 'table' && (dialog.blot ? 'सारणी संपादित करें' : 'सारणी जोड़ें')}
            </h2>
            {dialog.kind === 'table' ? (
              <>
                <div
                  className="table-grid"
                  style={{ gridTemplateColumns: `repeat(${dialog.cells[0].length}, minmax(80px, 1fr))` }}
                >
                  {dialog.cells.map((row, r) => (
                    <div key={r} style={{ display: 'contents' }}>
                      {row.map((cell, c) => (
                        <input
                          key={`${r}-${c}`}
                          type="text"
                          lang="hi"
                          value={cell}
                          placeholder={r === 0 ? 'शीर्षक' : ''}
                          onChange={(e) => {
                            const cells = dialog.cells.map((row2, r2) =>
                              row2.map((cell2, c2) => (r2 === r && c2 === c ? e.target.value : cell2))
                            );
                            setDialog({ ...dialog, cells });
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="table-grid-actions">
                  {dialog.cells.length < 8 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({ ...dialog, cells: [...dialog.cells, Array(dialog.cells[0].length).fill('')] })
                      }
                    >
                      + पंक्ति
                    </button>
                  )}
                  {dialog.cells.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setDialog({ ...dialog, cells: dialog.cells.slice(0, -1) })}
                    >
                      − पंक्ति
                    </button>
                  )}
                  {dialog.cells[0].length < 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({ ...dialog, cells: dialog.cells.map((row) => [...row, '']) })
                      }
                    >
                      + स्तंभ
                    </button>
                  )}
                  {dialog.cells[0].length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDialog({ ...dialog, cells: dialog.cells.map((row) => row.slice(0, -1)) })}
                    >
                      − स्तंभ
                    </button>
                  )}
                </div>
              </>
            ) : (
              <label>
                {dialog.kind === 'link' && 'कड़ी (जैसे: https://…)'}
                {dialog.kind === 'image' && 'चित्र की कड़ी'}
                {dialog.kind === 'video' && 'वीडियो कड़ी (YouTube या Vimeo)'}
                <input
                  type="url"
                  lang="hi"
                  autoFocus
                  value={dialog.value}
                  onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && confirmDialog()}
                  placeholder="https://…"
                />
              </label>
            )}
            <div className="publish-actions">
              <button type="button" className="editor-draft" onClick={() => setDialog(null)}>रद्द</button>
              <button type="button" className="editor-publish" onClick={confirmDialog}>
                {dialog.kind === 'table' && dialog.blot ? 'सहेजें' : 'जोड़ें'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="cover-field">
              <span className="cover-field-label">कवर चित्र (वैकल्पिक)</span>
              <div className="cover-field-actions">
                <button
                  type="button"
                  className="cover-upload-btn"
                  onClick={() => coverInputRef.current && coverInputRef.current.click()}
                  disabled={uploading}
                >
                  {uploading ? 'अपलोड हो रहा है…' : 'उपकरण से चुनें'}
                </button>
                <input
                  type="url"
                  className="cover-url"
                  value={formData.cover_image}
                  onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                  placeholder="या कड़ी जोड़ें (https://…)"
                />
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) uploadCoverFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            {formData.cover_image && (
              <div className="cover-preview">
                <img src={formData.cover_image} alt="कवर चित्र का पूर्वावलोकन" />
                <button
                  type="button"
                  className="cover-remove"
                  onClick={() => setFormData({ ...formData, cover_image: '' })}
                >
                  हटाएँ
                </button>
              </div>
            )}
            <div className="publish-actions">
              <button type="button" className="editor-draft" onClick={() => setShowPublish(false)}>रद्द</button>
              <button type="button" className="editor-publish" onClick={() => save(1)} disabled={saving}>
                {saving ? 'प्रकाशित हो रहा है…' : 'अभी प्रकाशित करें'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="editor-toast" role="alert" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default Editor;
