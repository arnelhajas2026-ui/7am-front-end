<script setup>
// Export options modal: format (PDF/Word/Excel) + orientation + paper.
// Orientation/paper = para sa PDF at Word lang (hindi applicable sa Excel — continuous).
import { ref } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Export' },
  busy: { type: Boolean, default: false },
  defaultOrientation: { type: String, default: 'landscape' }, // portrait | landscape
});
const emit = defineEmits(['confirm', 'close']);

const format = ref('pdf');       // pdf | docx | xlsx
const orientation = ref(props.defaultOrientation === 'portrait' ? 'portrait' : 'landscape');
const paper = ref('A4');         // A4 | Letter

function go() { emit('confirm', { format: format.value, orientation: orientation.value, paper: paper.value }); }
</script>

<template>
  <div v-if="visible" class="xd-backdrop" @click.self="emit('close')">
    <div class="xd-card">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0" style="font-family:var(--font-display)">{{ title }}</h5>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">×</button>
      </div>

      <label class="form-label">Format</label>
      <div class="btn-group w-100 mb-3" role="group">
        <button class="btn" :class="format==='pdf' ? 'btn-primary' : 'btn-ghost'" @click="format='pdf'">PDF</button>
        <button class="btn" :class="format==='docx' ? 'btn-primary' : 'btn-ghost'" @click="format='docx'">Word</button>
        <button class="btn" :class="format==='xlsx' ? 'btn-primary' : 'btn-ghost'" @click="format='xlsx'">Excel</button>
      </div>

      <div :class="{ 'xd-dim': format==='xlsx' }">
        <label class="form-label">Orientation</label>
        <div class="btn-group w-100 mb-3" role="group">
          <button class="btn" :class="orientation==='portrait' ? 'btn-ink' : 'btn-ghost'" :disabled="format==='xlsx'" @click="orientation='portrait'">Portrait</button>
          <button class="btn" :class="orientation==='landscape' ? 'btn-ink' : 'btn-ghost'" :disabled="format==='xlsx'" @click="orientation='landscape'">Landscape</button>
        </div>
        <label class="form-label">Paper size</label>
        <div class="btn-group w-100 mb-2" role="group">
          <button class="btn" :class="paper==='A4' ? 'btn-ink' : 'btn-ghost'" :disabled="format==='xlsx'" @click="paper='A4'">A4</button>
          <button class="btn" :class="paper==='Letter' ? 'btn-ink' : 'btn-ghost'" :disabled="format==='xlsx'" @click="paper='Letter'">Letter</button>
        </div>
      </div>
      <p v-if="format==='xlsx'" class="text-muted small mb-2">Excel = continuous (walang orientation/pagination).</p>

      <div class="d-flex justify-content-end gap-2 mt-3">
        <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy" @click="go">{{ busy ? 'Preparing…' : 'Download' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xd-backdrop { position:fixed; inset:0; background:rgba(15,25,40,.45); z-index:1300; display:flex; align-items:center; justify-content:center; padding:16px; }
.xd-card { background:#fff; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.3); padding:20px; width:100%; max-width:380px; }
.xd-dim { transition:opacity .15s; }
.xd-card .btn-group .btn { flex:1; }
</style>
