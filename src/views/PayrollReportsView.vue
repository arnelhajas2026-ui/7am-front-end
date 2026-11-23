<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const now = new Date();
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
const year = ref(now.getFullYear());
const tab = ref('monthly');
const rows = ref([]);
const cols = ref([]);
const error = ref('');
const loading = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = {
  monthly: { label: 'Monthly Summary', url: () => ['/payroll/reports/monthly-summary', { year: year.value }, 'months'],
    cols: [['month', 'Month'], ['gross', 'Gross', 1], ['employeeDeductions', 'EE deductions', 1], ['withholdingTax', 'Tax', 1], ['net', 'Net', 1], ['employer', 'Employer', 1], ['totalCost', 'Total cost', 1], ['employees', 'Emps']] },
  employer: { label: 'Employer Contributions', url: () => ['/payroll/reports/employer-contributions', { month: month.value }, 'rows'],
    cols: [['employeeNumber', 'No.'], ['employeeName', 'Name'], ['sssEE', 'SSS EE', 1], ['sssER', 'SSS ER', 1], ['philhealthEE', 'PH EE', 1], ['philhealthER', 'PH ER', 1], ['pagibigEE', 'PI EE', 1], ['pagibigER', 'PI ER', 1], ['totalER', 'Total ER', 1]] },
  sss: { label: 'SSS', url: () => ['/payroll/reports/agency/SSS', { month: month.value }, 'rows'], cols: agencyCols() },
  philhealth: { label: 'PhilHealth', url: () => ['/payroll/reports/agency/PHILHEALTH', { month: month.value }, 'rows'], cols: agencyCols() },
  pagibig: { label: 'Pag-IBIG', url: () => ['/payroll/reports/agency/PAGIBIG', { month: month.value }, 'rows'], cols: agencyCols() },
  costcenter: { label: 'By Cost Center', url: () => ['/payroll/reports/cost-center', { month: month.value }, 'rows'],
    cols: [['costCenter', 'Cost Center'], ['salaries', 'Salaries', 1], ['employer', 'Employer', 1], ['totalCost', 'Total', 1], ['employees', 'Emps']] },
  bir2316: { label: 'BIR 2316', url: () => ['/payroll/reports/bir-2316', { year: year.value }, 'rows'],
    cols: [['employeeNumber', 'No.'], ['employeeName', 'Name'], ['grossCompensation', 'Gross', 1], ['nonTaxable', 'Non-taxable', 1], ['taxableCompensation', 'Taxable', 1], ['mandatoryContributions', 'Contributions', 1], ['taxWithheld', 'Tax withheld', 1]] },
  loans: { label: 'Loans', url: () => ['/payroll/reports/loans', {}, 'rows'],
    cols: [['loanCode', 'Loan'], ['employeeName', 'Name'], ['loanType', 'Type'], ['principal', 'Principal', 1], ['installment', 'Installment', 1], ['outstanding', 'Outstanding', 1], ['status', 'Status']] },
};
function agencyCols() { return [['employeeNumber', 'No.'], ['employeeName', 'Name'], ['employeeShare', 'Employee', 1], ['employerShare', 'Employer', 1], ['total', 'Total', 1]]; }

async function load() {
  loading.value = true; error.value = '';
  const def = TABS[tab.value];
  cols.value = def.cols;
  const [url, params, key] = def.url();
  try { const r = await api.get(url, { params }); rows.value = r.data[key] || []; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load.'; rows.value = []; }
  finally { loading.value = false; }
}
function pick(t) { tab.value = t; load(); }
function exportCsv() {
  const header = cols.value.map((c) => c[1]);
  const lines = [header, ...rows.value.map((r) => cols.value.map((c) => r[c[0]]))];
  const csv = lines.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `payroll-${tab.value}.csv`; a.click();
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Payroll Reports</h3>
    <p class="text-muted">Registers, contributions, cost-center, BIR 2316 at loans — may CSV export.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="d-flex flex-wrap gap-1 mb-3">
      <button v-for="(def,k) in TABS" :key="k" class="btn btn-sm" :class="tab===k ? 'btn-primary' : 'btn-ghost'" @click="pick(k)">{{ def.label }}</button>
    </div>

    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-auto"><label class="form-label small">Month</label><input v-model="month" type="month" class="form-control form-control-sm" /></div>
        <div class="col-auto"><label class="form-label small">Year</label><input v-model.number="year" type="number" class="form-control form-control-sm" style="width:100px" /></div>
        <div class="col-auto"><button class="btn btn-ink btn-sm" @click="load">Apply</button></div>
        <div class="col-auto ms-auto"><button class="btn btn-ghost btn-sm" @click="exportCsv">⬇ CSV</button></div>
      </div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr><th v-for="c in cols" :key="c[0]" :class="c[2] ? 'text-end' : ''">{{ c[1] }}</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in rows" :key="i">
            <td v-for="c in cols" :key="c[0]" class="small" :class="c[2] ? 'text-end' : ''">{{ c[2] ? peso(r[c[0]]) : r[c[0]] }}</td>
          </tr>
          <tr v-if="!rows.length"><td :colspan="cols.length" class="text-muted text-center py-3">Walang data.</td></tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>
