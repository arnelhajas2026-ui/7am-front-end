<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const customers = ref([]);
const selectedId = ref('');
const ledger = ref(null);
const loading = ref(false);
const error = ref('');

async function loadCustomers(){
  try { const { data } = await api.get('/customers'); customers.value = data.customers; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load customers.'; }
}
async function loadLedger(){
  if(!selectedId.value){ ledger.value=null; return; }
  loading.value=true; error.value='';
  try { const { data } = await api.get(`/customers/${selectedId.value}/ledger`); ledger.value = data; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load ledger.'; }
  finally { loading.value=false; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
onMounted(loadCustomers);
</script>

<template>
  <div>
    <h3 class="mb-1">Customer Ledger</h3>
    <p class="text-muted">Statement of account — all charges, payments, and running balance for one customer.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="mb-3" style="max-width:360px">
      <label class="form-label">Customer</label>
      <select v-model="selectedId" class="form-select" @change="loadLedger">
        <option value="">— select a customer —</option>
        <option v-for="c in customers" :key="c._id" :value="c._id">{{ c.name }}</option>
      </select>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <template v-else-if="ledger">
      <div class="row g-2 mb-3" style="max-width:560px">
        <div class="col-4"><div class="tile sm"><div class="tlabel">Total billed</div><div class="tval">{{ peso(ledger.summary.totalBilled) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Total paid</div><div class="tval">{{ peso(ledger.summary.totalPaid) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Outstanding</div><div class="tval" :class="ledger.summary.outstanding>0 && 'warn'">{{ peso(ledger.summary.outstanding) }}</div></div></div>
      </div>

      <div v-if="!ledger.entries.length" class="card"><div class="card-body text-muted text-center py-4">No transactions for this customer yet.</div></div>
      <div v-else class="card"><div class="card-body" style="overflow-x:auto">
        <table class="fin-table">
          <thead><tr><th class="lbl">Date</th><th class="lbl">Ref</th><th class="lbl">Description</th><th>Charge</th><th>Payment</th><th>Balance</th></tr></thead>
          <tbody>
            <tr v-for="(e,i) in ledger.entries" :key="i">
              <td class="lbl">{{ fmtDate(e.date) }}</td>
              <td class="lbl">{{ e.ref }}</td>
              <td class="lbl">{{ e.description }}</td>
              <td class="num">{{ e.charge ? peso(e.charge) : '—' }}</td>
              <td class="num">{{ e.credit ? peso(e.credit) : '—' }}</td>
              <td class="num fw-semibold">{{ peso(e.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div></div>
    </template>
    <div v-else class="text-muted">Select a customer to view their statement.</div>
  </div>
</template>
