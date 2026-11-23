<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const employees = ref([]);
const records = ref([]);
const meta = ref({ holidayTypes: ['NONE'], leaveTypes: [] });
const loading = ref(false);
const error = ref('');
const info = ref('');

const todayKey = new Date().toISOString().slice(0, 10);
const filters = ref({ employee: '', department: '', dateFrom: todayKey, dateTo: todayKey, approvalStatus: '' });
const genDate = ref(todayKey);
const selected = ref({});

const blankForm = () => ({ employee: '', date: todayKey, timeIn: '', timeOut: '', breakMinutes: '', restDay: false, holidayType: 'NONE', leaveType: '', approvedOvertimeHours: '', note: '' });
const form = ref(blankForm());
const showForm = ref(false);

// adjustment
const adjFor = ref(null);
const adjForm = ref({ timeIn: '', timeOut: '', breakMinutes: '', holidayType: '', leaveType: '', approvedOvertimeHours: '', reason: '' });

const empName = (e) => e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : '—';
const selectedIds = computed(() => Object.keys(selected.value).filter((k) => selected.value[k]));

async function loadEmployees() {
  try { const { data } = await api.get('/payroll/employees'); employees.value = data.employees; } catch { /* ignore */ }
}
async function loadMeta() {
  try { const { data } = await api.get('/payroll/attendance/meta'); meta.value = data; } catch { /* ignore */ }
}
async function load() {
  loading.value = true; error.value = ''; selected.value = {};
  try {
    const { data } = await api.get('/payroll/attendance', { params: filters.value });
    records.value = data.records;
  } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang attendance.'; }
  finally { loading.value = false; }
}

