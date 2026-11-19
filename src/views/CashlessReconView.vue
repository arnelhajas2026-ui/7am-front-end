<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

const step = ref('list');        // list | setup | match | investigate
const error = ref('');
const notice = ref('');
const busy = ref(false);

const meta = ref({ reasonCodes: [], statuses: [], providers: ['GCASH','MAYA','QRPH'] });
const machines = ref([]);
const users = ref([]);
const recons = ref([]);
const filterStatus = ref('');

const setup = ref({ machine: '', periodStart: '', periodEnd: '', provider: 'GCASH', custodian: '' });
const sysPreview = ref(null);

const rec = ref(null);
const providerRows = ref([]);    // [{txnRef, amount, status, datetime, fee, net}]
const tolerance = ref(120);
const matchSummary = ref(null);
const investItems = ref({});

const peso = (c) => '₱' + (Number(c || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = (s) => ({
  IN_PROGRESS:'bg-info', SUBMITTED:'bg-primary', FOR_REVIEW:'bg-primary', UNDER_INVESTIGATION:'bg-warning text-dark',
  PENDING_OWNER_APPROVAL:'bg-warning text-dark', APPROVED:'bg-success', REJECTED:'bg-danger', POSTED:'bg-success', CLOSED:'bg-dark',
}[s] || 'bg-secondary');
const txnBadge = (s) => ({
  MATCHED:'bg-success', MISSING_IN_PROVIDER:'bg-danger', MISSING_IN_SYSTEM:'bg-danger',
  DUPLICATE:'bg-warning text-dark', PENDING:'bg-secondary', REVERSED:'bg-dark', REFUNDED:'bg-dark', AMOUNT_MISMATCH:'bg-warning text-dark',
}[s] || 'bg-secondary');

async function loadMeta(){
  try { const { data } = await api.get('/recon-config'); meta.value = { ...meta.value, ...(data.meta||{}) }; } catch { /* ignore */ }
  try { const { data } = await api.get('/recon/stock/locations'); machines.value = data.machines || []; } catch { /* ignore */ }
  try { const { data } = await api.get('/users'); users.value = (data.users || []).filter(u=>u.role!=='SUPERADMIN'); } catch { /* ignore */ }
}
async function loadList(){
  try { const params={}; if(filterStatus.value) params.status=filterStatus.value;
    const { data } = await api.get('/recon/cashless', { params }); recons.value = data.reconciliations || []; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load list.'; }
}

function goSetup(){ setup.value={ machine:'', periodStart:'', periodEnd:'', provider:'GCASH', custodian:'' }; sysPreview.value=null; error.value=''; step.value='setup'; }

async function previewSystem(){
  if(!setup.value.machine) return;
  try { const { data } = await api.get('/recon/cashless/system', { params:{ machine:setup.value.machine, start:setup.value.periodStart, end:setup.value.periodEnd } }); sysPreview.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not preview.'; }
}

async function startRecon(){
  busy.value=true; error.value='';
  try { const { data } = await api.post('/recon/cashless/start', { ...setup.value }); await openById(data.reconciliation._id); notice.value=`Nasimulan: ${data.reconciliation.refNo}.`; }
  catch(e){ error.value = e.response?.data?.message || 'Could not start.'; }
  finally { busy.value=false; }
}

async function openById(id){
  busy.value=true; error.value='';
  try {
    const { data } = await api.get('/recon/cashless/'+id);
    rec.value = data.reconciliation;
    providerRows.value = (rec.value.cashlessProviderRows || []).map(r => ({ txnRef:r.txnRef||'', amount:Number(r.amount)||0, status:r.status||'success', datetime:r.datetime||'', fee:Number(r.fee)||0, net:(r.net==null?null:Number(r.net)) }));
    matchSummary.value = null;
    investItems.value = {};
    for (const v of rec.value.variances || []) investItems.value[v.productName] = { reasonCode:v.reasonCode||'', explanation:v.explanation||'', evidence:(v.evidence||[]).map(e=>({kind:e.kind,url:e.url,label:e.label})) };
    step.value = (rec.value.cashlessTxns && rec.value.cashlessTxns.length && !['IN_PROGRESS','DRAFT','RECOUNT_REQUESTED','RECOUNT_SUBMITTED'].includes(rec.value.status)) ? 'investigate' : 'match';
  } catch(e){ error.value = e.response?.data?.message || 'Could not open.'; }
  finally { busy.value=false; }
}

// --- CSV import (client-side) ---
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length) return [];
  const split = (l)=>{ const out=[]; let cur='',q=false; for(let i=0;i<l.length;i++){ const ch=l[i];
    if(q){ if(ch==='"'){ if(l[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else { if(ch===','){out.push(cur);cur='';} else if(ch==='"') q=true; else cur+=ch; } } out.push(cur); return out; };
  const header = split(lines[0]).map(h=>h.trim().toLowerCase());
  const idx = (names)=> header.findIndex(h=> names.some(n=> h.includes(n)));
  const iRef=idx(['ref','txn','transaction id','reference']), iAmt=idx(['amount','gross','total']),
    iStat=idx(['status','state']), iDate=idx(['date','time','datetime','timestamp']), iFee=idx(['fee','charge']), iNet=idx(['net','settle']);
  return lines.slice(1).map(l=>{ const c=split(l);
    const num=(s)=> Number(String(s||'').replace(/[^0-9.\-]/g,'')) || 0;
    return { txnRef: iRef>=0?String(c[iRef]||'').trim():'', amount: iAmt>=0?num(c[iAmt]):0,
      status: iStat>=0?String(c[iStat]||'').trim():'success', datetime: iDate>=0?String(c[iDate]||'').trim():'',
      fee: iFee>=0?num(c[iFee]):0, net: iNet>=0?num(c[iNet]):null }; })
    .filter(r=> r.amount>0 || r.txnRef);
}
function onFile(e){
  const f = e.target.files?.[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ try { providerRows.value = parseCSV(String(r.result)); notice.value = `Na-import: ${providerRows.value.length} rows.`; } catch { error.value='Hindi ma-parse ang CSV.'; } };
  r.readAsText(f);
}
function addRow(){ providerRows.value.push({ txnRef:'', amount:0, status:'success', datetime:'', fee:0, net:null }); }
function removeRow(i){ providerRows.value.splice(i,1); }

async function runMatch(isDraft){
  busy.value=true; error.value='';
  try {
    const { data } = await api.post(`/recon/cashless/${rec.value._id}/match`, { providerRows: providerRows.value, toleranceMinutes: tolerance.value, isDraft });
    rec.value = data.reconciliation; matchSummary.value = data.summary;
    if(!isDraft){ notice.value = rec.value.hasVariance ? 'May unmatched — kailangan ng investigation.' : 'Fully matched! 🎉';
      investItems.value={}; for (const v of rec.value.variances||[]) investItems.value[v.productName]={reasonCode:'',explanation:'',evidence:[]};
      step.value = rec.value.hasVariance ? 'investigate' : 'investigate'; }
    else notice.value='Na-match (draft).';
  } catch(e){ error.value = e.response?.data?.message || 'Could not match.'; }
  finally { busy.value=false; }
}

function addEvidence(key){ const it=investItems.value[key]||(investItems.value[key]={reasonCode:'',explanation:'',evidence:[]}); it.evidence.push({kind:'DOCUMENT',url:'',label:''}); }
function removeEvidence(key,i){ investItems.value[key].evidence.splice(i,1); }

async function submitInvestigation(){
  busy.value=true; error.value='';
  try {
    const items = (rec.value.variances||[]).map(v=>{ const it=investItems.value[v.productName]||{};
      return { key:v.productName, reasonCode:it.reasonCode||'', explanation:it.explanation||'', evidence:(it.evidence||[]).filter(e=>e.url) }; });
    const { data } = await api.post(`/recon/cashless/${rec.value._id}/investigate`, { items });
    rec.value = data.reconciliation;
    notice.value = data.investigationComplete ? 'Kumpleto na — handa para sa review/approval (Chunk E).' : 'Kulang pa: ' + (data.pending||[]).join(', ');
  } catch(e){ error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { busy.value=false; }
}

function backToList(){ step.value='list'; rec.value=null; notice.value=''; loadList(); }
const channel = computed(()=> (rec.value?.cashlessChannels||[])[0] || null);
const txns = computed(()=> rec.value?.cashlessTxns || []);
const varianceCount = computed(()=> (rec.value?.variances||[]).length);

onMounted(async ()=>{ await loadMeta(); await loadList(); });
</script>

<template>
  <div class="container-fluid py-3" style="max-width:1100px">
    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
      <h4 class="mb-0" style="font-family:var(--font-display)">Cashless Reconciliation</h4>
      <div class="d-flex gap-2">
        <button v-if="step!=='list'" class="btn btn-ghost btn-sm" @click="backToList">← Balik</button>
        <button v-if="step==='list'" class="btn btn-primary btn-sm" @click="goSetup">+ New Cashless Reconciliation</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- LIST -->
    <div v-if="step==='list'" class="card"><div class="card-body">
      <div class="mb-3"><select v-model="filterStatus" class="form-select form-select-sm" style="max-width:220px" @change="loadList">
        <option value="">— Lahat ng status —</option><option v-for="s in meta.statuses" :key="s" :value="s">{{ s }}</option></select></div>
      <div class="table-responsive"><table class="table table-sm align-middle">
        <thead><tr><th>Reference</th><th>Machine</th><th>Provider</th><th>Status</th><th class="text-end">Variance</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in recons" :key="r._id">
            <td class="fw-semibold">{{ r.refNo }}</td><td>{{ r.locationLabel }}</td><td>{{ r.provider }}</td>
            <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span></td>
            <td class="text-end" :class="r.totalVarianceCentavos<0?'text-danger':''">{{ peso(r.totalVarianceCentavos) }}</td>
            <td><button class="btn btn-ghost btn-sm" @click="openById(r._id)">Buksan</button></td>
          </tr>
          <tr v-if="!recons.length"><td colspan="6" class="text-center text-muted py-3">Wala pang cashless reconciliation.</td></tr>
        </tbody>
      </table></div>
    </div></div>

    <!-- SETUP -->
    <div v-else-if="step==='setup'" class="card"><div class="card-body" style="max-width:580px">
      <h6 class="mb-3">Setup — machine + provider + period</h6>
      <div class="mb-2"><label class="form-label">Machine</label>
        <select v-model="setup.machine" class="form-select" @change="previewSystem"><option value="">— Pumili —</option>
          <option v-for="m in machines" :key="m.machine" :value="m.machine">{{ m.machineId }} — {{ m.locationName }}</option></select></div>
      <div class="mb-2"><label class="form-label">Provider</label>
        <select v-model="setup.provider" class="form-select"><option v-for="p in meta.providers" :key="p" :value="p">{{ p }}</option></select></div>
      <div class="row g-2">
        <div class="col-6"><label class="form-label">From</label><input type="datetime-local" class="form-control" v-model="setup.periodStart" @change="previewSystem" /></div>
        <div class="col-6"><label class="form-label">To</label><input type="datetime-local" class="form-control" v-model="setup.periodEnd" @change="previewSystem" /></div>
      </div>
      <div class="mb-2 mt-2"><label class="form-label">Assigned counter</label>
        <select v-model="setup.custodian" class="form-select"><option value="">— Opsyonal —</option><option v-for="u in users" :key="u._id" :value="u._id">{{ u.name }}</option></select></div>
      <div v-if="sysPreview" class="alert alert-info py-2 small mb-3">System cashless sa period: <strong>{{ sysPreview.count }} txns</strong> · {{ peso(sysPreview.totalCentavos) }}</div>
      <button class="btn btn-primary" :disabled="busy || !setup.machine" @click="startRecon">{{ busy?'…':'Start Cashless Reconciliation' }}</button>
    </div></div>

    <!-- MATCH -->
    <div v-else-if="step==='match'" class="card"><div class="card-body">
      <div class="fw-semibold mb-1">{{ rec.refNo }} · {{ rec.locationLabel }} · {{ rec.provider }}</div>
      <div class="small text-muted mb-3"><span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span></div>

      <div class="d-flex gap-2 align-items-end flex-wrap mb-2">
        <div><label class="form-label small mb-0">Import provider report (CSV)</label><input type="file" accept=".csv,text/csv" class="form-control form-control-sm" @change="onFile" /></div>
        <div><label class="form-label small mb-0">Time tolerance (min)</label><input type="number" min="0" class="form-control form-control-sm" style="width:120px" v-model.number="tolerance" /></div>
        <button class="btn btn-ghost btn-sm" @click="addRow">+ Manual row</button>
      </div>
      <p class="small text-muted">Inaasahang columns: <code>ref/txn</code>, <code>amount</code>, <code>status</code>, <code>datetime</code>, <code>fee</code>, <code>net</code> (case-insensitive; forgiving sa pangalan).</p>

      <div class="table-responsive" style="max-height:40vh;overflow:auto">
        <table class="table table-sm align-middle">
          <thead><tr><th>Txn Ref</th><th>Amount</th><th>Status</th><th>Datetime</th><th>Fee</th><th>Net</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(r,i) in providerRows" :key="i">
              <td><input class="form-control form-control-sm" v-model="r.txnRef" /></td>
              <td><input type="number" step="0.01" class="form-control form-control-sm" v-model.number="r.amount" /></td>
              <td><input class="form-control form-control-sm" v-model="r.status" style="width:110px" /></td>
              <td><input class="form-control form-control-sm" v-model="r.datetime" style="width:160px" /></td>
              <td><input type="number" step="0.01" class="form-control form-control-sm" v-model.number="r.fee" /></td>
              <td><input type="number" step="0.01" class="form-control form-control-sm" v-model.number="r.net" /></td>
              <td><button class="btn btn-ghost btn-sm" @click="removeRow(i)">✕</button></td>
            </tr>
            <tr v-if="!providerRows.length"><td colspan="7" class="text-center text-muted py-2">Mag-import ng CSV o mag-add ng rows.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="d-flex gap-2 mt-2">
        <button class="btn btn-ghost btn-sm" :disabled="busy || !providerRows.length" @click="runMatch(true)">Preview Match (draft)</button>
        <button class="btn btn-primary btn-sm" :disabled="busy || !providerRows.length" @click="runMatch(false)">Match &amp; Submit</button>
      </div>
    </div></div>

    <!-- INVESTIGATE / RESULTS -->
    <div v-else-if="step==='investigate'" class="card"><div class="card-body">
      <div class="fw-semibold mb-1">{{ rec.refNo }} · {{ rec.locationLabel }} · {{ rec.provider }}</div>
      <div class="small text-muted mb-2"><span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span>
        <span v-if="rec.requiresOwnerApproval" class="badge bg-warning text-dark ms-1">Owner approval required</span></div>

      <div v-if="channel" class="alert py-2 small" :class="rec.hasVariance?'alert-warning':'alert-success'">
        System: <strong>{{ peso(channel.systemAmount) }}</strong> · Provider gross: {{ peso(channel.providerAmount) }} ·
        Fees: {{ peso(channel.fees) }} · Net settlement: {{ peso(channel.netSettlement) }} ·
        Variance: <strong>{{ peso(channel.variance) }}</strong>
      </div>

      <h6 class="section-eyebrow">Transaction Matching</h6>
      <div class="table-responsive mb-3" style="max-height:38vh;overflow:auto">
        <table class="table table-sm align-middle">
          <thead class="position-sticky top-0 bg-body"><tr><th>Txn Ref</th><th class="text-end">System</th><th class="text-end">Provider</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="(t,i) in txns" :key="i">
              <td class="small">{{ t.txnRef }}</td>
              <td class="text-end">{{ t.systemAmount?peso(t.systemAmount):'—' }}</td>
              <td class="text-end">{{ t.providerAmount?peso(t.providerAmount):'—' }}</td>
              <td><span class="badge" :class="txnBadge(t.status)">{{ t.status.replace(/_/g,' ') }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="rec.status==='IN_PROGRESS' || rec.status==='DRAFT'">
        <button class="btn btn-ghost btn-sm" @click="step='match'">← Balik sa matching</button>
      </div>
      <div v-else-if="!varianceCount" class="alert alert-success py-2">Fully matched — walang problema. Handa para sa review/approval (Chunk E).</div>
      <div v-else>
        <h6 class="section-eyebrow">Investigation</h6>
        <p class="small text-muted">Hindi puwedeng "fully matched" kung may unmatched, kahit pantay ang totals (REC-053).</p>
        <table class="table table-sm align-middle">
          <thead><tr><th>Issue</th><th class="text-end">Count</th><th style="min-width:200px">Reason</th><th style="min-width:220px">Explanation / Evidence</th></tr></thead>
          <tbody>
            <tr v-for="v in rec.variances" :key="v.productName">
              <td class="fw-semibold">{{ v.productName.replace(/_/g,' ') }}</td>
              <td class="text-end">{{ v.actual }}</td>
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
