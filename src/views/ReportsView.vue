<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

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
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Income Statement</h3>
    <p class="text-muted">Statement using your recorded data.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="seg mb-3">
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
  </div>
</template>