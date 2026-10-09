<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';

const machines = ref([]);
const rows = ref([]);
const loading = ref(false);
const error = ref('');
const context = ref('WAREHOUSE'); // 'WAREHOUSE' | 'ALL' | machine _id

// Per-product location summary (All view drill-down)
const detailProduct = ref(null);
const prodLoc = ref(null);
const prodLocLoading = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

async function loadMachines(){
  try { const { data } = await api.get('/machines'); machines.value = data.machines; } catch {}
}
async function loadBalances(){
  loading.value=true; error.value='';
  try {
    let params;
    if(context.value === 'WAREHOUSE') params = { locationType:'WAREHOUSE' };
    else if(context.value === 'ALL') params = { locationType:'ALL' };
    else params = { machine: context.value };
    const { data } = await api.get('/inventory/balances', { params });
    rows.value = data.balances;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load balances.'; }
  finally { loading.value=false; }
}
function change(){ detailProduct.value=null; prodLoc.value=null; loadBalances(); }

async function openProduct(r){
  detailProduct.value = r.product;
  prodLocLoading.value=true; prodLoc.value=null;
  try { const { data } = await api.get('/inventory/product-locations', { params:{ product: r.product._id } }); prodLoc.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load product locations.'; }
  finally { prodLocLoading.value=false; }
}

const loaded = computed(()=> rows.value.filter(r=>r.type==='MACHINE_LOADED'));
const cabinet = computed(()=> rows.value.filter(r=>r.type==='SIDE_CABINET'));
const isMachine = computed(()=> context.value !== 'WAREHOUSE' && context.value !== 'ALL');
const isAll = computed(()=> context.value === 'ALL');

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
        <option value="ALL">📦 All locations</option>
        <option value="WAREHOUSE">🏬 Warehouse</option>
        <option v-for="m in machines" :key="m._id" :value="m._id">📟 {{ m.locationName || m.machineId }}</option>
      </select>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <!-- ALL view: product list (total qty), click → per-location summary -->
    <template v-else-if="isAll">
      <!-- Per-product location drill-down -->
      <div v-if="detailProduct" class="card mb-4"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ detailProduct.sku }} · {{ detailProduct.name }}</h5>
          <button class="btn btn-ghost btn-sm" @click="detailProduct=null; prodLoc=null">Close</button>
        </div>
        <div v-if="prodLocLoading" class="text-muted small">Loading…</div>
        <div v-else-if="prodLoc" class="card"><div class="card-body p-0" style="overflow-x:auto">
          <table class="fin-table ruled" style="min-width:680px">
            <thead><tr><th class="lbl">Location</th><th class="lbl">Product ID</th><th class="lbl">Product Name</th><th>Ending Qty</th><th>Unit Cost</th><th>Inventory Value</th></tr></thead>
            <tbody>
              <tr v-for="(r,i) in prodLoc.rows" :key="i">
                <td class="lbl">{{ r.location }}</td>
                <td class="lbl">{{ r.productId }}</td>
                <td class="lbl">{{ r.productName }}</td>
                <td class="num">{{ r.endingQty }}</td>
                <td class="num">{{ peso(r.unitCost) }}</td>
                <td class="num fw-semibold">{{ peso(r.value) }}</td>
              </tr>
              <tr v-if="!prodLoc.rows.length"><td colspan="6" class="text-center text-muted py-3">Walang stock sa anumang lokasyon.</td></tr>
            </tbody>
            <tfoot v-if="prodLoc.rows.length"><tr class="gp"><td class="lbl" colspan="5">Total</td><td class="num fw-bold">{{ peso(prodLoc.total) }}</td></tr></tfoot>
          </table>
        </div></div>
      </div></div>

      <div v-if="!rows.length" class="card"><div class="card-body text-muted text-center py-4">No stock yet.</div></div>
      <div v-else class="card"><div class="card-body p-0">
        <div v-for="r in rows" :key="r.product._id" class="stock-row click-row" @click="openProduct(r)">
          <div class="flex-grow-1">
            <div class="fw-semibold">{{ r.product.name }} <span class="text-muted small">{{ r.product.sku }}</span></div>
            <div class="text-muted small">Click para sa breakdown per location / machine / side cabinet</div>
          </div>
          <div class="qty numeric" :class="{ low: r.lowStock }">{{ r.quantity }}</div>
        </div>
      </div></div>
    </template>

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

<style scoped>
.click-row { cursor:pointer; }
.click-row:hover { background:#F2F7FD; }
</style>
