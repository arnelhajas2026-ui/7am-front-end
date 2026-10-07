<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const accounts = ref([]);
const machines = ref([]);
const entries = ref([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const showForm = ref(false);
const detail = ref(null);
const fStart = ref('');
const fEnd = ref('');
const fSource = ref('');

const postable = computed(()=> accounts.value.filter(a => !a.isHeader && a.active !== false));
const accByCode = computed(()=> Object.fromEntries(accounts.value.map(a=>[a.code, a])));

const today = new Date().toLocaleDateString('en-CA', { timeZone:'Asia/Manila' });
function blankLine(){ return { accountCode:'', costCenter:'', machine:'', debit:0, credit:0, description:'' }; }
const form = ref({ date: today, memo:'', lines:[ blankLine(), blankLine() ] });

function addLine(){ form.value.lines.push(blankLine()); }
function removeLine(i){ form.value.lines.splice(i,1); }
function onAccount(line){
  const a = accByCode.value[Number(line.accountCode)];
  if(a){ if(!line.description) line.description = a.description || ''; }
}
const totalDebit = computed(()=> round(form.value.lines.reduce((s,l)=> s + (Number(l.debit)||0), 0)));
const totalCredit = computed(()=> round(form.value.lines.reduce((s,l)=> s + (Number(l.credit)||0), 0)));
const balanced = computed(()=> totalDebit.value === totalCredit.value && totalDebit.value > 0);
function round(n){ return Math.round(Number(n||0)*100)/100; }
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});

// Auto-posted entries (Phase 2) — pang-kilala kung saan galing.
const SRC = { SALES_BATCH:'Sales import', PURCHASE:'Purchase', PURCHASE_PAYMENT:'Purchase payment',
  EXPENSE:'Expense', SALES_ORDER:'Machine sale', CUSTOMER_PAYMENT:'Customer payment', SUPPLIER_PAYMENT:'Supplier payment' };
function isManual(e){ const t = e?.source?.type; return !t || t === 'MANUAL'; }
function srcLabel(e){ const t = e?.source?.type; return isManual(e) ? 'Manual' : (SRC[t] || t); }

const SOURCE_TYPES = ['MANUAL','SALES_BATCH','SALES_COGS','PURCHASE','PURCHASE_PAYMENT','EXPENSE','SALES_ORDER','CUSTOMER_PAYMENT','SUPPLIER_PAYMENT','INV_ADJUST','DEPRECIATION','ASSET_DISPOSAL','OPENING_BALANCE'];
const shownEntries = computed(()=> entries.value.filter(e => !fSource.value || (e.source?.type || 'MANUAL') === fSource.value));

