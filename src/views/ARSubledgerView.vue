<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';

const rows = ref([]);
const total = ref(0);
const control = ref(null);
const loading = ref(false);
const error = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const reconciled = computed(() => control.value && Math.abs(control.value.diff) < 0.01);

async function load() {
  loading.value = true; error.value = '';
  try {
    const { data } = await api.get('/ledger/ar');
    rows.value = data.rows; total.value = data.total; control.value = data.control;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load AR sub-ledger.'; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Accounts Receivable Sub-Ledger</h3>
    <p class="text-muted">Natitirang singilin sa bawat customer (machine sales). Dapat tumugma sa GL Accounts Receivable (1050).</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="control" class="recon" :class="reconciled ? 'ok' : 'off'">
      <div><div class="recon-label">Sub-ledger total</div><div class="recon-val">{{ peso(total) }}</div></div>
      <div class="recon-eq">vs</div>
      <div><div class="recon-label">GL {{ control.code }} · {{ control.name }}</div><div class="recon-val">{{ peso(control.glBalance) }}</div></div>
      <div class="recon-badge"><span v-if="reconciled">✓ Reconciled</span><span v-else>✗ Off by {{ peso(control.diff) }}</span></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:620px">
        <thead><tr><th class="lbl">Customer</th><th>Orders</th><th>Opening</th><th>Billed</th><th>Paid</th><th>Outstanding</th></tr></thead>
        <tbody>
          <tr v-for="(r,i) in rows" :key="i">
            <td class="lbl">{{ r.customer }}</td>
            <td class="num">{{ r.count }}</td>
            <td class="num">{{ peso(r.opening) }}</td>
            <td class="num">{{ peso(r.billed) }}</td>
            <td class="num">{{ peso(r.paid) }}</td>
            <td class="num fw-semibold">{{ peso(r.outstanding) }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="text-center text-muted py-3">Walang outstanding na receivable.</td></tr>
        </tbody>
        <tfoot v-if="rows.length"><tr class="gp"><td class="lbl" colspan="5">Total receivable</td><td class="num fw-bold">{{ peso(total) }}</td></tr></tfoot>
      </table>
    </div></div>
  </div>
</template>

<style scoped>
.recon { display:flex; align-items:center; gap:1.25rem; padding:.85rem 1.1rem; border-radius:12px; margin-bottom:1rem; border:1px solid; flex-wrap:wrap; }
.recon.ok { background:#E5F6EC; border-color:#8FD3A8; } .recon.off { background:#FDECEC; border-color:#F0A9A9; }
.recon-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); }
.recon-val { font-family:var(--font-display); font-weight:700; font-size:1.1rem; }
.recon-eq { color:var(--muted); }
.recon-badge { margin-left:auto; font-weight:700; }
.recon.ok .recon-badge { color:var(--good); } .recon.off .recon-badge { color:var(--bad); }
</style>
