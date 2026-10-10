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
const showExport = ref(false);
const exporting = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const reconciled = computed(() => control.value && Math.abs(control.value.diff) < 0.01);
const agingClass = (a) => ({ 'Current': 'emp', 'Paid': 'emp', '1-30 Days': 'parked', '31-60 Days': 'parked', '61-90 Days': 'off', 'Over 90 Days': 'off' }[a] || 'emp');

async function load() {
  loading.value = true; error.value = '';
  try {
    const { data } = await api.get('/ledger/ar-detail');
    rows.value = data.rows; total.value = data.total; control.value = data.control;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load AR sub-ledger.'; }
  finally { loading.value = false; }
}
async function onExport({ format, orientation, paper }) {
  exporting.value = true; error.value = '';
  try {
    await downloadFromApi(api, '/ledger/ar-export', { format, orientation, paper },
      `ar-subsidiary-ledger.${format === 'docx' ? 'docx' : format === 'xlsx' ? 'xlsx' : 'pdf'}`);
    showExport.value = false;
  } catch (e) { error.value = e.response?.data?.message || 'Could not export.'; }
  finally { exporting.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Accounts Receivable Sub-Ledger</h3>
      <button class="btn btn-ghost btn-sm" @click="showExport = true">⤓ Export (PDF / Word / Excel)</button>
    </div>
    <p class="text-muted">Invoice-level receivables para sa lahat ng product sales. Dapat tumugma sa GL Accounts Receivable (1050).</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="control" class="recon" :class="reconciled ? 'ok' : 'off'">
      <div><div class="recon-label">Sub-ledger total</div><div class="recon-val">{{ peso(total) }}</div></div>
      <div class="recon-eq">vs</div>
      <div><div class="recon-label">GL {{ control.code }} · {{ control.name }}</div><div class="recon-val">{{ peso(control.glBalance) }}</div></div>
      <div class="recon-badge"><span v-if="reconciled">✓ Reconciled</span><span v-else>✗ Off by {{ peso(control.diff) }}</span></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table ruled" style="min-width:1400px">
        <thead><tr>
          <th class="lbl">Customer ID</th><th class="lbl">Customer Name</th><th class="lbl">Invoice No.</th><th class="lbl">Invoice Date</th><th class="lbl">Due Date</th>
          <th class="lbl">Description</th><th>Original</th><th>Payments</th><th>Outstanding</th><th>Days Past Due</th>
          <th class="lbl">Aging</th><th class="lbl">Status</th><th class="lbl">Last Payment</th><th class="lbl">Payment Ref</th><th class="lbl">Remarks</th>
        </tr></thead>
        <tbody>
          <tr v-for="(r,i) in rows" :key="i">
            <td class="lbl">{{ r.customerId }}</td>
            <td class="lbl">{{ r.customerName }}</td>
            <td class="lbl">{{ r.invoiceNo }}</td>
            <td class="lbl">{{ r.invoiceDate ? fmtDate(r.invoiceDate) : '—' }}</td>
            <td class="lbl">{{ r.dueDate ? fmtDate(r.dueDate) : '—' }}</td>
            <td class="lbl">{{ r.description }}</td>
            <td class="num">{{ peso(r.original) }}</td>
            <td class="num">{{ r.payments ? peso(r.payments) : '' }}</td>
            <td class="num fw-semibold">{{ peso(r.outstanding) }}</td>
            <td class="num">{{ r.daysPastDue }}</td>
            <td class="lbl"><span class="badge7" :class="agingClass(r.aging)">{{ r.aging }}</span></td>
            <td class="lbl">{{ r.status }}</td>
            <td class="lbl">{{ r.lastPaymentDate ? fmtDate(r.lastPaymentDate) : '' }}</td>
            <td class="lbl">{{ r.paymentReference }}</td>
            <td class="lbl text-muted small">{{ r.remarks }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="15" class="text-center text-muted py-3">Walang receivable.</td></tr>
        </tbody>
        <tfoot v-if="rows.length"><tr class="gp"><td class="lbl" colspan="8">Total outstanding</td><td class="num fw-bold">{{ peso(total) }}</td><td colspan="6"></td></tr></tfoot>
      </table>
    </div></div>

    <ExportDialog :visible="showExport" :busy="exporting" title="Export AR Sub-Ledger"
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
