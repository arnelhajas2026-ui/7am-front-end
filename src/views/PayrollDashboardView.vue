<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const data = ref(null);
const error = ref('');
const year = ref(new Date().getFullYear());
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (s) => s ? String(s).slice(0, 10) : '';

async function load() {
  error.value = '';
  try { const r = await api.get('/payroll/reports/dashboard', { params: { year: year.value } }); data.value = r.data; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load.'; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Payroll Dashboard</h3>
      <div class="d-flex gap-2"><input v-model.number="year" type="number" class="form-control form-control-sm" style="width:100px" /><button class="btn btn-ink btn-sm" @click="load">Load</button></div>
    </div>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="data" class="row g-3">
      <div class="col-6 col-md-3"><div class="card h-100"><div class="card-body"><div class="text-muted small">Active employees</div><div class="h4 mb-0">{{ data.headcount }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card h-100"><div class="card-body"><div class="text-muted small">YTD payroll cost</div><div class="h5 mb-0">{{ peso(data.ytdPayrollCost) }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card h-100"><div class="card-body"><div class="text-muted small">YTD net pay</div><div class="h5 mb-0">{{ peso(data.ytdNet) }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card h-100"><div class="card-body"><div class="text-muted small">Pending approval</div><div class="h4 mb-0">{{ data.pendingApproval }}<span v-if="data.pendingRemittance" class="text-muted small"> · {{ data.pendingRemittance }} remit</span></div></div></div></div>

      <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
        <p class="section-eyebrow mb-2">Latest run</p>
        <div v-if="data.latestRun"><span class="fw-semibold">{{ data.latestRun.runCode }}</span> <span class="badge bg-secondary">{{ data.latestRun.status }}</span><br><span class="text-muted small">{{ data.latestRun.month }} · net {{ peso(data.latestRun.net) }}</span></div>
        <div v-else class="text-muted small">Wala pa.</div>
      </div></div></div>
      <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
        <p class="section-eyebrow mb-2">Upcoming pay dates</p>
        <div v-for="p in data.upcomingPayDates" :key="p.periodCode" class="d-flex justify-content-between small border-bottom py-1"><span>{{ p.periodCode }}</span><span>{{ d(p.paymentDate) }}</span></div>
        <div v-if="!data.upcomingPayDates.length" class="text-muted small">Walang naka-schedule.</div>
      </div></div></div>
    </div>
  </div>
</template>
