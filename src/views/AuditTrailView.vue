<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';
import { exportCSV, stampPH } from '../utils/exporters.js';

const route = useRoute();
const logs = ref([]);
const types = ref([]);
const loading = ref(false);
const error = ref('');
const expanded = ref(null);

const fType = ref(route.query.entityType || '');
const fEntityId = ref(route.query.entityId || '');
const fEntityName = ref(route.query.name || '');
const fAction = ref('');
const fWho = ref('');
const fStart = ref('');
const fEnd = ref('');

const ACTIONS = ['CREATE','UPDATE','DELETE','VOID','RESTORE','LOGIN'];

async function loadTypes(){
  try { const { data } = await api.get('/audit/entity-types'); types.value = data.types; } catch {}
}
async function load(){
  loading.value=true; error.value='';
  try {
    const params = {};
    if(fType.value) params.entityType = fType.value;
    if(fEntityId.value) params.entityId = fEntityId.value;
    if(fAction.value) params.action = fAction.value;
    if(fWho.value) params.q = fWho.value;
    if(fStart.value) params.start = fStart.value;
    if(fEnd.value) params.end = fEnd.value;
    const { data } = await api.get('/audit', { params });
    logs.value = data.logs;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load audit trail.'; }
  finally { loading.value=false; }
}
function clearEntity(){ fEntityId.value=''; fEntityName.value=''; load(); }

function fields(obj){
  if(obj === null || obj === undefined) return [];
  if(typeof obj !== 'object') return [['value', String(obj)]];
  return Object.entries(obj).map(([k,v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
}

const actionClass = (a) => ({ CREATE:'emp', UPDATE:'emp', DELETE:'off', VOID:'off', RESTORE:'owner', LOGIN:'emp' }[a] || 'emp');

function downloadCSV(){
  const rows = [['When','Who','Action','Entity','Entity ID','Reason','Before','After']];
  for(const l of logs.value){
    rows.push([ fmtDateTime(l.createdAt), l.actorName||'', l.action, l.entityType, l.entityId||'',
      l.reason||'', l.before ? JSON.stringify(l.before) : '', l.after ? JSON.stringify(l.after) : '' ]);
  }
  exportCSV(`audit-trail_${stampPH()}.csv`, rows);
}

onMounted(async ()=>{ await loadTypes(); await load(); });
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-2">
      <h3 class="mb-0">Audit Trail</h3>
      <button class="btn btn-ghost btn-sm" @click="downloadCSV">⤓ CSV</button>
    </div>
    <p class="text-muted">Who changed what, and when. Append-only record for accountability — hindi ito mae-edit o mabubura.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="fEntityName" class="alert alert-info py-2 d-flex justify-content-between align-items-center">
      <span>Showing history for: <strong>{{ fEntityName }}</strong></span>
      <button class="btn btn-ghost btn-sm" @click="clearEntity">Show all</button>
    </div>

    <div class="row g-2 mb-3">
      <div class="col-6 col-md-3"><label class="form-label">Entity type</label>
        <select v-model="fType" class="form-select form-select-sm" @change="load">
          <option value="">All</option>
          <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
        </select></div>
      <div class="col-6 col-md-2"><label class="form-label">Action</label>
        <select v-model="fAction" class="form-select form-select-sm" @change="load">
          <option value="">All</option>
          <option v-for="a in ACTIONS" :key="a" :value="a">{{ a }}</option>
        </select></div>
      <div class="col-6 col-md-3"><label class="form-label">Who (name)</label>
        <input v-model="fWho" class="form-control form-control-sm" placeholder="Actor name…" @keyup.enter="load" /></div>
      <div class="col-3 col-md-2"><label class="form-label">From</label><input v-model="fStart" type="date" class="form-control form-control-sm" @change="load" /></div>
      <div class="col-3 col-md-2"><label class="form-label">To</label><input v-model="fEnd" type="date" class="form-control form-control-sm" @change="load" /></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!logs.length" class="card"><div class="card-body text-muted text-center py-4">Walang audit record sa filter na ito.</div></div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table ruled" style="min-width:820px">
        <thead><tr><th class="lbl">When</th><th class="lbl">Who</th><th class="lbl">Action</th><th class="lbl">Entity</th><th class="lbl">Reason</th><th class="lbl">Details</th></tr></thead>
        <tbody>
          <template v-for="(l,i) in logs" :key="l._id">
            <tr>
              <td class="lbl">{{ fmtDateTime(l.createdAt) }}</td>
              <td class="lbl">{{ l.actorName || '—' }}</td>
              <td class="lbl"><span class="badge7" :class="actionClass(l.action)">{{ l.action }}</span></td>
              <td class="lbl">{{ l.entityType }}<span v-if="l.entityId" class="text-muted small"> · {{ l.entityId.slice(-6) }}</span></td>
              <td class="lbl text-muted small">{{ l.reason || '' }}</td>
              <td class="lbl">
                <button v-if="l.before || l.after" class="btn btn-ghost btn-sm py-0" @click="expanded = expanded===i ? null : i">
                  {{ expanded===i ? 'Hide' : 'View' }}
                </button>
              </td>
            </tr>
            <tr v-if="expanded===i">
              <td colspan="6" style="background:#F8FAFC">
                <div class="row g-3 py-2">
                  <div class="col-12 col-md-6">
                    <div class="section-eyebrow mb-1">Before</div>
                    <div v-if="!l.before" class="text-muted small">—</div>
                    <div v-else class="diff-box">
                      <div v-for="[k,v] in fields(l.before)" :key="k" class="diff-row"><span class="dk">{{ k }}</span><span class="dv">{{ v }}</span></div>
                    </div>
                  </div>
                  <div class="col-12 col-md-6">
                    <div class="section-eyebrow mb-1">After</div>
                    <div v-if="!l.after" class="text-muted small">—</div>
                    <div v-else class="diff-box">
                      <div v-for="[k,v] in fields(l.after)" :key="k" class="diff-row"><span class="dk">{{ k }}</span><span class="dv">{{ v }}</span></div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div></div>
    <p class="text-muted small mt-2">{{ logs.length }} record(s) · newest first</p>
  </div>
</template>

<style scoped>
.diff-box { font-size:.8rem; }
.diff-row { display:flex; gap:8px; padding:.12rem 0; border-bottom:1px dashed #E3E8EF; }
.dk { flex:0 0 130px; color:var(--muted,#8a94a3); font-weight:600; }
.dv { flex:1 1 auto; word-break:break-word; font-variant-numeric:tabular-nums; }
</style>
