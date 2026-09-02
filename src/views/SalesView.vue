<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtTime } from '../utils/datetime.js';
import { matchNames } from '../utils/match.js';

const file = ref(null);
const importing = ref(false);
const error = ref('');
const result = ref(null);

const batches = ref([]);
const days = ref([]);
const selectedDate = ref('');
const sales = ref([]);
const products = ref([]);
const loading = ref(false);

const productSearch = ref('');
const sortMode = ref('time');
const detail = ref(null);          // group para sa per-time modal
const resolveTarget = ref(null);   // group ("new") na reresolbahin
const resolveSearch = ref('');
const resolving = ref(false);
const resolveNotice = ref('');

function onFile(e){ file.value = e.target.files[0] || null; result.value=null; error.value=''; }

async function runImport(){
  if(!file.value){ error.value='Choose a file first.'; return; }
  importing.value=true; error.value=''; result.value=null;
  try {
    const fd = new FormData(); fd.append('file', file.value);
    const { data } = await api.post('/sales/import', fd);
    result.value = data.batch; file.value=null; document.getElementById('salesFile').value='';
    await load();
  } catch(e){ error.value = e.response?.data?.message || 'Import failed.'; }
  finally { importing.value=false; }
}

async function load(){
  loading.value=true;
  try {
    const [b, sm, pr] = await Promise.all([ api.get('/sales/batches'), api.get('/sales/summary'), api.get('/products') ]);
    batches.value = b.data.batches;
    days.value = sm.data.days || [];
    products.value = pr.data.products || [];
    if(!selectedDate.value && days.value.length) selectedDate.value = days.value[0].date;
    await loadDay();
  } catch { } finally { loading.value=false; }
}
async function loadDay(){
  detail.value=null;
  if(!selectedDate.value){ sales.value=[]; return; }
  try { const { data } = await api.get('/sales', { params:{ date: selectedDate.value } }); sales.value = data.sales; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load sales.'; }
}

const filtered = computed(()=>{
  const q = productSearch.value.trim().toLowerCase();
  return sales.value.filter(s => {
    const name = (s.product?.name || s.productNameRaw || '').toLowerCase();
    return !q || name.includes(q);
  });
});

const grouped = computed(()=>{
  const map = new Map();
  for (const s of filtered.value) {
    const isNew = !s.product;
    const pname = s.product?.name || s.productNameRaw || '—';
    const mname = s.machine?.locationName || s.machine?.machineId || '—';
    const key = (isNew ? 'NEW::' : 'OK::') + pname + '||' + mname;
    if(!map.has(key)) map.set(key, { key, productName:pname, machineName:mname, rawName:s.productNameRaw, status:isNew?'new':'existing', qty:0, amount:0, items:[], latest:0 });
    const g = map.get(key);
    g.qty++; g.amount += Number(s.amount||0); g.items.push(s);
    const t = new Date(s.soldAt).getTime(); if(t > g.latest) g.latest = t;
  }
  let arr = [...map.values()];
  if(sortMode.value === 'product') arr.sort((a,b)=> a.productName.localeCompare(b.productName));
  else arr.sort((a,b)=> b.latest - a.latest);
  return arr;
});

const detailItems = computed(()=> detail.value ? [...detail.value.items].sort((a,b)=> new Date(b.soldAt)-new Date(a.soldAt)) : []);
const totalQty = computed(()=> filtered.value.length);
const totalSales = computed(()=> filtered.value.reduce((s,x)=> s + Number(x.amount||0), 0));
const newItemCount = computed(()=> filtered.value.filter(s => !s.product).length);
const newGroupCount = computed(()=> grouped.value.filter(g => g.status==='new').length);

// Resolve modal
function openResolve(g){ resolveTarget.value = g; resolveSearch.value = g.rawName || g.productName; }
const productNames = computed(()=> products.value.map(p=>p.name));
const nameToProduct = computed(()=> Object.fromEntries(products.value.map(p=>[p.name, p])));
const resolveSuggestions = computed(()=> matchNames(resolveSearch.value, productNames.value, 5).map(n=> nameToProduct.value[n]).filter(Boolean));
async function doResolve(productId){
  resolving.value=true; error.value=''; resolveNotice.value='';
  const rawName = resolveTarget.value.rawName;
  try {
    const { data } = await api.post('/sales/resolve', { rawName, productId: productId || undefined });
    resolveTarget.value=null;
    await load();
    if (data.created) resolveNotice.value = `Bagong product "${rawName}" na ginawa. Nakatala na ang benta (revenue). Pumunta sa Products para itakda ang purchase cost, at sa Purchases/Transfers para sa inventory.`;
  } catch(e){ error.value = e.response?.data?.message || 'Could not resolve.'; }
  finally { resolving.value=false; }
}

const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Sales</h3>
    <p class="text-muted">Upload the machine's daily export — all sales are recorded; unmatched ones are marked "new" to resolve.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="resolveNotice" class="alert alert-success py-2">{{ resolveNotice }}</div>

    <!-- Upload -->
    <div class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">Import sales file</p>
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-8">
          <label class="form-label">File (.xlsx or .csv from the machine)</label>
          <input id="salesFile" type="file" class="form-control" accept=".xlsx,.xls,.csv" @change="onFile" />
        </div>
        <div class="col-12 col-md-4">
          <button class="btn btn-primary w-100" :disabled="importing" @click="runImport">
            <span v-if="importing" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            {{ importing ? 'Importing…' : 'Import sales' }}
          </button>
        </div>
      </div>
      <div v-if="result" class="mt-3 d-flex gap-2 flex-wrap">
        <span class="pill ok">{{ result.imported }} recorded</span>
        <span class="pill">{{ result.duplicates }} already imported</span>
        <span class="pill" :class="{ warn: result.unmatchedProducts.length }">{{ result.unmatchedProducts.length }} new (needs resolve)</span>
      </div>
    </div></div>

    <!-- Sales Summary -->
    <p class="section-eyebrow">Sales Summary</p>
    <div class="sales-summary mb-4">
      <div class="sum-card"><div class="sum-label">Total Qty</div><div class="sum-value">{{ totalQty }}</div></div>
      <div class="sum-card"><div class="sum-label">Total Sales</div><div class="sum-value">{{ peso(totalSales) }}</div></div>
    </div>

    <!-- Sales Record -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
      <p class="section-eyebrow mb-0">Sales Record</p>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <input v-model="productSearch" class="form-control form-control-sm" style="max-width:180px" placeholder="Search product…" />
        <select v-model="sortMode" class="form-select form-select-sm" style="max-width:180px">
          <option value="time">Sort: Latest sale</option>
          <option value="product">Sort: Product name (A–Z)</option>
        </select>
        <input v-model="selectedDate" type="date" class="form-control form-control-sm" style="max-width:160px" @change="loadDay" />
      </div>
    </div>

    <div v-if="days.length" class="d-flex gap-1 flex-wrap mb-2">
      <button v-for="d in days" :key="d.date" class="chip" :class="{ active: d.date===selectedDate }"
              @click="selectedDate=d.date; loadDay()">{{ d.date }} ({{ d.count }})</button>
    </div>

    <div v-if="newItemCount>0" class="alert alert-warning py-2 mb-2">
      ⚠️ <strong>{{ newItemCount }}</strong> new item<span v-if="newItemCount>1">s</span>
      sa <strong>{{ newGroupCount }}</strong> produkto para sa petsang ito ang kailangang <strong>i-resolve</strong>
      para maiwasan ang unbalanced na record. Pindutin ang <span class="badge-new" style="cursor:default">new</span> badge sa ibaba.
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!grouped.length" class="card"><div class="card-body text-muted text-center py-4">No sales for this date.</div></div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="srec">
        <thead>
          <tr><th>Product Name</th><th>Status</th><th class="nowrap">Time</th><th>Machine Name</th><th>Goods Channel</th><th class="r nowrap">Qty</th><th class="r nowrap">Amount</th></tr>
        </thead>
        <tbody>
          <tr v-for="g in grouped" :key="g.key">
            <td>
              <button v-if="g.qty>1 && g.status==='existing'" class="pname-link" @click="detail=g">{{ g.productName }}</button>
              <span v-else>{{ g.productName }}</span>
            </td>
            <td>
              <button v-if="g.status==='new'" class="badge-new" @click="openResolve(g)">new</button>
              <span v-else class="badge-ok">existing</span>
            </td>
            <td class="nowrap muted">{{ g.qty>1 ? '—' : fmtTime(g.items[0].soldAt) }}</td>
            <td>{{ g.machineName }}</td>
            <td class="muted">{{ g.qty>1 ? '—' : (g.items[0].channel || '—') }}</td>
            <td class="r nowrap">{{ g.qty }}</td>
            <td class="r amt">{{ peso(g.amount) }}</td>
          </tr>
        </tbody>
      </table>
    </div></div>

    <!-- Import history -->
    <p class="section-eyebrow mt-4">Import history</p>
    <div v-if="!batches.length" class="text-muted">No imports yet.</div>
    <div v-for="b in batches" :key="b._id" class="card mb-2"><div class="card-body py-2">
      <div class="d-flex justify-content-between align-items-center">
        <div><div class="fw-semibold small">{{ b.fileName }}</div>
          <div class="text-muted small">{{ b.imported }} recorded, {{ b.duplicates }} already<span v-if="b.unmatchedProducts.length">, {{ b.unmatchedProducts.length }} new</span></div></div>
        <span class="pill ok">{{ b.imported }}</span>
      </div>
    </div></div>

    <!-- Per-time detail modal -->
    <div v-if="detail" class="srec-modal" @click.self="detail=null">
      <div class="srec-modal-card">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div>
            <div class="fw-semibold" style="font-family:var(--font-display)">{{ detail.productName }}</div>
            <div class="text-muted small">{{ detail.machineName }} · {{ detail.qty }} sold · {{ peso(detail.amount) }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="detail=null">Close</button>
        </div>
        <div style="overflow-x:auto">
          <table class="srec detail">
            <thead><tr><th class="nowrap">Time</th><th>Goods Channel</th><th class="r nowrap">Amount</th></tr></thead>
            <tbody>
              <tr v-for="s in detailItems" :key="s._id">
                <td class="nowrap">{{ fmtTime(s.soldAt) }}</td>
                <td>{{ s.channel || '—' }}</td>
                <td class="r amt">{{ peso(s.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Resolve "new" product modal -->
    <div v-if="resolveTarget" class="srec-modal" @click.self="resolveTarget=null">
      <div class="srec-modal-card">
        <div class="d-flex justify-content-between align-items-start mb-1">
          <div>
            <div class="fw-semibold" style="font-family:var(--font-display)">Resolve: {{ resolveTarget.rawName }}</div>
            <div class="text-muted small">{{ resolveTarget.qty }} sold · {{ peso(resolveTarget.amount) }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="resolveTarget=null">Cancel</button>
        </div>
        <p class="text-muted small mb-2">Isa ba ito sa mga existing product? Piliin para i-merge (magiging alias). Kung bago talaga, i-keep bilang new product.</p>
        <input v-model="resolveSearch" class="form-control form-control-sm mb-2" placeholder="Search existing product…" />
        <div v-if="resolveSuggestions.length" class="mb-2">
          <button v-for="p in resolveSuggestions" :key="p._id" class="btn btn-ghost btn-sm w-100 text-start mb-1"
                  :disabled="resolving" @click="doResolve(p._id)">↳ Merge into: <strong>{{ p.name }}</strong></button>
        </div>
        <div v-else class="text-muted small mb-2">Walang katugmang existing product.</div>
        <div class="d-flex gap-2">
          <button class="btn btn-primary btn-sm" :disabled="resolving" @click="doResolve(null)">Keep as new product</button>
          <span class="text-muted small align-self-center">(revenue only — no stock yet)</span>
          <button class="btn btn-ghost btn-sm" :disabled="resolving" @click="resolveTarget=null">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sales-summary { display:flex; gap:14px; flex-wrap:wrap; background:#EAF6EE; border:1px solid #CDE9D6; border-radius:14px; padding:14px; }
.sum-card { flex:1; min-width:180px; background:#fff; border:1px solid #D7ECDE; border-radius:12px; padding:12px 16px; }
.sum-label { font-size:.78rem; color:#5B7A66; font-weight:600; }
.sum-value { font-family:var(--font-display); font-weight:800; font-size:1.6rem; color:#1E7A46; margin-top:2px; }

.srec { width:100%; border-collapse:collapse; font-size:.84rem; min-width:720px; }
.srec.detail { min-width:320px; }
.srec thead th { text-align:left; background:#F5F7FA; color:#3A4A5E; font-size:.7rem; text-transform:uppercase; letter-spacing:.03em;
  padding:.5rem .6rem; border-bottom:1px solid var(--line); overflow-wrap:anywhere; }
.srec thead th.r { text-align:right; }
.srec tbody td { padding:.5rem .6rem; border-bottom:1px solid var(--line); vertical-align:top; overflow-wrap:anywhere; white-space:normal; }
.srec tbody tr:last-child td { border-bottom:none; }
.srec tbody tr:hover td { background:#FAFBFC; }
.srec .r { text-align:right; }
.srec .amt { font-variant-numeric:tabular-nums; white-space:nowrap; }
.srec .nowrap { white-space:nowrap; }

.pname-link { background:none; border:none; padding:0; text-align:left; color:#2563EB; cursor:pointer; font-weight:400;
  text-decoration:underline; text-decoration-style:dotted; overflow-wrap:anywhere; }
.pname-link:hover { color:#1D4ED8; }

.badge-ok { font-size:.7rem; font-weight:700; padding:.15rem .5rem; border-radius:999px; background:#E5F6EC; color:var(--good); }
.badge-new { font-size:.7rem; font-weight:700; padding:.15rem .5rem; border-radius:999px; background:#FDECEC; color:var(--bad); border:1px solid #F3C7C7; cursor:pointer; }
.badge-new:hover { background:var(--bad); color:#fff; }

.srec-modal { position:fixed; inset:0; z-index:1100; background:rgba(15,28,46,.45); display:flex; align-items:center; justify-content:center; padding:14px; }
.srec-modal-card { background:#fff; border-radius:16px; box-shadow:var(--shadow-md); width:100%; max-width:520px; max-height:85vh; overflow:auto; padding:18px; }
</style>