import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { notificationsAPI } from '../services/api';
import { initials, timeAgo } from '../utils/format';
import { formatRupees } from '../utils/partner';
import './NotificationBell.css';

const POLL_MS = 60 * 1000;

// What the reader did, as one Hindi sentence ("राम ने … को 3 तालियाँ दीं").
function sentence(item) {
  const who = item.actor.full_name || item.actor.username;
  if (item.kind === 'follow') return { who, rest: 'ने आपको फ़ॉलो करना शुरू किया' };
  // Write and earn is about a person or the programme, not a story: these carry no post.
  if (item.kind === 'partner_applied') return { who, rest: 'ने “लिखें और कमाएँ” के लिए आवेदन किया है' };
  if (item.kind === 'partner_approved') return { who: 'समीक्षा टीम', rest: 'ने आपका आवेदन स्वीकृत कर दिया। अब आप साझेदार लेखक हैं' };
  if (item.kind === 'partner_declined') return { who: 'समीक्षा टीम', rest: 'ने इस बार आपका “लिखें और कमाएँ” आवेदन स्वीकृत नहीं किया' };
  if (item.kind === 'partner_revoked') return { who: 'समीक्षा टीम', rest: 'ने आपकी साझेदारी फ़िलहाल रोक दी है' };
  if (item.kind === 'partner_eligible') return { who: 'लेखनी', rest: 'की ओर से बधाई: आप अब “लिखें और कमाएँ” के लिए आवेदन कर सकते हैं' };
  if (item.kind === 'payout_paid') return { who: 'लेखनी', rest: 'ने आपकी कमाई का भुगतान भेज दिया है' };
  // A tip: the site tells you (so a sender who asked to stay unnamed stays unnamed); `count` is your share in paise.
  if (item.kind === 'tip') return { who: 'लेखनी', rest: `की ओर से — आपको ${formatRupees(item.count)} का समर्थन मिला` };
  const title = `“${item.post.title}”`;
  // Reviewers speak for the platform, not as a named person; the sentence has no "who".
  if (item.kind === 'review_changes') {
    return { who: 'समीक्षा टीम', rest: `ने आपकी रचना ${title} में बदलाव माँगे हैं${item.count > 0 ? ` (${item.count} टिप्पणी)` : ''}। रचना तब तक जनता को नहीं दिखेगी` };
  }
  if (item.kind === 'review_approved') return { who: 'समीक्षा टीम', rest: `ने आपकी रचना ${title} स्वीकृत कर दी। यह फिर से प्रकाशित है` };
  if (item.kind === 'review_resubmit') return { who, rest: `ने सुधार कर ${title} को समीक्षा के लिए फिर भेजा है` };
  if (item.kind === 'reply') return { who, rest: `ने “${item.post.title}” पर आपकी प्रतिक्रिया का जवाब दिया` };
  if (item.kind === 'comment') return { who, rest: `ने आपकी रचना ${title} पर प्रतिक्रिया दी` };
  if (item.kind === 'clap') {
    return {
      who,
      rest: item.count > 1
        ? `ने आपकी रचना ${title} को ${item.count} तालियाँ दीं`
        : `ने आपकी रचना ${title} को ताली दी`,
    };
  }
  return {
    who,
    rest: item.count > 1
      ? `ने आपकी रचना ${title} के ${item.count} अंश हाइलाइट किए`
      : `ने आपकी रचना ${title} का एक अंश हाइलाइट किया`,
  };
}

// A follow opens the new follower's profile; a response or a reply opens the story at it; write and
// earn opens its own page (the reviewers' desk for a new application, the writer's page for the rest);
// the others open the story.
const linkFor = (item) => {
  if (item.kind === 'follow') return `/user/${item.actor.id}`;
  if (item.kind === 'partner_applied') return '/review/partners';
  if (item.kind.startsWith('partner_') || item.kind === 'payout_paid' || item.kind === 'tip') return '/earn';
  const slug = encodeURIComponent(item.post.slug);
  const anchor = (item.kind === 'comment' || item.kind === 'reply') && item.comment_id ? `#response-${item.comment_id}` : '';
  return `/post/${slug}${anchor}`;
};

/**
 * Bell in the navbar: a badge with how many things are new, and a panel listing
 * what readers did on the author's stories. Opening the panel marks them read.
 */
const NotificationBell = () => {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef(null);

  const refreshCount = useCallback(async () => {
    try {
      const response = await notificationsAPI.unreadCount();
      setUnread(response.data.count);
    } catch (error) {
      // Quiet: the badge just keeps its last value until the next check.
    }
  }, []);

  // Check now, then every minute while the tab is showing, and when it comes back.
  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setFailed(false);
    setItems(null);
    try {
      const response = await notificationsAPI.list({ limit: 30 });
      setItems(response.data);
      // Seen now. The list keeps showing which ones were new until it is closed.
      if (response.data.some((item) => !item.read)) {
        const marked = await notificationsAPI.markRead();
        setUnread(marked.data.count);
      } else {
        setUnread(0);
      }
    } catch (error) {
      setFailed(true);
    }
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={toggle}
        aria-label={unread ? `सूचनाएँ, ${unread} नई` : 'सूचनाएँ'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="सूचनाएँ"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="सूचनाएँ">
          <div className="notif-head">सूचनाएँ</div>
          {failed ? (
            <p className="notif-empty">सूचनाएँ लोड नहीं हो सकीं। थोड़ी देर में फिर कोशिश करें।</p>
          ) : items === null ? (
            <p className="notif-empty">लोड हो रहा है…</p>
          ) : items.length === 0 ? (
            <p className="notif-empty">अभी कोई सूचना नहीं। जब कोई आपको फ़ॉलो करेगा, या आपकी रचना पर प्रतिक्रिया देगा, ताली देगा या कोई अंश हाइलाइट करेगा, यहाँ दिखेगा।</p>
          ) : (
            <ul className="notif-list">
              {items.map((item) => {
                const { who, rest } = sentence(item);
                return (
                  <li key={item.id}>
                    <Link
                      to={linkFor(item)}
                      className={`notif-item ${item.read ? '' : 'new'}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="notif-avatar" aria-hidden="true">{initials(who)}</span>
                      <span className="notif-body">
                        <span className="notif-text"><strong>{who}</strong> {rest}</span>
                        {item.text && <span className="notif-quote">{item.text}</span>}
                        <span className="notif-time">{timeAgo(item.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
