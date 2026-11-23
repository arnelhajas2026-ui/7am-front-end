<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const employees = ref([]);
const loans = ref([]);
const error = ref('');
const filters = ref({ employee: '', status: '' });
const showForm = ref(false);
const blankForm = () => ({ employee: '', loanType: 'CASH_ADVANCE', principal: '', installment: '', deductEveryPeriod: true, deductionStartDate: '', deductionEndDate: '', reason: '' });
const form = ref(blankForm());

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const empName = (e) => e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : '—';
const LOAN_TYPES = ['CASH_ADVANCE', 'SSS_LOAN', 'PAGIBIG_LOAN', 'COMPANY_LOAN', 'OTHER'];

async function loadEmployees() { try { const { data } = await api.get('/payroll/employees'); employees.value = data.employees; } catch { /* ignore */ } }
async function load() {
  error.value = '';
  try { const { data } = await api.get('/payroll/loans', { params: filters.value }); loans.value = data.loans; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang loans.'; }
}
async function save() {
  if (!form.value.employee || !form.value.principal || !form.value.installment) { error.value = 'Kailangan ng employee, principal, at installment.'; return; }
  try { await api.post('/payroll/loans', form.value); showForm.value = false; form.value = blankForm(); await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-save.'; }
}
async function approve(l) { try { await api.post(`/payroll/loans/${l._id}/approve`); await load(); } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-approve.'; } }
async function setStatus(l, status) { try { await api.post(`/payroll/loans/${l._id}/status`, { status }); await load(); } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-update.'; } }
onMounted(async () => { await loadEmployees(); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Loans & Advances</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? (showForm = false) : (showForm = true)">{{ showForm ? 'Close' : '+ New loan' }}</button>
    </div>
    <p class="text-muted">Awtomatikong binabawas ang installment tuwing payroll (hindi lalampas sa balance).</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-3"><div class="card-body">
      <p class="section-eyebrow mb-3">New loan / advance</p>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label">Employee</label>
          <select v-model="form.employee" class="form-select"><option value="">—</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }} ({{ e.employeeNumber }})</option></select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label">Type</label>
          <select v-model="form.loanType" class="form-select"><option v-for="t in LOAN_TYPES" :key="t" :value="t">{{ t }}</option></select>
        </div>
        <div class="col-6 col-md-2"><label class="form-label">Principal</label><input v-model="form.principal" type="number" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Installment / period</label><input v-model="form.installment" type="number" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Start date</label><input v-model="form.deductionStartDate" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">End date</label><input v-model="form.deductionEndDate" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3 d-flex align-items-end"><div class="form-check"><input v-model="form.deductEveryPeriod" class="form-check-input" type="checkbox" id="every" /><label class="form-check-label" for="every">Bawas kada period</label></div></div>
        <div class="col-12"><label class="form-label">Reason / reference</label><input v-model="form.reason" class="form-control" /></div>
      </div>
      <div class="mt-3"><button class="btn btn-primary" @click="save">{{ isOwner ? 'Create & approve' : 'Submit' }}</button></div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3"><label class="form-label small">Employee</label>
          <select v-model="filters.employee" class="form-select form-select-sm"><option value="">All</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }}</option></select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label small">Status</label>
          <select v-model="filters.status" class="form-select form-select-sm"><option value="">All</option><option value="PENDING_APPROVAL">Pending</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option></select>
        </div>
        <div class="col-auto"><button class="btn btn-ink btn-sm" @click="load">Filter</button></div>
      </div>
    </div></div>

    <div class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr><th>Loan</th><th>Employee</th><th>Type</th><th class="text-end">Principal</th><th class="text-end">Installment</th><th class="text-end">Outstanding</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="l in loans" :key="l._id">
            <td class="small fw-semibold">{{ l.loanCode }}</td>
            <td class="small">{{ empName(l.employee) }} <span class="text-muted">{{ l.employeeNumber }}</span></td>
            <td class="small">{{ l.loanType }}</td>
            <td class="text-end small">{{ peso(l.principal) }}</td>
            <td class="text-end small">{{ peso(l.installment) }}</td>
            <td class="text-end small fw-semibold">{{ peso(l.outstanding) }}</td>
            <td><span class="badge" :class="l.status==='ACTIVE' ? 'bg-success' : (l.status==='PENDING_APPROVAL' ? 'bg-warning text-dark' : 'bg-secondary')">{{ l.status }}</span></td>
            <td class="text-end text-nowrap">
              <button v-if="l.status==='PENDING_APPROVAL' && isOwner" class="btn btn-primary btn-sm" @click="approve(l)">Approve</button>
              <button v-if="l.status==='ACTIVE'" class="btn btn-ghost btn-sm" @click="setStatus(l,'ON_HOLD')">Hold</button>
              <button v-if="l.status==='ON_HOLD'" class="btn btn-ghost btn-sm" @click="setStatus(l,'ACTIVE')">Resume</button>
            </td>
          </tr>
          <tr v-if="!loans.length"><td colspan="8" class="text-muted text-center py-3">Walang loan.</td></tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>
