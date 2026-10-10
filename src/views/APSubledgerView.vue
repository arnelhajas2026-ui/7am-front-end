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

// Supplier drill-down
const detail = ref(null);           // { supplier, rows, totalDue, alert }
const detailLoading = ref(false);
const showExport = ref(false);
const exporting = ref(false);
const exportSupplier = ref('');     // '' = summary, else supplier id

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const reconciled = computed(() => control.value && Math.abs(control.value.diff) < 0.01);

async function load() {
  loading.value = true; error.value = '';
  try {
    const { data } = await api.get('/ledger/ap');
    rows.value = data.rows; total.value = data.total; control.value = data.control;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load AP sub-ledger.'; }
  finally { loading.value = false; }
}
async function openDetail(r) {
  detailLoading.value = true; detail.value = null;
  try {
    const { data } = await api.get('/ledger/ap-detail', { params: { supplier: r.supplierId } });
    detail.value = data;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) { error.value = e.response?.data?.message || 'Could not load supplier detail.'; }
  finally { detailLoading.value = false; }
}
function openExport(supplierId) { exportSupplier.value = supplierId || ''; showExport.value = true; }
async function onExport({ format, orientation, paper }) {
  exporting.value = true; error.value = '';
  try {
    const params = { format, orientation, paper };
    if (exportSupplier.value) params.supplier = exportSupplier.value;
    const base = exportSupplier.value ? 'ap-ledger' : 'ap-summary';
    await downloadFromApi(api, '/ledger/ap-export', params, `${base}.${format === 'docx' ? 'docx' : format === 'xlsx' ? 'xlsx' : 'pdf'}`);
    showExport.value = false;
  } catch (e) { error.value = e.response?.data?.message || 'Could not export.'; }
  finally { exporting.value = false; }
}
function alertText(a) {
  if (!a) return '';
  if (a.overdue) return `Past due (${Math.abs(a.daysLeft)} day/s) — ${fmtDate(a.date)}${a.reference ? ' · ' + a.reference : ''}`;
  return `Due in ${a.daysLeft} day/s — ${fmtDate(a.date)}${a.reference ? ' · ' + a.reference : ''}`;
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-1">
      <h3 class="mb-0">Accounts Payable Sub-Ledger</h3>
      <button class="btn btn-ghost btn-sm" @click="openExport('')">⤓ Export (PDF / Word / Excel)</button>
    </div>
    <p class="text-muted">Natitirang utang sa bawat supplier (credit purchases). Dapat tumugma sa GL Accounts Payable (2010). I-click ang supplier para sa transaction detail.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="control" class="recon" :class="reconciled ? 'ok' : 'off'">
      <div><div class="recon-label">Sub-ledger total</div><div class="recon-val">{{ peso(total) }}</div></div>
      <div class="recon-eq">vs</div>
      <div><div class="recon-label">GL {{ control.code }} · {{ control.name }}</div><div class="recon-val">{{ peso(control.glBalance) }}</div></div>
      <div class="recon-badge"><span v-if="reconciled">✓ Reconciled</span><span v-else>✗ Off by {{ peso(control.diff) }}</span></div>
    </div>

    <!-- Supplier transaction detail -->
    <div v-if="detailLoading" class="text-muted">Loading detail…</div>
    <div v-else-if="detail" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
        <div><h5 class="mb-0" style="font-family:var(--font-display)">{{ detail.supplier.name }}</h5>
          <div class="text-muted small">Total Amount Due: <strong>{{ peso(detail.totalDue) }}</strong></div></div>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="openExport(detail.supplier.id)">⤓ Export</button>
          <button class="btn btn-ghost btn-sm" @click="detail = null">Close</button>
        </div>
      </div>
      <div v-if="detail.alert" class="alert py-2" :class="detail.alert.overdue ? 'alert-danger' : 'alert-warning'">
        ⚠ <strong>Due Alert:</strong> {{ alertText(detail.alert) }}
      </div>
      <div class="card"><div class="card-body p-0" style="overflow-x:auto">
        <table class="fin-table ruled" style="min-width:980px">
          <thead><tr>
            <th class="lbl">Date Entered</th><th class="lbl">Supplier</th><th class="lbl">Reference</th>
            <th class="lbl">Date Purchased</th><th class="lbl">Date Due</th><th class="lbl">Date Paid</th>
            <th>Amount Due</th><th>Payment</th><th>Age</th><th>Balance</th>
          </tr></thead>
          <tbody>
            <tr v-for="(r,i) in detail.rows" :key="i" :class="{ 'pay-row': r.kind==='PAYMENT' }">
              <td class="lbl">{{ r.entered ? fmtDate(r.entered) : '—' }}</td>
              <td class="lbl">{{ r.supplier }}</td>
              <td class="lbl">{{ r.reference }}</td>
              <td class="lbl">{{ r.datePurchased ? fmtDate(r.datePurchased) : '—' }}</td>
              <td class="lbl">{{ r.dateDue ? fmtDate(r.dateDue) : '—' }}</td>
              <td class="lbl">{{ r.datePaid ? fmtDate(r.datePaid) : '' }}</td>
              <td class="num">{{ r.amountDue ? peso(r.amountDue) : '' }}</td>
              <td class="num">{{ r.payment ? peso(r.payment) : '' }}</td>
              <td class="num">{{ r.age == null ? '' : r.age }}</td>
              <td class="num fw-semibold">{{ peso(r.balance) }}</td>
            </tr>
            <tr v-if="!detail.rows.length"><td colspan="10" class="text-center text-muted py-3">Walang transaksyon.</td></tr>
          </tbody>
        </table>
      </div></div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:620px">
        <thead><tr><th class="lbl">Supplier</th><th>Purchases</th><th>Opening</th><th>Billed</th><th>Paid</th><th>Outstanding</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in rows" :key="i" class="click-row" @click="openDetail(r)">
            <td class="lbl"><a href="#" @click.prevent>{{ r.supplier }}</a></td>
            <td class="num">{{ r.count }}</td>
            <td class="num">{{ peso(r.opening) }}</td>
            <td class="num">{{ peso(r.billed) }}</td>
            <td class="num">{{ peso(r.paid) }}</td>
            <td class="num fw-semibold">{{ peso(r.outstanding) }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="text-center text-muted py-3">Walang outstanding na payable.</td></tr>
        </tbody>
        <tfoot v-if="rows.length"><tr class="gp"><td class="lbl" colspan="5">Total payable</td><td class="num fw-bold">{{ peso(total) }}</td></tr></tfoot>
      </table>
    </div></div>

    <ExportDialog :visible="showExport" :busy="exporting" default-orientation="portrait"
      :title="exportSupplier ? 'Export AP Detail' : 'Export AP Summary'"
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
.pay-row td { background:#F7FBF8; font-style:italic; }
</style>
