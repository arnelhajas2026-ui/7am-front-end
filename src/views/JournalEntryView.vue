<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate, fmtDateTime } from '../utils/datetime.js';
import { useAuthStore } from '../stores/auth.js';
import { downloadFromApi } from '../utils/exporters.js';
import AccountSelect from '../components/AccountSelect.vue';
import ExportDialog from '../components/ExportDialog.vue';

const auth = useAuthStore();
const isOwner = computed(()=> auth.isOwner || auth.isSuperadmin);

const accounts = ref([]);
const machines = ref([]);
const entries = ref([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const editingStatus = ref('');     // '' (new) | PARKED | POSTED
const detail = ref(null);
const fStart = ref('');
const fEnd = ref('');
const fSource = ref('');
const showExport = ref(false);
const exporting = ref(false);

const postable = computed(()=> accounts.value.filter(a => !a.isHeader && a.active !== false));
const accByCode = computed(()=> Object.fromEntries(accounts.value.map(a=>[a.code, a])));
const machineById = computed(()=> Object.fromEntries(machines.value.map(m=>[m._id, m])));

function todayPH(){ return new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Manila' }); }
function isoDatePH(d){ return new Date(d).toLocaleDateString('en-CA', { timeZone:'Asia/Manila' }); }

function blankLine(){ return { accountCode:'', costCenter:'', machine:'', debit:0, credit:0, description:'' }; }
const form = ref({ date: todayPH(), memo:'', lines:[ blankLine(), blankLine() ] });

function addLine(){ form.value.lines.push(blankLine()); }
function removeLine(i){ form.value.lines.splice(i,1); }

function onAccount(line, acct){ if(acct && !line.description) line.description = acct.description || ''; }
// Machine → i-lookup ang naka-map na default Cost Center (editable pa rin).
// Explicit handler (hindi umaasa sa v-model/@change ordering) para sigurado ang fill.
function onMachine(line, machineId){
  line.machine = machineId;
  const m = machineById.value[machineId];
  if(m && m.costCenter) line.costCenter = m.costCenter;
}
function acctType(line){ return accByCode.value[Number(line.accountCode)]?.type || ''; }

const totalDebit = computed(()=> round(form.value.lines.reduce((s,l)=> s + (Number(l.debit)||0), 0)));
const totalCredit = computed(()=> round(form.value.lines.reduce((s,l)=> s + (Number(l.credit)||0), 0)));
const balanced = computed(()=> totalDebit.value === totalCredit.value && totalDebit.value > 0);
function round(n){ return Math.round(Number(n||0)*100)/100; }
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});

const SRC = { SALES_BATCH:'Sales import', SALES_COGS:'Sales COGS', PURCHASE:'Purchase', PURCHASE_PAYMENT:'Purchase payment',
  EXPENSE:'Expense', SALES_ORDER:'Machine sale', CUSTOMER_PAYMENT:'Customer payment', SUPPLIER_PAYMENT:'Supplier payment',
  INV_ADJUST:'Inventory adj', DEPRECIATION:'Depreciation', ASSET_DISPOSAL:'Asset disposal', OPENING_BALANCE:'Opening balance' };
function isManual(e){ const t = e?.source?.type; return !t || t === 'MANUAL'; }
function srcLabel(e){ const t = e?.source?.type; return isManual(e) ? 'Manual' : (SRC[t] || t); }
function isParked(e){ return e?.status === 'PARKED'; }

const SOURCE_TYPES = ['MANUAL','SALES_BATCH','SALES_COGS','PURCHASE','PURCHASE_PAYMENT','EXPENSE','SALES_ORDER','CUSTOMER_PAYMENT','SUPPLIER_PAYMENT','INV_ADJUST','DEPRECIATION','ASSET_DISPOSAL','OPENING_BALANCE'];
const shownEntries = computed(()=> entries.value.filter(e => !fSource.value || (e.source?.type || 'MANUAL') === fSource.value));

function setCurrentMonth(){
  const [y,m] = todayPH().split('-');
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  fStart.value = `${y}-${m}-01`;
  fEnd.value = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;
}

async function load(){
  loading.value=true; error.value='';
  try {
    const params = {}; if(fStart.value) params.start = fStart.value; if(fEnd.value) params.end = fEnd.value;
    const [ac,ma,je] = await Promise.all([ api.get('/accounts-coa'), api.get('/machines'), api.get('/journal', { params }) ]);
    accounts.value = ac.data.accounts; machines.value = ma.data.machines; entries.value = je.data.entries;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value=false; }
}

function cleanLines(){
  return form.value.lines
    .filter(l=> l.accountCode || (Number(l.debit)||0)>0 || (Number(l.credit)||0)>0)
    .map(l=>({ accountCode:l.accountCode?Number(l.accountCode):undefined, costCenter:l.costCenter||'', machine:l.machine||undefined,
      debit:Number(l.debit)||0, credit:Number(l.credit)||0, description:l.description||'' }));
}

function openNew(){ form.value = { date: todayPH(), memo:'', lines:[ blankLine(), blankLine() ] }; editingId.value=null; editingStatus.value=''; showForm.value=true; detail.value=null; window.scrollTo({top:0,behavior:'smooth'}); }
function openEdit(e){
  form.value = {
    date: isoDatePH(e.date), memo: e.memo || '',
    lines: e.lines.map(l=>({ accountCode: l.accountCode, costCenter: l.costCenter||'',
      machine: l.machine?._id || l.machine || '', debit: l.debit||0, credit: l.credit||0, description: l.description||'' })),
  };
  editingId.value = e._id; editingStatus.value = e.status; showForm.value=true; detail.value=null; window.scrollTo({top:0,behavior:'smooth'});
}
function close(){ showForm.value=false; editingId.value=null; editingStatus.value=''; }

const canPark = computed(()=> !editingId.value || editingStatus.value==='PARKED');
const primaryLabel = computed(()=> editingStatus.value==='POSTED' ? 'Save changes' : 'Post entry');

// Primary action: post (new/parked) o save changes (posted edit).
async function save(){
  if(!balanced.value){ error.value = 'Hindi balanse — dapat pantay ang Debit at Credit, at hindi zero.'; return; }
  saving.value=true; error.value='';
  try {
    const payload = { date: form.value.date, memo: form.value.memo, lines: cleanLines() };
    if(editingId.value && editingStatus.value==='POSTED') await api.patch(`/journal/${editingId.value}`, payload);
    else if(editingId.value && editingStatus.value==='PARKED') await api.post(`/journal/${editingId.value}/post`, payload);
    else await api.post('/journal', payload);
    close(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
// Park: save muna bilang draft (hindi posted). Pwede kahit hindi balanced.
async function park(){
  saving.value=true; error.value='';
  try {
    const payload = { id: editingStatus.value==='PARKED' ? editingId.value : undefined, date: form.value.date, memo: form.value.memo, lines: cleanLines() };
    await api.post('/journal/park', payload);
    close(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not park.'; }
  finally { saving.value=false; }
}
async function voidEntry(e){
  if(!confirm(`Void ${e.ref}? Hindi na ito mabibilang sa General Ledger.`)) return;
  try { await api.post(`/journal/${e._id}/void`); await load(); if(detail.value?._id===e._id) detail.value=null; }
  catch(err){ error.value = err.response?.data?.message || 'Could not void.'; }
}
async function restoreEntry(e){
  if(!confirm(`Restore ${e.ref}? Babalik ito bilang POSTED sa General Ledger.`)) return;
  try { await api.post(`/journal/${e._id}/restore`); await load(); if(detail.value?._id===e._id) detail.value=null; }
  catch(err){ error.value = err.response?.data?.message || 'Could not restore.'; }
}
async function discardDraft(e){
  if(!confirm(`Discard draft ${e.ref}? Hindi na ito mababawi.`)) return;
  try { await api.delete(`/journal/${e._id}`); await load(); if(detail.value?._id===e._id) detail.value=null; }
  catch(err){ error.value = err.response?.data?.message || 'Could not discard.'; }
}
async function postFromDetail(e){
  try { await api.post(`/journal/${e._id}/post`, {}); await load(); detail.value=null; }
  catch(err){ error.value = err.response?.data?.message || 'Could not post (baka hindi pa balanced — buksan sa Edit).'; }
}

// Export (PDF / Word / Excel) via backend — kinukuha ang kasalukuyang date range + source.
async function onExport({ format, orientation, paper }){
  exporting.value=true; error.value='';
  try {
    const params = { format, orientation, paper };
    if(fStart.value) params.start = fStart.value;
    if(fEnd.value) params.end = fEnd.value;
    if(fSource.value) params.source = fSource.value;
    await downloadFromApi(api, '/journal/export', params, `general-journal.${format==='docx'?'docx':format==='xlsx'?'xlsx':'pdf'}`);
    showExport.value=false;
  } catch(e){ error.value = e.response?.data?.message || 'Could not export.'; }
  finally { exporting.value=false; }
}

onMounted(async ()=>{ setCurrentMonth(); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Journal Entry</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? close() : openNew()">{{ showForm ? 'Close' : '+ New entry' }}</button>
    </div>
    <p class="text-muted">Record a balanced journal entry (Debit = Credit). Transactions auto-post here too.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Form (new / edit / draft) -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <p class="section-eyebrow mb-0">{{ editingStatus==='PARKED' ? 'Edit parked draft' : (editingStatus==='POSTED' ? 'Edit entry' : 'New journal entry') }}</p>
        <button v-if="canPark" class="btn btn-park btn-sm" :disabled="saving" @click="park">⎘ Park (save draft)</button>
      </div>
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3"><label class="form-label">Transaction date</label><input v-model="form.date" type="date" class="form-control" /></div>
        <div class="col-12 col-md-9"><label class="form-label">Memo / description (Particulars)</label><input v-model="form.memo" class="form-control" placeholder="e.g. Vending product sale — Amaia Sucat" /></div>
      </div>

      <div class="je-head d-none d-lg-flex">
        <span class="c-acct">Account</span><span class="c-code">Code</span><span class="c-type">Type</span>
        <span class="c-cc">Cost Center</span><span class="c-mac">Machine</span>
        <span class="c-amt">Debit</span><span class="c-amt">Credit</span><span class="c-desc">Description</span><span class="c-x"></span>
      </div>
      <div v-for="(l,i) in form.lines" :key="i" class="je-row">
        <span class="c-acct">
          <AccountSelect v-model="l.accountCode" :accounts="postable" @change="onAccount(l, $event)" />
        </span>
        <span class="c-code"><input :value="l.accountCode || ''" class="form-control form-control-sm ro" readonly placeholder="—" /></span>
        <span class="c-type"><input :value="acctType(l)" class="form-control form-control-sm ro" readonly placeholder="—" /></span>
        <span class="c-cc"><input v-model="l.costCenter" class="form-control form-control-sm" placeholder="CC code" /></span>
        <span class="c-mac">
          <select :value="l.machine" class="form-select form-select-sm" @change="onMachine(l, $event.target.value)"><option value="">—</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select>
        </span>
        <span class="c-amt"><input v-model.number="l.debit" type="number" class="form-control form-control-sm numeric text-end" /></span>
        <span class="c-amt"><input v-model.number="l.credit" type="number" class="form-control form-control-sm numeric text-end" /></span>
        <span class="c-desc"><input v-model="l.description" class="form-control form-control-sm" /></span>
        <span class="c-x"><button class="btn btn-ghost btn-sm" @click="removeLine(i)">×</button></span>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="addLine">+ Add line</button>

      <div class="d-flex align-items-center justify-content-end gap-3 mt-3">
        <span>Debit: <strong class="numeric">{{ peso(totalDebit) }}</strong></span>
        <span>Credit: <strong class="numeric">{{ peso(totalCredit) }}</strong></span>
        <span class="pill" :class="balanced ? 'ok' : 'warn'">{{ balanced ? 'Balanced' : 'Not balanced' }}</span>
        <button class="btn btn-primary" :disabled="saving || !balanced" @click="save">{{ saving ? 'Saving…' : primaryLabel }}</button>
      </div>
    </div></div>

    <!-- Detail -->
    <div v-if="detail" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div><h5 class="mb-0" style="font-family:var(--font-display)">{{ detail.ref }}
          <span v-if="!isManual(detail)" class="pill src ms-1">AUTO · {{ srcLabel(detail) }}</span>
          <span class="badge7 ms-1" :class="detail.status==='VOID' ? 'off' : (detail.status==='PARKED' ? 'parked' : 'emp')">{{ detail.status }}</span></h5>
          <div class="text-muted small">{{ detail.status==='PARKED' ? 'Saved (draft)' : 'Posted' }}: {{ fmtDateTime(detail.createdAt) }}</div>
          <div class="text-muted small">Transaction date: {{ fmtDate(detail.date) }} · {{ detail.memo }}</div></div>
        <div class="d-flex gap-2 flex-wrap justify-content-end">
          <template v-if="detail.status==='PARKED'">
            <button class="btn btn-ink btn-sm" @click="openEdit(detail)">Edit</button>
            <button class="btn btn-primary btn-sm" @click="postFromDetail(detail)">Post entry</button>
            <button class="btn btn-sm btn-danger7" @click="discardDraft(detail)">Discard</button>
          </template>
          <template v-else-if="detail.status==='VOID'">
            <button v-if="isOwner" class="btn btn-ink btn-sm" @click="restoreEntry(detail)">Restore</button>
          </template>
          <template v-else>
            <button v-if="isOwner" class="btn btn-ink btn-sm" @click="openEdit(detail)">Edit</button>
            <button v-if="isOwner" class="btn btn-ghost btn-sm" @click="voidEntry(detail)">Void</button>
          </template>
          <button class="btn btn-ghost btn-sm" @click="detail=null">Close</button>
        </div>
      </div>
      <p v-if="isOwner && detail.status==='POSTED' && !isManual(detail)" class="text-muted small mb-2" style="color:var(--bad)!important">
        ⚠ Auto-posted ito. Ang pag-edit ay maaaring mag-desync sa pinagmulang transaction at maaaring ma-overwrite kapag na-re-post ang source.
      </p>
      <table class="fin-table ruled"><thead><tr><th class="lbl">Date</th><th class="lbl">Account</th><th class="lbl">Type</th><th class="lbl">Cost Ctr</th><th class="lbl">Machine</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          <tr v-for="(l,i) in detail.lines" :key="i">
            <td class="lbl">{{ fmtDate(detail.date) }}</td>
            <td class="lbl">{{ l.accountCode }} · {{ l.accountName }}</td>
            <td class="lbl">{{ l.accountType || '—' }}</td>
            <td class="lbl">{{ l.costCenter || '—' }}</td>
            <td class="lbl">{{ l.machine?.locationName || l.machine?.machineId || '—' }}</td>
            <td class="num">{{ l.debit ? peso(l.debit) : '' }}</td>
            <td class="num">{{ l.credit ? peso(l.credit) : '' }}</td>
          </tr>
          <tr class="gp"><td class="lbl" colspan="5">Total</td><td class="num">{{ peso(detail.totalDebit) }}</td><td class="num">{{ peso(detail.totalCredit) }}</td></tr>
        </tbody>
      </table>
    </div></div>

    <!-- List + filters -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <p class="section-eyebrow mb-0">General Journal</p>
      <button class="btn btn-ghost btn-sm" @click="showExport=true">⤓ Export (PDF / Word / Excel)</button>
    </div>
    <div class="row g-2 my-2">
      <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">From</label><input v-model="fStart" type="date" class="form-control form-control-sm" @change="load" /></div>
      <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">To</label><input v-model="fEnd" type="date" class="form-control form-control-sm" @change="load" /></div>
      <div class="col-12 col-md-4"><label class="form-label mb-0 small text-muted">Source</label><select v-model="fSource" class="form-select form-select-sm">
        <option value="">All sources</option>
        <option v-for="s in SOURCE_TYPES" :key="s" :value="s">{{ s === 'MANUAL' ? 'Manual' : (SRC[s] || s) }}</option></select></div>
    </div>
    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!shownEntries.length" class="card"><div class="card-body text-muted text-center py-4">Walang journal entry sa filter na ito.</div></div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table ruled gj-screen" style="min-width:1000px">
        <thead><tr>
          <th class="lbl">Date</th><th class="lbl">Account Code</th><th class="lbl">Accounts</th><th class="lbl">JE</th>
          <th>Debit Amount</th><th>Credit Amount</th><th class="lbl">Description</th><th class="lbl">Account Type</th><th class="lbl">Particulars</th>
        </tr></thead>
        <tbody>
          <template v-for="e in shownEntries" :key="e._id">
            <tr v-for="(l,i) in e.lines" :key="e._id+'-'+i" class="gj-line" :class="{ voided: e.status==='VOID' }" @click="detail=e">
              <td class="lbl">{{ fmtDate(e.date) }}</td>
              <td class="lbl">{{ l.accountCode }}</td>
              <td class="lbl">{{ l.accountName }}</td>
              <td class="lbl"><span class="je-ref">{{ e.ref }}</span>
                <span v-if="isParked(e) && i===0" class="badge7 parked ms-1">Parked</span>
                <span v-if="!isManual(e) && i===0" class="pill src ms-1">AUTO</span>
                <span v-if="e.status==='VOID' && i===0" class="badge7 off ms-1">VOID</span></td>
              <td class="num">{{ l.debit ? peso(l.debit) : '' }}</td>
              <td class="num">{{ l.credit ? peso(l.credit) : '' }}</td>
              <td class="lbl text-muted small">{{ l.description }}</td>
              <td class="lbl">{{ l.accountType }}</td>
              <td class="lbl">{{ e.memo }}</td>
            </tr>
            <tr class="gj-gap"><td colspan="9"></td></tr>
          </template>
        </tbody>
      </table>
    </div></div>
    <p class="text-muted small mt-2">{{ shownEntries.length }} entries · i-click ang isang row para buksan (view · edit · post · void · restore)</p>

    <ExportDialog :visible="showExport" :busy="exporting" title="Export General Journal"
      @confirm="onExport" @close="showExport=false" />
  </div>
</template>

<style scoped>
.je-head, .je-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
.je-head { font-size:.7rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.03em; }
.c-acct{ flex:0 0 19%; } .c-code{ flex:0 0 7%; } .c-type{ flex:0 0 10%; } .c-cc{ flex:0 0 9%; } .c-mac{ flex:0 0 13%; }
.c-amt{ flex:0 0 10%; } .c-desc{ flex:1 1 auto; } .c-x{ flex:0 0 26px; }
.ro { background:#F3F6FA; color:var(--ink-2); font-variant-numeric:tabular-nums; }
.pill { font-size:.75rem; font-weight:700; padding:.2rem .6rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); } .pill.warn { background:#FDECEC; color:var(--bad); }
.pill.src { background:#EEF2FF; color:#4338CA; font-size:.68rem; padding:.12rem .5rem; vertical-align:middle; }
.btn-park { background:#1F9D55; color:#fff; border:none; }
.btn-park:hover { background:#188046; color:#fff; }
@media (max-width: 991px){ .je-row{ flex-wrap:wrap; } .c-acct,.c-code,.c-type,.c-cc,.c-mac,.c-amt,.c-desc{ flex:1 1 46%; } }

/* General Journal on-screen table */
.gj-screen thead th { background:#EEF2F7; }
.gj-screen .gj-line { cursor:pointer; }
.gj-screen .gj-line:hover td { background:#F2F7FD; }
.gj-screen .gj-line.voided td { opacity:.5; text-decoration:line-through; }
.gj-screen .gj-gap td { border:none !important; height:5px; background:transparent; padding:0; }
.gj-screen .je-ref { font-family:var(--font-display); font-weight:700; }
</style>
