<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { fmtDate } from '../utils/datetime.js';

const auth = useAuthStore();
const isAdmin = computed(() => auth.isOwner || auth.isSuperadmin);

const transfers = ref([]);
const loading = ref(false);
const error = ref('');
const busy = ref('');

const STATUS = {
  UNDER_REVIEW:{ label:'Under Review', cls:'warn' }, COMPLETED:{ label:'Completed', cls:'ok' },
  ACKNOWLEDGED:{ label:'Acknowledged', cls:'ack' }, PARKED:{ label:'Parked', cls:'park' }, POSTED:{ label:'Posted', cls:'ok' },
};
const statusOf = (s)=> STATUS[s] || { label:s||'—', cls:'' };
function lineRoute(l){
  const s = l.sourceMachine ? (l.sourceMachine.locationName||l.sourceMachine.machineId) : 'Warehouse';
  const d = l.destMachine ? (l.destMachine.locationName||l.destMachine.machineId) : 'Warehouse';
  const tag=(t)=> t==='SIDE_CABINET'?' (side cab)': t==='MACHINE_LOADED'?' (display)':'';
  return `${s}${tag(l.sourceType)} → ${d}${tag(l.destType)}`;
}

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/transfers/assigned'); transfers.value = data.transfers; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load deliveries.'; }
  finally { loading.value=false; }
}
async function acknowledge(t){
  busy.value=t._id; error.value='';
  try { await api.post(`/transfers/${t._id}/acknowledge`); await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not acknowledge.'; }
  finally { busy.value=''; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Transfers / Deliveries</h3>
    <p class="text-muted">
      <template v-if="isAdmin">Lahat ng transfer na naka-assign sa mga rider. Kitang-kita kung alin ang hindi pa na-acknowledge.</template>
      <template v-else>Mga transfer na naka-assign sa iyo. I-acknowledge kapag natanggap na para sa delivery / restocking.</template>
    </p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!transfers.length" class="card"><div class="card-body text-muted text-center py-4">Walang naka-assign na transfer.</div></div>

    <div v-for="t in transfers" :key="t._id" class="card mb-2"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-semibold" style="font-family:var(--font-display)">{{ t.transferNo }}
            <span class="pill ms-1" :class="statusOf(t.status).cls">{{ statusOf(t.status).label }}</span></div>
          <div class="text-muted small">{{ fmtDate(t.date) }} ·
            <span v-if="isAdmin">Rider: {{ t.assignedRider?.name || '—' }} · </span>{{ (t.lines?.length||0) }} line(s)</div>
        </div>
        <button v-if="t.status==='COMPLETED'" class="btn btn-primary btn-sm" :disabled="busy===t._id" @click="acknowledge(t)">
          {{ busy===t._id ? '…' : 'Acknowledge' }}
        </button>
        <span v-else-if="t.status==='ACKNOWLEDGED'" class="pill ack">✓ Acknowledged</span>
        <span v-else class="text-muted small">Awaiting approval</span>
      </div>
      <table class="fin-table ruled mt-2" style="width:100%">
        <thead><tr><th class="lbl">Product</th><th class="lbl">Route</th><th>Qty</th></tr></thead>
        <tbody>
          <tr v-for="(l,i) in (t.lines||[])" :key="i">
            <td class="lbl">{{ l.product?.name || 'Product' }} <span class="text-muted small">{{ l.product?.sku }}</span></td>
            <td class="lbl">{{ lineRoute(l) }}</td>
            <td class="num">{{ l.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>

<style scoped>
.pill { font-size:.66rem; font-weight:700; padding:.12rem .55rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); }
.pill.warn { background:#FFF3DF; color:var(--dawn-deep); }
.pill.park { background:#E7F5E9; color:#2E7D32; }
.pill.ack { background:#E6EEFB; color:#2451B3; }
</style>
