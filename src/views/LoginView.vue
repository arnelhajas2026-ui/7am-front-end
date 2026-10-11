<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import api from '../services/api.js';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const showPw = ref(false);
const error = ref('');
const loading = ref(false);

// --- Gate: ipakita lang ang login card kapag (1) naka-connect na sa server
//     AT (2) lumipas na ang 4 seconds. Hanggang doon, background + "connecting…".
const connected = ref(false);
const minElapsed = ref(false);
const ready = computed(() => connected.value && minElapsed.value);

let pingTimer = null;
let minTimer = null;
let cancelled = false;

async function ping() {
  if (cancelled) return;
  try {
    await api.get('/health');
    connected.value = true;
  } catch {
    pingTimer = setTimeout(ping, 800); // retry hanggang gumising ang server (Render cold start)
  }
}

onMounted(() => {
  minTimer = setTimeout(() => { minElapsed.value = true; }, 4000);
  ping();
});
onUnmounted(() => {
  cancelled = true;
  clearTimeout(pingTimer);
  clearTimeout(minTimer);
});

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
  <!-- Background (laging nakikita; 916.jpg portrait, 169.jpg landscape — walang gradient) -->
  <div class="login-bg"></div>

  <!-- Connecting state: background + mensahe lang hangga't hindi pa ready -->
  <transition name="fade">
    <div v-if="!ready" class="login-status">
      <img src="/logo.png" class="status-logo" alt="7A'M" onerror="this.style.display='none'" />
      <p class="status-msg">connecting to server<span class="dots"><span>.</span><span>.</span><span>.</span></span></p>
    </div>
  </transition>

  <!-- Glass login card: lalabas lang kapag ready -->
  <transition name="card-fade">
    <div v-if="ready" class="glass-login">
      <div class="glass-card">
        <img src="/logo.png" class="glass-logo" alt="7A'M" onerror="this.style.display='none'" />
        <p class="section-eyebrow glass-eyebrow mb-1">Welcome back</p>
        <h3 class="glass-title mb-4">Sign in</h3>

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

        <p class="login-credit glass-credit">© 2026 Designed by: RDT Systems</p>
      </div>
    </div>
  </transition>
</template>
