<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { BRAND } from '../constants/brand.js';
import { fmtDate } from '../utils/datetime.js';

const mode = ref('quarterly');
const columns = ref([]);
const categories = ref([]);
const loading = ref(false);
const error = ref('');

const TABS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'annual', label: 'Annually' },
];

async function load(){
  loading.value=true; error.value='';
  try {
    const { data } = await api.get('/reports/income-statement-periods', { params:{ mode: mode.value } });
    columns.value = data.columns; categories.value = data.categories;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load report.'; }
  finally { loading.value=false; }
}
function setMode(m){ mode.value=m; load(); }
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH');

function printPage(){ window.print(); }

function downloadCSV(){
  const esc = (v)=>{ const s=String(v??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const header = ['Line', ...columns.value.map(c=>c.label)];
  const col = (fn)=> columns.value.map(fn);
  const rows = [
    header,
    ['Revenue'],
    ['Vending Sales', ...col(c=>c.vendingRevenue)],
    ['Machine Sales', ...col(c=>c.machineRevenue)],
    ['Total Sales', ...col(c=>c.sales)],
    ['Cost of Sales'],
    ['Vending COGS', ...col(c=>c.vendingCogs)],
    ['Machine COGS', ...col(c=>c.machineCogs)],
    ['Total Cost of Sales', ...col(c=>c.cogs)],
    ['Gross Profit', ...col(c=>c.grossProfit)],
    ['Operating Expenses'],
    ...categories.value.map(cat=> [cat, ...col(c=>c.byCategory[cat]||0)]),
    ['Total Operating Expenses', ...col(c=>c.operatingExpenses)],
    ['Income Before Taxes', ...col(c=>c.incomeBeforeTaxes)],
    ['Income Tax Expense', ...col(c=>c.incomeTax)],
    ['Net Income', ...col(c=>c.netIncome)],
  ];
  const csv = rows.map(r=> r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`income-statement-${mode.value}.csv`; a.click();
  URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Income Statement</h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Statement using your recorded data.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="seg mb-3 no-print">
      <button v-for="t in TABS" :key="t.key" :class="{active: mode===t.key}" @click="setMode(t.key)">{{ t.label }}</button>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body" style="overflow-x:auto">
      <table class="fin-table">
        <thead>
          <tr><th class="lbl">{{ mode==='monthly' ? 'Period (last 6 months)' : mode==='annual' ? 'Year' : 'Period' }}</th>
            <th v-for="c in columns" :key="c.key">{{ c.label }}</th></tr>
        </thead>
        <tbody>
          <tr class="sec"><td class="lbl">Revenue</td><td v-for="c in columns" :key="c.key"></td></tr>
          <tr><td class="lbl indent">Vending Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.vendingRevenue) }}</td></tr>
          <tr><td class="lbl indent">Machine Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.machineRevenue) }}</td></tr>
          <tr class="tot"><td class="lbl indent">Total Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.sales) }}</td></tr>

          <tr class="sec"><td class="lbl">Cost of Sales</td><td v-for="c in columns" :key="c.key"></td></tr>
          <tr><td class="lbl indent">Vending COGS</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.vendingCogs) }}</td></tr>
          <tr><td class="lbl indent">Machine COGS</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.machineCogs) }}</td></tr>
          <tr class="tot"><td class="lbl indent">Total Cost of Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.cogs) }}</td></tr>

          <tr class="gp"><td class="lbl">Gross Profit</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.grossProfit) }}</td></tr>

          <tr class="sec"><td class="lbl">Operating Expenses</td><td v-for="c in columns" :key="c.key"></td></tr>
          <tr v-for="cat in categories" :key="cat"><td class="lbl indent">{{ cat }}</td>
            <td v-for="c in columns" :key="c.key" class="num">{{ peso(c.byCategory[cat] || 0) }}</td></tr>
          <tr class="tot"><td class="lbl indent">Total Operating Expenses</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.operatingExpenses) }}</td></tr>

          <tr class="ibt"><td class="lbl">Income Before Taxes</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.incomeBeforeTaxes) }}</td></tr>
          <tr><td class="lbl indent">Income Tax Expense</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.incomeTax) }}</td></tr>
          <tr class="net"><td class="lbl">Net Income</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.netIncome) }}</td></tr>
        </tbody>
      </table>
    </div></div>

    <!-- Print sheet (hidden on screen, shown on print/PDF) -->
    <div class="print-sheet">
      <div class="print-head">
        <div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">Income Statement ({{ TABS.find(t=>t.key===mode)?.label }}) · Generated {{ fmtDate(Date.now()) }}</div>
      </div>
      <table class="fin-table">
        <thead>
          <tr><th class="lbl">{{ mode==='monthly' ? 'Period' : mode==='annual' ? 'Year' : 'Period' }}</th>
            <th v-for="c in columns" :key="c.key">{{ c.label }}</th></tr>
        </thead>
        <tbody>
          <tr><td class="lbl"><strong>Revenue</strong></td><td v-for="c in columns" :key="c.key"></td></tr>
          <tr><td class="lbl">Vending Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.vendingRevenue) }}</td></tr>
          <tr><td class="lbl">Machine Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.machineRevenue) }}</td></tr>
          <tr><td class="lbl">Total Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.sales) }}</td></tr>
          <tr><td class="lbl"><strong>Cost of Sales</strong></td><td v-for="c in columns" :key="c.key"></td></tr>
          <tr><td class="lbl">Vending COGS</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.vendingCogs) }}</td></tr>
          <tr><td class="lbl">Machine COGS</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.machineCogs) }}</td></tr>
          <tr><td class="lbl">Total Cost of Sales</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.cogs) }}</td></tr>
          <tr><td class="lbl"><strong>Gross Profit</strong></td><td v-for="c in columns" :key="c.key" class="num"><strong>{{ peso(c.grossProfit) }}</strong></td></tr>
          <tr><td class="lbl"><strong>Operating Expenses</strong></td><td v-for="c in columns" :key="c.key"></td></tr>
          <tr v-for="cat in categories" :key="cat"><td class="lbl">{{ cat }}</td>
            <td v-for="c in columns" :key="c.key" class="num">{{ peso(c.byCategory[cat] || 0) }}</td></tr>
          <tr><td class="lbl">Total Operating Expenses</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.operatingExpenses) }}</td></tr>
          <tr><td class="lbl"><strong>Income Before Taxes</strong></td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.incomeBeforeTaxes) }}</td></tr>
          <tr><td class="lbl">Income Tax Expense</td><td v-for="c in columns" :key="c.key" class="num">{{ peso(c.incomeTax) }}</td></tr>
          <tr><td class="lbl"><strong>Net Income</strong></td><td v-for="c in columns" :key="c.key" class="num"><strong>{{ peso(c.netIncome) }}</strong></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
