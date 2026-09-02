<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';

const machines = ref([]);
const rows = ref([]);
const loading = ref(false);
const error = ref('');
const context = ref('WAREHOUSE'); // 'WAREHOUSE' o machine _id

async function loadMachines(){
  try { const { data } = await api.get('/machines'); machines.value = data.machines; } catch {}
}
async function loadBalances(){
  loading.value=true; error.value='';
  try {
    const params = context.value === 'WAREHOUSE' ? { locationType:'WAREHOUSE' } : { machine: context.value };
    const { data } = await api.get('/inventory/balances', { params });
    rows.value = data.balances;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load balances.'; }
  finally { loading.value=false; }
}
function change(){ loadBalances(); }

const loaded = computed(()=> rows.value.filter(r=>r.type==='MACHINE_LOADED'));
const cabinet = computed(()=> rows.value.filter(r=>r.type==='SIDE_CABINET'));
const isMachine = computed(()=> context.value !== 'WAREHOUSE');

onMounted(async ()=>{ await loadMachines(); await loadBalances(); });
</script>

<template>
  <div>
    <h3 class="mb-1">Inventory</h3>
    <p class="text-muted">Running stock, computed from every movement — warehouse, loaded, and side cabinet.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="mb-3" style="max-width:320px">
      <label class="form-label">Location</label>
      <select v-model="context" class="form-select" @change="change">
        <option value="WAREHOUSE">🏬 Warehouse</option>
        <option v-for="m in machines" :key="m._id" :value="m._id">📟 {{ m.locationName || m.machineId }}</option>
      </select>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <!-- Warehouse view -->
    <template v-else-if="!isMachine">
      <div v-if="!rows.length" class="card"><div class="card-body text-muted text-center py-4">No warehouse stock yet. Record a purchase first.</div></div>
      <div v-else class="card"><div class="card-body p-0">
        <div v-for="r in rows" :key="r.product._id" class="stock-row">
          <div class="flex-grow-1">
            <div class="fw-semibold">{{ r.product.name }} <span class="text-muted small">{{ r.product.sku }}</span></div>
            <div class="text-muted small" v-if="r.lowStock" style="color:var(--bad) !important">Low stock · reorder at {{ r.product.reorderLevel }}</div>
          </div>
          <div class="qty numeric" :class="{ low: r.lowStock }">{{ r.quantity }}</div>
        </div>
      </div></div>
    </template>

    <!-- Machine view: LOADED + SIDE CABINET -->
    <template v-else>
      <p class="section-eyebrow">In machine (display)</p>
      <div class="card mb-4"><div class="card-body p-0">
        <div v-if="!loaded.length" class="text-muted text-center py-4">Nothing loaded yet.</div>
        <div v-for="r in loaded" :key="r.product._id" class="stock-row">
          <div class="flex-grow-1 fw-semibold">{{ r.product.name }} <span class="text-muted small">{{ r.product.sku }}</span></div>
          <div class="qty numeric">{{ r.quantity }}</div>
        </div>
      </div></div>

      <p class="section-eyebrow">Side cabinet (reserve)</p>
      <div class="card"><div class="card-body p-0">
        <div v-if="!cabinet.length" class="text-muted text-center py-4">Nothing in the side cabinet.</div>
        <div v-for="r in cabinet" :key="r.product._id" class="stock-row">
          <div class="flex-grow-1 fw-semibold">{{ r.product.name }} <span class="text-muted small">{{ r.product.sku }}</span></div>
          <div class="qty numeric">{{ r.quantity }}</div>
        </div>
      </div></div>
    </template>
  </div>
</template>
