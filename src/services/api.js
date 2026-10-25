import axios from 'axios';
import { getEnv } from '../utils/env';

const API_BASE_URL = getEnv('REACT_APP_API_URL', 'http://localhost:8000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  // Free-tier cold start can take ~60s; don't give up before it wakes.
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cold-start awareness: if any request is still pending after 6s, tell the UI
// (SlowServerNotice) the server is waking up; clear it once all settle.
const SLOW_AFTER_MS = 6000;
let pendingRequests = 0;
let slowTimer = null;
let slowShown = false;

api.interceptors.request.use((config) => {
  pendingRequests += 1;
  if (!slowTimer && !slowShown) {
    slowTimer = setTimeout(() => {
      slowTimer = null;
      if (pendingRequests > 0) {
        slowShown = true;
        window.dispatchEvent(new CustomEvent('lekhani:slow-server'));
      }
    }, SLOW_AFTER_MS);
  }
  return config;
});

const requestSettled = () => {
  pendingRequests = Math.max(0, pendingRequests - 1);
  if (pendingRequests > 0) return;
  if (slowTimer) {
    clearTimeout(slowTimer);
    slowTimer = null;
  }
  if (slowShown) {
    slowShown = false;
    window.dispatchEvent(new CustomEvent('lekhani:server-ready'));
  }
};

api.interceptors.response.use(
  (response) => {
    requestSettled();
    return response;
  },
  (error) => {
    requestSettled();
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const postsAPI = {
  getAll: (params) => api.get('/posts', { params }),
  getMine: (params) => api.get('/posts/me', { params }),
  getById: (id) => api.get(`/posts/${id}`),
  getBySlug: (slug) => api.get(`/posts/slug/${slug}`),
  create: (data) => api.post('/posts', data),
  update: (id, data) => api.put(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  getByUser: (userId, params) => api.get(`/posts/user/${userId}`, { params }),
  clap: (id) => api.post(`/posts/${id}/clap`),
};

export const commentsAPI = {
  getByPost: (postId) => api.get(`/comments/post/${postId}`),
  create: (data) => api.post('/comments', data),
  delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export const usersAPI = {
  getById: (userId) => api.get(`/users/${userId}`),
  // The signed-in writer's own profile. Each returns the updated profile.
  updateProfile: (data) => api.put('/users/me/profile', data),
  setAvatar: (data, contentType) => api.put('/users/me/avatar', { data, content_type: contentType }, { timeout: 60000 }),
  removeAvatar: () => api.delete('/users/me/avatar'),
  setCover: (data, contentType) => api.put('/users/me/cover', { data, content_type: contentType }, { timeout: 60000 }),
  removeCover: () => api.delete('/users/me/cover'),
};

export const followsAPI = {
  follow: (userId) => api.post(`/follows/${userId}`),
  unfollow: (userId) => api.delete(`/follows/${userId}`),
  followers: (userId) => api.get(`/follows/${userId}/followers`),
  following: (userId) => api.get(`/follows/${userId}/following`),
};

export const bookmarksAPI = {
  list: () => api.get('/bookmarks'),
  add: (postId) => api.post(`/bookmarks/${postId}`),
  remove: (postId) => api.delete(`/bookmarks/${postId}`),
};

export const highlightsAPI = {
  list: (params) => api.get('/highlights', { params }),
  // Every reader's highlights on a story, each with who made it.
  forPost: (postId) => api.get(`/highlights/post/${postId}`),
  create: (data) => api.post('/highlights', data),
  remove: (id) => api.delete(`/highlights/${id}`),
};

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  // No ids: everything is marked read.
  markRead: (ids) => api.post('/notifications/read', ids ? { ids } : {}),
};

export const tagsAPI = {
  list: (params) => api.get('/tags', { params }),
  posts: (slug, params) => api.get(`/tags/${encodeURIComponent(slug)}/posts`, { params }),
};

export const uploadsAPI = {
  // base64 bodies are bigger than typical API payloads; give them room.
  uploadImage: (data, contentType) =>
    api.post('/uploads/image', { data, content_type: contentType }, { timeout: 60000 }),
};

export default api;

// The owner's status page. The server answers 404 to anyone who is not the admin.
export const opsAPI = {
  overview: () => api.get('/ops/overview'),
};

// Narrated audio of a story. Plain axios calls (not `api`) on purpose: making a story's audio
// the first time takes a while, and that must not raise the "server is waking up" banner.
const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const audioAPI = {
  // { enabled }: whether the server can narrate at all (a key is set up).
  status: () => axios.get(`${API_BASE_URL}/audio/status`, { timeout: 15000 }),
  // 200 + the story as an MP3 Blob, or 202 + a small JSON Blob { done, total } while the
  // server is still making it (ask again). Rejects with response.status 503 when the server
  // voice is unavailable (not set up, quota used, outage), 413 for a very long story.
  forPost: (id) =>
    axios.get(`${API_BASE_URL}/audio/post/${id}`, {
      responseType: 'blob',
      timeout: 90000,
      headers: authHeader(),
    }),
};
