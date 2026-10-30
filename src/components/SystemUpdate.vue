<script setup>
// =====================================================================
//  SystemUpdate — "Check for updates / Update" button.
//  Chini-check kung may mas bagong frontend build na na-deploy (Vercel)
//  sa pamamagitan ng paghahambing ng naka-embed na __APP_VERSION__ sa
//  /version.json. Kung meron → i-re-reload ang app para ma-apply ang
//  pinakabago. Kung wala → "latest updates".
//
//  TANDAAN: hindi ito nagti-trigger ng deployment — awtomatiko 'yon sa
//  Render/Vercel kapag nag-push ang dev. Nire-refresh lang nito ang app
//  papunta sa pinakahuling na-deploy na version.
// =====================================================================
import { ref } from 'vue';

const state = ref('idle'); // idle | checking | updating | latest | error
const msg = ref('');
const busy = () => state.value === 'checking' || state.value === 'updating';

async function checkUpdate() {
  state.value = 'checking';
  msg.value = 'Your System is updating';
  try {
    const current = String(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '');
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('no version file');
    const data = await res.json();
    const latest = String(data.version || '');

    if (latest && current && latest !== current) {
      // May bagong build → i-apply (reload sa pinakabagong assets).
      state.value = 'updating';
      msg.value = 'Your System is updating';
      setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 1200);
    } else {
      state.value = 'latest';
      msg.value = 'Your System now has the latest updates';
    }
  } catch {
    state.value = 'error';
    msg.value = 'Hindi ma-check ang updates ngayon. Subukan muli mamaya.';
  }
}
</script>

<template>
  <div class="sysupd">
    <button class="btn btn-ink" :disabled="busy()" @click="checkUpdate">
      <span v-if="busy()" class="spin"></span>
      {{ busy() ? 'Updating…' : '↻ Update' }}
    </button>
    <div v-if="msg" class="su-msg" :class="{ ok: state==='latest', err: state==='error', wait: busy() }">
      <span v-if="busy()" class="spin dark"></span>
      {{ msg }}
    </div>
  </div>
</template>

<style scoped>
.sysupd { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
.su-msg { display:flex; align-items:center; gap:.5rem; font-weight:600; font-size:.9rem; }
.su-msg.ok { color:var(--good); }
.su-msg.err { color:var(--bad); }
.su-msg.wait { color:var(--ink-2); }
.spin { width:16px; height:16px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff;
  border-radius:50%; display:inline-block; vertical-align:middle; margin-right:.3rem; animation:su-rot .7s linear infinite; }
.spin.dark { width:14px; height:14px; border-color:rgba(15,28,46,.2); border-top-color:var(--ink); margin:0; }
@keyframes su-rot { to { transform:rotate(360deg); } }
</style>
