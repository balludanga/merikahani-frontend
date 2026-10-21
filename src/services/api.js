import axios from 'axios';
import { getEnv } from '../utils/env';

const API_BASE_URL = getEnv('REACT_APP_API_URL', 'http://localhost:8000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
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
  create: (data) => api.post('/highlights', data),
  remove: (id) => api.delete(`/highlights/${id}`),
};

export const tagsAPI = {
  list: (params) => api.get('/tags', { params }),
  posts: (slug, params) => api.get(`/tags/${encodeURIComponent(slug)}/posts`, { params }),
};

export default api;
