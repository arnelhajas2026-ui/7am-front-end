<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';
import { BRAND } from '../constants/brand.js';
import { exportCSV, stampPH } from '../utils/exporters.js';

const accounts = ref([]);
const costCenters = ref([]);
const selAccount = ref('');
const selCostCenter = ref('');
const start = ref('');
const end = ref('');
const loading = ref(false);
const error = ref('');

const summary = ref([]);
const detailRows = ref([]);
const detailBalance = ref(0);
const detailMeta = ref(null);

const postable = computed(()=> accounts.value.filter(a => !a.isHeader));
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});

async function loadRefs(){
  try {
    const [ac,cc] = await Promise.all([ api.get('/accounts-coa'), api.get('/cost-centers') ]);
    accounts.value = ac.data.accounts; costCenters.value = cc.data.costCenters;
  } catch {}
}
async function run(){
  loading.value=true; error.value='';
  try {
    const params = {};
    if(selAccount.value) params.account = selAccount.value;
    if(selCostCenter.value) params.costCenter = selCostCenter.value;
    if(start.value) params.start = start.value;
    if(end.value) params.end = end.value;
    const { data } = await api.get('/ledger/general', { params });
    if(selAccount.value){ detailRows.value = data.rows; detailBalance.value = data.balance; detailMeta.value = data.account; summary.value = []; }
    else { summary.value = data.summary; detailRows.value = []; detailMeta.value = null; }
  } catch(e){ error.value = e.response?.data?.message || 'Could not load ledger.'; }
  finally { loading.value=false; }
}
onMounted(async ()=>{ await loadRefs(); await run(); });

function printPage(){ window.print(); }
function downloadCSV(){
  let rows, name;
  if(selAccount.value){
    rows = [['Date','JE','Cost Center','Description','Debit','Credit','Balance']];
    for(const r of detailRows.value) rows.push([ new Date(r.date).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}), r.ref, r.costCenter||'', r.description||r.memo||'', Number(r.debit)||0, Number(r.credit)||0, Number(r.balance)||0 ]);
    rows.push(['','','','Ending balance','','', Number(detailBalance.value)||0]);
    name = `general-ledger_${(detailMeta.value?.code)||'account'}_${stampPH()}.csv`;
  } else {
    rows = [['Code','Account','Type','Debit','Credit','Balance']];
    for(const r of summary.value) rows.push([ r.code, r.name, r.type, Number(r.debit)||0, Number(r.credit)||0, Number(r.balance)||0 ]);
    name = `general-ledger_summary_${stampPH()}.csv`;
  }
  exportCSV(name, rows);
}
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">General Ledger</h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Balances built from posted journal entries. Pick an account for its detailed ledger.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="row g-2 mb-3 no-print">
      <div class="col-12 col-md-4"><label class="form-label">Account</label>
        <select v-model="selAccount" class="form-select" @change="run">
          <option value="">— All accounts (summary) —</option>
          <option v-for="a in postable" :key="a.code" :value="a.code">{{ a.code }} · {{ a.name }}</option>
        </select></div>
      <div class="col-6 col-md-3"><label class="form-label">Cost Center</label>
        <select v-model="selCostCenter" class="form-select" @change="run"><option value="">All</option>
          <option v-for="c in costCenters" :key="c._id" :value="c.code">{{ c.code }}</option></select></div>
      <div class="col-3 col-md-2"><label class="form-label">From</label><input v-model="start" type="date" class="form-control" @change="run" /></div>
      <div class="col-3 col-md-2"><label class="form-label">To</label><input v-model="end" type="date" class="form-control" @change="run" /></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <!-- Summary (all accounts) -->
    <div v-else-if="!selAccount" class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table ruled" style="min-width:640px">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Account</th><th class="lbl">Type</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
        <tbody>
          <tr v-for="r in summary" :key="r.code">
            <td class="lbl">{{ r.code }}</td>
            <td class="lbl"><a href="#" @click.prevent="selAccount=String(r.code); run()">{{ r.name }}</a></td>
            <td class="lbl">{{ r.type }}</td>
            <td class="num">{{ peso(r.debit) }}</td>
            <td class="num">{{ peso(r.credit) }}</td>
            <td class="num fw-semibold">{{ peso(r.balance) }}</td>
          </tr>
          <tr v-if="!summary.length"><td colspan="6" class="text-center text-muted py-3">No postings yet.</td></tr>
        </tbody>
      </table>
    </div></div>

    <!-- Detail (one account) -->
    <template v-else>
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="fw-semibold" style="font-family:var(--font-display)">{{ detailMeta?.code }} · {{ detailMeta?.name }}</div>
        <div>Ending balance: <strong class="numeric">{{ peso(detailBalance) }}</strong></div>
      </div>
      <div class="card"><div class="card-body p-0" style="overflow-x:auto">
        <table class="fin-table ruled" style="min-width:680px">
          <thead><tr><th class="lbl">Date</th><th class="lbl">Ref</th><th class="lbl">Cost Ctr</th><th class="lbl">Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
          <tbody>
            <tr v-for="(r,i) in detailRows" :key="i">
              <td class="lbl">{{ fmtDate(r.date) }}</td>
              <td class="lbl">{{ r.ref }}</td>
              <td class="lbl">{{ r.costCenter || '—' }}</td>
              <td class="lbl text-muted small">{{ r.description || r.memo }}</td>
              <td class="num">{{ r.debit ? peso(r.debit) : '' }}</td>
              <td class="num">{{ r.credit ? peso(r.credit) : '' }}</td>
              <td class="num fw-semibold">{{ peso(r.balance) }}</td>
            </tr>
            <tr v-if="!detailRows.length"><td colspan="7" class="text-center text-muted py-3">No postings for this account.</td></tr>
          </tbody>
        </table>
      </div></div>
    </template>

    <!-- Print sheet -->
    <div class="print-sheet">
      <div class="print-head"><div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">General Ledger{{ selAccount ? ' · ' + (detailMeta?.code) + ' ' + (detailMeta?.name) : ' · Summary' }}
          <span v-if="start || end"> · {{ start || '…' }} to {{ end || '…' }}</span><span v-if="selCostCenter"> · {{ selCostCenter }}</span></div></div>
      <table v-if="selAccount" class="fin-table ruled">
        <thead><tr><th class="lbl">Date</th><th class="lbl">Ref</th><th class="lbl">Cost Ctr</th><th class="lbl">Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in detailRows" :key="i"><td class="lbl">{{ fmtDate(r.date) }}</td><td class="lbl">{{ r.ref }}</td><td class="lbl">{{ r.costCenter||'—' }}</td>
            <td class="lbl">{{ r.description||r.memo }}</td><td class="num">{{ r.debit?peso(r.debit):'' }}</td><td class="num">{{ r.credit?peso(r.credit):'' }}</td><td class="num">{{ peso(r.balance) }}</td></tr>
          <tr><td class="lbl" colspan="6"><strong>Ending balance</strong></td><td class="num"><strong>{{ peso(detailBalance) }}</strong></td></tr>
        </tbody>
      </table>
      <table v-else class="fin-table ruled">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Account</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
        <tbody>
          <tr v-for="r in summary" :key="r.code"><td class="lbl">{{ r.code }}</td><td class="lbl">{{ r.name }}</td>
            <td class="num">{{ peso(r.debit) }}</td><td class="num">{{ peso(r.credit) }}</td><td class="num">{{ peso(r.balance) }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
