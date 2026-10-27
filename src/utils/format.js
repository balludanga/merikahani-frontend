// The API sends UTC stamps with no zone marker ("2026-01-01T18:30:00"). Read as-is,
// JS treats them as local time, so a reader away from UTC can get the wrong day.
// Anchor the bare stamp to UTC before formatting or diffing.
export const asUtcDate = (dateString) => {
  const stamp = /Z|[+-]\d\d:?\d\d$/.test(dateString) ? dateString : `${dateString}Z`;
  return new Date(stamp);
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = asUtcDate(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('hi-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const readingMinutes = (content = '') => {
  const words = content.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 150));
};

export const excerpt = (text = '', length = 140) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= length) return clean;
  return `${clean.slice(0, length).trim()}…`;
};

export const initials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ल';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
};

// "अभी", "5 मिनट पहले", "2 घंटे पहले", "3 दिन पहले"; older than a week, the date.
export const timeAgo = (dateString) => {
  if (!dateString) return '';
  const stamp = asUtcDate(dateString);
  if (Number.isNaN(stamp.getTime())) return '';
  const seconds = Math.max(0, Math.round((Date.now() - stamp.getTime()) / 1000));
  if (seconds < 60) return 'अभी';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} मिनट पहले`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} घंटे पहले`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} दिन पहले`;
  return formatDate(dateString);
};
