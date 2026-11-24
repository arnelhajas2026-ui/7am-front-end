<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api.js';

const route = useRoute();
const payslips = ref([]);
const header = ref('');
const error = ref('');
const loading = ref(false);

// Picker (kapag binuksan mula sa menu nang walang query)
const fromPicker = ref(false);
const runs = ref([]);
const employees = ref([]);
const pickRun = ref('');
const pickEmployee = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (s) => s ? String(s).slice(0, 10) : '';
const empName = (e) => e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : '—';

// ---- query-based load (mula sa Payroll Processing "Payslips" button) ----
async function load() {
  loading.value = true; error.value = '';
  try {
    if (route.query.run) {
      const { data } = await api.get(`/payroll/processing/runs/${route.query.run}/payslips`);
      header.value = `${data.run.runCode} · ${data.run.payrollMonth} P${data.run.periodNumber}`;
      payslips.value = data.payslips;
    } else if (route.query.employee) {
      const { data } = await api.get('/payroll/payslips', { params: { employee: route.query.employee } });
      header.value = 'Payslip history';
      payslips.value = data.payslips;
    } else if (route.query.detail) {
      const { data } = await api.get(`/payroll/payslips/${route.query.detail}`);
      payslips.value = [data.payslip];
    }
  } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang payslip.'; }
  finally { loading.value = false; }
}

// ---- picker ----
async function loadPickerData() {
  try {
    const [r, e] = await Promise.all([api.get('/payroll/processing/runs'), api.get('/payroll/employees')]);
    runs.value = (r.data.runs || []).filter((x) => ['POSTED', 'PAID'].includes(x.status));
    employees.value = e.data.employees || [];
  } catch (err) { error.value = err.response?.data?.message || 'Hindi ma-load ang listahan.'; }
}
async function loadByRun() {
  if (!pickRun.value) return;
  loading.value = true; error.value = ''; payslips.value = [];
  try {
    const { data } = await api.get(`/payroll/processing/runs/${pickRun.value}/payslips`);
    header.value = `${data.run.runCode} · ${data.run.payrollMonth} P${data.run.periodNumber}`;
    payslips.value = data.payslips;
  } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load.'; }
  finally { loading.value = false; }
}
async function loadByEmployee() {
  if (!pickEmployee.value) return;
  loading.value = true; error.value = ''; payslips.value = [];
  try {
    const { data } = await api.get('/payroll/payslips', { params: { employee: pickEmployee.value } });
    const emp = employees.value.find((x) => x._id === pickEmployee.value);
    header.value = 'Payslip history — ' + empName(emp);
    payslips.value = data.payslips;
    if (!data.payslips.length) error.value = 'Walang POSTED/PAID na payslip ang empleyadong ito.';
  } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load.'; }
  finally { loading.value = false; }
}
function backToPicker() { payslips.value = []; header.value = ''; error.value = ''; }

onMounted(() => {
  if (route.query.run || route.query.employee || route.query.detail) load();
  else { fromPicker.value = true; loadPickerData(); }
});

// ---- print (hidden iframe — hindi apektado ng app layout) ----
function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function buildPrintHtml() {
  const sheets = payslips.value.map((p) => `
    <div class="slip">
      <div class="ctr"><div class="co">${esc(p.company)}</div><div class="sub">PAYSLIP</div></div>
      <div class="row">
        <div><strong>${esc(p.employeeName)}</strong><br>${esc(p.employeeNumber)}${p.department ? ' · ' + esc(p.department) : ''}</div>
        <div class="right">Period: ${esc(p.payrollPeriod)}<br>${d(p.periodStart)} → ${d(p.periodEnd)}<br>Payment: ${d(p.paymentDate)}</div>
      </div>
      <div class="cols">
        <div class="col"><div class="hd">EARNINGS</div>
          ${(p.earnings || []).map((e) => `<div class="ln"><span>${esc(e.label)}</span><span>${peso(e.amount)}</span></div>`).join('')}
          <div class="ln tot"><span>Gross pay</span><span>${peso(p.grossPay)}</span></div></div>
        <div class="col"><div class="hd">DEDUCTIONS</div>
          ${(p.deductions || []).map((e) => `<div class="ln"><span>${esc(e.label)}</span><span>${peso(e.amount)}</span></div>`).join('')}
          <div class="ln tot"><span>Total deductions</span><span>${peso(p.totalDeductions)}</span></div></div>
      </div>
      <div class="net"><span>NET PAY</span><span>${peso(p.netPay)}</span></div>
      <div class="emp">Employer contributions (informational): SSS ${peso(p.employerContributions.sss)} · PhilHealth ${peso(p.employerContributions.philhealth)} · Pag-IBIG ${peso(p.employerContributions.pagibig)}</div>
    </div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Payslips</title><style>
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    body{margin:16px;color:#000}
    .slip{border:1px solid #000;border-radius:8px;padding:16px;margin-bottom:14px;page-break-inside:avoid}
    .ctr{text-align:center;margin-bottom:10px}.co{font-weight:bold;font-size:15px}.sub{color:#555;font-size:12px}
    .row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px}.right{text-align:right}
    .cols{display:flex;gap:24px}.col{flex:1}
    .hd{font-weight:bold;font-size:12px;border-bottom:1px solid #000;margin-bottom:4px;padding-bottom:2px}
    .ln{display:flex;justify-content:space-between;font-size:13px;padding:1px 0}
    .tot{font-weight:bold;border-top:1px solid #000;margin-top:4px;padding-top:3px}
    .net{display:flex;justify-content:space-between;font-weight:bold;border-top:2px solid #000;margin-top:10px;padding-top:6px;font-size:15px}
    .emp{color:#555;font-size:11px;margin-top:8px}
  </style></head><body>${sheets}</body></html>`;
}
function printAll() {
  if (!payslips.value.length) return;
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(buildPrintHtml()); doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 250);
}
</script>

