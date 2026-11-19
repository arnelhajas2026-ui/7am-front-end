<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

const step = ref('list');        // list | setup | count | investigate
const error = ref('');
const notice = ref('');
const busy = ref(false);

const meta = ref({ reasonCodes: [], statuses: [] });
const machines = ref([]);
const users = ref([]);
const recons = ref([]);
const filterStatus = ref('');

const setup = ref({ machine: '', periodStart: '', periodEnd: '', custodian: '' });
const expectedInfo = ref(null);

const rec = ref(null);
// bills
const openingBills = ref(0), billsAccepted = ref(0), billsRemoved = ref(0);
const billRows = ref([]);        // [{denom, qty}]
// coin float
const cf = ref({ opening: 0, received: 0, dispensed: 0, removed: 0, added: 0, sensorNote: '' });
const coinRows = ref([]);
// investigation
const investItems = ref({});     // key -> {reasonCode, explanation, evidence[]}

const peso = (c) => '₱' + (Number(c || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const denomLabel = (c) => '₱' + (c / 100).toLocaleString('en-PH', { minimumFractionDigits: c % 100 ? 2 : 0 });

const statusBadge = (s) => ({
  IN_PROGRESS: 'bg-info', SUBMITTED: 'bg-primary', FOR_REVIEW: 'bg-primary',
  UNDER_INVESTIGATION: 'bg-warning text-dark', PENDING_OWNER_APPROVAL: 'bg-warning text-dark',
  APPROVED: 'bg-success', REJECTED: 'bg-danger', POSTED: 'bg-success', CLOSED: 'bg-dark',
}[s] || 'bg-secondary');

async function loadMeta(){
  try { const { data } = await api.get('/recon-config'); meta.value = data.meta || meta.value; } catch { /* ignore */ }
  try { const { data } = await api.get('/recon/stock/locations'); machines.value = data.machines || []; } catch { /* ignore */ }
  try { const { data } = await api.get('/users'); users.value = (data.users || []).filter(u=>u.role!=='SUPERADMIN'); } catch { /* ignore */ }
}
async function loadList(){
  try { const params = {}; if(filterStatus.value) params.status=filterStatus.value;
    const { data } = await api.get('/recon/cash', { params }); recons.value = data.reconciliations || []; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load list.'; }
}

function goSetup(){ setup.value = { machine:'', periodStart:'', periodEnd:'', custodian:'' }; expectedInfo.value=null; error.value=''; step.value='setup'; }

async function previewExpected(){
  if(!setup.value.machine) return;
  try {
    const { data } = await api.get('/recon/cash/expected', { params: { machine:setup.value.machine, start:setup.value.periodStart, end:setup.value.periodEnd } });
    expectedInfo.value = data;
  } catch(e){ error.value = e.response?.data?.message || 'Could not preview.'; }
}

async function startRecon(){
  busy.value=true; error.value='';
  try {
    const { data } = await api.post('/recon/cash/start', { ...setup.value });
    await openById(data.reconciliation._id);
    notice.value = `Nasimulan: ${data.reconciliation.refNo}.`;
  } catch(e){ error.value = e.response?.data?.message || 'Could not start.'; }
  finally { busy.value=false; }
}

function denomRowsFrom(denoms, existing){
  const byDenom = new Map((existing||[]).map(d=>[d.denom, d.qty]));
  return (denoms||[]).map(d=>({ denom:d, qty: byDenom.get(d) || 0 }));
}

async function openById(id){
  busy.value=true; error.value='';
  try {
    const { data } = await api.get('/recon/cash/'+id);
    rec.value = data.reconciliation;
    // load denomination config
    let billDenoms=[100000,50000,20000,10000,5000,2000], coinDenoms=[2000,1000,500,100,25], prevBills=0, prevFloat=0, expCash=0;
    try { const ex = await api.get('/recon/cash/expected', { params:{ machine: rec.value.machine?._id || rec.value.machine, start: rec.value.periodStart, end: rec.value.periodEnd } });
      billDenoms = ex.data.billDenominations; coinDenoms = ex.data.coinDenominations; prevBills = ex.data.prevClosingBills; prevFloat = ex.data.prevClosingFloat; expCash = ex.data.expectedCashCollection; } catch { /* ignore */ }

    billRows.value = denomRowsFrom(billDenoms, rec.value.bills);
    coinRows.value = denomRowsFrom(coinDenoms, rec.value.coins);
    openingBills.value = rec.value.expectedClosingBills ? (rec.value.bills?.length ? Math.max(0, rec.value.expectedClosingBills - billsAccepted.value + billsRemoved.value) : prevBills) : prevBills;
    // prefill billsAccepted from expected cash collection on first open
    billsAccepted.value = rec.value.bills?.length ? billsAcceptedFromRec() : expCash;
    billsRemoved.value = 0;
    const c = rec.value.coinFloat || {};
    cf.value = { opening: c.openingFloat ?? prevFloat, received: c.coinsReceived||0, dispensed: c.changeDispensed||0, removed: c.coinsRemoved||0, added: c.coinsAdded||0, sensorNote: c.sensorReadingNote||'' };

    investItems.value = {};
    for (const v of rec.value.variances || []) investItems.value[v.productName] = { reasonCode:v.reasonCode||'', explanation:v.explanation||'', evidence:(v.evidence||[]).map(e=>({kind:e.kind,url:e.url,label:e.label})) };

    step.value = ['IN_PROGRESS','DRAFT','RECOUNT_REQUESTED','RECOUNT_SUBMITTED'].includes(rec.value.status) ? 'count' : 'investigate';
  } catch(e){ error.value = e.response?.data?.message || 'Could not open.'; }
  finally { busy.value=false; }
}
function billsAcceptedFromRec(){ // reconstruct: accepted = expectedClosing - opening + removed (best-effort)
  return 0;
}

const billTotal = computed(()=> billRows.value.reduce((s,r)=> s + r.denom * (Number(r.qty)||0), 0));
const coinTotal = computed(()=> coinRows.value.reduce((s,r)=> s + r.denom * (Number(r.qty)||0), 0));
const expectedClosingBills = computed(()=> Number(openingBills.value||0) + Number(billsAccepted.value||0) - Number(billsRemoved.value||0));
const billVariance = computed(()=> billTotal.value - expectedClosingBills.value);
const expectedClosingFloat = computed(()=> Number(cf.value.opening||0) + Number(cf.value.received||0) - Number(cf.value.dispensed||0) - Number(cf.value.removed||0) + Number(cf.value.added||0));
const coinVariance = computed(()=> coinTotal.value - expectedClosingFloat.value);
const totalVariance = computed(()=> billVariance.value + coinVariance.value);

async function saveCount(isDraft){
  busy.value=true; error.value='';
  try {
    const body = {
      openingBills: openingBills.value, billsAccepted: billsAccepted.value, billsRemoved: billsRemoved.value,
      bills: billRows.value.map(r=>({ denom:r.denom, qty:Number(r.qty)||0 })),
      coinFloat: { ...cf.value },
      coins: coinRows.value.map(r=>({ denom:r.denom, qty:Number(r.qty)||0 })),
      isDraft,
    };
    const { data } = await api.post(`/recon/cash/${rec.value._id}/count`, body);
    rec.value = data.reconciliation;
    if (isDraft) { notice.value='Na-save ang draft.'; }
    else { notice.value='Na-submit. ' + (rec.value.hasVariance?'May variance — kailangan ng investigation.':'Matched.'); step.value='investigate';
      investItems.value={}; for (const v of rec.value.variances||[]) investItems.value[v.productName]={reasonCode:'',explanation:'',evidence:[]}; }
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { busy.value=false; }
}

function addEvidence(key){ const it = investItems.value[key] || (investItems.value[key]={reasonCode:'',explanation:'',evidence:[]}); it.evidence.push({kind:'DOCUMENT',url:'',label:''}); }
function removeEvidence(key,i){ investItems.value[key].evidence.splice(i,1); }

async function submitInvestigation(){
  busy.value=true; error.value='';
  try {
    const items = (rec.value.variances||[]).map(v=>{ const it=investItems.value[v.productName]||{};
      return { key:v.productName, reasonCode:it.reasonCode||'', explanation:it.explanation||'', evidence:(it.evidence||[]).filter(e=>e.url) }; });
    const { data } = await api.post(`/recon/cash/${rec.value._id}/investigate`, { items });
    rec.value = data.reconciliation;
    notice.value = data.investigationComplete ? 'Kumpleto na — handa para sa review/approval (Chunk E).' : 'Kulang pa: ' + (data.pending||[]).join(', ');
  } catch(e){ error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { busy.value=false; }
}

function backToList(){ step.value='list'; rec.value=null; notice.value=''; loadList(); }
const varianceCount = computed(()=> (rec.value?.variances||[]).length);

onMounted(async ()=>{ await loadMeta(); await loadList(); });
</script>

<template>
  <div class="container-fluid py-3" style="max-width:1100px">
    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
      <h4 class="mb-0" style="font-family:var(--font-display)">Cash Reconciliation</h4>
      <div class="d-flex gap-2">
        <button v-if="step!=='list'" class="btn btn-ghost btn-sm" @click="backToList">← Balik</button>
        <button v-if="step==='list'" class="btn btn-primary btn-sm" @click="goSetup">+ New Cash Reconciliation</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- LIST -->
    <div v-if="step==='list'" class="card"><div class="card-body">
      <div class="mb-3"><select v-model="filterStatus" class="form-select form-select-sm" style="max-width:220px" @change="loadList">
        <option value="">— Lahat ng status —</option><option v-for="s in meta.statuses" :key="s" :value="s">{{ s }}</option></select></div>
      <div class="table-responsive"><table class="table table-sm align-middle">
        <thead><tr><th>Reference</th><th>Machine</th><th>Status</th><th class="text-end">Variance</th><th>Period</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in recons" :key="r._id">
            <td class="fw-semibold">{{ r.refNo }}</td><td>{{ r.locationLabel }}</td>
            <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span></td>
            <td class="text-end" :class="r.totalVarianceCentavos<0?'text-danger':''">{{ peso(r.totalVarianceCentavos) }}</td>
            <td class="small text-muted">{{ r.periodStart?fmtDateTime(r.periodStart):'' }} – {{ r.periodEnd?fmtDateTime(r.periodEnd):'' }}</td>
            <td><button class="btn btn-ghost btn-sm" @click="openById(r._id)">Buksan</button></td>
          </tr>
          <tr v-if="!recons.length"><td colspan="6" class="text-center text-muted py-3">Wala pang cash reconciliation.</td></tr>
        </tbody>
      </table></div>
    </div></div>

    <!-- SETUP -->
    <div v-else-if="step==='setup'" class="card"><div class="card-body" style="max-width:580px">
      <h6 class="mb-3">Setup — machine + period</h6>
      <div class="mb-2"><label class="form-label">Machine</label>
        <select v-model="setup.machine" class="form-select" @change="previewExpected">
          <option value="">— Pumili —</option>
          <option v-for="m in machines" :key="m.machine" :value="m.machine">{{ m.machineId }} — {{ m.locationName }}</option>
        </select></div>
      <div class="row g-2">
        <div class="col-6"><label class="form-label">From</label><input type="datetime-local" class="form-control" v-model="setup.periodStart" @change="previewExpected" /></div>
        <div class="col-6"><label class="form-label">To</label><input type="datetime-local" class="form-control" v-model="setup.periodEnd" @change="previewExpected" /></div>
      </div>
      <div class="mb-2 mt-2"><label class="form-label">Assigned counter</label>
        <select v-model="setup.custodian" class="form-select"><option value="">— Opsyonal —</option><option v-for="u in users" :key="u._id" :value="u._id">{{ u.name }}</option></select></div>
      <div v-if="expectedInfo" class="alert alert-info py-2 small mb-3">
        Expected cash collection (excl. cashless): <strong>{{ peso(expectedInfo.expectedCashCollection) }}</strong> ·
        Cashless: {{ peso(expectedInfo.cashlessCollection) }} · {{ expectedInfo.txnCount }} txns
        <span v-if="expectedInfo.postCutoffCount"> · ⚠ {{ expectedInfo.postCutoffCount }} post-cutoff txn(s)</span>
      </div>
      <button class="btn btn-primary" :disabled="busy || !setup.machine" @click="startRecon">{{ busy?'…':'Start Cash Reconciliation' }}</button>
    </div></div>

    <!-- COUNT -->
    <div v-else-if="step==='count'" class="card"><div class="card-body">
      <div class="fw-semibold mb-1">{{ rec.refNo }} · {{ rec.locationLabel }}</div>
      <div class="small text-muted mb-3"><span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span></div>

      <!-- BILLS -->
      <h6 class="section-eyebrow">Bill Reconciliation</h6>
      <div class="row g-2 mb-2">
        <div class="col-md-4"><label class="form-label small mb-0">Opening Bills (₱)</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(openingBills/100)" @input="openingBills=Math.round(($event.target.value||0)*100)" /></div>
        <div class="col-md-4"><label class="form-label small mb-0">Bills Accepted (₱)</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(billsAccepted/100)" @input="billsAccepted=Math.round(($event.target.value||0)*100)" /></div>
        <div class="col-md-4"><label class="form-label small mb-0">Bills Removed (₱)</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(billsRemoved/100)" @input="billsRemoved=Math.round(($event.target.value||0)*100)" /></div>
      </div>
      <table class="table table-sm align-middle" style="max-width:420px">
        <thead><tr><th>Denom</th><th style="width:110px">Qty</th><th class="text-end">Subtotal</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in billRows" :key="'b'+i"><td>{{ denomLabel(r.denom) }}</td>
            <td><input type="number" min="0" class="form-control form-control-sm" v-model.number="r.qty" /></td>
            <td class="text-end">{{ peso(r.denom*(Number(r.qty)||0)) }}</td></tr>
        </tbody>
      </table>
      <div class="small mb-3">
        Total Physical Bills: <strong>{{ peso(billTotal) }}</strong> ·
        Expected Closing: {{ peso(expectedClosingBills) }} ·
        Variance: <strong :class="billVariance<0?'text-danger':billVariance>0?'text-success':''">{{ peso(billVariance) }}</strong>
      </div>

      <!-- COIN FLOAT -->
      <h6 class="section-eyebrow">Coin Float</h6>
      <div class="row g-2 mb-2">
        <div class="col"><label class="form-label small mb-0">Opening</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(cf.opening/100)" @input="cf.opening=Math.round(($event.target.value||0)*100)" /></div>
        <div class="col"><label class="form-label small mb-0">Received</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(cf.received/100)" @input="cf.received=Math.round(($event.target.value||0)*100)" /></div>
        <div class="col"><label class="form-label small mb-0">Dispensed</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(cf.dispensed/100)" @input="cf.dispensed=Math.round(($event.target.value||0)*100)" /></div>
        <div class="col"><label class="form-label small mb-0">Removed</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(cf.removed/100)" @input="cf.removed=Math.round(($event.target.value||0)*100)" /></div>
        <div class="col"><label class="form-label small mb-0">Added</label><input type="number" step="0.01" class="form-control form-control-sm" :value="(cf.added/100)" @input="cf.added=Math.round(($event.target.value||0)*100)" /></div>
      </div>
      <table class="table table-sm align-middle" style="max-width:420px">
        <thead><tr><th>Denom</th><th style="width:110px">Qty</th><th class="text-end">Subtotal</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in coinRows" :key="'c'+i"><td>{{ denomLabel(r.denom) }}</td>
            <td><input type="number" min="0" class="form-control form-control-sm" v-model.number="r.qty" /></td>
            <td class="text-end">{{ peso(r.denom*(Number(r.qty)||0)) }}</td></tr>
        </tbody>
      </table>
      <div class="mb-2"><label class="form-label small mb-0">Sensor reading note (monitoring lang, hindi verified count)</label>
        <input class="form-control form-control-sm" v-model="cf.sensorNote" placeholder="opsyonal" /></div>
      <div class="small mb-3">
        Actual Closing Coins: <strong>{{ peso(coinTotal) }}</strong> ·
        Expected Closing Float: {{ peso(expectedClosingFloat) }} ·
        Variance: <strong :class="coinVariance<0?'text-danger':coinVariance>0?'text-success':''">{{ peso(coinVariance) }}</strong>
      </div>

      <div class="alert py-2" :class="totalVariance===0?'alert-success':'alert-warning'">
        Kabuuang Cash Variance: <strong>{{ peso(totalVariance) }}</strong>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="saveCount(true)">Save Draft</button>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="saveCount(false)">Submit Cash Count</button>
      </div>
    </div></div>

    <!-- INVESTIGATE -->
    <div v-else-if="step==='investigate'" class="card"><div class="card-body">
      <div class="fw-semibold mb-1">{{ rec.refNo }} · {{ rec.locationLabel }}</div>
      <div class="small text-muted mb-3">Submitted by {{ rec.submittedByName || '—' }} ·
        <span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span>
        <span v-if="rec.requiresOwnerApproval" class="badge bg-warning text-dark ms-1">Owner approval required</span></div>

      <div v-if="!varianceCount" class="alert alert-success py-2">Matched — walang variance. Handa para sa review/approval (Chunk E).</div>
      <div v-else>
        <table class="table table-sm align-middle">
          <thead><tr><th>Category</th><th class="text-end">Expected</th><th class="text-end">Actual</th><th class="text-end">Variance</th><th style="min-width:200px">Reason</th><th style="min-width:220px">Explanation / Evidence</th></tr></thead>
          <tbody>
            <tr v-for="v in rec.variances" :key="v.productName">
              <td class="fw-semibold">{{ v.productName }} <span v-if="v.ownerFlagged" class="badge bg-danger">FLAG</span></td>
              <td class="text-end">{{ peso(v.expected) }}</td><td class="text-end">{{ peso(v.actual) }}</td>
              <td class="text-end fw-semibold" :class="v.variance<0?'text-danger':'text-success'">{{ peso(v.variance) }}</td>
              <td><select class="form-select form-select-sm" v-model="investItems[v.productName].reasonCode">
                <option value="">— Pumili —</option><option v-for="rc in meta.reasonCodes" :key="rc.code" :value="rc.code">{{ rc.label }}</option></select></td>
              <td>
                <input class="form-control form-control-sm mb-1" placeholder="Explanation…" v-model="investItems[v.productName].explanation" />
                <div v-for="(e,i) in investItems[v.productName].evidence" :key="i" class="d-flex gap-1 mb-1">
                  <select class="form-select form-select-sm" style="width:90px" v-model="e.kind"><option value="PHOTO">Photo</option><option value="DOCUMENT">Doc</option></select>
                  <input class="form-control form-control-sm" placeholder="Link URL" v-model="e.url" />
                  <button class="btn btn-ghost btn-sm" @click="removeEvidence(v.productName,i)">✕</button>
                </div>
                <button class="btn btn-ghost btn-sm" @click="addEvidence(v.productName)">+ Evidence link</button>
              </td>
            </tr>
          </tbody>
        </table>
        <button class="btn btn-primary btn-sm mt-2" :disabled="busy" @click="submitInvestigation">Submit Investigation</button>
      </div>
    </div></div>
  </div>
</template>
