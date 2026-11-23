<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const employees = ref([]);
const leaves = ref([]);
const leaveTypes = ref([]);
const loading = ref(false);
const error = ref('');

const filters = ref({ employee: '', status: '' });
const todayKey = new Date().toISOString().slice(0, 10);
const blankForm = () => ({ employee: '', leaveType: 'VL', paid: true, dateFrom: todayKey, dateTo: todayKey, halfDay: false, reason: '' });
const form = ref(blankForm());
const showForm = ref(false);

const empName = (e) => e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : '—';
const typeLabel = (code) => leaveTypes.value.find((l) => l.code === code)?.label || code;

async function loadEmployees() { try { const { data } = await api.get('/payroll/employees'); employees.value = data.employees; } catch { /* ignore */ } }
async function loadMeta() { try { const { data } = await api.get('/payroll/attendance/meta'); leaveTypes.value = data.leaveTypes || []; } catch { /* ignore */ } }
async function load() {
  loading.value = true; error.value = '';
  try { const { data } = await api.get('/payroll/leaves', { params: filters.value }); leaves.value = data.leaves; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang leaves.'; }
  finally { loading.value = false; }
}
function onTypeChange() { const t = leaveTypes.value.find((l) => l.code === form.value.leaveType); if (t) form.value.paid = t.paid; }
async function save() {
  if (!form.value.employee) { error.value = 'Pumili ng empleyado.'; return; }
  error.value = '';
  try { await api.post('/payroll/leaves', form.value); showForm.value = false; form.value = blankForm(); await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-save.'; }
}
async function approve(l) { try { await api.post(`/payroll/leaves/${l._id}/approve`); await load(); } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-approve.'; } }
async function reject(l) { const reason = prompt('Dahilan ng rejection?') || ''; try { await api.post(`/payroll/leaves/${l._id}/reject`, { reason }); await load(); } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-reject.'; } }

onMounted(async () => { await Promise.all([loadEmployees(), loadMeta()]); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Leaves</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? (showForm = false) : (showForm = true)">{{ showForm ? 'Close' : '+ File leave' }}</button>
    </div>
    <p class="text-muted">Leave applications — pag approved, awtomatikong nababanggit sa attendance.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-3"><div class="card-body">
      <p class="section-eyebrow mb-3">File leave</p>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label">Employee</label>
          <select v-model="form.employee" class="form-select"><option value="">—</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }} ({{ e.employeeNumber }})</option></select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label">Leave type</label>
          <select v-model="form.leaveType" class="form-select" @change="onTypeChange"><option v-for="l in leaveTypes" :key="l.code" :value="l.code">{{ l.label }}</option></select>
        </div>
        <div class="col-6 col-md-2 d-flex align-items-end"><div class="form-check"><input v-model="form.paid" class="form-check-input" type="checkbox" id="paid" /><label class="form-check-label" for="paid">Paid</label></div></div>
        <div class="col-6 col-md-2"><label class="form-label">From</label><input v-model="form.dateFrom" type="date" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">To</label><input v-model="form.dateTo" type="date" class="form-control" /></div>
        <div class="col-6 col-md-2 d-flex align-items-end"><div class="form-check"><input v-model="form.halfDay" class="form-check-input" type="checkbox" id="half" /><label class="form-check-label" for="half">Half day</label></div></div>
        <div class="col-12"><label class="form-label">Reason</label><input v-model="form.reason" class="form-control" /></div>
      </div>
      <div class="mt-3"><button class="btn btn-primary" @click="save">{{ isOwner ? 'File & approve' : 'Submit' }}</button></div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3"><label class="form-label small">Employee</label>
          <select v-model="filters.employee" class="form-select form-select-sm"><option value="">All</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }}</option></select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label small">Status</label>
          <select v-model="filters.status" class="form-select form-select-sm"><option value="">All</option><option value="PENDING_APPROVAL">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select>
        </div>
        <div class="col-auto"><button class="btn btn-ink btn-sm" @click="load">Filter</button></div>
      </div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!leaves.length" class="card"><div class="card-body text-muted text-center py-4">Walang leave record.</div></div>
    <div v-else class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th class="text-end">Days</th><th>Paid</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="l in leaves" :key="l._id">
            <td class="small">{{ empName(l.employee) }} <span class="text-muted">{{ l.employeeNumber }}</span></td>
            <td class="small">{{ typeLabel(l.leaveType) }}</td>
            <td class="small">{{ l.dateFrom ? l.dateFrom.slice(0,10) : '—' }}</td>
            <td class="small">{{ l.dateTo ? l.dateTo.slice(0,10) : '—' }}</td>
            <td class="text-end small">{{ l.days }}</td>
            <td class="small">{{ l.paid ? '✓' : '—' }}</td>
            <td><span class="badge" :class="l.status==='APPROVED' ? 'bg-success' : (l.status==='PENDING_APPROVAL' ? 'bg-warning text-dark' : 'bg-secondary')">{{ l.status }}</span></td>
            <td class="text-end text-nowrap">
              <template v-if="l.status==='PENDING_APPROVAL' && isOwner">
                <button class="btn btn-primary btn-sm" @click="approve(l)">Approve</button>
                <button class="btn btn-ghost btn-sm" @click="reject(l)">Reject</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>