async function load(){
  loading.value=true; error.value='';
  try {
    const params = {}; if(fStart.value) params.start = fStart.value; if(fEnd.value) params.end = fEnd.value;
    const [ac,ma,je] = await Promise.all([ api.get('/accounts-coa'), api.get('/machines'), api.get('/journal', { params }) ]);
    accounts.value = ac.data.accounts; machines.value = ma.data.machines; entries.value = je.data.entries;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value=false; }
}
function downloadCSV(){
  const esc = (v)=>{ const s=String(v??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const rows = [['Ref','Date','Source','Memo','Total','Status']];
  for(const e of shownEntries.value) rows.push([e.ref, fmtDate(e.date), srcLabel(e), e.memo||'', e.totalDebit, e.status]);
  const csv = rows.map(r=> r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='journal-entries.csv'; a.click(); URL.revokeObjectURL(url);
}
function openNew(){ form.value = { date: today, memo:'', lines:[ blankLine(), blankLine() ] }; showForm.value=true; detail.value=null; window.scrollTo({top:0,behavior:'smooth'}); }
function close(){ showForm.value=false; }
async function save(){
  if(!balanced.value){ error.value = 'Hindi balanse — dapat pantay ang Debit at Credit, at hindi zero.'; return; }
  saving.value=true; error.value='';
  try {
    const lines = form.value.lines
      .filter(l=> l.accountCode && ((Number(l.debit)||0)>0 || (Number(l.credit)||0)>0))
      .map(l=>({ accountCode:Number(l.accountCode), costCenter:l.costCenter||'', machine:l.machine||undefined,
        debit:Number(l.debit)||0, credit:Number(l.credit)||0, description:l.description||'' }));
    await api.post('/journal', { date: form.value.date, memo: form.value.memo, lines });
    close(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
async function voidEntry(e){
  if(!confirm(`Void ${e.ref}? Hindi na ito mabibilang sa General Ledger.`)) return;
  try { await api.post(`/journal/${e._id}/void`); await load(); }
  catch(err){ error.value = err.response?.data?.message || 'Could not void.'; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Journal Entry</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? close() : openNew()">{{ showForm ? 'Close' : '+ New entry' }}</button>
    </div>
    <p class="text-muted">Record a balanced journal entry (Debit = Credit). Auto-posting of transactions comes in Phase 2.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Form -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New journal entry</p>
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3"><label class="form-label">Date</label><input v-model="form.date" type="date" class="form-control" /></div>
        <div class="col-12 col-md-9"><label class="form-label">Memo / description</label><input v-model="form.memo" class="form-control" placeholder="e.g. Vending product sale — Amaia Sucat" /></div>
      </div>

      <div class="je-head d-none d-lg-flex">
        <span class="c-acct">Account</span><span class="c-cc">Cost Center</span><span class="c-mac">Machine</span>
        <span class="c-amt">Debit</span><span class="c-amt">Credit</span><span class="c-desc">Description</span><span class="c-x"></span>
      </div>
      <div v-for="(l,i) in form.lines" :key="i" class="je-row">
        <span class="c-acct">
          <select v-model="l.accountCode" class="form-select form-select-sm" @change="onAccount(l)">
            <option value="">— account —</option>
            <option v-for="a in postable" :key="a.code" :value="a.code">{{ a.code }} · {{ a.name }}</option>
          </select>
        </span>
        <span class="c-cc"><input v-model="l.costCenter" class="form-control form-control-sm" placeholder="CC-007" /></span>
        <span class="c-mac">
          <select v-model="l.machine" class="form-select form-select-sm"><option value="">—</option>
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
        <button class="btn btn-primary" :disabled="saving || !balanced" @click="save">{{ saving ? 'Saving…' : 'Post entry' }}</button>
      </div>
    </div></div>

    <!-- Detail modal-ish -->
    <div v-if="detail" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div><h5 class="mb-0" style="font-family:var(--font-display)">{{ detail.ref }}
          <span v-if="!isManual(detail)" class="pill src ms-1">AUTO · {{ srcLabel(detail) }}</span>
          <span class="badge7 ms-1" :class="detail.status==='VOID' ? 'off' : 'emp'">{{ detail.status }}</span></h5>
          <div class="text-muted small">{{ fmtDate(detail.date) }} · {{ detail.memo }}</div></div>
        <button class="btn btn-ghost btn-sm" @click="detail=null">Close</button>
      </div>
      <table class="fin-table"><thead><tr><th class="lbl">Account</th><th class="lbl">Cost Ctr</th><th class="lbl">Machine</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          <tr v-for="(l,i) in detail.lines" :key="i">
            <td class="lbl">{{ l.accountCode }} · {{ l.accountName }}</td>
            <td class="lbl">{{ l.costCenter || '—' }}</td>
            <td class="lbl">{{ l.machine?.locationName || l.machine?.machineId || '—' }}</td>
            <td class="num">{{ l.debit ? peso(l.debit) : '' }}</td>
            <td class="num">{{ l.credit ? peso(l.credit) : '' }}</td>
          </tr>
          <tr class="gp"><td class="lbl" colspan="3">Total</td><td class="num">{{ peso(detail.totalDebit) }}</td><td class="num">{{ peso(detail.totalCredit) }}</td></tr>
        </tbody>
      </table>
    </div></div>

    <!-- List + filters -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <p class="section-eyebrow mb-0">Recent entries</p>
      <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
    </div>
    <div class="row g-2 my-2">
      <div class="col-6 col-md-3"><input v-model="fStart" type="date" class="form-control form-control-sm" @change="load" placeholder="From" /></div>
      <div class="col-6 col-md-3"><input v-model="fEnd" type="date" class="form-control form-control-sm" @change="load" placeholder="To" /></div>
      <div class="col-12 col-md-4"><select v-model="fSource" class="form-select form-select-sm">
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
      <!-- Manual entries lang ang puwedeng i-void dito; i-void ang auto-entry sa pinagmulan nitong transaction. -->
      <button v-if="e.status!=='VOID' && isManual(e)" class="btn btn-ghost btn-sm" @click="voidEntry(e)">Void</button>
    </div></div>
  </div>
</template>

<style scoped>
.je-head, .je-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
.je-head { font-size:.7rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.03em; }
.c-acct{ flex:0 0 22%; } .c-cc{ flex:0 0 11%; } .c-mac{ flex:0 0 16%; }
.c-amt{ flex:0 0 12%; } .c-desc{ flex:1 1 auto; } .c-x{ flex:0 0 28px; }
.pill { font-size:.75rem; font-weight:700; padding:.2rem .6rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); } .pill.warn { background:#FDECEC; color:var(--bad); }
.pill.src { background:#EEF2FF; color:#4338CA; font-size:.68rem; padding:.12rem .5rem; vertical-align:middle; }
@media (max-width: 991px){ .je-row{ flex-wrap:wrap; } .c-acct,.c-cc,.c-mac,.c-amt,.c-desc{ flex:1 1 46%; } }
</style>
