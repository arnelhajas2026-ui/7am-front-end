<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';
import { downloadFromApi } from '../utils/exporters.js';
import ExportDialog from '../components/ExportDialog.vue';

const customers = ref([]);
const selectedId = ref('');
const ledger = ref(null);
const aging = ref(null);
const loading = ref(false);
const error = ref('');
const showExport = ref(false);
const exporting = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const isAll = computed(() => selectedId.value === 'ALL');

async function loadCustomers(){
  try { const { data } = await api.get('/customers'); customers.value = data.customers; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load customers.'; }
}
async function loadLedger(){
  ledger.value = null; aging.value = null;
  if(!selectedId.value) return;
  loading.value=true; error.value='';
  try {
    if(selectedId.value === 'ALL'){ const { data } = await api.get('/ledger/ar-aging'); aging.value = data; }
    else { const { data } = await api.get(`/customers/${selectedId.value}/ledger`); ledger.value = data; }
  } catch(e){ error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value=false; }
}
async function onExport({ format, orientation, paper }) {
  exporting.value = true; error.value = '';
  try {
    await downloadFromApi(api, '/ledger/ar-export', { aging: 1, format, orientation, paper },
      `ar-aging.${format === 'docx' ? 'docx' : format === 'xlsx' ? 'xlsx' : 'pdf'}`);
    showExport.value = false;
  } catch (e) { error.value = e.response?.data?.message || 'Could not export.'; }
  finally { exporting.value = false; }
}
onMounted(loadCustomers);
</script>

<template>
  <div>
    <h3 class="mb-1">Customer Ledger</h3>
    <p class="text-muted">Statement of account per customer, o pumili ng "All" para sa Aging of Accounts Receivable.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="d-flex align-items-end gap-2 mb-3 flex-wrap">
      <div style="max-width:360px;flex:1 1 240px">
        <label class="form-label">Customer</label>
        <select v-model="selectedId" class="form-select" @change="loadLedger">
          <option value="">— select a customer —</option>
          <option value="ALL">📊 All (AR Aging)</option>
          <option v-for="c in customers" :key="c._id" :value="c._id">{{ c.name }}</option>
        </select>
      </div>
      <button v-if="isAll && aging" class="btn btn-ghost" @click="showExport = true">⤓ Export (PDF / Word / Excel)</button>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <!-- AR AGING (All customers) -->
    <template v-else-if="isAll && aging">
      <p class="section-eyebrow">AR Aging · as-of {{ aging.asOf }}</p>
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-2" v-for="b in [['Current','current'],['1-30 Days','d1_30'],['31-60 Days','d31_60'],['61-90 Days','d61_90'],['Over 90','over90'],['Total','total']]" :key="b[1]">
          <div class="tile sm"><div class="tlabel">{{ b[0] }}</div><div class="tval">{{ peso(aging.buckets[b[1]]) }}</div></div>
        </div>
      </div>

      <div class="recon" :class="aging.control.status==='OK' ? 'ok' : 'off'">
        <div><div class="recon-label">AR Subsidiary total</div><div class="recon-val">{{ peso(aging.control.subTotal) }}</div></div>
        <div class="recon-eq">vs</div>
        <div><div class="recon-label">GL 1050 · {{ aging.control.name }}</div><div class="recon-val">{{ peso(aging.control.glBalance) }}</div></div>
        <div class="recon-badge"><span v-if="aging.control.status==='OK'">✓ Reconciled</span><span v-else>✗ Diff {{ peso(aging.control.diff) }} — INVESTIGATE</span></div>
      </div>

      <p class="section-eyebrow">Customer-Level Aging</p>
      <div class="card"><div class="card-body p-0" style="overflow-x:auto">
        <table class="fin-table ruled" style="min-width:820px">
          <thead><tr><th class="lbl">Customer ID</th><th class="lbl">Customer Name</th><th>Current</th><th>1-30 Days</th><th>31-60 Days</th><th>61-90 Days</th><th>Over 90 Days</th><th>Total AR</th></tr></thead>
          <tbody>
            <tr v-for="(c,i) in aging.customers" :key="i">
              <td class="lbl">{{ c.customerId }}</td>
              <td class="lbl">{{ c.customer }}</td>
              <td class="num">{{ peso(c.current) }}</td>
              <td class="num">{{ peso(c.d1_30) }}</td>
              <td class="num">{{ peso(c.d31_60) }}</td>
              <td class="num">{{ peso(c.d61_90) }}</td>
              <td class="num">{{ peso(c.over90) }}</td>
              <td class="num fw-semibold">{{ peso(c.total) }}</td>
            </tr>
            <tr v-if="!aging.customers.length"><td colspan="8" class="text-center text-muted py-3">Walang outstanding na receivable.</td></tr>
          </tbody>
          <tfoot v-if="aging.customers.length"><tr class="gp">
            <td class="lbl" colspan="2">Total</td>
            <td class="num">{{ peso(aging.buckets.current) }}</td><td class="num">{{ peso(aging.buckets.d1_30) }}</td>
            <td class="num">{{ peso(aging.buckets.d31_60) }}</td><td class="num">{{ peso(aging.buckets.d61_90) }}</td>
            <td class="num">{{ peso(aging.buckets.over90) }}</td><td class="num fw-bold">{{ peso(aging.buckets.total) }}</td>
          </tr></tfoot>
        </table>
      </div></div>
    </template>

    <!-- Per-customer statement -->
    <template v-else-if="ledger">
      <div class="row g-2 mb-3" style="max-width:560px">
        <div class="col-4"><div class="tile sm"><div class="tlabel">Total billed</div><div class="tval">{{ peso(ledger.summary.totalBilled) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Total paid</div><div class="tval">{{ peso(ledger.summary.totalPaid) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Outstanding</div><div class="tval" :class="ledger.summary.outstanding>0 && 'warn'">{{ peso(ledger.summary.outstanding) }}</div></div></div>
      </div>

      <div v-if="!ledger.entries.length" class="card"><div class="card-body text-muted text-center py-4">No transactions for this customer yet.</div></div>
      <div v-else class="card"><div class="card-body" style="overflow-x:auto">
        <table class="fin-table">
          <thead><tr><th class="lbl">Date</th><th class="lbl">Ref</th><th class="lbl">Description</th><th>Charge</th><th>Payment</th><th>Balance</th></tr></thead>
          <tbody>
            <tr v-for="(e,i) in ledger.entries" :key="i">
              <td class="lbl">{{ fmtDate(e.date) }}</td>
              <td class="lbl">{{ e.ref }}</td>
              <td class="lbl">{{ e.description }}</td>
              <td class="num">{{ e.charge ? peso(e.charge) : '—' }}</td>
              <td class="num">{{ e.credit ? peso(e.credit) : '—' }}</td>
              <td class="num fw-semibold">{{ peso(e.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div></div>
    </template>
    <div v-else class="text-muted">Select a customer to view their statement, or "All" for AR aging.</div>

    <ExportDialog :visible="showExport" :busy="exporting" title="Export AR Aging"
      @confirm="onExport" @close="showExport = false" />
  </div>
</template>

<style scoped>
.recon { display:flex; align-items:center; gap:1.25rem; padding:.85rem 1.1rem; border-radius:12px; margin-bottom:1rem; border:1px solid; flex-wrap:wrap; }
.recon.ok { background:#E5F6EC; border-color:#8FD3A8; } .recon.off { background:#FDECEC; border-color:#F0A9A9; }
.recon-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); }
.recon-val { font-family:var(--font-display); font-weight:700; font-size:1.1rem; }
.recon-eq { color:var(--muted); }
.recon-badge { margin-left:auto; font-weight:700; }
.recon.ok .recon-badge { color:var(--good); } .recon.off .recon-badge { color:var(--bad); }
</style>
