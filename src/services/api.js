import axios from 'axios';
import { useAuthStore } from '../stores/auth.js';

// Isang axios instance na may baseURL. Dito dadaan lahat ng request.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// REQUEST interceptor: idikit ang JWT token sa bawat request (kung meron).
api.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`;
  return config;
});

// RESPONSE interceptor: kung 401 (expired/invalid), auto-logout.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const auth = useAuthStore();
      auth.logout();
    }
    return Promise.reject(err);
  }
);

export default api;
