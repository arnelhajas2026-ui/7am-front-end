<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { BRAND } from '../constants/brand.js';
import { fmtDate } from '../utils/datetime.js';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const start = ref(today.slice(0, 4) + '-01-01');
const end = ref(today);
const costCenter = ref('');
const costCenters = ref([]);
const data = ref(null);
const loading = ref(false);
const error = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

async function loadRefs() { try { const { data: d } = await api.get('/cost-centers'); costCenters.value = d.costCenters; } catch {} }
async function load() {
  loading.value = true; error.value = '';
  try {
    const params = {}; if (start.value) params.start = start.value; if (end.value) params.end = end.value; if (costCenter.value) params.costCenter = costCenter.value;
    const { data: d } = await api.get('/financials/trial-balance', { params });
    data.value = d;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load trial balance.'; }
  finally { loading.value = false; }
}
function printPage() { window.print(); }
function downloadCSV() {
  if (!data.value) return;
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Code', 'Account', 'Type', 'Debit', 'Credit']];
  for (const r of data.value.rows) rows.push([r.code, r.name, r.type, r.debit, r.credit]);
  rows.push(['', '', 'TOTAL', data.value.totalDebit, data.value.totalCredit]);
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'trial-balance.csv'; a.click(); URL.revokeObjectURL(url);
}
onMounted(async () => { await loadRefs(); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Trial Balance</h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Lahat ng account na may balanse, mula sa posted journal entries. Dapat pantay ang Debit at Credit.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="row g-2 mb-3 no-print">
      <div class="col-6 col-md-3"><label class="form-label">From</label><input v-model="start" type="date" class="form-control" @change="load" /></div>
      <div class="col-6 col-md-3"><label class="form-label">To</label><input v-model="end" type="date" class="form-control" @change="load" /></div>
      <div class="col-12 col-md-3"><label class="form-label">Cost Center</label>
        <select v-model="costCenter" class="form-select" @change="load"><option value="">All</option>
          <option v-for="c in costCenters" :key="c._id" :value="c.code">{{ c.code }} · {{ c.name }}</option></select></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="data" class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:640px">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Account</th><th class="lbl">Type</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          <tr v-for="r in data.rows" :key="r.code">
            <td class="lbl">{{ r.code }}</td><td class="lbl">{{ r.name }}</td><td class="lbl">{{ r.type }}</td>
            <td class="num">{{ r.debit ? peso(r.debit) : '' }}</td><td class="num">{{ r.credit ? peso(r.credit) : '' }}</td>
          </tr>
          <tr v-if="!data.rows.length"><td colspan="5" class="text-center text-muted py-3">Walang postings sa period na ito.</td></tr>
        </tbody>
        <tfoot><tr class="gp"><td class="lbl" colspan="3">TOTAL</td><td class="num fw-bold">{{ peso(data.totalDebit) }}</td><td class="num fw-bold">{{ peso(data.totalCredit) }}</td></tr></tfoot>
      </table>
    </div></div>
    <p v-if="data" class="mt-2" :class="data.balanced ? 'text-success' : 'text-danger'">
      <strong>{{ data.balanced ? '✓ Balanced' : '✗ Hindi balanse — may maling entry' }}</strong>
    </p>

    <!-- Print sheet -->
    <div v-if="data" class="print-sheet">
      <div class="print-head"><div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">Trial Balance · {{ start }} to {{ end }}{{ costCenter ? ' · ' + costCenter : '' }}</div></div>
      <table class="fin-table">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Account</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          <tr v-for="r in data.rows" :key="r.code"><td class="lbl">{{ r.code }}</td><td class="lbl">{{ r.name }}</td>
            <td class="num">{{ r.debit ? peso(r.debit) : '' }}</td><td class="num">{{ r.credit ? peso(r.credit) : '' }}</td></tr>
          <tr><td class="lbl" colspan="2"><strong>TOTAL</strong></td><td class="num"><strong>{{ peso(data.totalDebit) }}</strong></td><td class="num"><strong>{{ peso(data.totalCredit) }}</strong></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
