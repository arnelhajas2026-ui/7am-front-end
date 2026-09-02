<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

const tab = ref('INVENTORY');
const machines = ref([]);
const error = ref('');
const saving = ref(false);
const done = ref(null);
const notice = ref('');
const history = ref([]);

// --- Inventory ---
const invContext = ref('WAREHOUSE');      // 'WAREHOUSE' o machineId
const invSub = ref('MACHINE_LOADED');     // kung machine
const invRows = ref([]);
const invReason = ref('');
const invSearch = ref('');
const visibleInvRows = computed(() => {
  const q = invSearch.value.trim().toLowerCase();
  return invRows.value
    .filter((r) => !q || (r.productName||'').toLowerCase().includes(q) || (r.sku||'').toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (a.productName||'').localeCompare(b.productName||''));
});
const invLoading = ref(false);

function invParams(){
  if(invContext.value === 'WAREHOUSE') return { locationType:'WAREHOUSE' };
  return { locationType: invSub.value, machine: invContext.value };
}
async function loadInvExpected(){
  invLoading.value=true; error.value=''; done.value=null;
  try {
    const { data } = await api.get('/reconciliation/inventory/expected', { params: invParams() });
    invRows.value = data.rows.map(r=>({ ...r, actual: r.expected }));
  } catch(e){ error.value = e.response?.data?.message || 'Could not load expected stock.'; }
  finally { invLoading.value=false; }
}
const invVarianceCount = computed(()=> invRows.value.filter(r=> Number(r.actual)!==Number(r.expected)).length);
async function submitInv(){
  saving.value=true; error.value='';
  try {
    const p = invParams();
    const { data } = await api.post('/reconciliation/inventory', {
      ...p, reason: invReason.value,
      lines: invRows.value.map(r=>({ product:r.product, productName:r.productName, expected:r.expected, actual:Number(r.actual)||0 })),
    });
    invReason.value='';
    if (data.pending) { notice.value = 'Naipadala para sa approval ni Owner.'; }
    else { done.value = data.reconciliation; await Promise.all([ loadInvExpected(), loadHistory() ]); }
  } catch(e){ error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { saving.value=false; }
}

// --- Cash ---
const cashMachine = ref('');
const cashStart = ref(''); const cashEnd = ref('');
const cashLines = ref([]);
const cashReason = ref('');
async function loadCashExpected(){
  error.value=''; done.value=null;
  try {
    const { data } = await api.get('/reconciliation/cash/expected', { params:{ machine:cashMachine.value||undefined, start:cashStart.value||undefined, end:cashEnd.value||undefined } });
    const types = Object.keys(data.expected);
    if(!types.length) cashLines.value = [{ paymentType:'cash', expected:0, actual:0 }];
    else cashLines.value = types.map(t=>({ paymentType:t, expected:data.expected[t], actual:data.expected[t] }));
  } catch(e){ error.value = e.response?.data?.message || 'Could not load expected cash.'; }
}
async function submitCash(){
  saving.value=true; error.value='';
  try {
    const { data } = await api.post('/reconciliation/cash', {
      machine: cashMachine.value||undefined, start:cashStart.value||undefined, end:cashEnd.value||undefined, reason:cashReason.value,
      lines: cashLines.value.map(l=>({ paymentType:l.paymentType, expected:Number(l.expected)||0, actual:Number(l.actual)||0 })),
    });
    cashReason.value='';
    if (data.pending) { notice.value = 'Naipadala para sa approval ni Owner.'; }
    else { done.value = data.reconciliation; await loadHistory(); }
  } catch(e){ error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { saving.value=false; }
}

async function loadHistory(){
  try { const { data } = await api.get('/reconciliation'); history.value = data.reconciliations; } catch {}
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
const dt = fmtDateTime;

onMounted(async ()=>{
  try { const { data } = await api.get('/machines'); machines.value = data.machines; } catch {}
  await loadInvExpected(); await loadHistory();
});
</script>

<template>
  <div>
    <h3 class="mb-1">Reconcile</h3>
    <p class="text-muted">Match physical counts against the system record. Differences are flagged and traceable.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- Tabs -->
    <div class="seg mb-4">
      <button :class="{active: tab==='INVENTORY'}" @click="tab='INVENTORY'; done=null; notice=''">Stock</button>
      <button :class="{active: tab==='CASH'}" @click="tab='CASH'; done=null; notice=''; loadCashExpected()">Cash</button>
    </div>

    <!-- ===== INVENTORY ===== -->
    <template v-if="tab==='INVENTORY'">
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-6"><label class="form-label">Location</label>
          <select v-model="invContext" class="form-select" @change="loadInvExpected">
            <option value="WAREHOUSE">🏬 Warehouse</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">📟 {{ m.locationName || m.machineId }}</option>
          </select></div>
        <div v-if="invContext!=='WAREHOUSE'" class="col-12 col-md-6"><label class="form-label">Sub-location</label>
          <select v-model="invSub" class="form-select" @change="loadInvExpected">
            <option value="MACHINE_LOADED">Machine (display)</option>
            <option value="SIDE_CABINET">Side cabinet</option>
          </select></div>
      </div>

      <div v-if="done && done.type==='INVENTORY'" class="alert py-2" :class="done.hasVariance ? 'alert-warning' : 'alert-success'">
        Saved. {{ done.hasVariance ? 'Variance recorded and ledger adjusted to physical count.' : 'No variance — everything matched.' }}
      </div>

      <div v-if="invLoading" class="text-muted">Loading…</div>
      <div v-else-if="!invRows.length" class="card"><div class="card-body text-muted text-center py-4">No products to count here.</div></div>
      <div v-else>
        <div class="mb-3" style="max-width:360px">
          <input v-model="invSearch" class="form-control" placeholder="Search products…" />
        </div>
        <div class="card mb-3"><div class="card-body p-0">
        <div class="recon-head"><span class="flex-grow-1">Product</span><span class="col-exp">Expected</span><span class="col-act">Actual</span><span class="col-var">Variance</span></div>
        <div v-for="r in visibleInvRows" :key="r.product" class="recon-row">
          <span class="flex-grow-1">{{ r.productName }} <span class="text-muted small">{{ r.sku }}</span></span>
          <span class="col-exp numeric">{{ r.expected }}</span>
          <span class="col-act"><input v-model.number="r.actual" type="number" class="form-control form-control-sm numeric text-end" /></span>
          <span class="col-var numeric" :class="{ pos: r.actual-r.expected>0, neg: r.actual-r.expected<0 }">
            {{ (r.actual-r.expected>0?'+':'') + (Number(r.actual)-Number(r.expected)) }}</span>
        </div>
      </div></div>
      </div>

      <div v-if="invRows.length" class="card"><div class="card-body">
        <div v-if="invVarianceCount" class="alert alert-warning py-2 small">{{ invVarianceCount }} item(s) don't match. Add a reason before submitting.</div>
        <input v-model="invReason" class="form-control mb-2" placeholder="Reason for variance (optional if all match)" />
        <button class="btn btn-primary" :disabled="saving" @click="submitInv">{{ saving ? 'Saving…' : 'Submit count' }}</button>
      </div></div>
    </template>

    <!-- ===== CASH ===== -->
    <template v-else>
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-4"><label class="form-label">Machine</label>
          <select v-model="cashMachine" class="form-select" @change="loadCashExpected"><option value="">All machines</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select></div>
        <div class="col-6 col-md-4"><label class="form-label">From</label><input v-model="cashStart" type="date" class="form-control" @change="loadCashExpected" /></div>
        <div class="col-6 col-md-4"><label class="form-label">To</label><input v-model="cashEnd" type="date" class="form-control" @change="loadCashExpected" /></div>
      </div>

      <div v-if="done && done.type==='CASH'" class="alert py-2" :class="done.hasVariance ? 'alert-warning' : 'alert-success'">
        Saved. {{ done.hasVariance ? 'Cash variance recorded for review.' : 'Cash matched the expected collection.' }}
      </div>

      <div class="card mb-3"><div class="card-body p-0">
        <div class="recon-head"><span class="flex-grow-1">Payment type</span><span class="col-exp">Expected</span><span class="col-act">Counted</span><span class="col-var">Variance</span></div>
        <div v-for="l in cashLines" :key="l.paymentType" class="recon-row">
          <span class="flex-grow-1 text-capitalize">{{ l.paymentType }}</span>
          <span class="col-exp numeric">{{ peso(l.expected) }}</span>
          <span class="col-act"><input v-model.number="l.actual" type="number" class="form-control form-control-sm numeric text-end" /></span>
          <span class="col-var numeric" :class="{ pos: l.actual-l.expected>0, neg: l.actual-l.expected<0 }">{{ peso(l.actual-l.expected) }}</span>
        </div>
      </div></div>

      <div class="card"><div class="card-body">
        <input v-model="cashReason" class="form-control mb-2" placeholder="Reason for variance (optional)" />
        <button class="btn btn-primary" :disabled="saving" @click="submitCash">{{ saving ? 'Saving…' : 'Submit count' }}</button>
      </div></div>
    </template>

    <!-- History -->
    <p class="section-eyebrow mt-4">Recent reconciliations</p>
    <div v-if="!history.length" class="text-muted">None yet.</div>
    <div v-for="h in history" :key="h._id" class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-center">
      <div><span class="badge7 emp me-1">{{ h.type }}</span>
        <span class="small">{{ h.machine?.locationName || (h.locationType || 'Warehouse') }} · {{ dt(h.date) }}</span></div>
      <span class="pill" :class="h.hasVariance ? 'warn' : 'ok'">{{ h.hasVariance ? 'Variance' : 'Matched' }}</span>
    </div></div>
  </div>
</template>
