export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('hi-IN', {
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
