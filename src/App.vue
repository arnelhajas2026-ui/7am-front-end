<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import { NAV } from './constants/nav.js';
import Icon from './components/Icon.vue';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const drawerOpen = ref(false);
watch(() => route.fullPath, () => { drawerOpen.value = false; });

function logout() { auth.logout(); router.push({ name: 'login' }); }
function exitImpersonation() { auth.exitImpersonation(); router.push({ name: 'accounts' }); }

// Filter ng nav base sa access (UX lang ito — backend pa rin ang tunay na bantay).
const visibleNav = computed(() =>
  NAV.filter((it) => {
    if (it.ownerOnly) return auth.isOwner || auth.isSuperadmin;
    if (!it.module) return true;
    return auth.isOwner || auth.isSuperadmin || (auth.user?.permissions?.[it.module] &&
                            auth.user.permissions[it.module] !== 'NONE');
  })
);

// I-group para may section headers sa sidebar.
const groups = computed(() => {
  const out = [];
  for (const it of visibleNav.value) {
    const g = it.group || null;
    let bucket = out.find((b) => b.group === g);
    if (!bucket) { bucket = { group: g, items: [] }; out.push(bucket); }
    bucket.items.push(it);
  }
  return out;
});

const initial = computed(() => (auth.user?.name || '?').charAt(0).toUpperCase());
</script>

<template>
  <div v-if="auth.isLoggedIn" class="app-shell">
    <div v-if="auth.impersonating" class="imp-banner">
      Viewing as <strong>{{ auth.user?.name }}</strong> ({{ auth.user?.role }})
      <button class="imp-exit" @click="exitImpersonation">Exit</button>
    </div>
    <!-- Sidebar (desktop) -->
    <aside class="sidebar d-none d-lg-flex">
      <div class="sidebar-brand"><span class="brand-dot"></span> 7A'M</div>
      <nav class="sidebar-nav">
        <template v-for="g in groups" :key="g.group || 'main'">
          <div v-if="g.group" class="nav-group-label">{{ g.group }}</div>
          <router-link v-for="it in g.items" :key="it.name" class="nav7" :to="{ name: it.name }">
            <Icon :name="it.icon" /> {{ it.label }}
          </router-link>
        </template>
      </nav>
      <div class="sidebar-user">
        <div class="avatar">{{ initial }}</div>
        <div class="flex-grow-1 lh-sm">
          <div class="text-white small fw-semibold">{{ auth.user?.name }}</div>
          <div class="small" style="color:#8595AA">{{ auth.user?.role }}</div>
        </div>
        <button class="icon-btn" title="Logout" @click="logout"><Icon name="logout" /></button>
      </div>
    </aside>

    <!-- Top bar (mobile) -->
    <header class="topbar d-lg-none">
      <button class="icon-btn" aria-label="Menu" @click="drawerOpen = true"><Icon name="menu" /></button>
      <span class="topbar-brand flex-grow-1">7A'M</span>
      <div class="avatar" style="width:34px;height:34px;border-radius:10px">{{ initial }}</div>
    </header>

    <!-- Drawer (mobile) -->
    <div v-if="drawerOpen" class="drawer-backdrop d-lg-none" @click="drawerOpen = false"></div>
    <aside class="drawer d-lg-none" :class="{ open: drawerOpen }">
      <div class="drawer-brand"><span class="brand-dot"></span> 7A'M</div>
      <nav class="sidebar-nav flex-grow-1">
        <template v-for="g in groups" :key="g.group || 'main'">
          <div v-if="g.group" class="nav-group-label">{{ g.group }}</div>
          <router-link v-for="it in g.items" :key="it.name" class="nav7" :to="{ name: it.name }">
            <Icon :name="it.icon" /> {{ it.label }}
          </router-link>
        </template>
      </nav>
      <div class="sidebar-user">
        <div class="avatar">{{ initial }}</div>
        <div class="flex-grow-1 lh-sm">
          <div class="text-white small fw-semibold">{{ auth.user?.name }}</div>
          <div class="small" style="color:#8595AA">{{ auth.user?.role }}</div>
        </div>
        <button class="icon-btn" title="Logout" @click="logout"><Icon name="logout" /></button>
      </div>
    </aside>

    <main class="app-main"><router-view /></main>
  </div>

  <router-view v-else />
</template>
