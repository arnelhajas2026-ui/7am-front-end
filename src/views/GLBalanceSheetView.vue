<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { BRAND } from '../constants/brand.js';
import { fmtDate } from '../utils/datetime.js';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const asOf = ref(today);
const d = ref(null);
const loading = ref(false);
const error = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

async function load() {
  loading.value = true; error.value = '';
  try { const { data } = await api.get('/financials/balance-sheet', { params: { asOf: asOf.value } }); d.value = data; }
  catch (e) { error.value = e.response?.data?.message || 'Could not load balance sheet.'; }
  finally { loading.value = false; }
}
function printPage() { window.print(); }
function downloadCSV() {
  if (!d.value) return;
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Section', 'Account', 'Amount']];
  for (const x of d.value.assets) rows.push(['Asset', x.name, x.amount]);
  for (const x of d.value.contraAssets) rows.push(['Contra Asset', x.name, -x.amount]);
  rows.push(['', 'Total Assets', d.value.totals.totalAssets]);
  for (const x of d.value.liabilities) rows.push(['Liability', x.name, x.amount]);
  rows.push(['', 'Total Liabilities', d.value.totals.totalLiabilities]);
  for (const x of d.value.equity) rows.push(['Equity', x.name, x.amount]);
  for (const x of d.value.contraEquity) rows.push(['Contra Equity', x.name, -x.amount]);
  rows.push(['Equity', 'Current Earnings', d.value.currentEarnings]);
  rows.push(['', 'Total Equity', d.value.totals.totalEquity]);
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'balance-sheet.csv'; a.click(); URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Balance Sheet <span class="text-muted" style="font-size:.7rem">(GL)</span></h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Financial position mula sa GL. Assets = Liabilities + Equity.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="row g-2 mb-3 no-print">
      <div class="col-6 col-md-3"><label class="form-label">As of</label><input v-model="asOf" type="date" class="form-control" @change="load" /></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="d" class="card" style="max-width:560px"><div class="card-body">
      <p class="section-eyebrow mb-2">Assets</p>
      <div v-for="x in d.assets" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-for="x in d.contraAssets" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span class="numeric">({{ peso(x.amount) }})</span></div>
      <div class="is-row total"><span>Total Assets</span><span class="numeric">{{ peso(d.totals.totalAssets) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Liabilities</p>
      <div v-for="x in d.liabilities" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-if="!d.liabilities.length" class="is-row sub text-muted"><span>None</span><span>—</span></div>
      <div class="is-row total"><span>Total Liabilities</span><span class="numeric">{{ peso(d.totals.totalLiabilities) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Equity</p>
      <div v-for="x in d.equity" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-for="x in d.contraEquity" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span class="numeric">({{ peso(x.amount) }})</span></div>
      <div class="is-row sub"><span>Current Earnings (period to date)</span><span class="numeric">{{ peso(d.currentEarnings) }}</span></div>
      <div class="is-row total"><span>Total Equity</span><span class="numeric">{{ peso(d.totals.totalEquity) }}</span></div>

      <div class="is-row grand mt-3"><span>Liabilities + Equity</span><span class="numeric">{{ peso(d.totals.liabilitiesPlusEquity) }}</span></div>
      <p class="mt-2 mb-0" :class="d.totals.balanced ? 'text-success' : 'text-danger'"><strong>{{ d.totals.balanced ? '✓ Balanced' : '✗ Hindi balanse' }}</strong></p>
    </div></div>

    <!-- Print sheet -->
    <div v-if="d" class="print-sheet">
      <div class="print-head"><div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">Balance Sheet · As of {{ fmtDate(asOf) }}</div></div>
      <div style="max-width:560px">
        <p><strong>ASSETS</strong></p>
        <div v-for="x in d.assets" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div v-for="x in d.contraAssets" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span>({{ peso(x.amount) }})</span></div>
        <div class="is-row total"><span>Total Assets</span><span>{{ peso(d.totals.totalAssets) }}</span></div>
        <p class="mt-2"><strong>LIABILITIES</strong></p>
        <div v-for="x in d.liabilities" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div class="is-row total"><span>Total Liabilities</span><span>{{ peso(d.totals.totalLiabilities) }}</span></div>
        <p class="mt-2"><strong>EQUITY</strong></p>
        <div v-for="x in d.equity" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div v-for="x in d.contraEquity" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span>({{ peso(x.amount) }})</span></div>
        <div class="is-row sub"><span>Current Earnings</span><span>{{ peso(d.currentEarnings) }}</span></div>
        <div class="is-row grand"><span>Liabilities + Equity</span><span>{{ peso(d.totals.liabilitiesPlusEquity) }}</span></div>
      </div>
    </div>
  </div>
</template>
