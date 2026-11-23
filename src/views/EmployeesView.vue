<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const items = ref([]);
const schedules = ref([]);
const meta = ref({ employmentTypes: [], employmentStatuses: [], payrollStatuses: [], taxStatuses: [], payrollFrequencies: [] });
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

// detail panel
const selected = ref(null);
const history = ref([]);
const revealed = ref(null);

const blankForm = () => ({
  id: null, employeeNumber: '', firstName: '', middleName: '', lastName: '',
  birthDate: '', contactNumber: '', residentialAddress: '',
  dateHired: '', employmentType: 'PROBATIONARY', employmentStatus: 'ACTIVE', payrollStatus: 'ACTIVE',
  department: '', position: '', immediateSupervisor: '', workLocation: '', costCenterCode: '',
  scheduleId: '',
  government: { sssNo: '', philhealthNo: '', pagibigMid: '', tin: '', taxStatus: 'S', statutoryRegistrationStatus: 'REGISTERED' },
  monthlyBasicSalary: '', payrollFrequency: 'SEMI_MONTHLY', compEffectiveDate: '',
});
const form = ref(blankForm());

// compensation form (sa detail panel)
const compForm = ref({ monthlyBasicSalary: '', effectiveDate: '', payrollFrequency: 'SEMI_MONTHLY', scheduleId: '', note: '' });

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function initials(e) { return ((e.firstName || '?').charAt(0) + (e.lastName || '').charAt(0)).toUpperCase(); }
function statusBadge(e) {
  if (e.approvalStatus === 'PENDING_APPROVAL') return { cls: 'bg-warning text-dark', label: 'PENDING APPROVAL' };
  if (e.approvalStatus === 'REJECTED') return { cls: 'bg-danger', label: 'REJECTED' };
  if (!e.active) return { cls: 'bg-secondary', label: 'INACTIVE' };
  if (e.payrollStatus === 'SEPARATED') return { cls: 'bg-secondary', label: 'SEPARATED' };
  if (e.payrollStatus === 'HOLD') return { cls: 'bg-warning text-dark', label: 'ON HOLD' };
  return { cls: 'bg-success', label: 'ACTIVE' };
}

async function load() {
  loading.value = true; error.value = '';
  try {
    const [e, s, m] = await Promise.all([
      api.get('/payroll/employees'),
      api.get('/payroll/employees/schedules'),
      api.get('/payroll/employees/meta'),
    ]);
    items.value = e.data.employees;
    schedules.value = s.data.schedules;
    meta.value = m.data;
  } catch (err) { error.value = err.response?.data?.message || 'Hindi ma-load ang empleyado.'; }
  finally { loading.value = false; }
}

function newEmployee() { form.value = blankForm(); showForm.value = true; }
function editEmployee(e) {
  form.value = {
    id: e._id, employeeNumber: e.employeeNumber,
    firstName: e.firstName, middleName: e.middleName || '', lastName: e.lastName,
    birthDate: e.birthDate ? e.birthDate.slice(0, 10) : '', contactNumber: e.contactNumber || '',
    residentialAddress: e.residentialAddress || '', dateHired: e.dateHired ? e.dateHired.slice(0, 10) : '',
    employmentType: e.employmentType, employmentStatus: e.employmentStatus, payrollStatus: e.payrollStatus,
    department: e.department || '', position: e.position || '', immediateSupervisor: e.immediateSupervisor || '',
    workLocation: e.workLocation || '', costCenterCode: e.costCenterCode || '',
    scheduleId: e.schedule?._id || e.schedule || '',
    government: { sssNo: '', philhealthNo: '', pagibigMid: '', tin: '', taxStatus: e.government?.taxStatus || 'S', statutoryRegistrationStatus: e.government?.statutoryRegistrationStatus || 'REGISTERED' },
    monthlyBasicSalary: '', payrollFrequency: 'SEMI_MONTHLY', compEffectiveDate: '',
  };
  showForm.value = true;
}

