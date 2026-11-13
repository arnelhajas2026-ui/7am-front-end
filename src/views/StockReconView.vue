<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

// step: 'list' | 'setup' | 'count' | 'investigate'
const step = ref('list');
const error = ref('');
const notice = ref('');
const busy = ref(false);

// --- reference data ---
const meta = ref({ countTypes: [], locationTypes: [], reasonCodes: [], statuses: [] });
const locations = ref({ warehouse: null, machines: [] });
const users = ref([]);

// --- list ---
const recons = ref([]);
const filterStatus = ref('');

// --- setup ---
const setup = ref({ locationType: 'WAREHOUSE', machine: '', countType: 'SCHEDULED', custodian: '' });

// --- active record ---
const rec = ref(null);
const countInputs = ref({});        // productId -> actual
const search = ref('');
const investItems = ref({});        // productId -> { reasonCode, explanation, recountRequired, evidence:[{kind,url,label}] }

const statusBadge = (s) => ({
  DRAFT: 'bg-secondary', IN_PROGRESS: 'bg-info', SUBMITTED: 'bg-primary', FOR_REVIEW: 'bg-primary',
  UNDER_INVESTIGATION: 'bg-warning text-dark', RECOUNT_REQUESTED: 'bg-warning text-dark',
  RECOUNT_SUBMITTED: 'bg-warning text-dark', PENDING_OWNER_APPROVAL: 'bg-warning text-dark',
  APPROVED: 'bg-success', REJECTED: 'bg-danger', POSTED: 'bg-success', CLOSED: 'bg-dark',
}[s] || 'bg-secondary');

async function loadMeta(){
  try { const { data } = await api.get('/recon-config'); meta.value = data.meta || meta.value; } catch { /* ignore */ }
  try { const { data } = await api.get('/recon/stock/locations'); locations.value = data; } catch { /* ignore */ }
  try { const { data } = await api.get('/users'); users.value = (data.users || data || []).filter(u=>u.role!=='SUPERADMIN'); } catch { /* ignore */ }
}
async function loadList(){
  error.value='';
  try {
    const params = {}; if (filterStatus.value) params.status = filterStatus.value;
    const { data } = await api.get('/recon/stock', { params });
    recons.value = data.reconciliations || [];
  } catch(e){ error.value = e.response?.data?.message || 'Could not load list.'; }
}

function goSetup(){ setup.value = { locationType:'WAREHOUSE', machine:'', countType:'SCHEDULED', custodian:'' }; error.value=''; step.value='setup'; }

async function startRecon(){
  busy.value=true; error.value='';
  try {
    const body = { ...setup.value };
    if (body.locationType === 'WAREHOUSE') body.machine = '';
    const { data } = await api.post('/recon/stock/start', body);
    openRecord(data.reconciliation);
    notice.value = `Nasimulan: ${data.reconciliation.refNo} — naka-lock na ang snapshot.`;
  } catch(e){ error.value = e.response?.data?.message || 'Could not start.'; }
  finally { busy.value=false; }
}

function openRecord(r){
  rec.value = r;
  countInputs.value = {};
  // prefill mula sa huling count version kung meron
  const cur = (r.counts || [])[(r.counts||[]).length-1];
  if (cur) for (const l of cur.lines||[]) countInputs.value[String(l.product)] = l.actual;
  // investigation prefill
  investItems.value = {};
  for (const v of r.variances || []) {
    investItems.value[String(v.product)] = {
      reasonCode: v.reasonCode || '', explanation: v.explanation || '',
      recountRequired: !!v.recountRequired, evidence: (v.evidence||[]).map(e=>({kind:e.kind,url:e.url,label:e.label})),
    };
  }
  const counting = ['IN_PROGRESS','DRAFT','RECOUNT_SUBMITTED','RECOUNT_REQUESTED'].includes(r.status);
  step.value = counting ? 'count' : 'investigate';
}

async function openById(id){
  busy.value=true; error.value='';
  try { const { data } = await api.get('/recon/stock/'+id); openRecord(data.reconciliation); }
  catch(e){ error.value = e.response?.data?.message || 'Could not open.'; }
  finally { busy.value=false; }
}

const snapRows = computed(()=>{
  const lines = rec.value?.snapshot?.lines || [];
  const q = search.value.trim().toLowerCase();
  return lines.filter(l => !q || (l.productName||'').toLowerCase().includes(q) || (l.sku||'').toLowerCase().includes(q));
});
const expectedHidden = computed(()=> !!rec.value?._expectedHidden);

async function saveCount(isDraft){
  busy.value=true; error.value='';
  try {
    const lines = (rec.value.snapshot.lines||[]).map(l=>({ product:l.product, actual: Number(countInputs.value[String(l.product)]) || 0 }));
    const { data } = await api.post(`/recon/stock/${rec.value._id}/count`, { lines, isDraft });
    openRecord(data.reconciliation);
    notice.value = isDraft ? 'Na-save ang draft.' : 'Na-submit ang physical count — na-reveal na ang variances.';
  } catch(e){ error.value = e.response?.data?.message || 'Could not save count.'; }
  finally { busy.value=false; }
}

