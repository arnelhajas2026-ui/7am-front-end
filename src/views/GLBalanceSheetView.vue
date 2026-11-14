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
  const t = d.value.totals;
  const rows = [['Section', 'Account', 'Amount']];
  for (const x of (d.value.currentAssets || [])) rows.push(['Current Asset', x.name, x.amount]);
  rows.push(['', 'Total Current Assets', t.totalCurrentAssets]);
  for (const x of (d.value.nonCurrentAssets || [])) rows.push(['Non-Current Asset', x.name, x.amount]);
  for (const x of (d.value.contraNonCurrentAssets || [])) rows.push(['Non-Current Asset', 'Less: ' + x.name, -x.amount]);
  rows.push(['', 'Total Non-Current Assets', t.totalNonCurrentAssets]);
  rows.push(['', 'Total Assets', t.totalAssets]);
  for (const x of (d.value.currentLiabilities || [])) rows.push(['Current Liability', x.name, x.amount]);
  rows.push(['', 'Total Current Liabilities', t.totalCurrentLiabilities]);
  for (const x of (d.value.nonCurrentLiabilities || [])) rows.push(['Non-Current Liability', x.name, x.amount]);
  rows.push(['', 'Total Non-Current Liabilities', t.totalNonCurrentLiabilities]);
  rows.push(['', 'Total Liabilities', t.totalLiabilities]);
  for (const x of d.value.equity) rows.push(['Equity', x.name, x.amount]);
  for (const x of d.value.contraEquity) rows.push(['Equity', 'Less: ' + x.name, -x.amount]);
  rows.push(['Equity', 'Current Earnings', d.value.currentEarnings]);
  rows.push(['', 'Total Equity', t.totalEquity]);
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
      <div class="is-row subhead"><span>Current Assets</span><span></span></div>
      <div v-for="x in (d.currentAssets || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div class="is-row subtotal"><span>Total Current Assets</span><span class="numeric">{{ peso(d.totals.totalCurrentAssets) }}</span></div>

      <div class="is-row subhead mt-2"><span>Non-Current Assets</span><span></span></div>
      <div v-for="x in (d.nonCurrentAssets || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-for="x in (d.contraNonCurrentAssets || [])" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span class="numeric">({{ peso(x.amount) }})</span></div>
      <div class="is-row subtotal"><span>Total Non-Current Assets</span><span class="numeric">{{ peso(d.totals.totalNonCurrentAssets) }}</span></div>

      <div class="is-row total mt-1"><span>Total Assets</span><span class="numeric">{{ peso(d.totals.totalAssets) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Liabilities</p>
      <div class="is-row subhead"><span>Current Liabilities</span><span></span></div>
      <div v-for="x in (d.currentLiabilities || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-if="!(d.currentLiabilities || []).length" class="is-row sub text-muted"><span>None</span><span>—</span></div>
      <div class="is-row subtotal"><span>Total Current Liabilities</span><span class="numeric">{{ peso(d.totals.totalCurrentLiabilities) }}</span></div>

      <div class="is-row subhead mt-2"><span>Non-Current Liabilities</span><span></span></div>
      <div v-for="x in (d.nonCurrentLiabilities || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-if="!(d.nonCurrentLiabilities || []).length" class="is-row sub text-muted"><span>None</span><span>—</span></div>
      <div class="is-row subtotal"><span>Total Non-Current Liabilities</span><span class="numeric">{{ peso(d.totals.totalNonCurrentLiabilities) }}</span></div>

      <div class="is-row total mt-1"><span>Total Liabilities</span><span class="numeric">{{ peso(d.totals.totalLiabilities) }}</span></div>

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
        <div class="is-row subhead"><span><em>Current Assets</em></span><span></span></div>
        <div v-for="x in (d.currentAssets || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div class="is-row subtotal"><span>Total Current Assets</span><span>{{ peso(d.totals.totalCurrentAssets) }}</span></div>
        <div class="is-row subhead"><span><em>Non-Current Assets</em></span><span></span></div>
        <div v-for="x in (d.nonCurrentAssets || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div v-for="x in (d.contraNonCurrentAssets || [])" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span>({{ peso(x.amount) }})</span></div>
        <div class="is-row subtotal"><span>Total Non-Current Assets</span><span>{{ peso(d.totals.totalNonCurrentAssets) }}</span></div>
        <div class="is-row total"><span>Total Assets</span><span>{{ peso(d.totals.totalAssets) }}</span></div>
        <p class="mt-2"><strong>LIABILITIES</strong></p>
        <div class="is-row subhead"><span><em>Current Liabilities</em></span><span></span></div>
        <div v-for="x in (d.currentLiabilities || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div class="is-row subtotal"><span>Total Current Liabilities</span><span>{{ peso(d.totals.totalCurrentLiabilities) }}</span></div>
        <div class="is-row subhead"><span><em>Non-Current Liabilities</em></span><span></span></div>
        <div v-for="x in (d.nonCurrentLiabilities || [])" :key="x.code" class="is-row"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div class="is-row subtotal"><span>Total Non-Current Liabilities</span><span>{{ peso(d.totals.totalNonCurrentLiabilities) }}</span></div>
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

<style scoped>
.is-row.subhead { font-weight: 600; opacity: .75; font-size: .82rem; text-transform: uppercase; letter-spacing: .03em; margin-top: .25rem; }
.is-row.subtotal { font-weight: 600; border-top: 1px solid var(--border, #dee2e6); }
</style>
