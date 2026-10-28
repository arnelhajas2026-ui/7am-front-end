<script setup>
// =====================================================================
//  FullscreenPanel — reusable na expand/collapse wrapper para sa
//  data-heavy tables. Ibalot lang ang table (at pager) dito:
//
//    <FullscreenPanel title="Cash Receipts Journal">
//      <div class="card">...table...</div>
//      <div class="pager">...</div>
//    </FullscreenPanel>
//
//  Normal mode: inline lang, may maliit na "Fullscreen" button sa taas-kanan.
//  Fullscreen mode: fixed overlay na sumasakop sa buong screen (kasama ang
//  sidebar) para magamit ang buong lapad ng device. Esc o "Exit" para bumalik.
//
//  Slots:
//    default      — ang nilalaman (table, pager, atbp.)
//    bar          — karagdagang kontrol katabi ng toggle (hal. Export)
// =====================================================================
import { ref, watch, onUnmounted } from 'vue';

defineProps({ title: { type: String, default: '' } });

const wide = ref(false);
const toggle = () => { wide.value = !wide.value; };

function onKey(e) { if (e.key === 'Escape' && wide.value) wide.value = false; }

watch(wide, (v) => {
  try { document.body.style.overflow = v ? 'hidden' : ''; } catch { /* ignore */ }
  if (v) window.addEventListener('keydown', onKey);
  else window.removeEventListener('keydown', onKey);
});

onUnmounted(() => {
  try { document.body.style.overflow = ''; } catch { /* ignore */ }
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <!-- NORMAL MODE -->
  <div v-if="!wide" class="fp">
    <div class="fp-bar">
      <slot name="bar" />
      <button class="fp-btn" @click="toggle" title="Palawakin sa buong screen">⤢ Fullscreen</button>
    </div>
    <slot />
  </div>

  <!-- FULLSCREEN MODE (teleported sa body para makalabas sa layout) -->
  <Teleport to="body" v-else>
    <div class="fp-full">
      <div class="fp-head">
        <h4 class="mb-0">{{ title || 'Full view' }}</h4>
        <div class="fp-actions">
          <slot name="bar" />
          <button class="fp-btn" @click="toggle">✕ Exit fullscreen</button>
        </div>
      </div>
      <div class="fp-body"><slot /></div>
    </div>
  </Teleport>
</template>

<style scoped>
.fp-bar { display:flex; justify-content:flex-end; align-items:center; gap:.5rem; margin-bottom:.5rem; }
.fp-btn { border:1px solid var(--line); background:var(--surface); color:var(--ink-2);
  font-weight:600; font-size:.8rem; padding:.3rem .75rem; border-radius:8px; cursor:pointer; white-space:nowrap; }
.fp-btn:hover { border-color:var(--dawn-deep); color:var(--dawn-deep); }

.fp-full { position:fixed; inset:0; z-index:1060; background:var(--haze); display:flex; flex-direction:column; }
.fp-head { display:flex; align-items:center; justify-content:space-between; gap:1rem;
  padding:.75rem 1.1rem; background:var(--surface); border-bottom:1px solid var(--line); }
.fp-head h4 { font-family:var(--font-display); }
.fp-actions { display:flex; align-items:center; gap:.5rem; }
.fp-body { flex:1; overflow:auto; padding:1rem 1.1rem; }
/* Sa fullscreen, hayaang mag-stretch ang table sa buong lapad */
.fp-body :deep(table) { width:100%; }
</style>
