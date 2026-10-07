<script setup>
// Searchable account picker — type code, name, o type para mag-filter (hal. "sales").
// Ginagamit sa Journal Entry new/edit form. Nagbabalik ng account CODE sa v-model.
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  accounts: { type: Array, default: () => [] },      // postable accounts [{code,name,type,...}]
  placeholder: { type: String, default: 'Search account…' },
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const q = ref('');

const selected = computed(() => props.accounts.find((a) => String(a.code) === String(props.modelValue)));
const label = computed(() => (selected.value ? `${selected.value.code} · ${selected.value.name}` : ''));

const shown = computed(() => {
  const s = q.value.trim().toLowerCase();
  const base = props.accounts;
  if (!s) return base.slice(0, 60);
  return base.filter((a) =>
    String(a.code).includes(s) ||
    (a.name || '').toLowerCase().includes(s) ||
    (a.type || '').toLowerCase().includes(s)
  ).slice(0, 60);
});

function pick(a) {
  emit('update:modelValue', a.code);
  emit('change', a);
  open.value = false;
  q.value = '';
}
function onFocus() { open.value = true; q.value = ''; }
function onBlur() { setTimeout(() => { open.value = false; }, 150); }
</script>

<template>
  <div class="acct-select">
    <input
      class="form-control form-control-sm acct-input"
      :value="open ? q : label"
      :placeholder="placeholder"
      @focus="onFocus"
      @blur="onBlur"
      @input="q = $event.target.value; open = true" />
    <div v-if="open" class="acct-menu">
      <div v-if="!shown.length" class="acct-empty">No match</div>
      <button
        v-for="a in shown" :key="a.code" type="button" class="acct-opt"
        @mousedown.prevent="pick(a)">
        <span class="ac-code">{{ a.code }}</span>
        <span class="ac-name">{{ a.name }}</span>
        <span class="ac-type">{{ a.type }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.acct-select { position: relative; }
.acct-input { cursor: text; }
.acct-menu {
  position: absolute; z-index: 50; left: 0; right: 0; top: 100%;
  background: #fff; border: 1px solid var(--line, #dce3ec); border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0,0,0,.14); max-height: 260px; overflow-y: auto; margin-top: 3px;
}
.acct-opt {
  display: flex; align-items: baseline; gap: 6px; width: 100%; text-align: left;
  border: none; background: transparent; padding: .35rem .6rem; font-size: .82rem; cursor: pointer;
}
.acct-opt:hover { background: #EEF2F7; }
.ac-code { font-weight: 700; font-variant-numeric: tabular-nums; min-width: 42px; }
.ac-name { flex: 1 1 auto; }
.ac-type { color: var(--muted, #8a94a3); font-size: .7rem; white-space: nowrap; }
.acct-empty { padding: .45rem .6rem; color: var(--muted, #8a94a3); font-size: .8rem; }
</style>
