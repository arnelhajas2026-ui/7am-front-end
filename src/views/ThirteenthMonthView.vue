<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const year = ref(new Date().getFullYear());
const data = ref(null);
const runs = ref([]);
const error = ref('');
const info = ref('');
const busy = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadList() { try { const r = await api.get('/payroll/thirteenth'); runs.value = r.data.runs; } catch { /* ignore */ } }
async function loadYear() {
  error.value = '';
  try { const r = await api.get(`/payroll/thirteenth/${year.value}`); data.value = r.data.thirteenth; }
  catch (e) { data.value = null; if (e.response?.status !== 404) error.value = e.response?.data?.message || 'Hindi ma-load.'; }
}
async function compute() {
  busy.value = true; error.value = ''; info.value = '';
  try { const r = await api.post('/payroll/thirteenth/compute', { year: year.value }); data.value = r.data.thirteenth; info.value = 'Na-compute mula sa POSTED/PAID na payroll ng taon.'; await loadList(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-compute.'; }
  finally { busy.value = false; }
}
async function approve() { try { const r = await api.post(`/payroll/thirteenth/${year.value}/approve`); data.value = r.data.thirteenth; await loadList(); } catch (e) { error.value = e.response?.data?.message || 'Hindi ma-approve.'; } }
async function post() {
  if (!confirm('I-post ang 13th month sa GL?')) return;
  try { const r = await api.post(`/payroll/thirteenth/${year.value}/post`); data.value = r.data.thirteenth; info.value = `Naka-post (JV ${r.data.journalRef}).`; await loadList(); }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-post.'; }
}
onMounted(async () => { await loadList(); await loadYear(); });
</script>

<template>
  <div>
    <h3 class="mb-1">13th Month Pay</h3>
    <p class="text-muted">Kabuuang basic na kinita sa taon ÷ 12. Hiwalay na transaction + JE.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="info" class="alert alert-info py-2">{{ info }}</div>

    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end">
        <div class="col-auto"><label class="form-label small">Year</label><input v-model.number="year" type="number" class="form-control form-control-sm" style="width:110px" /></div>
        <div class="col-auto"><button class="btn btn-ink btn-sm" @click="loadYear">Load</button></div>
        <div class="col-auto"><button class="btn btn-primary btn-sm" :disabled="busy" @click="compute">Compute</button></div>
        <div class="col-auto ms-auto" v-if="data">
          <span class="badge bg-secondary me-2">{{ data.status }}</span>
          <button v-if="data.status==='DRAFT' && isOwner" class="btn btn-success btn-sm" @click="approve">Approve</button>
          <button v-if="data.status==='APPROVED' && isOwner" class="btn btn-primary btn-sm" @click="post">Post to GL</button>
          <span v-if="data.journalRef" class="badge bg-success ms-1">JV {{ data.journalRef }}</span>
        </div>
      </div>
    </div></div>

    <div v-if="data" class="card"><div class="card-body p-0">
      <table class="table table-sm mb-0 align-middle">
        <thead><tr><th>Employee</th><th class="text-end">Basic earned (year)</th><th class="text-end">13th month (÷12)</th></tr></thead>
        <tbody>
          <tr v-for="(d,i) in data.details" :key="i"><td class="small">{{ d.employeeName }} <span class="text-muted">{{ d.employeeNumber }}</span></td><td class="text-end small">{{ peso(d.basicEarned) }}</td><td class="text-end small fw-semibold">{{ peso(d.amount) }}</td></tr>
          <tr v-if="!data.details.length"><td colspan="3" class="text-muted text-center py-3">Walang qualifying basic. Tiyaking may POSTED/PAID na payroll sa taon.</td></tr>
        </tbody>
        <tfoot v-if="data.details.length"><tr class="border-top"><td class="fw-semibold">Total</td><td></td><td class="text-end fw-semibold">{{ peso(data.total) }}</td></tr></tfoot>
      </table>
    </div></div>
    <div v-else class="text-muted">Walang computation para sa {{ year }}. I-click ang Compute.</div>
  </div>
</template>
