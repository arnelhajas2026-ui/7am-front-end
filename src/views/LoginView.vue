<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const showPw = ref(false);
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    router.push({ name: 'dashboard' });
  } catch (err) {
    error.value = err.response?.data?.message || 'Hindi maka-login. Subukan ulit.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrap">
    <!-- Brand / first-light panel (desktop) -->
    <div class="login-brand">
      <img src="/logo.png" class="login-logo" alt="7A'M" onerror="this.style.display='none'" />
      <div class="mark"><span class="brand-dot"></span> 7A'M</div>
      <h1 class="headline">Run the day from first light.</h1>
      <p class="tag">Every sale, every machine, every peso of stock and cash — in one place.</p>
    </div>

    <!-- Form -->
    <div class="login-form">
      <div class="inner">
        <img src="/logo.png" class="login-logo-sm d-lg-none" alt="7A'M" onerror="this.style.display='none'" />
        <p class="section-eyebrow mb-1">Welcome back</p>
        <h3 class="mb-4">Sign in</h3>

        <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

        <div class="mb-3">
          <label class="form-label">Username</label>
          <input v-model="username" class="form-control" autocomplete="username" @keyup.enter="submit" />
        </div>
        <div class="mb-4">
          <label class="form-label">Password</label>
          <div class="pw-field">
            <input v-model="password" :type="showPw ? 'text' : 'password'" class="form-control" autocomplete="current-password" @keyup.enter="submit" />
            <button type="button" class="pw-toggle" :title="showPw ? 'Hide password' : 'Show password'" @click="showPw = !showPw">
              <svg v-if="!showPw" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10 10 0 0 1 12 19c-7 0-11-7-11-7a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 7 11 7a18 18 0 0 1-2.16 3.19M1 1l22 22"/></svg>
            </button>
          </div>
        </div>

        <button class="btn btn-primary w-100" :disabled="loading" @click="submit">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>

        <p class="login-credit">© 2026 Designed by: RDT Systems</p>
      </div>
    </div>
  </div>
</template>
