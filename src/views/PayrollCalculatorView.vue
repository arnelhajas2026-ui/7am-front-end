<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const tab = ref('calc');
const employees = ref([]);
const error = ref('');
const loading = ref(false);

const todayKey = new Date().toISOString().slice(0, 10);
const form = ref({ mode: 'employee', employeeId: '', monthlyBasic: '', supplementary: '', asOf: todayKey, taxPeriodPolicy: '' });
const result = ref(null);

const tables = ref(null);
const tablesLoading = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const empName = (e) => e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : '—';
const c2p = (c) => (Number(c || 0) / 100);

async function loadEmployees() { try { const { data } = await api.get('/payroll/employees'); employees.value = data.employees; } catch { /* ignore */ } }

async function compute() {
  error.value = ''; loading.value = true; result.value = null;
  try {
    const body = { asOf: form.value.asOf };
    if (form.value.taxPeriodPolicy) body.taxPeriodPolicy = form.value.taxPeriodPolicy;
    if (form.value.supplementary) body.supplementary = form.value.supplementary;
    if (form.value.mode === 'employee') {
      if (!form.value.employeeId) { error.value = 'Pumili ng empleyado.'; loading.value = false; return; }
      body.employeeId = form.value.employeeId;
    } else {
      if (!form.value.monthlyBasic) { error.value = 'Maglagay ng monthly basic.'; loading.value = false; return; }
      body.monthlyBasic = form.value.monthlyBasic;
    }
    const { data } = await api.post('/payroll/compute/preview', body);
    result.value = data;
  } catch (e) { error.value = e.response?.data?.message || 'Hindi makalkula.'; }
  finally { loading.value = false; }
}

