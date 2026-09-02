import { defineStore } from 'pinia';
import api from '../services/api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    superToken: localStorage.getItem('superToken') || null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isOwner: (s) => s.user?.role === 'OWNER',
    isSuperadmin: (s) => s.user?.role === 'SUPERADMIN' || !!s.superToken,
    impersonating: (s) => !!s.superToken,
  },
  actions: {
    async login(username, password) {
      const { data } = await api.post('/auth/login', { username, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
    // SUPERADMIN: mag-login bilang ibang user (nakaka-balik)
    async impersonate(userId) {
      const { data } = await api.post(`/users/${userId}/impersonate`);
      localStorage.setItem('superToken', this.token);
      localStorage.setItem('superUser', JSON.stringify(this.user));
      this.superToken = this.token;
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
    exitImpersonation() {
      const t = localStorage.getItem('superToken');
      const u = JSON.parse(localStorage.getItem('superUser') || 'null');
      if (!t) return;
      this.token = t; this.user = u; this.superToken = null;
      localStorage.setItem('token', t);
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.removeItem('superToken');
      localStorage.removeItem('superUser');
    },
    logout() {
      this.token = null; this.user = null; this.superToken = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('superToken');
      localStorage.removeItem('superUser');
    },
  },
});
