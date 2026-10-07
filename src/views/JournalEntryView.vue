<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate, fmtDateTime } from '../utils/datetime.js';
import { useAuthStore } from '../stores/auth.js';
import { BRAND } from '../constants/brand.js';
import { exportCSV, stampPH } from '../utils/exporters.js';
import AccountSelect from '../components/AccountSelect.vue';

const auth = useAuthStore();
const isOwner = computed(()=> auth.isOwner || auth.isSuperadmin);

const accounts = ref([]);
const machines = ref([]);
const entries = ref([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const showForm = ref(false);
const editingId = ref(null);        // kapag nag-eedit ng existing entry
const detail = ref(null);
const fStart = ref('');
const fEnd = ref('');
const fSource = ref('');

const postable = computed(()=> accounts.value.filter(a => !a.isHeader && a.active !== false));
const accByCode = computed(()=> Object.fromEntries(accounts.value.map(a=>[a.code, a])));
const machineById = computed(()=> Object.fromEntries(machines.value.map(m=>[m._id, m])));

// Petsa ngayon (Asia/Manila) bilang YYYY-MM-DD.
function todayPH(){ return new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Manila' }); }
function isoDatePH(d){ return new Date(d).toLocaleDateString('en-CA', { timeZone:'Asia/Manila' }); }

function blankLine(){ return { accountCode:'', costCenter:'', machine:'', debit:0, credit:0, description:'' }; }
const form = ref({ date: todayPH(), memo:'', lines:[ blankLine(), blankLine() ] });

function addLine(){ form.value.lines.push(blankLine()); }
function removeLine(i){ form.value.lines.splice(i,1); }

// Pagpili ng account — i-default ang description kung wala pa.
function onAccount(line, acct){
  if(acct && !line.description) line.description = acct.description || '';
}
// Pagpili ng machine — i-lookup ang default cost center nito (editable pa rin).
function onMachine(line){
  const m = machineById.value[line.machine];
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

const SOURCE_TYPES = ['MANUAL','SALES_BATCH','SALES_COGS','PURCHASE','PURCHASE_PAYMENT','EXPENSE','SALES_ORDER','CUSTOMER_PAYMENT','SUPPLIER_PAYMENT','INV_ADJUST','DEPRECIATION','ASSET_DISPOSAL','OPENING_BALANCE'];
const shownEntries = computed(()=> entries.value.filter(e => !fSource.value || (e.source?.type || 'MANUAL') === fSource.value));
// Para sa print / Excel (General Journal) — POSTED lang, sorted by date asc.
const journalRows = computed(()=> shownEntries.value.filter(e => e.status === 'POSTED')
  .slice().sort((a,b)=> new Date(a.date) - new Date(b.date) || String(a.ref).localeCompare(b.ref)));

// Default: current month (Asia/Manila) pagbukas.
function setCurrentMonth(){
  const t = todayPH();                 // YYYY-MM-DD
  const [y,m] = t.split('-');
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

function openNew(){ form.value = { date: todayPH(), memo:'', lines:[ blankLine(), blankLine() ] }; editingId.value=null; showForm.value=true; detail.value=null; window.scrollTo({top:0,behavior:'smooth'}); }
function openEdit(e){
  form.value = {
    date: isoDatePH(e.date), memo: e.memo || '',
    lines: e.lines.map(l=>({ accountCode: l.accountCode, costCenter: l.costCenter||'',
      machine: l.machine?._id || l.machine || '', debit: l.debit||0, credit: l.credit||0, description: l.description||'' })),
  };
  editingId.value = e._id; showForm.value=true; detail.value=null; window.scrollTo({top:0,behavior:'smooth'});
}
function close(){ showForm.value=false; editingId.value=null; }

async function save(){
  if(!balanced.value){ error.value = 'Hindi balanse — dapat pantay ang Debit at Credit, at hindi zero.'; return; }
  saving.value=true; error.value='';
  try {
    const lines = form.value.lines
      .filter(l=> l.accountCode && ((Number(l.debit)||0)>0 || (Number(l.credit)||0)>0))
      .map(l=>({ accountCode:Number(l.accountCode), costCenter:l.costCenter||'', machine:l.machine||undefined,
        debit:Number(l.debit)||0, credit:Number(l.credit)||0, description:l.description||'' }));
    const payload = { date: form.value.date, memo: form.value.memo, lines };
    if(editingId.value) await api.patch(`/journal/${editingId.value}`, payload);
    else await api.post('/journal', payload);
    close(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
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

function rangeLabel(){ return `${fStart.value || '…'} to ${fEnd.value || '…'}`; }
function printJournal(){ window.print(); }
function downloadCSV(){
  const header = ['Date','Account Code','Account Name','JE','Debit Amount','Credit Amount','Description','Account Type','Particulars'];
  const rows = [header];
  for(const e of journalRows.value){
    for(const l of e.lines){
      rows.push([ isoDatePH(e.date), l.accountCode, l.accountName || '', e.ref,
        Number(l.debit)||0, Number(l.credit)||0, l.description || '', l.accountType || '', e.memo || '' ]);
    }
    rows.push([]); // spacer bawat entry
  }
  exportCSV(`general-journal_${fStart.value||''}_${fEnd.value||stampPH()}.csv`, rows);
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

    <!-- Form (new / edit) -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">{{ editingId ? 'Edit entry' : 'New journal entry' }}</p>
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
        <span class="c-cc"><input v-model="l.costCenter" class="form-control form-control-sm" placeholder="CC-007" /></span>
        <span class="c-mac">
          <select v-model="l.machine" class="form-select form-select-sm" @change="onMachine(l)"><option value="">—</option>
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
        <button class="btn btn-primary" :disabled="saving || !balanced" @click="save">{{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Post entry') }}</button>
      </div>
    </div></div>

    <!-- Detail -->
    <div v-if="detail" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div><h5 class="mb-0" style="font-family:var(--font-display)">{{ detail.ref }}
          <span v-if="!isManual(detail)" class="pill src ms-1">AUTO · {{ srcLabel(detail) }}</span>
          <span class="badge7 ms-1" :class="detail.status==='VOID' ? 'off' : 'emp'">{{ detail.status }}</span></h5>
          <div class="text-muted small">Posted: {{ fmtDateTime(detail.createdAt) }}</div>
          <div class="text-muted small">Transaction date: {{ fmtDate(detail.date) }} · {{ detail.memo }}</div></div>
        <div class="d-flex gap-2">
          <button v-if="isOwner && detail.status!=='VOID'" class="btn btn-ink btn-sm" @click="openEdit(detail)">Edit</button>
          <button v-if="isOwner && detail.status!=='VOID'" class="btn btn-ghost btn-sm" @click="voidEntry(detail)">Void</button>
          <button v-if="isOwner && detail.status==='VOID'" class="btn btn-ink btn-sm" @click="restoreEntry(detail)">Restore</button>
          <button class="btn btn-ghost btn-sm" @click="detail=null">Close</button>
        </div>
      </div>
      <p v-if="isOwner && !isManual(detail)" class="text-muted small mb-2" style="color:var(--bad)!important">
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
      <p class="section-eyebrow mb-0">Entries</p>
      <div class="d-flex gap-2">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printJournal">🖨 Print / PDF</button>
      </div>
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
    <div v-for="e in shownEntries" :key="e._id" class="card mb-2"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1" style="cursor:pointer" @click="detail=e">
        <div class="fw-semibold" style="font-family:var(--font-display)">{{ e.ref }}
          <span v-if="!isManual(e)" class="pill src ms-1">AUTO · {{ srcLabel(e) }}</span>
          <span v-if="e.status==='VOID'" class="badge7 off ms-1">VOID</span>
          <span class="text-muted small ms-1">{{ fmtDate(e.date) }}</span></div>
        <div class="text-muted small">{{ e.memo || (e.lines[0]?.accountName) }} · {{ e.lines.length }} lines</div>
      </div>
      <div class="numeric fw-bold">{{ peso(e.totalDebit) }}</div>
      <button v-if="e.status!=='VOID' && (isManual(e) || isOwner)" class="btn btn-ghost btn-sm" @click.stop="voidEntry(e)">Void</button>
      <button v-if="e.status==='VOID' && isOwner" class="btn btn-ghost btn-sm" @click.stop="restoreEntry(e)">Restore</button>
    </div></div>

    <!-- Print sheet: GENERAL JOURNAL (output: PDF via browser print) -->
    <div class="print-sheet">
      <div class="print-head gj-head">
        <div class="ph-name">{{ BRAND.name }}</div>
        <div class="gj-title">GENERAL JOURNAL</div>
        <div class="ph-sub">Date: {{ rangeLabel() }}<span v-if="fSource"> · {{ fSource === 'MANUAL' ? 'Manual' : (SRC[fSource] || fSource) }}</span></div>
      </div>
      <table class="fin-table ruled gj-table">
        <thead><tr>
          <th class="lbl">DATE</th><th class="lbl">ACCOUNT CODE</th><th class="lbl">ACCOUNTS</th><th class="lbl">JE</th>
          <th>DEBIT AMOUNT</th><th>CREDIT AMOUNT</th><th class="lbl">DESCRIPTION</th><th class="lbl">ACCOUNT TYPE</th><th class="lbl">PARTICULARS</th>
        </tr></thead>
        <tbody>
          <template v-for="e in journalRows" :key="e._id">
            <tr v-for="(l,i) in e.lines" :key="e._id+'-'+i">
              <td class="lbl">{{ isoDatePH(e.date) }}</td>
              <td class="lbl">{{ l.accountCode }}</td>
              <td class="lbl">{{ l.accountName }}</td>
              <td class="lbl">{{ e.ref }}</td>
              <td class="num">{{ l.debit ? peso(l.debit) : '' }}</td>
              <td class="num">{{ l.credit ? peso(l.credit) : '' }}</td>
              <td class="lbl">{{ l.description }}</td>
              <td class="lbl">{{ l.accountType }}</td>
              <td class="lbl">{{ e.memo }}</td>
            </tr>
            <tr class="gj-spacer"><td colspan="9"></td></tr>
          </template>
        </tbody>
      </table>
    </div>
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
@media (max-width: 991px){ .je-row{ flex-wrap:wrap; } .c-acct,.c-code,.c-type,.c-cc,.c-mac,.c-amt,.c-desc{ flex:1 1 46%; } }

/* General Journal print look */
.gj-head { text-align:center; margin-bottom:10px; }
.gj-title { font-family:var(--font-display); font-weight:800; font-size:1.25rem; letter-spacing:.04em; }
.gj-table th { background:#EEF2F7; }
.gj-spacer td { border:none !important; height:6px; }
</style>
