<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { BRAND } from '../constants/brand.js';
import { fmtDate } from '../utils/datetime.js';

const bs = ref(null);
const loading = ref(false);
const error = ref('');
const showCash = ref(false);
const showPayable = ref(false);

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/reports/balance-sheet'); bs.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load balance sheet.'; }
  finally { loading.value=false; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});

function printPage(){ window.print(); }

function downloadCSV(){
  if(!bs.value) return;
  const b = bs.value;
  const esc = (v)=>{ const s=String(v??''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const rows = [
    ['Item','Amount'],
    ['ASSETS',''],
    ['Cash', b.assets.cash],
    ['  Vending sales in', b.cashBreakdown.vendingIn],
    ['  Customer payments in', b.cashBreakdown.customerIn],
    ['  Purchase payments out', -b.cashBreakdown.purchasePaymentsOut],
    ['  Supplier payments out', -b.cashBreakdown.supplierOut],
    ['  Expenses out', -b.cashBreakdown.expensesOut],
    ['Inventory (at cost)', b.assets.inventory],
    ['Accounts Receivable', b.assets.accountsReceivable],
    ['Total Assets', b.assets.total],
    ['LIABILITIES',''],
    ['Accounts Payable', b.liabilities.accountsPayable],
    ['  Merchandise (unpaid purchases)', b.payableBreakdown?.merchandise ?? 0],
    ['  Machine procurement', b.payableBreakdown?.machine ?? 0],
    ['Total Liabilities', b.liabilities.total],
    ["Owner's Equity", b.equity.ownersEquity],
  ];
  const csv = rows.map(r=> r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='balance-sheet.csv'; a.click();
  URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Balance Sheet</h3>
      <div class="d-flex gap-2 no-print">
        <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
        <button class="btn btn-ghost btn-sm" @click="printPage">🖨 Print / PDF</button>
      </div>
    </div>
    <p class="text-muted no-print">Financial position as of today — what the business owns vs. owes.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="bs" class="card" style="max-width:560px"><div class="card-body">
      <!-- Assets -->
      <p class="section-eyebrow mb-2">Assets</p>
      <div class="is-row"><span>Cash <button class="btn btn-ghost btn-sm py-0" @click="showCash=!showCash">{{ showCash ? '−' : 'ⓘ' }}</button></span><span class="numeric">{{ peso(bs.assets.cash) }}</span></div>
      <template v-if="showCash">
        <div class="is-row sub"><span>Vending sales in</span><span class="numeric">{{ peso(bs.cashBreakdown.vendingIn) }}</span></div>
        <div class="is-row sub"><span>Customer payments in</span><span class="numeric">{{ peso(bs.cashBreakdown.customerIn) }}</span></div>
        <div class="is-row sub"><span>Purchase payments out</span><span class="numeric">({{ peso(bs.cashBreakdown.purchasePaymentsOut) }})</span></div>
        <div class="is-row sub"><span>Supplier payments out</span><span class="numeric">({{ peso(bs.cashBreakdown.supplierOut) }})</span></div>
        <div class="is-row sub"><span>Expenses out</span><span class="numeric">({{ peso(bs.cashBreakdown.expensesOut) }})</span></div>
      </template>
      <div class="is-row"><span>Inventory (at cost)</span><span class="numeric">{{ peso(bs.assets.inventory) }}</span></div>
      <div class="is-row"><span>Accounts Receivable</span><span class="numeric">{{ peso(bs.assets.accountsReceivable) }}</span></div>
      <div class="is-row total"><span>Total Assets</span><span class="numeric">{{ peso(bs.assets.total) }}</span></div>

      <!-- Liabilities -->
      <p class="section-eyebrow mb-2 mt-3">Liabilities</p>
      <div class="is-row"><span>Accounts Payable <button class="btn btn-ghost btn-sm py-0" @click="showPayable=!showPayable">{{ showPayable ? '−' : 'ⓘ' }}</button></span><span class="numeric">{{ peso(bs.liabilities.accountsPayable) }}</span></div>
      <template v-if="showPayable">
        <div class="is-row sub"><span>Merchandise (unpaid purchases)</span><span class="numeric">{{ peso(bs.payableBreakdown?.merchandise) }}</span></div>
        <div class="is-row sub"><span>Machine procurement</span><span class="numeric">{{ peso(bs.payableBreakdown?.machine) }}</span></div>
      </template>
      <div class="is-row total"><span>Total Liabilities</span><span class="numeric">{{ peso(bs.liabilities.total) }}</span></div>

      <!-- Equity -->
      <div class="is-row grand mt-3"><span>Owner's Equity</span><span class="numeric">{{ peso(bs.equity.ownersEquity) }}</span></div>
      <div class="text-muted small mt-2">Assets − Liabilities = Owner's Equity</div>
    </div></div>

    <!-- Print sheet (hidden on screen, shown on print/PDF) -->
    <div v-if="bs" class="print-sheet">
      <div class="print-head">
        <div class="ph-name">{{ BRAND.name }}</div>
        <div class="ph-sub">Balance Sheet · As of {{ fmtDate(Date.now()) }}</div>
      </div>
      <div style="max-width:560px">
        <p><strong>ASSETS</strong></p>
        <div class="is-row"><span>Cash</span><span>{{ peso(bs.assets.cash) }}</span></div>
        <div class="is-row sub"><span>Vending sales in</span><span>{{ peso(bs.cashBreakdown.vendingIn) }}</span></div>
        <div class="is-row sub"><span>Customer payments in</span><span>{{ peso(bs.cashBreakdown.customerIn) }}</span></div>
        <div class="is-row sub"><span>Purchase payments out</span><span>({{ peso(bs.cashBreakdown.purchasePaymentsOut) }})</span></div>
        <div class="is-row sub"><span>Supplier payments out</span><span>({{ peso(bs.cashBreakdown.supplierOut) }})</span></div>
        <div class="is-row sub"><span>Expenses out</span><span>({{ peso(bs.cashBreakdown.expensesOut) }})</span></div>
        <div class="is-row"><span>Inventory (at cost)</span><span>{{ peso(bs.assets.inventory) }}</span></div>
        <div class="is-row"><span>Accounts Receivable</span><span>{{ peso(bs.assets.accountsReceivable) }}</span></div>
        <div class="is-row total"><span>Total Assets</span><span>{{ peso(bs.assets.total) }}</span></div>

        <p class="mt-3"><strong>LIABILITIES</strong></p>
        <div class="is-row"><span>Accounts Payable</span><span>{{ peso(bs.liabilities.accountsPayable) }}</span></div>
        <div class="is-row sub"><span>Merchandise (unpaid purchases)</span><span>{{ peso(bs.payableBreakdown?.merchandise) }}</span></div>
        <div class="is-row sub"><span>Machine procurement</span><span>{{ peso(bs.payableBreakdown?.machine) }}</span></div>
        <div class="is-row total"><span>Total Liabilities</span><span>{{ peso(bs.liabilities.total) }}</span></div>

        <div class="is-row grand"><span>Owner's Equity</span><span>{{ peso(bs.equity.ownersEquity) }}</span></div>
      </div>
    </div>
  </div>
</template>
