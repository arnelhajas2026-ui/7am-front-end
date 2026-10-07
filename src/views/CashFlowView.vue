<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { BRAND } from '../constants/brand.js';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const start = ref(today.slice(0, 4) + '-01-01');
const end = ref(today);
const d = ref(null);
const loading = ref(false);
const error = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const flow = (n) => (n < 0 ? '(' + peso(Math.abs(n)) + ')' : peso(n));

async function load() {
  loading.value = true; error.value = '';
  try {
    const params = {}; if (start.value) params.start = start.value; if (end.value) params.end = end.value;
    const { data } = await api.get('/financials/cash-flow', { params });
    d.value = data;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load cash flow.'; }
  finally { loading.value = false; }
}
function printPage() { window.print(); }
function downloadCSV() {
  if (!d.value) return;
  const t = d.value.totals; const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Section', 'Account', 'Amount']];
  const push = (label, arr) => { for (const x of arr) rows.push([label, x.name, x.amount]); };
  push('Operating', d.value.operating); rows.push(['', 'Net Operating', t.netOperating]);
  push('Investing', d.value.investing); rows.push(['', 'Net Investing', t.netInvesting]);
  push('Financing', d.value.financing); rows.push(['', 'Net Financing', t.netFinancing]);
  rows.push(['', 'Net Change in Cash', t.netChange]);
  rows.push(['', 'Beginning Cash', t.beginningCash]); rows.push(['', 'Ending Cash', t.endingCash]);
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'cash-flow.csv'; a.click(); URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Cash Flow</h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Galaw ng cash, nakaklasipika sa Operating / Investing / Financing (base sa COA cash-flow type).</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="row g-2 mb-3 no-print">
      <div class="col-6 col-md-3"><label class="form-label">From</label><input v-model="start" type="date" class="form-control" @change="load" /></div>
      <div class="col-6 col-md-3"><label class="form-label">To</label><input v-model="end" type="date" class="form-control" @change="load" /></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="d" class="card" style="max-width:600px"><div class="card-body">
      <p class="section-eyebrow mb-2">Operating Activities</p>
      <div v-for="x in d.operating" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ flow(x.amount) }}</span></div>
      <div class="is-row total"><span>Net cash from operating</span><span class="numeric">{{ flow(d.totals.netOperating) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Investing Activities</p>
      <div v-for="x in d.investing" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ flow(x.amount) }}</span></div>
      <div v-if="!d.investing.length" class="is-row sub text-muted"><span>None</span><span>—</span></div>
      <div class="is-row total"><span>Net cash from investing</span><span class="numeric">{{ flow(d.totals.netInvesting) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Financing Activities</p>
      <div v-for="x in d.financing" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ flow(x.amount) }}</span></div>
      <div v-if="!d.financing.length" class="is-row sub text-muted"><span>None</span><span>—</span></div>
      <div class="is-row total"><span>Net cash from financing</span><span class="numeric">{{ flow(d.totals.netFinancing) }}</span></div>

      <div class="is-row grand mt-3"><span>Net Change in Cash</span><span class="numeric">{{ flow(d.totals.netChange) }}</span></div>
      <div class="is-row sub"><span>Beginning cash</span><span class="numeric">{{ peso(d.totals.beginningCash) }}</span></div>
      <div class="is-row total"><span>Ending cash</span><span class="numeric">{{ peso(d.totals.endingCash) }}</span></div>
      <p class="mt-2 mb-0" :class="d.totals.reconciles ? 'text-success' : 'text-danger'"><strong>{{ d.totals.reconciles ? '✓ Reconciles' : '✗ Hindi tugma sa cash balance' }}</strong></p>
    </div></div>

    <!-- Print sheet -->
    <div v-if="d" class="print-sheet">
      <div class="print-head"><div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">Cash Flow Statement · {{ start }} to {{ end }}</div></div>
      <div style="max-width:560px">
        <p><strong>OPERATING</strong></p>
        <div v-for="x in d.operating" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ flow(x.amount) }}</span></div>
        <div class="is-row total"><span>Net operating</span><span>{{ flow(d.totals.netOperating) }}</span></div>
        <p class="mt-2"><strong>INVESTING</strong></p>
        <div v-for="x in d.investing" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ flow(x.amount) }}</span></div>
        <div class="is-row total"><span>Net investing</span><span>{{ flow(d.totals.netInvesting) }}</span></div>
        <p class="mt-2"><strong>FINANCING</strong></p>
        <div v-for="x in d.financing" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ flow(x.amount) }}</span></div>
        <div class="is-row total"><span>Net financing</span><span>{{ flow(d.totals.netFinancing) }}</span></div>
        <div class="is-row grand"><span>Net Change in Cash</span><span>{{ flow(d.totals.netChange) }}</span></div>
        <div class="is-row sub"><span>Beginning cash</span><span>{{ peso(d.totals.beginningCash) }}</span></div>
        <div class="is-row total"><span>Ending cash</span><span>{{ peso(d.totals.endingCash) }}</span></div>
      </div>
    </div>
  </div>
</template>
