<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { BRAND } from '../constants/brand.js';

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const start = ref(today.slice(0, 4) + '-01-01');
const end = ref(today);
const costCenter = ref('');
const costCenters = ref([]);
const d = ref(null);
const loading = ref(false);
const error = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

async function loadRefs() { try { const { data } = await api.get('/cost-centers'); costCenters.value = data.costCenters; } catch {} }
async function load() {
  loading.value = true; error.value = '';
  try {
    const params = {}; if (start.value) params.start = start.value; if (end.value) params.end = end.value; if (costCenter.value) params.costCenter = costCenter.value;
    const { data } = await api.get('/financials/income-statement', { params });
    d.value = data;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load income statement.'; }
  finally { loading.value = false; }
}
function printPage() { window.print(); }
function downloadCSV() {
  if (!d.value) return;
  const t = d.value.totals; const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Section', 'Account', 'Amount']];
  const push = (label, arr) => { for (const x of arr) rows.push([label, x.name, x.amount]); };
  push('Revenue', d.value.revenue); push('Contra Revenue', d.value.contraRevenue);
  rows.push(['', 'Net Revenue', t.netRevenue]);
  push('COGS', d.value.cogs); rows.push(['', 'Gross Profit', t.grossProfit]);
  push('Operating Expense', d.value.opex); rows.push(['', 'Operating Income', t.operatingIncome]);
  push('Other Income', d.value.otherIncome); push('Other Expense', d.value.otherExpense);
  rows.push(['', 'NET INCOME', t.netIncome]);
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'income-statement.csv'; a.click(); URL.revokeObjectURL(url);
}
onMounted(async () => { await loadRefs(); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Income Statement <span class="text-muted" style="font-size:.7rem">(GL)</span></h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Mula sa posted journal entries — authoritative na ulat ng kita.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="row g-2 mb-3 no-print">
      <div class="col-6 col-md-3"><label class="form-label">From</label><input v-model="start" type="date" class="form-control" @change="load" /></div>
      <div class="col-6 col-md-3"><label class="form-label">To</label><input v-model="end" type="date" class="form-control" @change="load" /></div>
      <div class="col-12 col-md-3"><label class="form-label">Cost Center</label>
        <select v-model="costCenter" class="form-select" @change="load"><option value="">All</option>
          <option v-for="c in costCenters" :key="c._id" :value="c.code">{{ c.code }} · {{ c.name }}</option></select></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="d" class="card" style="max-width:620px"><div class="card-body">
      <p class="section-eyebrow mb-2">Revenue</p>
      <div v-for="x in d.revenue" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div v-for="x in d.contraRevenue" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span class="numeric">({{ peso(x.amount) }})</span></div>
      <div class="is-row total"><span>Net Revenue</span><span class="numeric">{{ peso(d.totals.netRevenue) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Cost of Sales</p>
      <div v-for="x in d.cogs" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div class="is-row total"><span>Gross Profit</span><span class="numeric">{{ peso(d.totals.grossProfit) }}</span></div>

      <p class="section-eyebrow mb-2 mt-3">Operating Expenses</p>
      <div v-for="x in d.opex" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
      <div class="is-row total"><span>Operating Income</span><span class="numeric">{{ peso(d.totals.operatingIncome) }}</span></div>

      <template v-if="d.otherIncome.length || d.otherExpense.length">
        <p class="section-eyebrow mb-2 mt-3">Other</p>
        <div v-for="x in d.otherIncome" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span class="numeric">{{ peso(x.amount) }}</span></div>
        <div v-for="x in d.otherExpense" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span class="numeric">({{ peso(x.amount) }})</span></div>
      </template>

      <div class="is-row grand mt-3"><span>Net Income</span><span class="numeric">{{ peso(d.totals.netIncome) }}</span></div>
    </div></div>

    <!-- Print sheet -->
    <div v-if="d" class="print-sheet">
      <div class="print-head"><div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">Income Statement · {{ start }} to {{ end }}{{ costCenter ? ' · ' + costCenter : '' }}</div></div>
      <div style="max-width:560px">
        <p><strong>REVENUE</strong></p>
        <div v-for="x in d.revenue" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div v-for="x in d.contraRevenue" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span>({{ peso(x.amount) }})</span></div>
        <div class="is-row total"><span>Net Revenue</span><span>{{ peso(d.totals.netRevenue) }}</span></div>
        <p class="mt-2"><strong>COST OF SALES</strong></p>
        <div v-for="x in d.cogs" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div class="is-row total"><span>Gross Profit</span><span>{{ peso(d.totals.grossProfit) }}</span></div>
        <p class="mt-2"><strong>OPERATING EXPENSES</strong></p>
        <div v-for="x in d.opex" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div class="is-row total"><span>Operating Income</span><span>{{ peso(d.totals.operatingIncome) }}</span></div>
        <div v-for="x in d.otherIncome" :key="x.code" class="is-row sub"><span>{{ x.name }}</span><span>{{ peso(x.amount) }}</span></div>
        <div v-for="x in d.otherExpense" :key="x.code" class="is-row sub"><span>Less: {{ x.name }}</span><span>({{ peso(x.amount) }})</span></div>
        <div class="is-row grand"><span>NET INCOME</span><span>{{ peso(d.totals.netIncome) }}</span></div>
      </div>
    </div>
  </div>
</template>
