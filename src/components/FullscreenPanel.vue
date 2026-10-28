<script setup>
// =====================================================================
//  FullscreenPanel — reusable na expand/collapse wrapper.
//  Pwedeng balutin ang BUONG page content (tabs + filters + tiles +
//  table + pager) o kahit ang table lang. Sa fullscreen, sumasakop sa
//  buong screen ng device at nakikita pa rin lahat ng nasa loob.
//
//    <FullscreenPanel>
//      <template #bar><button @click="exportX">Export</button></template>
//      <div class="stack">  ...tabs, filters, tiles, table, pager...  </div>
//    </FullscreenPanel>
//
//  Esc o "Exit fullscreen" para bumalik. Naka-lock ang body scroll habang
//  naka-expand. Reusable sa lahat ng table/report views.
//
//  Slots:  default — nilalaman   |   bar — karagdagang kontrol katabi ng toggle
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

  <!-- FULLSCREEN MODE (teleported sa body para makalabas sa app layout) -->
  <Teleport to="body" v-else>
    <div class="fp-full">
      <div class="fp-topbar">
        <span v-if="title" class="fp-title">{{ title }}</span>
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
.fp-bar { display:flex; justify-content:flex-end; align-items:center; gap:.5rem; margin-bottom:.75rem; }
.fp-btn { border:1px solid var(--line); background:var(--surface); color:var(--ink-2);
  font-weight:600; font-size:.8rem; padding:.3rem .75rem; border-radius:8px; cursor:pointer; white-space:nowrap; }
.fp-btn:hover { border-color:var(--dawn-deep); color:var(--dawn-deep); }

.fp-full { position:fixed; inset:0; z-index:1060; background:var(--haze); display:flex; flex-direction:column; }
.fp-topbar { display:flex; align-items:center; gap:1rem; justify-content:flex-end;
  padding:.6rem 1.1rem; background:var(--surface); border-bottom:1px solid var(--line); }
.fp-title { margin-right:auto; font-family:var(--font-display); font-weight:700; }
.fp-actions { display:flex; align-items:center; gap:.5rem; }
.fp-body { flex:1; overflow:auto; padding:1rem 1.1rem; }
/* Sa fullscreen, hayaang mag-stretch ang mga table sa buong lapad */
.fp-body :deep(table) { width:100%; }
/* Alisin ang sariling scroll ng table card para ang fp-body ang mag-scroll —
   kailangan para gumana ang sticky header (override ang inline overflow-x). */
.fp-body :deep(.card-body) { overflow:visible !important; }
/* Sticky column headers — mananatili sa taas habang nag-scroll, sa ilalim mismo ng top bar */
.fp-body :deep(thead th) {
  position:sticky; top:0; z-index:5; background:var(--surface);
  box-shadow:0 2px 4px rgba(15,28,46,.08);
}
</style>
