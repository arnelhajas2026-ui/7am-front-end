<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const o = ref(null);
const recon = ref(null);
const loading = ref(false);
const error = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

async function load() {
  loading.value = true; error.value = '';
  try {
    const [ov, inv, ap, ar] = await Promise.all([
      api.get('/financials/overview'),
      api.get('/ledger/inventory'), api.get('/ledger/ap'), api.get('/ledger/ar'),
    ]);
    o.value = ov.data;
    recon.value = {
      inventory: inv.data.control, ap: ap.data.control, ar: ar.data.control,
    };
  } catch (e) { error.value = e.response?.data?.message || 'Could not load overview.'; }
  finally { loading.value = false; }
}
const ok = (c) => c && Math.abs(c.diff) < 0.01;
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Accounting Overview</h3>
    <p class="text-muted">Buod ng financial position mula sa General Ledger<span v-if="o"> · as of {{ fmtDate(o.asOf) }}</span>.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="loading" class="text-muted">Loading…</div>

    <template v-else-if="o">
      <!-- KPI cards -->
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Net Income (YTD)</div>
          <div class="h4 mb-0 numeric" :class="o.netIncomeYTD >= 0 ? 'text-success' : 'text-danger'">{{ peso(o.netIncomeYTD) }}</div>
          <div class="text-muted small">This month: {{ peso(o.netIncomeMTD) }}</div>
        </div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Cash &amp; Bank</div><div class="h4 mb-0 numeric">{{ peso(o.cash) }}</div></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Inventory</div><div class="h4 mb-0 numeric">{{ peso(o.inventory) }}</div></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Receivables</div><div class="h4 mb-0 numeric">{{ peso(o.accountsReceivable) }}</div></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Payables</div><div class="h4 mb-0 numeric">{{ peso(o.accountsPayable) }}</div></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Total Assets</div><div class="h4 mb-0 numeric">{{ peso(o.totalAssets) }}</div></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Liabilities</div><div class="h4 mb-0 numeric">{{ peso(o.totalLiabilities) }}</div></div></div></div>
        <div class="col-6 col-md-4 col-lg-3"><div class="card h-100"><div class="card-body py-3">
          <div class="section-eyebrow">Equity</div><div class="h4 mb-0 numeric">{{ peso(o.totalEquity) }}</div></div></div></div>
      </div>

      <!-- Accounting equation -->
      <div class="alert py-2" :class="o.balanced ? 'alert-success' : 'alert-danger'">
        <strong>{{ o.balanced ? '✓' : '✗' }}</strong>
        Assets {{ peso(o.totalAssets) }} = Liabilities {{ peso(o.totalLiabilities) }} + Equity {{ peso(o.totalEquity) }}
      </div>

      <!-- Reconciliation panel -->
      <p class="section-eyebrow">Sub-ledger reconciliation</p>
      <div class="card"><div class="card-body p-0" style="overflow-x:auto">
        <table class="fin-table" style="min-width:560px">
          <thead><tr><th class="lbl">Sub-ledger</th><th>Sub-ledger total</th><th>GL control</th><th class="lbl">Status</th></tr></thead>
          <tbody>
            <tr><td class="lbl">Inventory (vs 1100)</td><td class="num">{{ peso(recon.inventory.subTotal) }}</td><td class="num">{{ peso(recon.inventory.glBalance) }}</td>
              <td class="lbl"><span :class="ok(recon.inventory) ? 'text-success' : 'text-danger'">{{ ok(recon.inventory) ? '✓ Reconciled' : '✗ Off by ' + peso(recon.inventory.diff) }}</span></td></tr>
            <tr><td class="lbl">Receivables (vs 1050)</td><td class="num">{{ peso(recon.ar.subTotal) }}</td><td class="num">{{ peso(recon.ar.glBalance) }}</td>
              <td class="lbl"><span :class="ok(recon.ar) ? 'text-success' : 'text-danger'">{{ ok(recon.ar) ? '✓ Reconciled' : '✗ Off by ' + peso(recon.ar.diff) }}</span></td></tr>
            <tr><td class="lbl">Payables (vs 2010)</td><td class="num">{{ peso(recon.ap.subTotal) }}</td><td class="num">{{ peso(recon.ap.glBalance) }}</td>
              <td class="lbl"><span :class="ok(recon.ap) ? 'text-success' : 'text-danger'">{{ ok(recon.ap) ? '✓ Reconciled' : '✗ Off by ' + peso(recon.ap.diff) }}</span></td></tr>
          </tbody>
        </table>
      </div></div>
      <p class="text-muted small mt-2">Lahat ng figures ay galing sa posted journal entries (General Ledger).</p>
    </template>
  </div>
</template>
