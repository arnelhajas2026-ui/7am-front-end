<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

const pending = ref([]);
const recent = ref([]);
const loading = ref(false);
const error = ref('');
const busy = ref(false);
const notes = ref({});

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/approvals'); pending.value=data.pending; recent.value=data.recent; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load approvals.'; }
  finally { loading.value=false; }
}
async function decide(req, action){
  busy.value=true; error.value='';
  try { await api.post(`/approvals/${req._id}/${action}`, { note: notes.value[req._id] || '' }); await load(); }
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
    <p class="text-muted">Employee submissions that need your review before they take effect.</p>
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
      <input v-model="notes[req._id]" class="form-control form-control-sm mb-2" placeholder="Note (optional)" />
      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-danger7 btn-sm" :disabled="busy" @click="decide(req,'reject')">Reject</button>
        <button class="btn btn-primary btn-sm" :disabled="busy" @click="decide(req,'approve')">Approve</button>
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
