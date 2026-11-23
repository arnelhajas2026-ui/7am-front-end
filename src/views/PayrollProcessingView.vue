<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const router = useRouter();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const now = new Date();
const sel = ref({ year: now.getFullYear(), month: now.getMonth() + 1 });
const periods = ref([]);
const runs = ref([]);
const error = ref('');
const info = ref('');
const busy = ref(false);

const run = ref(null);
const details = ref([]);
const detailOpen = ref(null);
const manualE = ref({ code: 'OTHER', label: '', amount: '', taxable: true });
const manualD = ref({ code: 'OTHER', label: '', amount: '' });
const je = ref(null);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthStr = computed(() => `${sel.value.year}-${String(sel.value.month).padStart(2, '0')}`);
const editable = computed(() => run.value && ['DRAFT', 'FOR_REVIEW', 'FOR_APPROVAL', 'REOPENED'].includes(run.value.status));
const BASE = '/payroll/processing';

async function loadAll() {
  error.value = '';
  try {
    const [pr, rn] = await Promise.all([
      api.get(`${BASE}/periods`, { params: { month: monthStr.value } }),
      api.get(`${BASE}/runs`, { params: { month: monthStr.value } }),
    ]);
    periods.value = pr.data.periods; runs.value = rn.data.runs;
  } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load.'; }
}
async function genPeriods() {
  busy.value = true; error.value = ''; info.value = '';
  try { await api.post(`${BASE}/periods/generate`, { year: sel.value.year, month: sel.value.month }); info.value = 'Na-generate ang mga period.'; await loadAll(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-generate.'; }
  finally { busy.value = false; }
}
async function createRun(period) {
  busy.value = true; error.value = '';
  try { const { data } = await api.post(`${BASE}/runs`, { periodId: period._id }); info.value = `Na-generate ang ${data.run.runCode}.`; await loadAll(); await openRun(data.run._id); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-generate ang run.'; }
  finally { busy.value = false; }
}
async function openRun(id) {
  error.value = ''; je.value = null;
  try { const { data } = await api.get(`${BASE}/runs/${id}`); run.value = data.run; details.value = data.details; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang run.'; }
}
function closeRun() { run.value = null; details.value = []; detailOpen.value = null; je.value = null; }
async function recalc() {
  busy.value = true;
  try { await api.post(`${BASE}/runs/${run.value._id}/recalc`); await openRun(run.value._id); info.value = 'Na-recalculate.'; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-recalc.'; }
  finally { busy.value = false; }
}
async function transition(to) {
  try { await api.post(`${BASE}/runs/${run.value._id}/transition`, { to }); await openRun(run.value._id); await loadAll(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-i-transition.'; }
}
async function doAction(path, body) {
  busy.value = true; error.value = '';
  try { await api.post(`${BASE}/runs/${run.value._id}/${path}`, body || {}); await openRun(run.value._id); await loadAll(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi matapos ang aksyon.'; }
  finally { busy.value = false; }
}
function approve() { doAction('approve'); }
function postGL() { if (confirm('I-post sa General Ledger? Hindi na maba-back-edit.')) doAction('post'); }
function markPaid() { const method = prompt('Payment method (BANK/CASH/GCASH):', 'BANK') || 'BANK'; doAction('mark-paid', { method }); }
function reopen() { const reason = prompt('Dahilan ng reopen? (iri-reverse ang JE + loan deductions)'); if (reason) doAction('reopen', { reason }); }
async function previewJe() {
  try { const { data } = await api.get(`${BASE}/runs/${run.value._id}/journal-preview`); je.value = data.preview; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-preview.'; }
}
function goPayslips() { router.push({ name: 'payslips', query: { run: run.value._id } }); }

function exportCsv() {
  const rows = [['Employee No', 'Name', 'Gross', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Tax', 'Loans', 'Other', 'Net']];
  for (const d of details.value) rows.push([d.employeeNumber, d.employeeName, d.gross, d.sssEE, d.philhealthEE, d.pagibigEE, d.withholdingTax, d.loans, d.otherDeductions, d.net]);
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${run.value.runCode}-register.csv`; a.click();
}
function openDetail(d) { detailOpen.value = d; manualE.value = { code: 'OTHER', label: '', amount: '', taxable: true }; manualD.value = { code: 'OTHER', label: '', amount: '' }; }
async function saveManual() {
  const me = [...(detailOpen.value.manualEarnings || [])];
  const md = [...(detailOpen.value.manualDeductions || [])];
  if (manualE.value.amount) me.push({ code: manualE.value.code, label: manualE.value.label, amount: Number(manualE.value.amount), classifications: manualE.value.taxable ? ['taxable'] : ['nonTaxable'] });
  if (manualD.value.amount) md.push({ code: manualD.value.code, label: manualD.value.label, amount: Number(manualD.value.amount) });
  try { const { data } = await api.put(`${BASE}/runs/${run.value._id}/details/${detailOpen.value._id}`, { manualEarnings: me, manualDeductions: md }); await openRun(run.value._id); detailOpen.value = details.value.find((x) => x._id === data.detail._id) || null; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-save.'; }
}
onMounted(loadAll);
</script>

<template>
  <div>
    <h3 class="mb-1">Payroll Processing</h3>
    <p class="text-muted">Generate ng period → run → register → review → approve → post → pay.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="info" class="alert alert-info py-2">{{ info }}</div>

    <div v-if="!run" class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-auto"><label class="form-label small">Year</label><input v-model.number="sel.year" type="number" class="form-control form-control-sm" style="width:100px" /></div>
        <div class="col-auto"><label class="form-label small">Month</label>
          <select v-model.number="sel.month" class="form-select form-select-sm"><option v-for="m in 12" :key="m" :value="m">{{ m }}</option></select>
        </div>
        <div class="col-auto"><button class="btn btn-ink btn-sm" @click="loadAll">Load</button></div>
        <div class="col-auto"><button class="btn btn-ghost btn-sm" :disabled="busy" @click="genPeriods">Generate periods</button></div>
      </div>
      <hr class="my-2" />
      <div v-if="!periods.length" class="text-muted small">Walang period para sa {{ monthStr }}. I-generate muna.</div>
      <div v-for="p in periods" :key="p._id" class="d-flex align-items-center justify-content-between border-bottom py-2">
        <div><span class="fw-semibold">{{ p.periodCode }}</span> <span class="text-muted small">{{ p.periodStart.slice(0,10) }} → {{ p.periodEnd.slice(0,10) }} · bayad {{ p.paymentDate.slice(0,10) }}</span></div>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="createRun(p)">Generate run</button>
      </div>
    </div></div>

    <div v-if="!run" class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr><th>Run</th><th>Period</th><th>Status</th><th class="text-end">Employees</th><th class="text-end">Net</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in runs" :key="r._id">
            <td class="small fw-semibold">{{ r.runCode }}</td>
            <td class="small">{{ r.payrollMonth }} P{{ r.periodNumber }}</td>
            <td><span class="badge bg-secondary">{{ r.status }}</span></td>
            <td class="text-end small">{{ r.employeeCount }}</td>
            <td class="text-end small">{{ peso(r.totalsPeso.net) }}</td>
            <td class="text-end"><button class="btn btn-ghost btn-sm" @click="openRun(r._id)">Open</button></td>
          </tr>
          <tr v-if="!runs.length"><td colspan="6" class="text-muted text-center py-3">Walang run.</td></tr>
        </tbody>
      </table>
    </div></div>

    <div v-if="run">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div><h5 class="mb-0">{{ run.runCode }} <span class="badge bg-secondary">{{ run.status }}</span>
          <span v-if="run.journalRef" class="badge bg-success ms-1">JV {{ run.journalRef }}</span></h5>
          <div class="text-muted small">{{ run.payrollMonth }} P{{ run.periodNumber }} · bayad {{ run.paymentDate.slice(0,10) }} · {{ run.employeeCount }} empleyado</div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="closeRun">← Balik</button>
      </div>

      <div class="d-flex gap-2 mb-3 flex-wrap">
        <button v-if="editable" class="btn btn-ghost btn-sm" :disabled="busy" @click="recalc">↻ Recalculate</button>
        <button class="btn btn-ghost btn-sm" @click="exportCsv">⬇ Register CSV</button>
        <button v-if="run.status==='DRAFT' || run.status==='REOPENED'" class="btn btn-primary btn-sm" @click="transition('FOR_REVIEW')">Submit for review</button>
        <button v-if="run.status==='FOR_REVIEW'" class="btn btn-primary btn-sm" @click="transition('FOR_APPROVAL')">Send for approval</button>
        <button v-if="run.status==='FOR_REVIEW'" class="btn btn-ghost btn-sm" @click="transition('DRAFT')">Back to draft</button>
        <button v-if="run.status==='FOR_APPROVAL' && isOwner" class="btn btn-success btn-sm" :disabled="busy" @click="approve">✓ Approve</button>
        <button v-if="run.status==='APPROVED'" class="btn btn-ghost btn-sm" @click="previewJe">Preview JE</button>
        <button v-if="run.status==='APPROVED' && isOwner" class="btn btn-primary btn-sm" :disabled="busy" @click="postGL">Post to GL</button>
        <button v-if="run.status==='POSTED' && isOwner" class="btn btn-primary btn-sm" :disabled="busy" @click="markPaid">Mark paid</button>
        <button v-if="['POSTED','PAID'].includes(run.status)" class="btn btn-ghost btn-sm" @click="goPayslips">Payslips</button>
        <button v-if="['APPROVED','POSTED','PAID'].includes(run.status) && isOwner" class="btn btn-outline-danger btn-sm" :disabled="busy" @click="reopen">Reopen</button>
        <span v-if="run.status==='FOR_APPROVAL' && !isOwner" class="text-muted small align-self-center">Naghihintay ng owner approval.</span>
      </div>

      <!-- JE preview -->
      <div v-if="je" class="card mb-3 border-info"><div class="card-body">
        <div class="d-flex justify-content-between"><p class="section-eyebrow mb-2">Journal entry preview</p><button class="btn btn-ghost btn-sm" @click="je=null">✕</button></div>
        <table class="table table-sm mb-1"><thead><tr><th>Account</th><th>CC</th><th class="text-end">Debit</th><th class="text-end">Credit</th></tr></thead>
          <tbody><tr v-for="(l,i) in je.lines" :key="i"><td class="small">{{ l.accountCode }} <span class="text-muted">{{ l.description }}</span></td><td class="small">{{ l.costCenter || '—' }}</td><td class="text-end small">{{ l.debit ? peso(l.debit) : '' }}</td><td class="text-end small">{{ l.credit ? peso(l.credit) : '' }}</td></tr></tbody>
        </table>
        <div class="small">Total: {{ peso(je.totalDebit) }} = {{ peso(je.totalCredit) }} <span class="badge" :class="je.balanced ? 'bg-success' : 'bg-danger'">{{ je.balanced ? 'Balanced ✓' : 'Unbalanced' }}</span></div>
      </div></div>

      <div class="card mb-3"><div class="card-body">
        <p class="section-eyebrow mb-2">Summary</p>
        <div class="row small g-2">
          <div class="col-6 col-md-3">Gross: <span class="fw-semibold">{{ peso(run.totalsPeso.gross) }}</span></div>
          <div class="col-6 col-md-3">SSS EE: {{ peso(run.totalsPeso.sssEE) }}</div>
          <div class="col-6 col-md-3">PhilHealth EE: {{ peso(run.totalsPeso.philhealthEE) }}</div>
          <div class="col-6 col-md-3">Pag-IBIG EE: {{ peso(run.totalsPeso.pagibigEE) }}</div>
          <div class="col-6 col-md-3">Withholding tax: {{ peso(run.totalsPeso.withholdingTax) }}</div>
          <div class="col-6 col-md-3">Loans: {{ peso(run.totalsPeso.loans) }}</div>
          <div class="col-6 col-md-3 fw-semibold">Net pay: {{ peso(run.totalsPeso.net) }}</div>
          <div class="col-6 col-md-3">Employer contrib: {{ peso(run.totalsPeso.employerTotal) }}</div>
          <div class="col-12 col-md-3 fw-semibold">Total payroll cost: {{ peso(run.totalsPeso.totalPayrollCost) }}</div>
        </div>
      </div></div>

      <div class="card"><div class="card-body p-0">
        <table class="table table-sm mb-0 align-middle">
          <thead><tr><th>Employee</th><th class="text-end">Gross</th><th class="text-end">SSS</th><th class="text-end">PH</th><th class="text-end">Pag-IBIG</th><th class="text-end">Tax</th><th class="text-end">Loans</th><th class="text-end">Net</th><th></th></tr></thead>
          <tbody>
            <tr v-for="d in details" :key="d._id">
              <td class="small">{{ d.employeeName }} <span class="text-muted">{{ d.employeeNumber }}</span></td>
              <td class="text-end small">{{ peso(d.gross) }}</td>
              <td class="text-end small">{{ peso(d.sssEE) }}</td>
              <td class="text-end small">{{ peso(d.philhealthEE) }}</td>
              <td class="text-end small">{{ peso(d.pagibigEE) }}</td>
              <td class="text-end small">{{ peso(d.withholdingTax) }}</td>
              <td class="text-end small">{{ peso(d.loans) }}</td>
              <td class="text-end small fw-semibold">{{ peso(d.net) }}</td>
              <td class="text-end"><button class="btn btn-ghost btn-sm" @click="openDetail(d)">View</button></td>
            </tr>
          </tbody>
        </table>
      </div></div>

      <div v-if="detailOpen" class="card mt-3 border-primary"><div class="card-body">
        <div class="d-flex justify-content-between"><h6 class="mb-2">{{ detailOpen.employeeName }} <span class="text-muted small">{{ detailOpen.employeeNumber }}</span></h6><button class="btn btn-ghost btn-sm" @click="detailOpen=null">✕</button></div>
        <div class="row">
          <div class="col-12 col-md-6">
            <p class="section-eyebrow mb-1">Earnings</p>
            <table class="table table-sm"><tbody>
              <tr v-for="(e,i) in detailOpen.earningsPeso" :key="i"><td class="small">{{ e.label }}</td><td class="text-end small">{{ peso(e.amount) }}</td></tr>
              <tr class="border-top"><td class="small fw-semibold">Gross</td><td class="text-end small fw-semibold">{{ peso(detailOpen.gross) }}</td></tr>
            </tbody></table>
          </div>
          <div class="col-12 col-md-6">
            <p class="section-eyebrow mb-1">Deductions</p>
            <table class="table table-sm"><tbody>
              <tr v-for="(e,i) in detailOpen.deductionsPeso" :key="i"><td class="small">{{ e.label }}</td><td class="text-end small">{{ peso(e.amount) }}</td></tr>
              <tr class="border-top"><td class="small fw-semibold">Net pay</td><td class="text-end small fw-semibold">{{ peso(detailOpen.net) }}</td></tr>
            </tbody></table>
          </div>
        </div>
        <div v-if="editable" class="row g-2 align-items-end mt-1">
          <div class="col-12"><p class="section-eyebrow mb-1">Add manual</p></div>
          <div class="col-6 col-md-3"><label class="form-label small">Earning label</label><input v-model="manualE.label" class="form-control form-control-sm" placeholder="Commission" /></div>
          <div class="col-3 col-md-2"><label class="form-label small">Amount</label><input v-model="manualE.amount" type="number" class="form-control form-control-sm" /></div>
          <div class="col-3 col-md-2 d-flex align-items-end"><div class="form-check"><input v-model="manualE.taxable" class="form-check-input" type="checkbox" id="tx" /><label class="form-check-label small" for="tx">Taxable</label></div></div>
          <div class="col-6 col-md-3"><label class="form-label small">Deduction label</label><input v-model="manualD.label" class="form-control form-control-sm" placeholder="Uniform" /></div>
          <div class="col-3 col-md-2"><label class="form-label small">Amount</label><input v-model="manualD.amount" type="number" class="form-control form-control-sm" /></div>
          <div class="col-12"><button class="btn btn-primary btn-sm" @click="saveManual">Save manual lines</button></div>
        </div>
        <p class="text-muted small mt-2">Attendance: {{ detailOpen.attendanceSummary?.regularHours }}h reg · {{ detailOpen.attendanceSummary?.overtimeHours }}h OT · {{ detailOpen.attendanceSummary?.absentDays }} absent · late {{ detailOpen.attendanceSummary?.lateMinutes }}m</p>
      </div></div>
    </div>
  </div>
</template>
