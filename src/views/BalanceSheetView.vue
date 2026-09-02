<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const bs = ref(null);
const loading = ref(false);
const error = ref('');
const showCash = ref(false);

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/reports/balance-sheet'); bs.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load balance sheet.'; }
  finally { loading.value=false; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Balance Sheet</h3>
    <p class="text-muted">Financial position as of today — what the business owns vs. owes.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="bs" class="card" style="max-width:560px"><div class="card-body">
      <!-- Assets -->
      <p class="section-eyebrow mb-2">Assets</p>
      <div class="is-row"><span>Cash <button class="btn btn-ghost btn-sm py-0" @click="showCash=!showCash">{{ showCash ? '−' : 'ⓘ' }}</button></span><span class="numeric">{{ peso(bs.assets.cash) }}</span></div>
      <template v-if="showCash">
        <div class="is-row sub"><span>Vending sales in</span><span class="numeric">{{ peso(bs.cashBreakdown.vendingIn) }}</span></div>
        <div class="is-row sub"><span>Customer payments in</span><span class="numeric">{{ peso(bs.cashBreakdown.customerIn) }}</span></div>
        <div class="is-row sub"><span>Purchases out</span><span class="numeric">({{ peso(bs.cashBreakdown.purchasesOut) }})</span></div>
        <div class="is-row sub"><span>Supplier payments out</span><span class="numeric">({{ peso(bs.cashBreakdown.supplierOut) }})</span></div>
        <div class="is-row sub"><span>Expenses out</span><span class="numeric">({{ peso(bs.cashBreakdown.expensesOut) }})</span></div>
      </template>
      <div class="is-row"><span>Inventory (at cost)</span><span class="numeric">{{ peso(bs.assets.inventory) }}</span></div>
      <div class="is-row"><span>Accounts Receivable</span><span class="numeric">{{ peso(bs.assets.accountsReceivable) }}</span></div>
      <div class="is-row total"><span>Total Assets</span><span class="numeric">{{ peso(bs.assets.total) }}</span></div>

      <!-- Liabilities -->
      <p class="section-eyebrow mb-2 mt-3">Liabilities</p>
      <div class="is-row"><span>Accounts Payable (suppliers)</span><span class="numeric">{{ peso(bs.liabilities.accountsPayable) }}</span></div>
      <div class="is-row total"><span>Total Liabilities</span><span class="numeric">{{ peso(bs.liabilities.total) }}</span></div>

      <!-- Equity -->
      <div class="is-row grand mt-3"><span>Owner's Equity</span><span class="numeric">{{ peso(bs.equity.ownersEquity) }}</span></div>
      <div class="text-muted small mt-2">Assets − Liabilities = Owner's Equity</div>
    </div></div>
  </div>
</template>
