<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const isOwner = computed(()=> ['OWNER','SUPERADMIN'].includes(auth.user?.role));

const step = ref('list');        // list | detail
const error = ref('');
const notice = ref('');
const busy = ref(false);

const queue = ref([]);
const filterType = ref('');
const rec = ref(null);
const jv = ref(null);
const comments = ref('');

const peso = (c) => '₱' + (Number(c || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = (s) => ({
  FOR_REVIEW:'bg-primary', UNDER_INVESTIGATION:'bg-warning text-dark', PENDING_OWNER_APPROVAL:'bg-warning text-dark',
  APPROVED:'bg-success', REJECTED:'bg-danger', POSTED:'bg-success', CLOSED:'bg-dark', RECOUNT_REQUESTED:'bg-warning text-dark',
}[s] || 'bg-secondary');

async function loadQueue(){
  error.value='';
  try { const params={}; if(filterType.value) params.type=filterType.value;
    const { data } = await api.get('/recon/review', { params }); queue.value = data.reconciliations || []; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load queue.'; }
}

async function open(id){
  busy.value=true; error.value=''; comments.value='';
  try { const { data } = await api.get('/recon/review/'+id); rec.value = data.reconciliation; jv.value = data.journalPreview; step.value='detail'; }
  catch(e){ error.value = e.response?.data?.message || 'Could not open.'; }
  finally { busy.value=false; }
}

async function decide(decision){
  if (decision==='REJECT' && !comments.value.trim()) { error.value='Kailangan ng dahilan ang rejection.'; return; }
  busy.value=true; error.value='';
  try {
    const { data } = await api.post(`/recon/review/${rec.value._id}/decision`, { decision, comments: comments.value });
    rec.value = data.reconciliation; comments.value='';
    notice.value = decision==='APPROVE' ? 'Na-approve.' : decision==='REJECT' ? 'Na-reject.' : 'Recount requested.';
  } catch(e){ error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { busy.value=false; }
}

async function authorizePost(){
  if(!confirm('I-authorize ang posting sa General Ledger? Hindi na ito maba-back-edit pagkatapos.')) return;
  busy.value=true; error.value='';
  try {
    const { data } = await api.post(`/recon/review/${rec.value._id}/post`, {});
    rec.value = data.reconciliation;
    notice.value = data.journalVoucherRef ? `Na-post! JV: ${data.journalVoucherRef}` : 'Naisara (walang JV kailangan).';
  } catch(e){ error.value = e.response?.data?.message || 'Could not post.'; }
  finally { busy.value=false; }
}

async function closeRec(){
  busy.value=true; error.value='';
  try { const { data } = await api.post(`/recon/review/${rec.value._id}/close`, {}); rec.value = data.reconciliation; notice.value='Naisara.'; }
  catch(e){ error.value = e.response?.data?.message || 'Could not close.'; }
  finally { busy.value=false; }
}

function back(){ step.value='list'; rec.value=null; jv.value=null; notice.value=''; loadQueue(); }

const canDecide = computed(()=> rec.value && ['FOR_REVIEW','UNDER_INVESTIGATION','PENDING_OWNER_APPROVAL'].includes(rec.value.status));
const canPost = computed(()=> rec.value && rec.value.status==='APPROVED' && !rec.value.posted && rec.value.type!=='CASH');
const canConfirmFinal = computed(()=> rec.value && rec.value.type==='CASH' && rec.value.stage1Posted && !rec.value.posted);
async function confirmFinalPost(){
  if(!confirm('I-confirm at i-post ang FINAL entry (Stage 2)? Hindi na mababago pagkatapos.')) return;
  busy.value=true; error.value='';
  try {
    const { data } = await api.post(`/recon/review/${rec.value._id}/confirm-final`, {});
    rec.value = data.reconciliation;
    notice.value = data.journalVoucherRef ? `Confirmed! Final JV: ${data.journalVoucherRef}` : 'Naisara.';
  } catch(e){ error.value = e.response?.data?.message || 'Could not confirm.'; }
  finally { busy.value=false; }
}
const variances = computed(()=> rec.value?.variances || []);
const isStock = computed(()=> rec.value?.type==='STOCK');

onMounted(loadQueue);
</script>

<template>
  <div class="container-fluid py-3" style="max-width:1050px">
    <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
      <h4 class="mb-0" style="font-family:var(--font-display)">Reconciliation Review &amp; Approval</h4>
      <button v-if="step!=='list'" class="btn btn-ghost btn-sm" @click="back">← Balik sa queue</button>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- QUEUE -->
    <div v-if="step==='list'" class="card"><div class="card-body">
      <div class="mb-3"><select v-model="filterType" class="form-select form-select-sm" style="max-width:200px" @change="loadQueue">
        <option value="">— Lahat ng type —</option><option value="STOCK">Stock</option><option value="CASH">Cash</option><option value="CASHLESS">Cashless</option></select></div>
      <div class="table-responsive"><table class="table table-sm align-middle">
        <thead><tr><th>Reference</th><th>Type</th><th>Location</th><th>Conducted</th><th>Count</th><th>Status</th><th class="text-end">Variance</th><th>Submitted by</th><th></th></tr></thead>
        <tbody>
          <tr v-for="r in queue" :key="r._id">
            <td class="fw-semibold">{{ r.refNo }}</td><td>{{ r.type }}</td><td>{{ r.locationLabel }} <span v-if="r.provider" class="text-muted">({{ r.provider }})</span></td>
            <td class="small text-muted">{{ r.countDate ? fmtDateTime(r.countDate) : '—' }}</td>
            <td class="small"><span v-if="r.recountCount" class="badge bg-warning text-dark">Recount{{ r.recountCount>1 ? ' #'+r.recountCount : '' }}</span><span v-else class="text-muted">1st count</span></td>
            <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span>
              <span v-if="r.requiresOwnerApproval" class="badge bg-warning text-dark ms-1">Owner</span></td>
            <td class="text-end">{{ r.type==='STOCK' ? (r.totalVarianceUnits+' u') : peso(r.totalVarianceCentavos) }}</td>
            <td class="small text-muted">{{ r.submittedByName || '—' }}</td>
            <td><button class="btn btn-ghost btn-sm" @click="open(r._id)">Review</button></td>
          </tr>
          <tr v-if="!queue.length"><td colspan="9" class="text-center text-muted py-3">Walang naghihintay na review.</td></tr>
        </tbody>
      </table></div>
    </div></div>

    <!-- DETAIL -->
    <div v-else-if="step==='detail' && rec" class="card"><div class="card-body">
      <div class="d-flex justify-content-between flex-wrap gap-2 mb-2">
        <div>
          <div class="fw-semibold">{{ rec.refNo }} · {{ rec.type }} · {{ rec.locationLabel }}<span v-if="rec.provider"> ({{ rec.provider }})</span></div>
          <div class="small text-muted">Submitted by {{ rec.submittedByName || '—' }} · {{ fmtDateTime(rec.submittedAt) }} ·
            <span class="badge" :class="statusBadge(rec.status)">{{ rec.status }}</span>
            <span v-if="rec.requiresOwnerApproval" class="badge bg-warning text-dark ms-1">Owner approval required</span>
            <span v-if="rec.posted" class="badge bg-success ms-1">Posted {{ rec.journalVoucherRef }}</span>
            <span v-if="rec.stage1Posted && !rec.posted" class="badge bg-info ms-1">Stage 1 posted {{ rec.stage1JournalVoucherRef }}</span></div>
        </div>
      </div>

      <!-- Variances + evidence -->
      <h6 class="section-eyebrow">Variances</h6>
      <div v-if="!variances.length" class="alert alert-success py-2">Matched — walang variance.</div>
      <div v-else class="table-responsive mb-3"><table class="table table-sm align-middle">
        <thead><tr><th>{{ isStock?'Product':'Category' }}</th><th class="text-end">Expected</th><th class="text-end">Actual</th><th class="text-end">Variance</th><th>Reason</th><th>Evidence</th></tr></thead>
        <tbody>
          <tr v-for="(v,i) in variances" :key="i">
            <td>{{ (v.productName||'').replace(/_/g,' ') }} <span v-if="v.ownerFlagged" class="badge bg-danger">FLAG</span></td>
            <td class="text-end">{{ isStock? v.expected : peso(v.expected) }}</td>
            <td class="text-end">{{ isStock? v.actual : peso(v.actual) }}</td>
            <td class="text-end fw-semibold" :class="v.variance<0?'text-danger':'text-success'">{{ isStock? v.variance : peso(v.variance) }}</td>
            <td class="small">{{ v.reasonCode || '—' }}<div class="text-muted">{{ v.explanation }}</div></td>
            <td class="small"><a v-for="(e,j) in (v.evidence||[])" :key="j" :href="e.url" target="_blank" rel="noopener" class="d-block">{{ e.kind }} ↗</a><span v-if="!(v.evidence||[]).length" class="text-muted">—</span></td>
          </tr>
        </tbody>
      </table></div>

      <!-- Journal preview (Screen 10) -->
      <h6 class="section-eyebrow">Journal Entry Preview</h6>
      <div v-if="jv && jv.lines.length" class="table-responsive mb-1"><table class="table table-sm align-middle" style="max-width:560px">
        <thead><tr><th>Account</th><th class="text-end">Debit</th><th class="text-end">Credit</th></tr></thead>
        <tbody>
          <tr v-for="(l,i) in jv.lines" :key="i"><td>{{ l.accountCode }} <span class="text-muted small">{{ l.description }}</span></td>
            <td class="text-end">{{ l.debit? money(l.debit):'' }}</td><td class="text-end">{{ l.credit? money(l.credit):'' }}</td></tr>
          <tr class="fw-semibold border-top"><td>Total</td><td class="text-end">{{ money(jv.totalDebit) }}</td><td class="text-end">{{ money(jv.totalCredit) }}</td></tr>
        </tbody>
      </table>
      <div class="small mb-3" :class="jv.balanced?'text-success':'text-danger'">{{ jv.balanced?'Balanced ✓':'HINDI balanced ✗' }}
        <span v-if="isStock" class="text-muted">· (approximate — FIFO ang aktwal sa posting)</span></div></div>
      <div v-else class="alert alert-light py-2 small mb-3">Walang journal entry kakailanganin (matched o counting error lang).</div>

      <!-- Status history -->
      <details class="mb-3"><summary class="small text-muted">Status history ({{ (rec.statusHistory||[]).length }})</summary>
        <ul class="small text-muted mb-0 mt-1">
          <li v-for="(h,i) in rec.statusHistory" :key="i">{{ fmtDateTime(h.at) }} — {{ h.from }} → <strong>{{ h.to }}</strong> · {{ h.byName }} <span v-if="h.note">· {{ h.note }}</span></li>
        </ul>
      </details>

      <!-- Decision controls -->
      <div v-if="canDecide">
        <label class="form-label small mb-0">Reviewer comments (kailangan kapag Reject)</label>
        <textarea v-model="comments" class="form-control form-control-sm mb-2" rows="2"></textarea>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-success btn-sm" :disabled="busy" @click="decide('APPROVE')">Approve</button>
          <button class="btn btn-danger btn-sm" :disabled="busy" @click="decide('REJECT')">Reject</button>
          <button class="btn btn-ghost btn-sm" :disabled="busy" @click="decide('RECOUNT')">Request Recount</button>
        </div>
        <p v-if="rec.requiresOwnerApproval && !isOwner" class="small text-muted mt-2">Kailangan ng owner approval — pupunta muna sa owner ang approval mo.</p>
      </div>

      <div v-if="canPost" class="mt-3 pt-3 border-top">
        <p class="small text-muted mb-1">Approved na. I-authorize ang posting sa General Ledger (owner lang; hindi na maba-back-edit).<span v-if="rec.type==='CASH'"> Para sa cash, <strong>Stage 1</strong> (to suspense) muna ang ipo-post.</span></p>
        <button class="btn btn-primary btn-sm" :disabled="busy || !isOwner" @click="authorizePost">{{ rec.type==='CASH' ? 'Authorize Posting (Stage 1)' : 'Authorize Posting' }}</button>
        <span v-if="!isOwner" class="small text-muted ms-2">Owner lang ang makakapag-post.</span>
      </div>

      <div v-if="canConfirmFinal" class="mt-3 pt-3 border-top">
        <p class="small text-muted mb-1">Naka-post na ang <strong>Stage 1</strong> (investigation, JV {{ rec.stage1JournalVoucherRef }}). I-confirm at i-post ang <strong>final</strong> entry (Stage 2 — expense/income).</p>
        <button class="btn btn-primary btn-sm" :disabled="busy || !isOwner" @click="confirmFinalPost">Confirm &amp; Post Final</button>
        <span v-if="!isOwner" class="small text-muted ms-2">Owner lang ang makakapag-confirm.</span>
      </div>

      <div v-if="rec.status==='REJECTED'" class="mt-3">
        <div class="alert alert-danger py-2 small mb-2">Rejected: {{ rec.rejectedReason }}</div>
        <button class="btn btn-ghost btn-sm" :disabled="busy" @click="closeRec">Isara (close record)</button>
      </div>
    </div></div>
  </div>
</template>
