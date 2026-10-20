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
const showEmpty = ref(false);   // ipakita ang mga lokasyong may balanseng 0 (hal. side cabinet)

// Inline transfer (mula sa Inventory screen — katabi ng Close; product naka-fix na).
const showTransfer = ref(false);
const tfSaving = ref(false);
const tfError = ref('');
const tfBal = ref({});          // locValue -> qty (para sa naka-fix na product)
const tfLines = ref([]);
const tfRider = ref('');
const riders = ref([]);
const locOptions = computed(() => {
  const opts = [{ value:'WAREHOUSE:', label:'Warehouse' }];
  for (const m of machines.value) opts.push({ value:`MACHINE_LOADED:${m._id}`, label:(m.locationName||m.machineId) });
  for (const m of machines.value) opts.push({ value:`SIDE_CABINET:${m._id}`, label:'Side Cabinet - '+(m.locationName||m.machineId) });
  return opts;
});
const tfNewLine = () => ({ source:'WAREHOUSE:', dest:'', quantity:1 });
async function openTransfer(){
  showTransfer.value=true; tfError.value=''; tfLines.value=[tfNewLine()]; tfRider.value='';
  try { const { data } = await api.get('/inventory/location-balances', { params:{ product: detailProduct.value._id } });
    const map={}; for (const b of data.balances) map[`${b.type}:${b.machine||''}`]=b.qty; tfBal.value=map;
  } catch { tfBal.value={}; }
  if (!riders.value.length) { try { const { data } = await api.get('/riders'); riders.value = data.riders; } catch {} }
}
function tfSrcBal(l){ return tfBal.value[l.source]||0; }
function tfDestAfter(l){ return l.dest ? (tfBal.value[l.dest]||0)+Number(l.quantity||0) : 0; }
function tfAdd(){ tfLines.value.push(tfNewLine()); }
function tfRemove(i){ tfLines.value.splice(i,1); if(!tfLines.value.length) tfAdd(); }
async function tfSubmit(saveDraft){
  if (!tfRider.value){ tfError.value='Pumili ng rider sa "Assign to" (required).'; return; }
  tfSaving.value=true; tfError.value='';
  try {
    const lines = tfLines.value.filter(l=>Number(l.quantity)>0 && l.source && l.dest).map(l=>{
      const [st,sm]=l.source.split(':'); const [dt,dm]=l.dest.split(':');
      return { product:detailProduct.value._id, sourceType:st, sourceMachine:sm||null, destType:dt, destMachine:dm||null, quantity:Number(l.quantity) };
    });
    if(!lines.length){ tfError.value='Magdagdag ng kahit isang linya.'; tfSaving.value=false; return; }
    await api.post('/transfers', { date:new Date().toISOString().slice(0,10), assignedRider: tfRider.value || null, lines, saveDraft });
    showTransfer.value=false;
    await openProduct({ product: detailProduct.value }); // i-refresh ang per-location summary
    await loadBalances();
  } catch(e){ tfError.value = e.response?.data?.message || 'Could not transfer.'; }
  finally { tfSaving.value=false; }
}

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
  try { const { data } = await api.get('/inventory/product-locations', { params:{ product: r.product._id, includeEmpty: showEmpty.value ? 1 : undefined } }); prodLoc.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load product locations.'; }
  finally { prodLocLoading.value=false; }
}
// I-toggle ang pagpapakita ng empty (0) na lokasyon at i-refresh ang summary.
async function toggleEmpty(){ if(detailProduct.value) await openProduct({ product: detailProduct.value }); }

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
          <div class="d-flex gap-2">
            <button class="btn btn-ghost btn-sm" @click="showTransfer ? (showTransfer=false) : openTransfer()">{{ showTransfer ? 'Hide transfer' : 'Transfer' }}</button>
            <button class="btn btn-ghost btn-sm" @click="detailProduct=null; prodLoc=null; showTransfer=false">Close</button>
          </div>
        </div>

        <!-- Inline transfer form (product naka-fix na = {{ detailProduct.sku }}) -->
        <div v-if="showTransfer" class="tf-box mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="section-eyebrow mb-0">New transfer · {{ detailProduct.name }}</span>
            <select v-model="tfRider" class="form-select form-select-sm" :class="!tfRider && 'needs'" style="max-width:210px">
              <option value="">Assign to rider… (required)</option>
              <option v-for="r in riders" :key="r._id" :value="r._id">{{ r.name }}</option>
            </select>
          </div>
          <div v-if="tfError" class="alert alert-danger py-1 small">{{ tfError }}</div>
          <div class="table-responsive">
            <table class="tf-table">
              <thead><tr><th>Source location</th><th class="r">Src bal.</th><th>Destination</th><th class="r">Dest after</th><th class="r">Qty</th><th></th></tr></thead>
              <tbody>
                <tr v-for="(l,i) in tfLines" :key="i">
                  <td><select v-model="l.source" class="form-select form-select-sm">
                    <option v-for="o in locOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></td>
                  <td class="r"><span :class="tfSrcBal(l)<Number(l.quantity||0) ? 'text-danger fw-semibold':''">{{ tfSrcBal(l) }}</span></td>
                  <td><select v-model="l.dest" class="form-select form-select-sm">
                    <option value="">— destination —</option>
                    <option v-for="o in locOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></td>
                  <td class="r">{{ l.dest ? tfDestAfter(l) : '—' }}</td>
                  <td class="r" style="width:80px"><input v-model.number="l.quantity" type="number" class="form-control form-control-sm numeric" /></td>
                  <td><button class="btn btn-ghost btn-sm" @click="tfRemove(i)">×</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <button class="btn btn-ghost btn-sm" @click="tfAdd">+ Add transfer</button>
            <div class="d-flex gap-2">
              <button class="btn btn-ghost btn-sm" :disabled="tfSaving" @click="tfSubmit(true)">{{ tfSaving ? '…' : 'Save as draft' }}</button>
              <button class="btn btn-primary btn-sm" :disabled="tfSaving" @click="tfSubmit(false)">{{ tfSaving ? 'Saving…' : 'Submit' }}</button>
            </div>
          </div>
          <div class="text-muted small mt-1">Kung kailangan ng approval, mapupunta muna sa Under Review — gagalaw lang ang stock pagka-approve sa Approvals section.</div>
        </div>

        <div class="form-check mb-2">
          <input v-model="showEmpty" type="checkbox" class="form-check-input" id="showEmpty" @change="toggleEmpty" />
          <label class="form-check-label small" for="showEmpty">Ipakita ang mga lokasyong walang laman (0) — hal. side cabinet na dinaanan lang ng stock</label>
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
.tf-box { border:1px solid var(--line); border-radius:12px; padding:.8rem .9rem; background:#FAFBFC; }
.tf-table { width:100%; border-collapse:collapse; font-size:.84rem; min-width:560px; }
.tf-table thead th { text-align:left; font-size:.62rem; text-transform:uppercase; letter-spacing:.03em; color:#3A4A5E; padding:.3rem .4rem; border-bottom:1px solid var(--line); }
.tf-table thead th.r { text-align:right; }
.tf-table tbody td { padding:.3rem .4rem; vertical-align:middle; }
.tf-table tbody td.r { text-align:right; font-variant-numeric:tabular-nums; }
.needs { border-color:var(--dawn-deep); box-shadow:0 0 0 .12rem rgba(224,138,0,.18); }
</style>
