import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import { errorText } from '../utils/authErrors';
import { ACCOUNT_DELETED_FLAG } from '../utils/session';

// "Delete my account": explained first, then confirmed by typing the account's own username.
const DeleteAccount = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;
  const matches = typed.trim() === user.username;

  const close = () => {
    setOpen(false);
    setTyped('');
    setError('');
  };

  const confirmDelete = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError('');
    try {
      await usersAPI.deleteAccount(typed.trim());
    } catch (failure) {
      setBusy(false);
      setError(errorText(failure, 'खाता हटाया नहीं जा सका, कृपया दोबारा कोशिश करें'));
      return;
    }
    try {
      sessionStorage.setItem(ACCOUNT_DELETED_FLAG, '1');
    } catch (storageError) {
      // The notice is only a courtesy.
    }
    logout();
    // A full page load, so nothing of the old account is left on the screen.
    window.location.assign('/');
  };

  return (
    <section className="ep-card ep-danger" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title">खाता हटाएँ</h2>
      <p className="ep-help">
        खाता हटाने पर आपकी सारी रचनाएँ और ड्राफ़्ट, ताली, हाइलाइट, प्रतिक्रियाएँ, फ़ॉलो, सहेजी हुई सूची, सूचनाएँ और अपलोड की
        हुई तस्वीरें मिट जाती हैं। यह वापस नहीं हो सकता। बाद में उसी गूगल (Google) खाते से साइन इन करेंगे तो एक नया, खाली खाता
        बनेगा।
      </p>
      {!open ? (
        <button type="button" className="ep-btn danger" onClick={() => setOpen(true)}>
          खाता हटाने की प्रक्रिया शुरू करें
        </button>
      ) : (
        <div className="ep-confirm">
          <label className="ep-field">
            <span>
              पक्का करने के लिए अपना यूज़रनेम लिखिए: <strong>{user.username}</strong>
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
          </label>
          {error && (
            <p className="ep-error" role="alert">
              {error}
            </p>
          )}
          <div className="ep-confirm-actions">
            <button type="button" className="ep-btn danger solid" onClick={confirmDelete} disabled={!matches || busy}>
              {busy ? 'हटा रहे हैं…' : 'हमेशा के लिए हटाएँ'}
            </button>
            <button type="button" className="ep-btn" onClick={close} disabled={busy}>
              रहने दें
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default DeleteAccount;
