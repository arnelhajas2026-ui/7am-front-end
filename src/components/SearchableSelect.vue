<script setup>
// Lightweight searchable dropdown (type-to-search) — walang bagong dependency.
// Options: [{ value, label }]. Ginagamit sa product/customer pickers.
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },      // [{ value, label }]
  placeholder: { type: String, default: '— pick —' },
  size: { type: String, default: 'sm' },            // sm | md
  clearable: { type: Boolean, default: true },
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const q = ref('');

const selectedLabel = computed(() => {
  const o = props.options.find((x) => String(x.value) === String(props.modelValue));
  return o ? o.label : '';
});
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (!s) return props.options;
  return props.options.filter((o) => String(o.label).toLowerCase().includes(s));
});

function pick(o) { emit('update:modelValue', o.value); emit('change', o.value); open.value = false; q.value = ''; }
function clear() { emit('update:modelValue', ''); emit('change', ''); open.value = false; q.value = ''; }
function onFocus() { open.value = true; q.value = ''; }
function onBlur() { setTimeout(() => { open.value = false; }, 150); } // hayaang tumama muna ang click
</script>

<template>
  <div class="ss" :class="size === 'sm' ? 'ss-sm' : ''">
    <input
      class="form-control" :class="size === 'sm' ? 'form-control-sm' : ''"
      :value="open ? q : selectedLabel"
      :placeholder="selectedLabel || placeholder"
      @focus="onFocus" @blur="onBlur"
      @input="q = $event.target.value; open = true" />
    <div v-if="open" class="ss-menu">
      <div v-if="clearable" class="ss-item ss-clear" @mousedown.prevent="clear">— clear —</div>
      <div v-if="!filtered.length" class="ss-empty">No match</div>
      <div v-for="o in filtered" :key="o.value" class="ss-item"
        :class="String(o.value) === String(modelValue) ? 'active' : ''"
        @mousedown.prevent="pick(o)">{{ o.label }}</div>
    </div>
  </div>
</template>

<style scoped>
.ss { position: relative; width: 100%; }
.ss-menu {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 1200;
  max-height: 240px; overflow-y: auto; margin-top: 2px;
  background: #fff; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 10px 28px rgba(0,0,0,.18);
}
.ss-item { padding: 6px 10px; font-size: .85rem; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-item:hover { background: #eef2f7; }
.ss-item.active { background: #2563eb; color: #fff; }
.ss-clear { color: #888; font-style: italic; }
.ss-empty { padding: 6px 10px; font-size: .8rem; color: #888; }
</style>
