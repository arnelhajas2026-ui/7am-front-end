<script setup>
import FullscreenPanel from '../components/FullscreenPanel.vue';
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

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
    const { data } = await api.get('/ledger/machine');
    rows.value = data.rows; total.value = data.total; control.value = data.control;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load machine sub-ledger.'; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <FullscreenPanel>
      <div class="stack">
    <h3 class="mb-0">Vending Machine Inventory Sub-Ledger</h3>
    <p class="text-muted">Vending Machines for Resale (GL 1130) — hiwalay sa snacks/drinks (1100). In = Delivered to 7A'M, Out = Delivered to Customer.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="control" class="recon" :class="reconciled ? 'ok' : 'off'">
      <div><div class="recon-label">Sub-ledger value</div><div class="recon-val">{{ peso(total) }}</div></div>
      <div class="recon-eq">vs</div>
      <div><div class="recon-label">GL {{ control.code }} · {{ control.name }}</div><div class="recon-val">{{ peso(control.glBalance) }}</div></div>
      <div class="recon-badge"><span v-if="reconciled">✓ Reconciled</span><span v-else>✗ Off by {{ peso(control.diff) }}</span></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table ruled" style="min-width:980px">
        <thead><tr>
          <th class="lbl">Date</th><th class="lbl">Order No.</th><th class="lbl">Machine Model</th><th class="lbl">Customer</th>
          <th class="lbl">Transaction</th><th>Qty In</th><th>Qty Out</th><th>Value</th><th>Running Qty</th><th>Running Value</th>
        </tr></thead>
        <tbody>
          <tr v-for="(r,i) in rows" :key="i">
            <td class="lbl">{{ r.date ? fmtDate(r.date) : '—' }}</td>
            <td class="lbl">{{ r.ref }}</td>
            <td class="lbl">{{ r.model }}</td>
            <td class="lbl">{{ r.customer }}</td>
            <td class="lbl">{{ r.txn }}</td>
            <td class="num">{{ r.qtyIn || '' }}</td>
            <td class="num">{{ r.qtyOut || '' }}</td>
            <td class="num" :class="r.value < 0 ? 'text-danger' : ''">{{ peso(r.value) }}</td>
            <td class="num">{{ r.runningQty }}</td>
            <td class="num fw-semibold">{{ peso(r.runningValue) }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="10" class="text-center text-muted py-3">Wala pang na-deliver na makina sa resale inventory.</td></tr>
        </tbody>
        <tfoot v-if="rows.length"><tr class="gp"><td class="lbl" colspan="9">Ending inventory value</td><td class="num fw-bold">{{ peso(total) }}</td></tr></tfoot>
      </table>
    </div></div>
      </div>
    </FullscreenPanel>
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