async function loadTables() {
  tablesLoading.value = true; error.value = '';
  try { const { data } = await api.get('/payroll/compute/tables', { params: { asOf: form.value.asOf } }); tables.value = data; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang tables.'; }
  finally { tablesLoading.value = false; }
}
function goTables() { tab.value = 'tables'; if (!tables.value) loadTables(); }

onMounted(loadEmployees);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Payroll Calculator</h3>
      <div class="btn-group btn-group-sm">
        <button class="btn" :class="tab==='calc' ? 'btn-primary' : 'btn-ghost'" @click="tab='calc'">Calculator</button>
        <button class="btn" :class="tab==='tables' ? 'btn-primary' : 'btn-ghost'" @click="goTables">Effective Tables</button>
      </div>
    </div>
    <p class="text-muted">Statutory (SSS/PhilHealth/Pag-IBIG) + BIR withholding + semi-monthly allocation.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- CALCULATOR -->
    <template v-if="tab==='calc'">
      <div class="card mb-3"><div class="card-body">
        <div class="row g-2 align-items-end">
          <div class="col-6 col-md-2"><label class="form-label small">Mode</label>
            <select v-model="form.mode" class="form-select form-select-sm"><option value="employee">Employee</option><option value="amount">Amount</option></select>
          </div>
          <div v-if="form.mode==='employee'" class="col-12 col-md-4"><label class="form-label small">Employee</label>
            <select v-model="form.employeeId" class="form-select form-select-sm"><option value="">—</option><option v-for="e in employees" :key="e._id" :value="e._id">{{ empName(e) }} ({{ e.employeeNumber }})</option></select>
          </div>
          <div v-else class="col-6 col-md-3"><label class="form-label small">Monthly basic</label><input v-model="form.monthlyBasic" type="number" class="form-control form-control-sm" placeholder="15000" /></div>
          <div class="col-6 col-md-2"><label class="form-label small">Supplementary</label><input v-model="form.supplementary" type="number" class="form-control form-control-sm" placeholder="0" /></div>
          <div class="col-6 col-md-2"><label class="form-label small">As of</label><input v-model="form.asOf" type="date" class="form-control form-control-sm" /></div>
          <div class="col-6 col-md-2"><label class="form-label small">Tax policy</label>
            <select v-model="form.taxPeriodPolicy" class="form-select form-select-sm"><option value="">Config default</option><option value="EACH">Each period</option><option value="SECOND">2nd period</option></select>
          </div>
          <div class="col-6 col-md-1"><button class="btn btn-primary btn-sm w-100" :disabled="loading" @click="compute">{{ loading ? '…' : 'Compute' }}</button></div>
        </div>
      </div></div>

      <div v-if="result">
        <div v-if="result.tablesMissing && result.tablesMissing.length" class="alert alert-warning py-2">
          ⚠ Walang effective table para sa: {{ result.tablesMissing.join(', ') }}. Patakbuhin ang <code>node src/seed-payroll.js</code>.
        </div>

        <div class="row g-3">
          <!-- Monthly summary -->
          <div class="col-12 col-lg-5">
            <div class="card h-100"><div class="card-body">
              <p class="section-eyebrow mb-2">Monthly summary
                <span v-if="result.employee" class="text-muted"> — {{ result.employee.name }}</span>
              </p>
              <table class="table table-sm mb-0">
                <tbody>
                  <tr><td>Gross</td><td class="text-end fw-semibold">{{ peso(result.monthly.gross) }}</td></tr>
                  <tr><td class="text-muted">SSS EE <span class="small">(MSC {{ peso(result.monthly.sss.msc) }})</span></td><td class="text-end">{{ peso(result.monthly.sss.ee) }}</td></tr>
                  <tr><td class="text-muted">PhilHealth EE</td><td class="text-end">{{ peso(result.monthly.philhealth.ee) }}</td></tr>
                  <tr><td class="text-muted">Pag-IBIG EE</td><td class="text-end">{{ peso(result.monthly.pagibig.ee) }}</td></tr>
                  <tr><td class="text-muted">Withholding tax</td><td class="text-end">{{ peso(result.monthly.withholdingTax) }}</td></tr>
                  <tr class="border-top"><td class="fw-semibold">Net pay</td><td class="text-end fw-semibold">{{ peso(result.monthly.net) }}</td></tr>
                </tbody>
              </table>
              <hr class="my-2" />
              <p class="section-eyebrow mb-2">Employer contributions</p>
              <table class="table table-sm mb-0">
                <tbody>
                  <tr><td class="text-muted">SSS ER + EC</td><td class="text-end">{{ peso(result.monthly.sss.employerTotal) }}</td></tr>
                  <tr><td class="text-muted">PhilHealth ER</td><td class="text-end">{{ peso(result.monthly.philhealth.er) }}</td></tr>
                  <tr><td class="text-muted">Pag-IBIG ER</td><td class="text-end">{{ peso(result.monthly.pagibig.er) }}</td></tr>
                  <tr class="border-top"><td class="fw-semibold">Total employer</td><td class="text-end fw-semibold">{{ peso(result.monthly.employerContributions) }}</td></tr>
                  <tr><td class="fw-semibold">Total employment cost</td><td class="text-end fw-semibold">{{ peso(result.monthly.totalEmploymentCost) }}</td></tr>
                </tbody>
              </table>
            </div></div>
          </div>

          <!-- Per-period -->
          <div class="col-12 col-lg-7">
            <div class="card h-100"><div class="card-body">
              <p class="section-eyebrow mb-2">Semi-monthly allocation <span class="text-muted small">(tax policy: {{ result.taxPeriodPolicy }})</span></p>
              <table class="table table-sm">
                <thead><tr><th></th><th class="text-end">1st (15th)</th><th class="text-end">2nd (30th)</th></tr></thead>
                <tbody>
                  <tr><td class="text-muted">Gross</td><td class="text-end" v-for="p in result.periods" :key="p.period">{{ peso(p.gross) }}</td></tr>
                  <tr><td class="text-muted">SSS EE</td><td class="text-end" v-for="p in result.periods" :key="p.period+'s'">{{ peso(p.sssEE) }}</td></tr>
                  <tr><td class="text-muted">PhilHealth EE</td><td class="text-end" v-for="p in result.periods" :key="p.period+'p'">{{ peso(p.philhealthEE) }}</td></tr>
                  <tr><td class="text-muted">Pag-IBIG EE</td><td class="text-end" v-for="p in result.periods" :key="p.period+'g'">{{ peso(p.pagibigEE) }}</td></tr>
                  <tr><td class="text-muted">Withholding tax</td><td class="text-end" v-for="p in result.periods" :key="p.period+'t'">{{ peso(p.withholdingTax) }}</td></tr>
                  <tr class="border-top"><td class="fw-semibold">Net pay</td><td class="text-end fw-semibold" v-for="p in result.periods" :key="p.period+'n'">{{ peso(p.net) }}</td></tr>
                </tbody>
              </table>
              <div class="small">
                <span class="me-2">Reconciliation:</span>
                <span class="badge" :class="result.reconciliation.sss.ok ? 'bg-success' : 'bg-danger'">SSS {{ result.reconciliation.sss.ok ? '✓' : '✗' }}</span>
                <span class="badge ms-1" :class="result.reconciliation.philhealth.ok ? 'bg-success' : 'bg-danger'">PH {{ result.reconciliation.philhealth.ok ? '✓' : '✗' }}</span>
                <span class="badge ms-1" :class="result.reconciliation.pagibig.ok ? 'bg-success' : 'bg-danger'">Pag-IBIG {{ result.reconciliation.pagibig.ok ? '✓' : '✗' }}</span>
                <span class="text-muted ms-2">Period1 + Period2 = buong monthly obligation.</span>
              </div>
            </div></div>
          </div>
        </div>

        <p class="text-muted small mt-2">
          Versions: SSS {{ result.versions.sss?.label || '—' }} · PhilHealth {{ result.versions.philhealth?.label || '—' }} · Pag-IBIG {{ result.versions.pagibig?.label || '—' }}
        </p>
      </div>
    </template>

    <!-- EFFECTIVE TABLES -->
    <template v-else>
      <div v-if="tablesLoading" class="text-muted">Loading…</div>
      <div v-else-if="tables" class="row g-3">
        <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
          <p class="section-eyebrow mb-2">SSS <span class="text-muted small">{{ tables.sss?.versionLabel }}</span></p>
          <div v-if="tables.sss" class="small">
            <div>MSC range: {{ peso(c2p(tables.sss.data.mscMinC)) }} – {{ peso(c2p(tables.sss.data.mscMaxC)) }} (step {{ peso(c2p(tables.sss.data.mscStepC)) }})</div>
            <div>EE {{ (tables.sss.data.employeeRate*100).toFixed(1) }}% · ER {{ (tables.sss.data.employerRate*100).toFixed(1) }}%</div>
            <div>MPF/WISP above {{ peso(c2p(tables.sss.data.regularCeilingC)) }} · EC {{ peso(c2p(tables.sss.data.ecLowC)) }}/{{ peso(c2p(tables.sss.data.ecHighC)) }}</div>
          </div>
          <div v-else class="text-muted small">Walang table.</div>
        </div></div></div>

        <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
          <p class="section-eyebrow mb-2">PhilHealth <span class="text-muted small">{{ tables.philhealth?.versionLabel }}</span></p>
          <div v-if="tables.philhealth" class="small">
            <div>Rate {{ (tables.philhealth.data.rate*100).toFixed(1) }}% (EE {{ (tables.philhealth.data.employeeShare*100).toFixed(0) }}% / ER {{ (tables.philhealth.data.employerShare*100).toFixed(0) }}%)</div>
            <div>Floor {{ peso(c2p(tables.philhealth.data.floorC)) }} · Ceiling {{ peso(c2p(tables.philhealth.data.ceilingC)) }}</div>
          </div>
          <div v-else class="text-muted small">Walang table.</div>
        </div></div></div>

        <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
          <p class="section-eyebrow mb-2">Pag-IBIG <span class="text-muted small">{{ tables.pagibig?.versionLabel }}</span></p>
          <div v-if="tables.pagibig" class="small">
            <div>EE {{ (tables.pagibig.data.lowEmployeeRate*100).toFixed(0) }}%/{{ (tables.pagibig.data.highEmployeeRate*100).toFixed(0) }}% · ER {{ (tables.pagibig.data.employerRate*100).toFixed(0) }}%</div>
            <div>Max fund salary {{ peso(c2p(tables.pagibig.data.maxFundSalaryC)) }}</div>
          </div>
          <div v-else class="text-muted small">Walang table.</div>
        </div></div></div>

        <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
          <p class="section-eyebrow mb-2">BIR Withholding (semi-monthly) <span class="text-muted small">{{ tables.taxSemiMonthly?.versionLabel }}</span></p>
          <table v-if="tables.taxSemiMonthly" class="table table-sm mb-0 small">
            <thead><tr><th>Over</th><th class="text-end">Base tax</th><th class="text-end">Rate</th></tr></thead>
            <tbody><tr v-for="(br,i) in tables.taxSemiMonthly.brackets" :key="i"><td>{{ peso(c2p(br.overC)) }}</td><td class="text-end">{{ peso(c2p(br.baseTaxC)) }}</td><td class="text-end">{{ (br.rate*100).toFixed(0) }}%</td></tr></tbody>
          </table>
          <div v-else class="text-muted small">Walang table.</div>
        </div></div></div>
      </div>
    </template>
  </div>
</template>