async function save() {
  if (!form.value.firstName || !form.value.lastName) { error.value = 'Kailangan ng first at last name.'; return; }
  saving.value = true; error.value = '';
  try {
    if (form.value.id) await api.put(`/payroll/employees/${form.value.id}`, form.value);
    else await api.post('/payroll/employees', form.value);
    showForm.value = false; form.value = blankForm();
    await load();
  } catch (err) { error.value = err.response?.data?.message || 'Hindi ma-save.'; }
  finally { saving.value = false; }
}

async function openDetail(e) {
  revealed.value = null;
  try {
    const { data } = await api.get(`/payroll/employees/${e._id}`);
    selected.value = data.employee; history.value = data.compensationHistory;
    compForm.value = { monthlyBasicSalary: '', effectiveDate: '', payrollFrequency: 'SEMI_MONTHLY', scheduleId: selected.value.schedule?._id || '', note: '' };
  } catch (err) { error.value = err.response?.data?.message || 'Hindi ma-load ang detalye.'; }
}
function closeDetail() { selected.value = null; history.value = []; revealed.value = null; }

async function approveEmp() {
  try { await api.post(`/payroll/employees/${selected.value._id}/approve`); await openDetail(selected.value); await load(); }
  catch (err) { error.value = err.response?.data?.message || 'Hindi ma-approve.'; }
}
async function rejectEmp() {
  const reason = prompt('Dahilan ng rejection?') || '';
  try { await api.post(`/payroll/employees/${selected.value._id}/reject`, { reason }); await openDetail(selected.value); await load(); }
  catch (err) { error.value = err.response?.data?.message || 'Hindi ma-reject.'; }
}
async function revealGov() {
  try { const { data } = await api.get(`/payroll/employees/${selected.value._id}/government`); revealed.value = data.government; }
  catch (err) { error.value = err.response?.data?.message || 'Hindi ma-reveal.'; }
}
async function addComp() {
  if (!compForm.value.monthlyBasicSalary) { error.value = 'Kailangan ng monthly basic salary.'; return; }
  try {
    await api.post(`/payroll/employees/${selected.value._id}/compensation`, compForm.value);
    await openDetail(selected.value); await load();
  } catch (err) { error.value = err.response?.data?.message || 'Hindi ma-save ang compensation.'; }
}
async function approveComp(c) {
  try { await api.post(`/payroll/employees/${selected.value._id}/compensation/${c._id}/approve`); await openDetail(selected.value); await load(); }
  catch (err) { error.value = err.response?.data?.message || 'Hindi ma-approve.'; }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Employees</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? (showForm = false) : newEmployee()">
        {{ showForm ? 'Close' : '+ New employee' }}
      </button>
    </div>
    <p class="text-muted">Employee Master File — compensation, government IDs, at payroll status.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- FORM -->
    <div v-if="showForm" class="card mb-4">
      <div class="card-body">
        <p class="section-eyebrow mb-3">{{ form.id ? 'Edit employee' : 'New employee' }}</p>
        <div class="row g-2">
          <div class="col-6 col-md-3"><label class="form-label">Employee No. <span class="text-muted small">(auto kung blangko)</span></label><input v-model="form.employeeNumber" class="form-control" :disabled="!!form.id" placeholder="EMP-0001" /></div>
          <div class="col-6 col-md-3"><label class="form-label">First name</label><input v-model="form.firstName" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Middle name</label><input v-model="form.middleName" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Last name</label><input v-model="form.lastName" class="form-control" /></div>

          <div class="col-6 col-md-3"><label class="form-label">Birth date</label><input v-model="form.birthDate" type="date" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Contact number</label><input v-model="form.contactNumber" class="form-control" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Residential address</label><input v-model="form.residentialAddress" class="form-control" /></div>

          <div class="col-6 col-md-3"><label class="form-label">Date hired</label><input v-model="form.dateHired" type="date" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Employment type</label>
            <select v-model="form.employmentType" class="form-select"><option v-for="t in meta.employmentTypes" :key="t" :value="t">{{ t }}</option></select>
          </div>
          <div class="col-6 col-md-3"><label class="form-label">Employment status</label>
            <select v-model="form.employmentStatus" class="form-select"><option v-for="t in meta.employmentStatuses" :key="t" :value="t">{{ t }}</option></select>
          </div>
          <div class="col-6 col-md-3"><label class="form-label">Payroll status</label>
            <select v-model="form.payrollStatus" class="form-select"><option v-for="t in meta.payrollStatuses" :key="t" :value="t">{{ t }}</option></select>
          </div>

          <div class="col-6 col-md-3"><label class="form-label">Department</label><input v-model="form.department" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Position</label><input v-model="form.position" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Supervisor</label><input v-model="form.immediateSupervisor" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Work location</label><input v-model="form.workLocation" class="form-control" /></div>

          <div class="col-6 col-md-3"><label class="form-label">Cost center code <span class="text-muted small">(GL)</span></label><input v-model="form.costCenterCode" class="form-control" placeholder="CC-002" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Schedule</label>
            <select v-model="form.scheduleId" class="form-select"><option value="">—</option><option v-for="s in schedules" :key="s._id" :value="s._id">{{ s.name }}</option></select>
          </div>
        </div>

        <p class="section-eyebrow mt-4 mb-2">Government IDs <span class="text-muted small">(naka-encrypt; iwan blangko kung walang babaguhin)</span></p>
        <div class="row g-2">
          <div class="col-6 col-md-3"><label class="form-label">SSS No.</label><input v-model="form.government.sssNo" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">PhilHealth No.</label><input v-model="form.government.philhealthNo" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Pag-IBIG MID</label><input v-model="form.government.pagibigMid" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">TIN</label><input v-model="form.government.tin" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Tax status</label>
            <select v-model="form.government.taxStatus" class="form-select"><option v-for="t in meta.taxStatuses" :key="t" :value="t">{{ t }}</option></select>
          </div>
        </div>

        <template v-if="!form.id">
          <p class="section-eyebrow mt-4 mb-2">Initial compensation <span class="text-muted small">(opsyonal)</span></p>
          <div class="row g-2">
            <div class="col-6 col-md-3"><label class="form-label">Monthly basic salary</label><input v-model="form.monthlyBasicSalary" type="number" class="form-control" placeholder="15000" /></div>
            <div class="col-6 col-md-3"><label class="form-label">Frequency</label>
              <select v-model="form.payrollFrequency" class="form-select"><option v-for="f in meta.payrollFrequencies" :key="f" :value="f">{{ f }}</option></select>
            </div>
            <div class="col-6 col-md-3"><label class="form-label">Effective date</label><input v-model="form.compEffectiveDate" type="date" class="form-control" /></div>
          </div>
          <p class="text-muted small mt-1">Auto-derive ang daily/hourly rate mula sa schedule divisor.</p>
        </template>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create employee') }}</button>
          <span v-if="!form.id && !isOwner" class="text-muted small align-self-center">Isa-submit for owner approval.</span>
        </div>
      </div>
    </div>

    <!-- LIST -->
    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length" class="card"><div class="card-body text-muted text-center py-4">Wala pang empleyado. Magdagdag ng una.</div></div>

    <div v-for="e in items" :key="e._id" class="card mb-2">
      <div class="card-body d-flex align-items-center gap-3">
        <div class="avatar">{{ initials(e) }}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold" style="font-family:var(--font-display)">{{ e.fullName }}
            <span class="text-muted small ms-1">{{ e.employeeNumber }}</span>
            <span class="badge ms-1" :class="statusBadge(e).cls">{{ statusBadge(e).label }}</span>
          </div>
          <div class="text-muted small">
            {{ e.employmentType }}<span v-if="e.position"> · {{ e.position }}</span><span v-if="e.department"> · {{ e.department }}</span>
            <span v-if="e.currentCompensation?.monthlyBasicSalary"> · {{ peso(e.currentCompensation.monthlyBasicSalary) }}/mo</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="openDetail(e)">Details</button>
        <button class="btn btn-ghost btn-sm" @click="editEmployee(e)">Edit</button>
      </div>
    </div>

    <!-- DETAIL PANEL -->
    <div v-if="selected" class="card mt-3 border-primary">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h5 class="mb-0">{{ selected.fullName }} <span class="text-muted small">{{ selected.employeeNumber }}</span></h5>
            <div class="text-muted small">{{ selected.employmentType }} · {{ selected.position || '—' }} · {{ selected.department || '—' }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="closeDetail">✕ Close</button>
        </div>

        <div v-if="selected.approvalStatus === 'PENDING_APPROVAL' && isOwner" class="alert alert-warning py-2 mt-3 d-flex justify-content-between align-items-center">
          <span>Naghihintay ng owner approval ang record na ito.</span>
          <span class="d-flex gap-2"><button class="btn btn-sm btn-primary" @click="approveEmp">Approve</button><button class="btn btn-sm btn-ghost" @click="rejectEmp">Reject</button></span>
        </div>

        <!-- Government IDs -->
        <p class="section-eyebrow mt-3 mb-2">Government IDs</p>
        <div class="row small">
          <div class="col-6 col-md-3">SSS: <span class="fw-semibold">{{ revealed ? revealed.sssNo || '—' : selected.government.sssNo || '—' }}</span></div>
          <div class="col-6 col-md-3">PhilHealth: <span class="fw-semibold">{{ revealed ? revealed.philhealthNo || '—' : selected.government.philhealthNo || '—' }}</span></div>
          <div class="col-6 col-md-3">Pag-IBIG: <span class="fw-semibold">{{ revealed ? revealed.pagibigMid || '—' : selected.government.pagibigMid || '—' }}</span></div>
          <div class="col-6 col-md-3">TIN: <span class="fw-semibold">{{ revealed ? revealed.tin || '—' : selected.government.tin || '—' }}</span></div>
        </div>
        <button v-if="isOwner && !revealed" class="btn btn-ghost btn-sm mt-2" @click="revealGov">🔓 Reveal full numbers</button>

        <!-- Compensation history -->
        <p class="section-eyebrow mt-4 mb-2">Compensation history</p>
        <table class="table table-sm">
          <thead><tr><th>Effective</th><th class="text-end">Monthly basic</th><th class="text-end">Daily</th><th class="text-end">Hourly</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr v-for="c in history" :key="c._id">
              <td>{{ c.effectiveDate ? c.effectiveDate.slice(0,10) : '—' }}</td>
              <td class="text-end">{{ peso(c.monthlyBasicSalary) }}</td>
              <td class="text-end">{{ peso(c.dailyRate) }}</td>
              <td class="text-end">{{ peso(c.hourlyRate) }}</td>
              <td><span class="badge" :class="c.status === 'ACTIVE' ? 'bg-success' : (c.status === 'PENDING_APPROVAL' ? 'bg-warning text-dark' : 'bg-secondary')">{{ c.status }}</span></td>
              <td class="text-end"><button v-if="c.status === 'PENDING_APPROVAL' && isOwner" class="btn btn-sm btn-primary" @click="approveComp(c)">Approve</button></td>
            </tr>
            <tr v-if="!history.length"><td colspan="6" class="text-muted text-center">Wala pang compensation record.</td></tr>
          </tbody>
        </table>

        <!-- Add compensation -->
        <div class="row g-2 align-items-end">
          <div class="col-6 col-md-3"><label class="form-label small">Bagong monthly basic</label><input v-model="compForm.monthlyBasicSalary" type="number" class="form-control form-control-sm" /></div>
          <div class="col-6 col-md-3"><label class="form-label small">Effective date</label><input v-model="compForm.effectiveDate" type="date" class="form-control form-control-sm" /></div>
          <div class="col-6 col-md-3"><label class="form-label small">Schedule</label>
            <select v-model="compForm.scheduleId" class="form-select form-select-sm"><option value="">—</option><option v-for="s in schedules" :key="s._id" :value="s._id">{{ s.name }}</option></select>
          </div>
          <div class="col-6 col-md-3"><button class="btn btn-sm btn-primary w-100" @click="addComp">{{ isOwner ? 'Add & activate' : 'Request change' }}</button></div>
        </div>
      </div>
    </div>
  </div>
</template>