function newEntry() { form.value = blankForm(); form.value.date = filters.value.dateFrom; showForm.value = true; }
function editEntry(r) {
  form.value = { employee: r.employee?._id || r.employee, date: r.dateKey, timeIn: r.timeIn, timeOut: r.timeOut,
    breakMinutes: r.breakMinutes ?? '', restDay: r.restDay, holidayType: r.holidayType, leaveType: r.leaveType,
    approvedOvertimeHours: r.overtimeHours || '', note: r.note || '' };
  showForm.value = true;
}
async function save() {
  if (!form.value.employee) { error.value = 'Pumili ng empleyado.'; return; }
  error.value = '';
  try { await api.post('/payroll/attendance', form.value); showForm.value = false; await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-save.'; }
}
async function generate() {
  info.value = ''; error.value = '';
  try {
    const { data } = await api.post('/payroll/attendance/bulk-generate', { date: genDate.value, department: filters.value.department || undefined });
    info.value = `Nakagawa ng ${data.created} record (${data.skipped} na-skip).`;
    filters.value.dateFrom = genDate.value; filters.value.dateTo = genDate.value; await load();
  } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-generate.'; }
}
async function approveRow(r) {
  try { await api.post(`/payroll/attendance/${r._id}/approve`); await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-approve.'; }
}
async function approveSelected() {
  if (!selectedIds.value.length) return;
  try { const { data } = await api.post('/payroll/attendance/bulk-approve', { ids: selectedIds.value }); info.value = `Na-approve: ${data.approved}.`; await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-approve.'; }
}

function openAdjust(r) {
  adjFor.value = r;
  adjForm.value = { timeIn: r.timeIn, timeOut: r.timeOut, breakMinutes: r.breakMinutes ?? '', holidayType: r.holidayType, leaveType: r.leaveType, approvedOvertimeHours: r.overtimeHours || '', reason: '' };
}
async function submitAdjust() {
  if (!adjForm.value.reason.trim()) { error.value = 'Kailangan ng dahilan ang adjustment.'; return; }
  const proposed = {
    timeIn: adjForm.value.timeIn, timeOut: adjForm.value.timeOut,
    breakMinutes: adjForm.value.breakMinutes === '' ? undefined : Number(adjForm.value.breakMinutes),
    holidayType: adjForm.value.holidayType, leaveType: adjForm.value.leaveType,
    approvedOvertimeHours: adjForm.value.approvedOvertimeHours === '' ? undefined : Number(adjForm.value.approvedOvertimeHours),
  };
  try { await api.post(`/payroll/attendance/${adjFor.value._id}/adjustments`, { proposed, reason: adjForm.value.reason }); adjFor.value = null; await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-save ang adjustment.'; }
}

onMounted(async () => { await Promise.all([loadEmployees(), loadMeta()]); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Attendance</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? (showForm = false) : newEntry()">{{ showForm ? 'Close' : '+ Encode' }}</button>
    </div>
    <p class="text-muted">Daily timekeeping — regular, overtime, late/undertime vs schedule.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="info" class="alert alert-info py-2">{{ info }}</div>

    <!-- Filters -->
    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3"><label class="form-label small">Employee</label>
          <select v-model="filters.employee" class="form-select form-select-sm"><option value="">All</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }}</option></select>
        </div>
        <div class="col-6 col-md-2"><label class="form-label small">Department</label><input v-model="filters.department" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-2"><label class="form-label small">From</label><input v-model="filters.dateFrom" type="date" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-2"><label class="form-label small">To</label><input v-model="filters.dateTo" type="date" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-2"><label class="form-label small">Status</label>
          <select v-model="filters.approvalStatus" class="form-select form-select-sm"><option value="">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option></select>
        </div>
        <div class="col-6 col-md-1"><button class="btn btn-ink btn-sm w-100" @click="load">Filter</button></div>
      </div>
      <hr class="my-2" />
      <div class="row g-2 align-items-end">
        <div class="col-auto"><label class="form-label small">Generate rows para sa petsa</label><input v-model="genDate" type="date" class="form-control form-control-sm" /></div>
        <div class="col-auto"><button class="btn btn-ghost btn-sm" @click="generate">⚡ Generate (active employees)</button></div>
        <div class="col-auto ms-auto"><button class="btn btn-primary btn-sm" :disabled="!selectedIds.length" @click="approveSelected">Approve selected ({{ selectedIds.length }})</button></div>
      </div>
    </div></div>

    <!-- Encode form -->
    <div v-if="showForm" class="card mb-3"><div class="card-body">
      <p class="section-eyebrow mb-3">Encode attendance</p>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label">Employee</label>
          <select v-model="form.employee" class="form-select"><option value="">—</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }} ({{ e.employeeNumber }})</option></select>
        </div>
        <div class="col-6 col-md-2"><label class="form-label">Date</label><input v-model="form.date" type="date" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Time In</label><input v-model="form.timeIn" type="time" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Time Out</label><input v-model="form.timeOut" type="time" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Break (min)</label><input v-model="form.breakMinutes" type="number" class="form-control" placeholder="60" /></div>

        <div class="col-6 col-md-3"><label class="form-label">Holiday type</label>
          <select v-model="form.holidayType" class="form-select"><option v-for="h in meta.holidayTypes" :key="h" :value="h">{{ h }}</option></select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label">Leave type</label>
          <select v-model="form.leaveType" class="form-select"><option value="">—</option><option v-for="l in meta.leaveTypes" :key="l.code" :value="l.code">{{ l.label }}</option></select>
        </div>
        <div class="col-6 col-md-2"><label class="form-label">Approved OT (hrs)</label><input v-model="form.approvedOvertimeHours" type="number" step="0.25" class="form-control" /></div>
        <div class="col-6 col-md-2 d-flex align-items-end"><div class="form-check"><input v-model="form.restDay" class="form-check-input" type="checkbox" id="rd" /><label class="form-check-label" for="rd">Rest day</label></div></div>
        <div class="col-12 col-md-2"><label class="form-label">Note</label><input v-model="form.note" class="form-control" /></div>
      </div>
      <div class="mt-3"><button class="btn btn-primary" @click="save">Save attendance</button></div>
    </div></div>

    <!-- Table -->
    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!records.length" class="card"><div class="card-body text-muted text-center py-4">Walang record sa filter na ito.</div></div>
    <div v-else class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr>
          <th style="width:28px"></th><th>Employee</th><th>Date</th><th>In</th><th>Out</th>
          <th class="text-end">Reg</th><th class="text-end">OT</th><th class="text-end">Late</th><th>Day</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          <tr v-for="r in records" :key="r._id">
            <td><input v-if="r.approvalStatus==='PENDING' && !r.locked" type="checkbox" v-model="selected[r._id]" /></td>
            <td class="small">{{ empName(r.employee) }} <span class="text-muted">{{ r.employeeNumber }}</span></td>
            <td class="small">{{ r.dateKey }}</td>
            <td class="small">{{ r.timeIn || '—' }}</td>
            <td class="small">{{ r.timeOut || '—' }}</td>
            <td class="text-end small">{{ r.regularHours }}</td>
            <td class="text-end small">{{ r.overtimeHours }}</td>
            <td class="text-end small"><span :class="r.lateMinutes ? 'text-danger' : 'text-muted'">{{ r.lateMinutes }}m</span></td>
            <td class="small">
              <span v-if="r.isAbsent" class="badge bg-danger">ABSENT</span>
              <span v-else-if="r.leaveType" class="badge bg-info text-dark">{{ r.leaveType }}</span>
              <span v-else-if="r.dayType!=='ORDINARY'" class="badge bg-warning text-dark">{{ r.dayType }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td><span class="badge" :class="r.locked ? 'bg-secondary' : (r.approvalStatus==='APPROVED' ? 'bg-success' : 'bg-warning text-dark')">{{ r.locked ? 'LOCKED' : r.approvalStatus }}</span></td>
            <td class="text-end text-nowrap">
              <button v-if="r.approvalStatus==='PENDING' && !r.locked" class="btn btn-ghost btn-sm" @click="editEntry(r)">Edit</button>
              <button v-if="r.approvalStatus==='PENDING' && !r.locked" class="btn btn-primary btn-sm" @click="approveRow(r)">Approve</button>
              <button v-if="r.approvalStatus==='APPROVED' && !r.locked" class="btn btn-ghost btn-sm" @click="openAdjust(r)">Adjust</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div></div>

    <!-- Adjustment modal -->
    <div v-if="adjFor" class="card mt-3 border-warning"><div class="card-body">
      <div class="d-flex justify-content-between"><p class="section-eyebrow mb-3">Attendance adjustment — {{ empName(adjFor.employee) }} · {{ adjFor.dateKey }}</p><button class="btn btn-ghost btn-sm" @click="adjFor=null">✕</button></div>
      <p class="text-muted small">{{ isOwner ? 'Owner ka — ia-apply agad.' : 'Isa-submit para sa owner approval.' }}</p>
      <div class="row g-2">
        <div class="col-6 col-md-2"><label class="form-label">Time In</label><input v-model="adjForm.timeIn" type="time" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Time Out</label><input v-model="adjForm.timeOut" type="time" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Break (min)</label><input v-model="adjForm.breakMinutes" type="number" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Holiday</label>
          <select v-model="adjForm.holidayType" class="form-select"><option v-for="h in meta.holidayTypes" :key="h" :value="h">{{ h }}</option></select>
        </div>
        <div class="col-6 col-md-3"><label class="form-label">Approved OT (hrs)</label><input v-model="adjForm.approvedOvertimeHours" type="number" step="0.25" class="form-control" /></div>
        <div class="col-12"><label class="form-label">Reason</label><input v-model="adjForm.reason" class="form-control" placeholder="Dahilan ng pagbabago" /></div>
      </div>
      <div class="mt-3"><button class="btn btn-primary" @click="submitAdjust">{{ isOwner ? 'Apply adjustment' : 'Submit for approval' }}</button></div>
    </div></div>
  </div>
</template>