<template>
  <div>
    <div class="d-print-none d-flex align-items-center justify-content-between mb-2">
      <h3 class="mb-0">Payslips <span class="text-muted small">{{ header }}</span></h3>
      <div class="d-flex gap-2">
        <button v-if="fromPicker && payslips.length" class="btn btn-ghost btn-sm" @click="backToPicker">← Pumili ng iba</button>
        <button v-if="payslips.length" class="btn btn-primary btn-sm" @click="printAll">🖨 Print / Save PDF</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-danger py-2 d-print-none">{{ error }}</div>

    <!-- PICKER -->
    <div v-if="fromPicker && !payslips.length && !loading" class="row g-3 d-print-none">
      <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
        <p class="section-eyebrow mb-2">By payroll run</p>
        <select v-model="pickRun" class="form-select form-select-sm mb-2">
          <option value="">— Pumili ng run —</option>
          <option v-for="r in runs" :key="r._id" :value="r._id">{{ r.runCode }} · {{ r.payrollMonth }} P{{ r.periodNumber }} ({{ r.status }})</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="!pickRun" @click="loadByRun">Buksan ang payslips</button>
        <p v-if="!runs.length" class="text-muted small mt-2 mb-0">Walang POSTED/PAID na run pa.</p>
      </div></div></div>

      <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
        <p class="section-eyebrow mb-2">By employee (history)</p>
        <select v-model="pickEmployee" class="form-select form-select-sm mb-2">
          <option value="">— Pumili ng empleyado —</option>
          <option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }} ({{ e.employeeNumber }})</option>
        </select>
        <button class="btn btn-primary btn-sm" :disabled="!pickEmployee" @click="loadByEmployee">Ipakita ang history</button>
      </div></div></div>
    </div>

    <div v-if="loading" class="text-muted d-print-none">Loading…</div>
    <div v-else-if="!fromPicker && !payslips.length" class="text-muted d-print-none">Walang payslip.</div>

    <!-- PAYSLIPS -->
    <div class="payslip-sheet" v-for="(p,i) in payslips" :key="i">
      <div class="text-center mb-2">
        <div class="fw-bold" style="font-size:1.05rem">{{ p.company }}</div>
        <div class="text-muted small">PAYSLIP</div>
      </div>
      <div class="row small mb-2">
        <div class="col-6"><strong>{{ p.employeeName }}</strong><br>{{ p.employeeNumber }}<span v-if="p.position"> · {{ p.position }}</span><span v-if="p.department"> · {{ p.department }}</span></div>
        <div class="col-6 text-end">Period: {{ p.payrollPeriod }}<br>{{ d(p.periodStart) }} → {{ d(p.periodEnd) }}<br>Payment: {{ d(p.paymentDate) }}</div>
      </div>
      <div class="row">
        <div class="col-6">
          <div class="fw-semibold small border-bottom mb-1">EARNINGS</div>
          <div v-for="(e,j) in p.earnings" :key="j" class="d-flex justify-content-between small"><span>{{ e.label }}</span><span>{{ peso(e.amount) }}</span></div>
          <div class="d-flex justify-content-between small fw-semibold border-top mt-1"><span>Gross pay</span><span>{{ peso(p.grossPay) }}</span></div>
        </div>
        <div class="col-6">
          <div class="fw-semibold small border-bottom mb-1">DEDUCTIONS</div>
          <div v-for="(e,j) in p.deductions" :key="j" class="d-flex justify-content-between small"><span>{{ e.label }}</span><span>{{ peso(e.amount) }}</span></div>
          <div class="d-flex justify-content-between small fw-semibold border-top mt-1"><span>Total deductions</span><span>{{ peso(p.totalDeductions) }}</span></div>
        </div>
      </div>
      <div class="d-flex justify-content-between mt-2 pt-1 border-top"><span class="fw-bold">NET PAY</span><span class="fw-bold">{{ peso(p.netPay) }}</span></div>
      <div class="text-muted mt-2" style="font-size:.72rem">
        Employer contributions (informational): SSS {{ peso(p.employerContributions.sss) }} · PhilHealth {{ peso(p.employerContributions.philhealth) }} · Pag-IBIG {{ peso(p.employerContributions.pagibig) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.payslip-sheet { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 14px; background: #fff; }
@media print {
  .d-print-none { display: none !important; }
  .payslip-sheet { page-break-inside: avoid; border: 1px solid #000; }
}
</style>
