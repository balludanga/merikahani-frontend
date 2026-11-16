import React, { useCallback, useEffect, useState } from 'react';
import { teamAPI } from '../services/api';
import { errorText } from '../utils/authErrors';
import { formatDate } from '../utils/format';

const ROLE = { owner: 'मालिक', reviewer: 'समीक्षक' };

/** The owner's list of who can review, with a form to add a Google address and a button to remove one. */
const ReviewerTeam = () => {
  const [members, setMembers] = useState(null);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState(null); // the row id waiting for "हाँ, हटाएँ"

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const response = await teamAPI.list();
      setMembers(response.data.members);
    } catch (error) {
      setFailed(true);
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (event) => {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      const response = await teamAPI.add(email.trim());
      setMembers(response.data.members);
      setNotice(
        'जोड़ दिया गया। लेखनी ईमेल नहीं भेजती, इसलिए उन्हें खुद बता दीजिए कि वे इसी ईमेल वाले गूगल (Google) खाते से साइन इन करें।'
      );
      setEmail('');
    } catch (error) {
      setProblem(errorText(error, 'जोड़ा नहीं जा सका, कृपया दोबारा कोशिश करें'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member) => {
    if (busy) return;
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      await teamAPI.remove(member.id);
      setRemoving(null);
      setNotice('हटा दिया गया। उनकी अगली ही कार्रवाई से समीक्षा का अधिकार बंद हो जाएगा।');
      await load();
    } catch (error) {
      setProblem(errorText(error, 'हटाया नहीं जा सका, कृपया दोबारा कोशिश करें'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="review-hint">
        यहाँ जिन्हें जोड़ेंगे, वे रचनाओं और साझेदारी के आवेदनों की समीक्षा कर पाएँगे और हर महीने का हिसाब देख पाएँगे। कोष
        तय करना, हिसाब पक्का करना और भुगतान दर्ज करना फिर भी केवल आपका काम रहेगा। व्यक्ति का गूगल (Google) से सत्यापित
        ईमेल यही पता होना चाहिए।
      </p>

      <form className="desk-pool" onSubmit={add}>
        <label htmlFor="team-email">समीक्षक का ईमेल</label>
        <input
          id="team-email"
          className="earn-input"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="earn-btn primary" disabled={busy || !email.trim()}>
          समीक्षक जोड़ें
        </button>
      </form>

      {problem && <p className="earn-problem" role="alert">{problem}</p>}
      {notice && <p className="earn-ok" role="status">{notice}</p>}
      {members === null && <p className="review-hint">लोड हो रहा है…</p>}
      {failed && (
        <p className="empty-state">
          लोड नहीं हो सका। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}

      {members && members.length > 0 && (
        <ul className="earn-rows">
          {members.map((member) => (
            <li key={`${member.source}-${member.email}`} className="earn-row">
              <div className="earn-row-main">
                <strong dir="ltr">{member.email}</strong>
                <span className="earn-row-sub">
                  {ROLE[member.role]}
                  {member.name ? ` · ${member.name}` : ''}
                  {member.source === 'settings' ? ' · सेटिंग में तय (यहाँ से नहीं हटता)' : ''}
                  {member.added_at ? ` · जोड़ा गया ${formatDate(member.added_at)}` : ''}
                  {!member.signed_in ? ' · अभी साइन इन नहीं किया' : ''}
                </span>
              </div>
              {member.id && removing !== member.id && (
                <button type="button" className="earn-btn" onClick={() => setRemoving(member.id)} disabled={busy}>
                  हटाएँ…
                </button>
              )}
              {member.id && removing === member.id && (
                <span className="earn-actions">
                  <button type="button" className="earn-btn primary" onClick={() => remove(member)} disabled={busy}>
                    हाँ, हटाएँ
                  </button>
                  <button type="button" className="earn-btn" onClick={() => setRemoving(null)} disabled={busy}>
                    रहने दें
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default ReviewerTeam;
