<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';

const rows = ref([]);
const total = ref(0);
const control = ref(null);
const loading = ref(false);
const error = ref('');
const search = ref('');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const reconciled = computed(() => control.value && Math.abs(control.value.diff) < 0.01);
const visible = computed(() => {
  const q = search.value.trim().toLowerCase();
  return rows.value.filter((r) => !q || (r.name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q));
});

async function load() {
  loading.value = true; error.value = '';
  try {
    const { data } = await api.get('/ledger/inventory');
    rows.value = data.rows; total.value = data.total; control.value = data.control;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load inventory sub-ledger.'; }
  finally { loading.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Inventory Sub-Ledger</h3>
    <p class="text-muted">FIFO valuation per product. Dapat tumugma sa GL control account na Merchandise Inventory (1100).</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Reconciliation banner -->
    <div v-if="control" class="recon" :class="reconciled ? 'ok' : 'off'">
      <div>
        <div class="recon-label">Sub-ledger total</div>
        <div class="recon-val">{{ peso(total) }}</div>
      </div>
      <div class="recon-eq">vs</div>
      <div>
        <div class="recon-label">GL {{ control.code }} · {{ control.name }}</div>
        <div class="recon-val">{{ peso(control.glBalance) }}</div>
      </div>
      <div class="recon-badge">
        <span v-if="reconciled">✓ Reconciled</span>
        <span v-else>✗ Off by {{ peso(control.diff) }}</span>
      </div>
    </div>

    <div class="mb-3" style="max-width:360px"><input v-model="search" class="form-control" placeholder="Search product or SKU…" /></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:620px">
        <thead><tr><th class="lbl">SKU</th><th class="lbl">Product</th><th>Qty on Hand</th><th>Avg Cost</th><th>Value (FIFO)</th></tr></thead>
        <tbody>
          <tr v-for="r in visible" :key="r.product">
            <td class="lbl">{{ r.sku }}</td>
            <td class="lbl">{{ r.name }}</td>
            <td class="num">{{ r.qty }}</td>
            <td class="num">{{ peso(r.avgCost) }}</td>
            <td class="num fw-semibold">{{ peso(r.value) }}</td>
          </tr>
          <tr v-if="!visible.length"><td colspan="5" class="text-center text-muted py-3">Walang stock na may halaga.</td></tr>
        </tbody>
        <tfoot v-if="visible.length"><tr class="gp"><td class="lbl" colspan="4">Total inventory value</td><td class="num fw-bold">{{ peso(total) }}</td></tr></tfoot>
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
