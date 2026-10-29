<script setup>
// =====================================================================
//  AttachmentLinks — reusable na URL-link attachments (walang file upload).
//  I-upload ng user sa Google Drive/Dropbox/atbp., i-paste ang share link.
//  Ang sine-save lang ng system ay { label, url } — text lang (minimal sa DB).
//
//    <AttachmentLinks v-model="form.attachments" />            (editor)
//    <AttachmentLinks :model-value="entry.attachments" readonly />  (view)
// =====================================================================
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const links = computed({
  get: () => props.modelValue || [],
  set: (v) => emit('update:modelValue', v),
});
const valid = (u) => /^https?:\/\//i.test(String(u || '').trim());

function add() { links.value = [...links.value, { label: '', url: '' }]; }
function remove(i) { const a = [...links.value]; a.splice(i, 1); links.value = a; }
function update(i, key, val) { links.value = links.value.map((x, idx) => idx === i ? { ...x, [key]: val } : x); }
</script>

<template>
  <div class="att">
    <!-- READ-ONLY: clickable links -->
    <template v-if="readonly">
      <div v-if="!(modelValue || []).length" class="text-muted small">Walang attachment.</div>
      <div v-for="(a, i) in modelValue" :key="i" class="att-view">
        📎 <a :href="a.url" target="_blank" rel="noopener noreferrer">{{ a.label || a.url }}</a>
      </div>
    </template>

    <!-- EDITOR -->
    <template v-else>
      <div v-for="(a, i) in links" :key="i" class="att-row">
        <input class="form-control form-control-sm att-label" :value="a.label"
               @input="update(i, 'label', $event.target.value)" placeholder="Label (hal. Supplier Invoice)" />
        <input class="form-control form-control-sm att-url" :class="{ 'is-invalid': a.url && !valid(a.url) }" :value="a.url"
               @input="update(i, 'url', $event.target.value)" placeholder="https://drive.google.com/…" />
        <button type="button" class="att-x" title="Alisin" @click="remove(i)">✕</button>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" @click="add">+ Add link</button>
      <div class="att-hint">I-upload sa Google Drive (o iba), i-paste ang share link. Gawing “anyone with the link” para mabuksan ng iba.</div>
    </template>
  </div>
</template>

<style scoped>
.att-row { display:flex; gap:.4rem; align-items:center; margin-bottom:.4rem; }
.att-label { flex:0 0 36%; }
.att-url { flex:1 1 auto; min-width:0; }
.att-x { border:none; background:none; color:var(--muted); cursor:pointer; font-size:.95rem; line-height:1; padding:.2rem .3rem; }
.att-x:hover { color:var(--bad); }
.att-view { font-size:.85rem; margin-bottom:.25rem; }
.att-view a { color:#2563EB; word-break:break-all; }
.att-hint { font-size:.72rem; color:var(--muted); margin-top:3px; }
</style>
