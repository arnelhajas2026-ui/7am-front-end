<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const now = new Date();
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
const items = ref([]);
const error = ref('');
const info = ref('');
const payFor = ref(null);
const payForm = ref({ referenceNo: '', evidenceNote: '', paymentDate: '', paymentMethod: 'BANK', paymentAmount: '' });

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function load() {
  error.value = '';
  try { const r = await api.get('/payroll/remittances', { params: { month: month.value } }); items.value = r.data.remittances; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load.'; }
}
async function generate() {
  error.value = ''; info.value = '';
  try { const r = await api.post('/payroll/remittances/generate', { month: month.value }); items.value = r.data.remittances; info.value = 'Na-kalkula mula sa POSTED/PAID na payroll.'; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-generate.'; }
}
function openPay(rem) { payFor.value = rem; payForm.value = { referenceNo: '', evidenceNote: '', paymentDate: '', paymentMethod: 'BANK', paymentAmount: rem.total }; }
async function pay() {
  if (!payForm.value.referenceNo || !payForm.value.evidenceNote) { error.value = 'Kailangan ng reference at evidence.'; return; }
  try { await api.post(`/payroll/remittances/${payFor.value._id}/pay`, payForm.value); payFor.value = null; await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-mark paid.'; }
}
async function unpay(rem) { if (!confirm('I-reverse ang remittance payment?')) return; try { await api.post(`/payroll/remittances/${rem._id}/unpay`); await load(); } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-reverse.'; } }
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Statutory Remittances</h3>
    <p class="text-muted">SSS / PhilHealth / Pag-IBIG / BIR payables. Kailangan ng reference + evidence bago PAID.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="info" class="alert alert-info py-2">{{ info }}</div>

    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-auto"><label class="form-label small">Month</label><input v-model="month" type="month" class="form-control form-control-sm" /></div>
        <div class="col-auto"><button class="btn btn-ink btn-sm" @click="load">Load</button></div>
        <div class="col-auto"><button class="btn btn-primary btn-sm" @click="generate">Generate / refresh</button></div>
      </div>
    </div></div>

    <div class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr><th>Agency</th><th class="text-end">Employee</th><th class="text-end">Employer</th><th class="text-end">Total</th><th>Status</th><th>Reference</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in items" :key="r._id">
            <td class="fw-semibold">{{ r.agency }}</td>
            <td class="text-end small">{{ peso(r.employeeShare) }}</td>
            <td class="text-end small">{{ peso(r.employerShare) }}</td>
            <td class="text-end small fw-semibold">{{ peso(r.total) }}</td>
            <td><span class="badge" :class="r.status==='PAID' ? 'bg-success' : 'bg-warning text-dark'">{{ r.status }}</span><span v-if="r.journalRef" class="badge bg-secondary ms-1">JV {{ r.journalRef }}</span></td>
            <td class="small text-muted">{{ r.referenceNo || '—' }}</td>
            <td class="text-end">
              <button v-if="r.status!=='PAID' && r.total>0 && isOwner" class="btn btn-primary btn-sm" @click="openPay(r)">Mark paid</button>
              <button v-if="r.status==='PAID' && isOwner" class="btn btn-ghost btn-sm" @click="unpay(r)">Reverse</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="7" class="text-muted text-center py-3">Walang remittance. I-generate.</td></tr>
        </tbody>
      </table>
    </div></div>

    <div v-if="payFor" class="card mt-3 border-primary"><div class="card-body">
      <div class="d-flex justify-content-between"><p class="section-eyebrow mb-2">Mark paid — {{ payFor.agency }} {{ payFor.month }} ({{ peso(payFor.total) }})</p><button class="btn btn-ghost btn-sm" @click="payFor=null">✕</button></div>
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label">Reference no.</label><input v-model="payForm.referenceNo" class="form-control" placeholder="PRN / payment ref" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Payment date</label><input v-model="payForm.paymentDate" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Method</label><input v-model="payForm.paymentMethod" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Amount paid</label><input v-model="payForm.paymentAmount" type="number" class="form-control" /></div>
        <div class="col-12"><label class="form-label">Evidence (OR / confirmation)</label><input v-model="payForm.evidenceNote" class="form-control" placeholder="OR number o confirmation reference" /></div>
      </div>
      <p class="text-muted small mt-2">Magpo-post ng clearing JE: Dr {{ payFor.agency }} Payable / Cr Cash in Bank.</p>
      <button class="btn btn-primary" @click="pay">Confirm paid</button>
    </div></div>
  </div>
</template>
