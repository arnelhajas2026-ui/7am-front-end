<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';
import { downloadFromApi } from '../utils/exporters.js';
import ExportDialog from '../components/ExportDialog.vue';

const rows = ref([]);
const total = ref(0);
const control = ref(null);
const loading = ref(false);
const error = ref('');
const search = ref('');
const machines = ref([]);

// Product movement drill-down
const detailProduct = ref(null);
const ledgerRows = ref([]);
const ledgerLoading = ref(false);
const f = ref({ start: '', end: '', machine: '', type: '' });
const showExport = ref(false);
const exporting = ref(false);

const TXN_TYPES = ['Purchase', 'Transfer Out', 'Transfer In', 'Sale', 'Adjustment'];
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const reconciled = computed(() => control.value && Math.abs(control.value.diff) < 0.01);
const visible = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => !q || (r.name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q));
});

async function load() {
  loading.value = true; error.value = '';
  try {
    const [inv, ma] = await Promise.all([api.get('/ledger/inventory'), api.get('/machines')]);
    rows.value = inv.data.rows; total.value = inv.data.total; control.value = inv.data.control;
    machines.value = ma.data.machines;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load inventory sub-ledger.'; }
  finally { loading.value = false; }
}
async function openLedger(r) {
  detailProduct.value = { _id: r.product, sku: r.sku, name: r.name };
  f.value = { start: '', end: '', machine: '', type: '' };
  await loadLedger();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function loadLedger() {
  if (!detailProduct.value) return;
  ledgerLoading.value = true;
  try {
    const params = { product: detailProduct.value._id };
    if (f.value.start) params.start = f.value.start;
    if (f.value.end) params.end = f.value.end;
    if (f.value.machine) params.machine = f.value.machine;
    if (f.value.type) params.type = f.value.type;
    const { data } = await api.get('/inventory/product-ledger', { params });
    ledgerRows.value = data.rows;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load movement history.'; }
  finally { ledgerLoading.value = false; }
}
async function onExport({ format, orientation, paper }) {
  exporting.value = true; error.value = '';
  try {
    const params = { product: detailProduct.value._id, format, orientation, paper };
    if (f.value.start) params.start = f.value.start;
    if (f.value.end) params.end = f.value.end;
    if (f.value.machine) params.machine = f.value.machine;
    if (f.value.type) params.type = f.value.type;
    await downloadFromApi(api, '/inventory/export', params, `inventory-ledger.${format === 'docx' ? 'docx' : format === 'xlsx' ? 'xlsx' : 'pdf'}`);
    showExport.value = false;
  } catch (e) { error.value = e.response?.data?.message || 'Could not export.'; }
  finally { exporting.value = false; }
}
function downloadCSV() {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [['SKU', 'Product', 'Qty', 'Avg Cost', 'Value']];
  for (const r of rows.value) out.push([r.sku, r.name, r.qty, r.avgCost, r.value]);
  out.push(['', '', '', 'TOTAL', total.value]);
  const csv = out.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'inventory-subledger.csv'; a.click(); URL.revokeObjectURL(url);
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Inventory Sub-Ledger</h3>
      <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
    </div>
    <p class="text-muted">FIFO valuation per product. Dapat tumugma sa GL control account na Merchandise Inventory (1100). I-click ang isang product para sa movement history.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Reconciliation banner -->
    <div v-if="control" class="recon" :class="reconciled ? 'ok' : 'off'">
      <div><div class="recon-label">Sub-ledger total</div><div class="recon-val">{{ peso(total) }}</div></div>
      <div class="recon-eq">vs</div>
      <div><div class="recon-label">GL {{ control.code }} · {{ control.name }}</div><div class="recon-val">{{ peso(control.glBalance) }}</div></div>
      <div class="recon-badge"><span v-if="reconciled">✓ Reconciled</span><span v-else>✗ Off by {{ peso(control.diff) }}</span></div>
    </div>

    <!-- Product movement drill-down -->
    <div v-if="detailProduct" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
        <div><h5 class="mb-0" style="font-family:var(--font-display)">{{ detailProduct.sku }} · {{ detailProduct.name }}</h5>
          <div class="text-muted small">Movement history — bakit ganito ang Quantity on Hand</div></div>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="showExport = true">⤓ Export (PDF / Word / Excel)</button>
          <button class="btn btn-ghost btn-sm" @click="detailProduct = null">Close</button>
        </div>
      </div>
      <div class="row g-2 mb-2">
        <div class="col-6 col-md-2"><label class="form-label mb-0 small text-muted">From</label><input v-model="f.start" type="date" class="form-control form-control-sm" @change="loadLedger" /></div>
        <div class="col-6 col-md-2"><label class="form-label mb-0 small text-muted">To</label><input v-model="f.end" type="date" class="form-control form-control-sm" @change="loadLedger" /></div>
        <div class="col-6 col-md-4"><label class="form-label mb-0 small text-muted">Machine / Location</label>
          <select v-model="f.machine" class="form-select form-select-sm" @change="loadLedger"><option value="">All</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select></div>
        <div class="col-6 col-md-4"><label class="form-label mb-0 small text-muted">Transaction type</label>
          <select v-model="f.type" class="form-select form-select-sm" @change="loadLedger"><option value="">All</option>
            <option v-for="t in TXN_TYPES" :key="t" :value="t">{{ t }}</option></select></div>
      </div>
      <div v-if="ledgerLoading" class="text-muted small">Loading…</div>
      <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
        <table class="fin-table ruled" style="min-width:1100px">
          <thead><tr>
            <th class="lbl">Date</th><th class="lbl">Ref No.</th><th class="lbl">Transaction Type</th><th class="lbl">Product ID</th>
            <th class="lbl">Product Name</th><th class="lbl">From Location</th><th class="lbl">To Location</th><th class="lbl">Machine / Location</th>
            <th>Qty In</th><th>Qty Out</th><th>Unit Cost</th><th>Running Qty</th><th>Running Value</th>
          </tr></thead>
          <tbody>
            <tr v-for="(r,i) in ledgerRows" :key="i">
              <td class="lbl">{{ fmtDate(r.date) }}</td>
              <td class="lbl">{{ r.ref }}</td>
              <td class="lbl">{{ r.transactionType }}</td>
              <td class="lbl">{{ r.productId }}</td>
              <td class="lbl">{{ r.productName }}</td>
              <td class="lbl">{{ r.fromLocation }}</td>
              <td class="lbl">{{ r.toLocation }}</td>
              <td class="lbl">{{ r.machineLocation }}</td>
              <td class="num">{{ r.qtyIn || '' }}</td>
              <td class="num">{{ r.qtyOut || '' }}</td>
              <td class="num">{{ peso(r.unitCost) }}</td>
              <td class="num fw-semibold">{{ r.runningQty }}</td>
              <td class="num">{{ peso(r.runningValue) }}</td>
            </tr>
            <tr v-if="!ledgerRows.length"><td colspan="13" class="text-center text-muted py-3">Walang movement sa filter na ito.</td></tr>
          </tbody>
        </table>
      </div></div>
    </div></div>

    <div class="mb-3" style="max-width:360px"><input v-model="search" class="form-control" placeholder="Search product or SKU…" /></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:620px">
        <thead><tr><th class="lbl">SKU</th><th class="lbl">Product</th><th>Qty on Hand</th><th>Avg Cost</th><th>Value (FIFO)</th></tr></thead>
        <tbody>
          <tr v-for="r in visible" :key="r.product" class="click-row" @click="openLedger(r)">
            <td class="lbl">{{ r.sku }}</td>
            <td class="lbl"><a href="#" @click.prevent>{{ r.name }}</a></td>
            <td class="num">{{ r.qty }}</td>
            <td class="num">{{ peso(r.avgCost) }}</td>
            <td class="num fw-semibold">{{ peso(r.value) }}</td>
          </tr>
          <tr v-if="!visible.length"><td colspan="5" class="text-center text-muted py-3">Walang stock na may halaga.</td></tr>
        </tbody>
        <tfoot v-if="visible.length"><tr class="gp"><td class="lbl" colspan="4">Total inventory value</td><td class="num fw-bold">{{ peso(total) }}</td></tr></tfoot>
      </table>
    </div></div>

    <ExportDialog :visible="showExport" :busy="exporting" title="Export Inventory Movement"
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
.click-row { cursor:pointer; }
.click-row:hover td { background:#F2F7FD; }
</style>
