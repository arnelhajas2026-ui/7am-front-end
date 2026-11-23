<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api.js';

const route = useRoute();
const payslips = ref([]);
const header = ref('');
const error = ref('');
const loading = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (s) => s ? String(s).slice(0, 10) : '';

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
function printAll() { window.print(); }
onMounted(load);
</script>

<template>
  <div>
    <div class="d-print-none d-flex align-items-center justify-content-between mb-2">
      <h3 class="mb-0">Payslips <span class="text-muted small">{{ header }}</span></h3>
      <button class="btn btn-primary btn-sm" @click="printAll">🖨 Print / Save PDF</button>
    </div>
    <div v-if="error" class="alert alert-danger py-2 d-print-none">{{ error }}</div>
    <div v-if="loading" class="text-muted d-print-none">Loading…</div>
    <div v-else-if="!payslips.length" class="text-muted d-print-none">Walang payslip.</div>

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
