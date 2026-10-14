<script setup>
import { ref, reactive, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

const pending = ref([]);
const recent = ref([]);
const riders = ref([]);
const loading = ref(false);
const error = ref('');
const busy = ref(false);
const notes = ref({});
const edits = reactive({}); // reqId -> { date, assignedRider, lines[] }

const isoForInput = (d)=> d ? new Date(d).toLocaleDateString('en-CA',{ timeZone:'Asia/Manila' }) : '';
function lineRoute(l){
  const s = l.sourceMachine ? (l.sourceMachine.locationName||l.sourceMachine.machineId) : 'Warehouse';
  const d = l.destMachine ? (l.destMachine.locationName||l.destMachine.machineId) : 'Warehouse';
  const tag=(t)=> t==='SIDE_CABINET'?' (side cab)': t==='MACHINE_LOADED'?' (display)':'';
  return `${s}${tag(l.sourceType)} → ${d}${tag(l.destType)}`;
}
function initEdits(reqs){
  for (const r of reqs){
    if (r.action==='transfer.post' && r.transfer){
      edits[r._id] = {
        date: isoForInput(r.transfer.date),
        assignedRider: r.transfer.assignedRider?._id || r.transfer.assignedRider || '',
        lines: (r.transfer.lines||[]).map((l)=>({
          product: l.product?._id || l.product,
          sourceType: l.sourceType, sourceMachine: l.sourceMachine?._id || l.sourceMachine || null,
          destType: l.destType, destMachine: l.destMachine?._id || l.destMachine || null,
          quantity: l.quantity,
          productName: l.product?.name || 'Product', sku: l.product?.sku || '',
          routeLabel: lineRoute(l),
        })),
      };
    }
  }
}

async function load(){
  loading.value=true; error.value='';
  try {
    const [a, rd] = await Promise.all([ api.get('/approvals'), api.get('/riders') ]);
    pending.value = a.data.pending; recent.value = a.data.recent; riders.value = rd.data.riders;
    for (const k of Object.keys(edits)) delete edits[k];
    initEdits(pending.value);
  }
  catch(e){ error.value = e.response?.data?.message || 'Could not load approvals.'; }
  finally { loading.value=false; }
}
async function decide(req, action){
  busy.value=true; error.value='';
  try {
    // Transfer: i-save muna ang mga edit ng owner (qty/rider/date) bago i-approve.
    if (action==='approve' && req.action==='transfer.post' && req.transfer && edits[req._id]){
      const e = edits[req._id];
      await api.patch(`/transfers/${req.transfer._id}/review-edit`, {
        date: e.date || undefined,
        assignedRider: e.assignedRider || null,
        lines: e.lines.map((l)=>({ product:l.product, sourceType:l.sourceType, sourceMachine:l.sourceMachine, destType:l.destType, destMachine:l.destMachine, quantity:Number(l.quantity) })),
      });
    }
    await api.post(`/approvals/${req._id}/${action}`, { note: notes.value[req._id] || '' });
    await load();
  }
  catch(e){ error.value = e.response?.data?.message || 'Could not process the request.'; }
  finally { busy.value=false; }
}
const dt = fmtDateTime;
const statusPill = (s)=> s==='APPROVED' ? 'ok' : 'warn';
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Approvals</h3>
    <p class="text-muted">Employee submissions that need your review before they take effect. Pwede mong i-edit ang detalye bago i-approve.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <p class="section-eyebrow">Pending</p>
    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!pending.length" class="card mb-4"><div class="card-body text-muted text-center py-4">No pending requests. 🎉</div></div>

    <div v-for="req in pending" :key="req._id" class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <div>
          <div class="fw-semibold">{{ req.label }}</div>
          <div class="text-muted small">by {{ req.requestedBy?.name || '—' }} · {{ dt(req.createdAt) }} · {{ req.module }}</div>
        </div>
        <span class="badge7 emp">{{ req.action }}</span>
      </div>

      <!-- Transfer document mirror (editable) -->
      <div v-if="req.action==='transfer.post' && req.transfer && edits[req._id]" class="doc-box mb-2">
        <div class="row g-2 align-items-end mb-2">
          <div class="col-6 col-md-4"><label class="form-label mb-0">Transfer No.</label>
            <div class="fw-semibold">{{ req.transfer.transferNo }}</div></div>
          <div class="col-6 col-md-4"><label class="form-label mb-0">Assign to (rider)</label>
            <select v-model="edits[req._id].assignedRider" class="form-select form-select-sm">
              <option value="">— rider —</option>
              <option v-for="r in riders" :key="r._id" :value="r._id">{{ r.name }}</option>
            </select></div>
          <div class="col-6 col-md-4"><label class="form-label mb-0">Date</label>
            <input v-model="edits[req._id].date" type="date" class="form-control form-control-sm" /></div>
        </div>
        <table class="doc-table">
          <thead><tr><th>Product</th><th>Route (source → destination)</th><th class="r" style="width:90px">Qty</th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in edits[req._id].lines" :key="i">
              <td>{{ l.productName }} <span class="text-muted small">{{ l.sku }}</span></td>
              <td>{{ l.routeLabel }}</td>
              <td class="r"><input v-model.number="l.quantity" type="number" class="form-control form-control-sm numeric" /></td>
            </tr>
          </tbody>
        </table>
        <div class="text-muted xs mt-1">Pwede mong baguhin ang qty, rider, o date dito. Para sa source/destination na mali, i-reject na lang at ipa-gawa ulit.</div>
      </div>

      <input v-model="notes[req._id]" class="form-control form-control-sm mb-2" placeholder="Note (optional)" />
      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-danger7 btn-sm" :disabled="busy" @click="decide(req,'reject')">Reject</button>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="decide(req,'approve')">{{ req.action==='transfer.post' ? 'Save & Approve' : 'Approve' }}</button>
      </div>
    </div></div>

    <p class="section-eyebrow mt-2">Recent decisions</p>
    <div v-if="!recent.length" class="text-muted">None yet.</div>
    <div v-for="req in recent" :key="req._id" class="card mb-2"><div class="card-body py-2 d-flex justify-content-between align-items-center">
      <div><div class="fw-semibold small">{{ req.label }}</div>
        <div class="text-muted small">by {{ req.requestedBy?.name }} · reviewed by {{ req.reviewedBy?.name }} · {{ dt(req.reviewedAt) }}</div></div>
      <span class="pill" :class="statusPill(req.status)">{{ req.status }}</span>
    </div></div>
  </div>
</template>

<style scoped>
.doc-box { border:1px solid var(--line); border-radius:12px; padding:.7rem .8rem; background:#FAFBFC; }
.doc-table { width:100%; border-collapse:collapse; font-size:.84rem; }
.doc-table thead th { text-align:left; font-size:.62rem; text-transform:uppercase; letter-spacing:.03em; color:#3A4A5E; padding:.3rem .4rem; border-bottom:1px solid var(--line); }
.doc-table thead th.r { text-align:right; }
.doc-table tbody td { padding:.3rem .4rem; border-bottom:1px solid var(--line); vertical-align:middle; }
.doc-table tbody td.r { text-align:right; }
.xs { font-size:.72rem; }
.pill { font-size:.7rem; font-weight:700; padding:.15rem .5rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); } .pill.warn { background:#FFF3DF; color:var(--dawn-deep); }
</style>