function addEvidence(pid){
  const it = investItems.value[pid] || (investItems.value[pid]={reasonCode:'',explanation:'',recountRequired:false,evidence:[]});
  it.evidence.push({ kind:'DOCUMENT', url:'', label:'' });
}
function removeEvidence(pid, i){ investItems.value[pid].evidence.splice(i,1); }

async function submitInvestigation(){
  busy.value=true; error.value='';
  try {
    const items = (rec.value.variances||[]).map(v=>{
      const it = investItems.value[String(v.product)] || {};
      return { product:v.product, reasonCode: it.reasonCode||'', explanation: it.explanation||'',
        recountRequired: !!it.recountRequired, evidence: (it.evidence||[]).filter(e=>e.url) };
    });
    const { data } = await api.post(`/recon/stock/${rec.value._id}/investigate`, { items });
    rec.value = data.reconciliation;
    if (data.investigationComplete) notice.value = 'Kumpleto na ang investigation — handa na para sa review/approval (Chunk E).';
    else notice.value = 'Na-save. Kulang pa: ' + (data.pending||[]).join(', ');
  } catch(e){ error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { busy.value=false; }
}

async function requestRecount(){
  if(!confirm('Mag-request ng recount? Gagawa ng bagong count version (hindi mababura ang original).')) return;
  busy.value=true; error.value='';
  try { const { data } = await api.post(`/recon/stock/${rec.value._id}/recount`, {}); openRecord(data.reconciliation); notice.value='Bukas na ang recount version.'; }
  catch(e){ error.value = e.response?.data?.message || 'Could not recount.'; }
  finally { busy.value=false; }
}

function backToList(){ step.value='list'; rec.value=null; notice.value=''; loadList(); }

const varianceCount = computed(()=> (rec.value?.variances||[]).length);

onMounted(async ()=>{ await loadMeta(); await loadList(); });
</script>

<template>
  <div class="container-fluid py-3" style="max-width:1100px">
    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
      <h4 class="mb-0" style="font-family:var(--font-display)">Stock Reconciliation</h4>
      <div class="d-flex gap-2">
        <button v-if="step!=='list'" class="btn btn-ghost btn-sm" @click="backToList">← Balik sa listahan</button>
        <button v-if="step==='list'" class="btn btn-primary btn-sm" @click="goSetup">+ New Stock Reconciliation</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- LIST -->
    <div v-if="step==='list'" class="card"><div class="card-body">
      <div class="d-flex gap-2 align-items-end mb-3 flex-wrap">
        <div><label class="form-label small mb-0">Status</label>
          <select v-model="filterStatus" class="form-select form-select-sm" style="min-width:180px" @change="loadList">
            <option value="">— Lahat —</option>
            <option v-for="s in meta.statuses" :key="s" :value="s">{{ s }}</option>
          </select></div>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead><tr><th>Reference</th><th>Location</th><th>Count Type</th><th>Status</th><th class="text-end">Variance (units)</th><th>Date</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in recons" :key="r._id">
              <td class="fw-semibold">{{ r.refNo }}</td>
              <td>{{ r.locationLabel || r.locationType }}</td>
              <td>{{ r.countType }}</td>
              <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span></td>
              <td class="text-end">{{ r.hasVariance ? r.totalVarianceUnits : '0' }}</td>
              <td class="small text-muted">{{ fmtDateTime(r.countDate || r.createdAt) }}</td>
              <td><button class="btn btn-ghost btn-sm" @click="openById(r._id)">Buksan</button></td>
            </tr>
            <tr v-if="!recons.length"><td colspan="7" class="text-center text-muted py-3">Wala pang stock reconciliation.</td></tr>
          </tbody>
        </table>
      </div>
    </div></div>

    <!-- SETUP -->
    <div v-else-if="step==='setup'" class="card"><div class="card-body" style="max-width:560px">
      <h6 class="mb-3">Setup — location at cutoff</h6>
      <div class="mb-2"><label class="form-label">Location type</label>
        <select v-model="setup.locationType" class="form-select">
          <option value="WAREHOUSE">Warehouse</option>
          <option value="VENDING_MACHINE">Vending Machine</option>
          <option value="SIDE_CABINET">Side Cabinet</option>
        </select></div>
      <div class="mb-2" v-if="setup.locationType!=='WAREHOUSE'"><label class="form-label">Machine</label>
        <select v-model="setup.machine" class="form-select">
          <option value="">— Pumili —</option>
          <option v-for="m in locations.machines" :key="m.machine" :value="m.machine">{{ m.machineId }} — {{ m.locationName }}</option>
        </select></div>
      <div class="mb-2"><label class="form-label">Count type</label>
        <select v-model="setup.countType" class="form-select">
          <option value="SCHEDULED">Scheduled</option>
          <option value="SURPRISE">Surprise</option>
          <option value="SPOT_CHECK">Spot Check</option>
        </select></div>
      <div class="mb-3"><label class="form-label">Assigned counter (custodian)</label>
        <select v-model="setup.custodian" class="form-select">
          <option value="">— Opsyonal —</option>
          <option v-for="u in users" :key="u._id" :value="u._id">{{ u.name }}</option>
        </select></div>
      <div class="alert alert-info py-2 small">Kapag sinimulan, makukuha ang immutable snapshot ng expected quantities at ILo-lock. Blind count — nakatago ang expected habang nagbibilang.</div>
      <button class="btn btn-primary" :disabled="busy" @click="startRecon">{{ busy?'…':'Start Blind Count' }}</button>
    </div></div>

    <!-- COUNT -->
    <div v-else-if="step==='count'" class="card"><div class="card-body">
      <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <div class="fw-semibold">{{ rec.refNo }} · {{ rec.locationLabel || rec.locationType }}</div>
          <div class="small text-muted">Snapshot: {{ fmtDateTime(rec.snapshot?.takenAt) }} · {{ rec.snapshot?.totalProducts }} products ·
            <span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span></div>
        </div>
        <span v-if="expectedHidden" class="badge bg-dark align-self-start">BLIND COUNT</span>
      </div>
      <input v-model="search" class="form-control form-control-sm mb-2" placeholder="Hanapin ang produkto…" style="max-width:320px" />
      <div class="table-responsive" style="max-height:60vh;overflow:auto">
        <table class="table table-sm align-middle">
          <thead class="position-sticky top-0 bg-body"><tr><th>Product</th><th style="width:140px">Actual Count</th><th v-if="!expectedHidden" class="text-end">Expected</th></tr></thead>
          <tbody>
            <tr v-for="l in snapRows" :key="l.product">
              <td>{{ l.productName }} <span class="text-muted small">{{ l.sku }}</span></td>
              <td><input type="number" min="0" class="form-control form-control-sm" v-model.number="countInputs[String(l.product)]" /></td>
              <td v-if="!expectedHidden" class="text-end">{{ l.expected }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="d-flex gap-2 mt-2">
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="saveCount(true)">Save Draft</button>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="saveCount(false)">Submit Physical Count</button>
      </div>
    </div></div>

    <!-- INVESTIGATE / REVIEW -->
    <div v-else-if="step==='investigate'" class="card"><div class="card-body">
      <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <div class="fw-semibold">{{ rec.refNo }} · {{ rec.locationLabel || rec.locationType }}</div>
          <div class="small text-muted">Submitted by {{ rec.submittedByName || '—' }} · <span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span></div>
        </div>
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="requestRecount">Request Recount</button>
      </div>

      <div v-if="!varianceCount" class="alert alert-success py-2">Matched — walang variance. Handa na para sa review/approval (Chunk E).</div>

      <div v-else>
        <p class="small text-muted mb-2">Kailangan ng reason code (+ explanation kung "Other", + evidence kung required) bawat variance.</p>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Product</th><th class="text-end">Exp</th><th class="text-end">Act</th><th class="text-end">Var</th><th style="min-width:200px">Reason</th><th style="min-width:200px">Explanation / Evidence</th></tr></thead>
            <tbody>
              <tr v-for="v in rec.variances" :key="v.product">
                <td>{{ v.productName }} <span v-if="v.ownerFlagged" class="badge bg-danger">THEFT FLAG</span></td>
                <td class="text-end">{{ v.expected }}</td>
                <td class="text-end">{{ v.actual }}</td>
                <td class="text-end fw-semibold" :class="v.variance<0?'text-danger':'text-success'">{{ v.variance>0?'+':'' }}{{ v.variance }}</td>
                <td>
                  <select class="form-select form-select-sm" v-model="investItems[String(v.product)].reasonCode">
                    <option value="">— Pumili —</option>
                    <option v-for="rc in meta.reasonCodes" :key="rc.code" :value="rc.code">{{ rc.label }}</option>
                  </select>
                  <div class="form-check mt-1"><input class="form-check-input" type="checkbox" :id="'rc-'+v.product" v-model="investItems[String(v.product)].recountRequired" /><label class="form-check-label small" :for="'rc-'+v.product">Recount required</label></div>
                </td>
                <td>
                  <input class="form-control form-control-sm mb-1" placeholder="Explanation…" v-model="investItems[String(v.product)].explanation" />
                  <div v-for="(e,i) in investItems[String(v.product)].evidence" :key="i" class="d-flex gap-1 mb-1">
                    <select class="form-select form-select-sm" style="width:90px" v-model="e.kind"><option value="PHOTO">Photo</option><option value="DOCUMENT">Doc</option></select>
                    <input class="form-control form-control-sm" placeholder="Link URL" v-model="e.url" />
                    <button class="btn btn-ghost btn-sm" @click="removeEvidence(String(v.product), i)">✕</button>
                  </div>
                  <button class="btn btn-ghost btn-sm" @click="addEvidence(String(v.product))">+ Evidence link</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="btn btn-primary btn-sm mt-2" :disabled="busy" @click="submitInvestigation">Submit Investigation</button>
      </div>
    </div></div>
  </div>
</template>
