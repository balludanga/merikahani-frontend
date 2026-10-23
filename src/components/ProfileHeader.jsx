import React from 'react';
import { useAccentStyle } from '../utils/accent';
import { coverBackground, describeLink } from '../utils/profileStyle';
import { mediaUrl } from '../utils/media';
import { initials } from '../utils/format';
import './ProfileHeader.css';

const ICONS = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
  camera: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17" cy="7" r="0.6" /></>,
  play: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.2l5 2.8-5 2.8z" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19c.6-3.4 3-5 6-5s5.4 1.6 6 5" /><path d="M16 5.6a3 3 0 0 1 0 5.8M18.2 14.4c1.7.6 2.6 2.2 2.8 4.6" /></>,
  bird: <path d="M4 4l7 9-7 7M20 4l-6.5 7.5M13 13l7 7" />,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  send: <path d="M21 3L3 10.5l6.5 2.5L12 20l2.4-5.6L21 3zM9.5 13L21 3" />,
  book: <><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5z" /><path d="M5 17a3 3 0 0 1 3-3h10" /></>,
  pen: <path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
};

export const Icon = ({ name, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name] || ICONS.globe}
  </svg>
);

const BADGE_GLYPH = { stories: '✎', claps: '👏', followers: '♥' };

/**
 * Cover, photo, identity, links, stats and badges. Used on a writer's page and,
 * with the unsaved draft, in the profile editor's live preview.
 *
 * `actions` is whatever buttons belong beside the name (follow / edit).
 */
const ProfileHeader = ({ profile, actions, compact = false }) => {
  const accentStyle = useAccentStyle(profile.accent);
  const name = profile.full_name || profile.username;
  const cover = mediaUrl(profile.cover_url);
  const avatar = mediaUrl(profile.avatar_url);
  const joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString('hi-IN', { year: 'numeric', month: 'long' }) : '';

  return (
    <section className={`ph ${compact ? 'ph-compact' : ''}`} style={accentStyle}>
      <div className="ph-cover" style={{ background: cover ? undefined : coverBackground(profile.cover_style, profile.accent) }}>
        {cover && <img src={cover} alt="" />}
      </div>

      <div className="ph-body">
        <div className="ph-top">
          {avatar ? (
            <img className="ph-avatar" src={avatar} alt="" />
          ) : (
            <span className="ph-avatar ph-avatar-fallback" aria-hidden="true">{initials(name)}</span>
          )}
          {actions && <div className="ph-actions">{actions}</div>}
        </div>

        <h1 className="ph-name">{name}</h1>
        {profile.tagline && <p className="ph-tagline">{profile.tagline}</p>}
        {profile.status_line && (
          <p className="ph-status"><span>इन दिनों</span> {profile.status_line}</p>
        )}

        <div className="ph-meta">
          {profile.location && <span><Icon name="pin" size={14} /> {profile.location}</span>}
          {joined && <span><Icon name="calendar" size={14} /> {joined} से लेखनी पर</span>}
        </div>

        {profile.genres && profile.genres.length > 0 && (
          <ul className="ph-genres" aria-label="लेखन की विधाएँ">
            {profile.genres.map((genre) => <li key={genre}>{genre}</li>)}
          </ul>
        )}

        {profile.bio && <p className="ph-bio">{profile.bio}</p>}

        {profile.links && profile.links.length > 0 && (
          <ul className="ph-links">
            {profile.links.map((link) => {
              const { label, icon, host } = describeLink(link);
              return (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc" title={host}>
                    <Icon name={icon} size={15} /> {label}
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <div className="ph-stats">
          <span><strong>{profile.post_count || 0}</strong> रचनाएँ</span>
          <span><strong>{profile.follower_count || 0}</strong> फ़ॉलोअर्स</span>
          <span><strong>{profile.following_count || 0}</strong> फ़ॉलोइंग</span>
          {profile.claps_total > 0 && <span><strong>{profile.claps_total}</strong> तालियाँ</span>}
        </div>

        {profile.badges && profile.badges.length > 0 && (
          <ul className="ph-badges" aria-label="उपलब्धियाँ">
            {profile.badges.map((badge) => (
              <li key={badge.key} title={badge.hint}>
                <span aria-hidden="true">{BADGE_GLYPH[badge.kind]}</span> {badge.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ProfileHeader;
