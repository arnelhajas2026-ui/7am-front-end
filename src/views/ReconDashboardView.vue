<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const tab = ref('dashboard');   // dashboard | reports
const error = ref('');
const busy = ref(false);

// dashboard
const dash = ref(null);

// reports
const REPORTS = [
  { key:'stock-reconciliation', label:'Stock Reconciliation' },
  { key:'stock-variance', label:'Stock Variance' },
  { key:'cash-reconciliation', label:'Cash Reconciliation' },
  { key:'bill-denomination', label:'Bill Denomination' },
  { key:'coin-float', label:'Coin Float' },
  { key:'cashless-matching', label:'Cashless Matching' },
  { key:'pending-approval', label:'Pending Approval' },
  { key:'variance-investigation', label:'Variance Investigation' },
  { key:'audit-trail', label:'Reconciliation Audit Trail' },
  { key:'employee', label:'Employee Reconciliation' },
  { key:'location-performance', label:'Location Performance' },
  { key:'accounting-adjustment', label:'Accounting Adjustment' },
];
const report = ref('stock-reconciliation');
const filters = ref({ from:'', to:'', type:'', status:'', employee:'' });
const result = ref(null);

async function loadDash(){
  busy.value=true; error.value='';
  try { const { data } = await api.get('/recon/reports/dashboard'); dash.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load dashboard.'; }
  finally { busy.value=false; }
}

async function runReport(){
  busy.value=true; error.value=''; result.value=null;
  try {
    const params = {};
    for (const k of Object.keys(filters.value)) if (filters.value[k]) params[k] = filters.value[k];
    const { data } = await api.get('/recon/reports/report/'+report.value, { params });
    result.value = data;
  } catch(e){ error.value = e.response?.data?.message || 'Could not run report.'; }
  finally { busy.value=false; }
}

function exportCSV(){
  if(!result.value) return;
  const esc = (v)=>{ const s = String(v??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const lines = [ result.value.columns.map(esc).join(','), ...result.value.rows.map(r=> r.map(esc).join(',')) ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${report.value}_${filters.value.from||'all'}_${filters.value.to||''}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function printReport(){ window.print(); }

onMounted(loadDash);
</script>

<template>
  <div class="container-fluid py-3" style="max-width:1100px">
    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
      <h4 class="mb-0" style="font-family:var(--font-display)">Reconciliation Center</h4>
      <div class="btn-group btn-group-sm">
        <button class="btn" :class="tab==='dashboard'?'btn-primary':'btn-ghost'" @click="tab='dashboard'">Dashboard</button>
        <button class="btn" :class="tab==='reports'?'btn-primary':'btn-ghost'" @click="tab='reports'">Reports</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- DASHBOARD -->
    <div v-if="tab==='dashboard'">
      <div v-if="dash">
        <div class="row g-2 mb-3">
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-3 text-center">
            <div class="h3 mb-0">{{ dash.summary.pendingCounts }}</div><div class="small text-muted">Pending Counts</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-3 text-center">
            <div class="h3 mb-0">{{ dash.summary.pendingApproval }}</div><div class="small text-muted">Pending Approval</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-3 text-center">
            <div class="h3 mb-0 text-danger">{{ dash.summary.unresolvedStockUnits }}</div><div class="small text-muted">Unresolved Stock (units)</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-3 text-center">
            <div class="h3 mb-0 text-danger">₱{{ Number(dash.summary.unresolvedCashPesos).toLocaleString('en-PH',{minimumFractionDigits:2}) }}</div><div class="small text-muted">Unresolved Cash</div></div></div></div>
        </div>
        <div class="row g-2 mb-3">
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center">
            <div class="h5 mb-0">{{ dash.summary.completionRate }}%</div><div class="small text-muted">Completion Rate</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center">
            <div class="h5 mb-0" :class="dash.summary.overdue?'text-warning':''">{{ dash.summary.overdue }}</div><div class="small text-muted">Overdue</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center">
            <div class="h5 mb-0">{{ dash.summary.total }}</div><div class="small text-muted">Total</div></div></div></div>
          <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center">
            <div class="h5 mb-0">{{ dash.summary.closed }}</div><div class="small text-muted">Closed</div></div></div></div>
        </div>

        <div class="card mb-3"><div class="card-body">
          <h6 class="section-eyebrow mb-2">Reconciliation Monitoring</h6>
          <div class="table-responsive"><table class="table table-sm align-middle">
            <thead><tr><th>Reference</th><th>Type</th><th>Location</th><th>Status</th><th class="text-end">Variance</th></tr></thead>
            <tbody>
              <tr v-for="m in dash.monitoring" :key="m._id"><td class="fw-semibold">{{ m.refNo }}</td><td>{{ m.type }}</td><td>{{ m.location }}</td>
                <td><span class="badge bg-secondary">{{ m.status }}</span></td><td class="text-end">{{ m.variance }}</td></tr>
              <tr v-if="!dash.monitoring.length"><td colspan="5" class="text-center text-muted py-3">Wala pang records.</td></tr>
            </tbody>
          </table></div>
        </div></div>

        <div class="row g-2">
          <div class="col-md-6"><div class="card"><div class="card-body">
            <h6 class="section-eyebrow mb-2">Recurring Discrepancies — by Location</h6>
            <ul class="list-unstyled mb-0 small"><li v-for="l in dash.recurringByLocation" :key="l.name" class="d-flex justify-content-between border-bottom py-1"><span>{{ l.name }}</span><span class="badge bg-warning text-dark">{{ l.count }}</span></li>
              <li v-if="!dash.recurringByLocation.length" class="text-muted">Wala.</li></ul>
          </div></div></div>
          <div class="col-md-6"><div class="card"><div class="card-body">
            <h6 class="section-eyebrow mb-2">Recurring Discrepancies — by Custodian</h6>
            <ul class="list-unstyled mb-0 small"><li v-for="l in dash.recurringByCustodian" :key="l.name" class="d-flex justify-content-between border-bottom py-1"><span>{{ l.name }}</span><span class="badge bg-warning text-dark">{{ l.count }}</span></li>
              <li v-if="!dash.recurringByCustodian.length" class="text-muted">Wala.</li></ul>
          </div></div></div>
        </div>
      </div>
      <div v-else-if="busy" class="text-muted">Loading…</div>
    </div>

    <!-- REPORTS -->
    <div v-else class="card"><div class="card-body">
      <div class="row g-2 align-items-end mb-3">
        <div class="col-md-4"><label class="form-label small mb-0">Report</label>
          <select v-model="report" class="form-select form-select-sm"><option v-for="r in REPORTS" :key="r.key" :value="r.key">{{ r.label }}</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">From</label><input type="date" class="form-control form-control-sm" v-model="filters.from" /></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">To</label><input type="date" class="form-control form-control-sm" v-model="filters.to" /></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Type</label>
          <select v-model="filters.type" class="form-select form-select-sm"><option value="">All</option><option value="STOCK">Stock</option><option value="CASH">Cash</option><option value="CASHLESS">Cashless</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Employee</label><input class="form-control form-control-sm" v-model="filters.employee" placeholder="pangalan" /></div>
      </div>
      <div class="d-flex gap-2 mb-3">
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="runReport">Run Report</button>
        <button class="btn btn-ghost btn-sm" :disabled="!result" @click="exportCSV">Export Excel (CSV)</button>
        <button class="btn btn-ghost btn-sm" :disabled="!result" @click="printReport">Print / PDF</button>
      </div>

      <div v-if="result">
        <h6 class="mb-2">{{ result.title }} <span class="text-muted small">({{ result.rows.length }} rows)</span></h6>
        <div class="table-responsive" style="max-height:60vh;overflow:auto"><table class="table table-sm align-middle">
          <thead class="position-sticky top-0 bg-body"><tr><th v-for="(c,i) in result.columns" :key="i">{{ c }}</th></tr></thead>
          <tbody>
            <tr v-for="(row,ri) in result.rows" :key="ri"><td v-for="(cell,ci) in row" :key="ci">{{ cell }}</td></tr>
            <tr v-if="!result.rows.length"><td :colspan="result.columns.length" class="text-center text-muted py-3">Walang data sa filter na ito.</td></tr>
          </tbody>
        </table></div>
      </div>
    </div></div>
  </div>
</template>
