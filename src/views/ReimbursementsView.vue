<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { fmtDate } from '../utils/datetime.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

// Mga kategorya — naka-tugma sa expense-account mapping ng system.
const CATEGORIES = [
  'Gas / Fuel', 'Parking fee', 'Toll / Ticket', 'Travel / Fare',
  'Electricity (shop)', 'Water (shop)', 'Internet (shop)', 'Load / Communication',
  'Printing', 'Shop supplies', 'Machine supplies / inventory', 'Coin change (machine)',
  'Repair / Maintenance', 'Others',
];

const items = ref([]);
const riders = ref([]);
const machines = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const blankLine = () => ({ category: '', description: '', amount: 0, machine: '' });
const form = reactive({ rider: '', date: today(), cashAccount: 'ON_HAND', notes: '', lines: [blankLine()] });

const formTotal = computed(() => form.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));

function resetForm() {
  form.rider = ''; form.date = today(); form.cashAccount = 'ON_HAND'; form.notes = '';
  form.lines = [blankLine()];
}
function addLine() { form.lines.push(blankLine()); }
function removeLine(i) { form.lines.splice(i, 1); if (!form.lines.length) form.lines.push(blankLine()); }

async function load() {
  loading.value = true; error.value = '';
  try {
    const reqs = [api.get('/reimbursements'), api.get('/machines')];
    if (isOwner.value) reqs.push(api.get('/riders'));
    const [r, m, rd] = await Promise.all(reqs);
    items.value = r.data.reimbursements;
    machines.value = m.data.machines || [];
    if (rd) riders.value = rd.data.riders || [];
  } catch (e) { error.value = e.response?.data?.message || 'Could not load reimbursements.'; }
  finally { loading.value = false; }
}

async function submit() {
  saving.value = true; error.value = '';
  try {
    const lines = form.lines
      .map((l) => ({ category: l.category, description: l.description, amount: Number(l.amount) || 0, machine: l.machine || undefined }))
      .filter((l) => l.category && l.amount > 0);
    if (!lines.length) { error.value = 'Magdagdag man lang ng isang linya (may category at amount).'; saving.value = false; return; }
    await api.post('/reimbursements', {
      rider: form.rider || undefined, date: form.date, cashAccount: form.cashAccount, notes: form.notes, lines,
    });
    showForm.value = false; resetForm(); await load();
  } catch (e) { error.value = e.response?.data?.message || 'Could not submit.'; }
  finally { saving.value = false; }
}

async function approve(r) {
  if (!confirm(`I-approve ang reimbursement na ${peso(r.total)}? Gagawa ito ng journal entry (Cash Disbursement).`)) return;
  error.value = '';
  try { await api.post(`/reimbursements/${r._id}/approve`); await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Could not approve.'; }
}
async function reject(r) {
  const reason = prompt('Rason sa pag-reject (optional):') ?? null;
  if (reason === null) return;
  error.value = '';
  try { await api.post(`/reimbursements/${r._id}/reject`, { reason }); await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Could not reject.'; }
}

const badgeClass = (s) => s === 'APPROVED' ? 'bg-success' : s === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark';
const cashLabel = (c) => c === 'BANK' ? 'Cash in Bank' : c === 'GCASH' ? 'GCash / E-Wallet' : 'Cash on Hand';

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-2">
      <h3 class="mb-0">Reimbursements</h3>
      <button class="btn btn-primary btn-sm" @click="showForm = !showForm; if(showForm) resetForm()">
        {{ showForm ? 'Close' : '+ New reimbursement' }}
      </button>
    </div>
    <p class="text-muted">Mga gastos na binayaran muna ng rider gamit sariling pera (gas, load, parking, coin change, supplies, kuryente/tubig/internet sa shop, atbp.). I-submit para sa approval ng owner — kapag APPROVED, awtomatikong may journal entry (Cash Disbursement) at papasok sa GL.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Submit form -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <h5 class="mb-3" style="font-family:var(--font-display)">New reimbursement</h5>
      <div class="row g-2 mb-2">
        <div v-if="isOwner" class="col-12 col-md-4"><label class="form-label mb-0 small text-muted">Rider / Payee</label>
          <select v-model="form.rider" class="form-select form-select-sm">
            <option value="">— self ({{ auth.user?.name }}) —</option>
            <option v-for="rd in riders" :key="rd._id" :value="rd._id">{{ rd.name }}</option>
          </select></div>
        <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Date</label>
          <input v-model="form.date" type="date" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Reimburse from</label>
          <select v-model="form.cashAccount" class="form-select form-select-sm">
            <option value="ON_HAND">Cash on Hand</option>
            <option value="BANK">Cash in Bank</option>
            <option value="GCASH">GCash / E-Wallet</option>
          </select></div>
      </div>

      <div class="table-responsive">
        <table class="table table-sm align-middle" style="min-width:680px">
          <thead><tr>
            <th style="width:22%">Category</th><th>Description</th>
            <th style="width:20%">Machine (optional)</th><th style="width:15%" class="text-end">Amount</th><th style="width:40px"></th>
          </tr></thead>
          <tbody>
            <tr v-for="(l,i) in form.lines" :key="i">
              <td><select v-model="l.category" class="form-select form-select-sm">
                <option value="">— pumili —</option>
                <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
              </select></td>
              <td><input v-model="l.description" class="form-control form-control-sm" placeholder="Detalye (optional)" /></td>
              <td><select v-model="l.machine" class="form-select form-select-sm">
                <option value="">—</option>
                <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option>
              </select></td>
              <td><input v-model.number="l.amount" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" /></td>
              <td><button class="btn btn-ghost btn-sm" @click="removeLine(i)" title="Remove">✕</button></td>
            </tr>
          </tbody>
          <tfoot><tr>
            <td colspan="3"><button class="btn btn-ghost btn-sm" @click="addLine">+ Add line</button></td>
            <td class="text-end fw-bold">{{ peso(formTotal) }}</td><td></td>
          </tr></tfoot>
        </table>
      </div>

      <div class="mb-2"><label class="form-label mb-0 small text-muted">Notes</label>
        <textarea v-model="form.notes" rows="2" class="form-control form-control-sm" placeholder="Karagdagang paliwanag (optional)"></textarea></div>
      <div class="d-flex gap-2">
        <button class="btn btn-primary btn-sm" :disabled="saving || formTotal <= 0" @click="submit">{{ saving ? 'Submitting…' : 'Submit for approval' }}</button>
        <button class="btn btn-ghost btn-sm" @click="showForm = false">Cancel</button>
      </div>
    </div></div>

    <!-- List -->
    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:820px">
        <thead><tr>
          <th class="lbl">Date</th><th class="lbl">Rider / Payee</th><th class="lbl">Items</th>
          <th class="lbl">From</th><th>Total</th><th class="lbl">Status</th><th class="lbl">Action</th>
        </tr></thead>
        <tbody>
          <tr v-for="r in items" :key="r._id">
            <td class="lbl">{{ fmtDate(r.date) }}</td>
            <td class="lbl">{{ r.rider?.name || r.createdBy?.name || '—' }}</td>
            <td class="lbl">
              <div v-for="(l,i) in r.lines" :key="i" class="small">
                {{ l.category }}<span v-if="l.description"> — {{ l.description }}</span>
                <span v-if="l.machine"> · {{ l.machine.locationName || l.machine.machineId }}</span>
                <span class="text-muted"> ({{ peso(l.amount) }})</span>
              </div>
            </td>
            <td class="lbl small">{{ cashLabel(r.cashAccount) }}</td>
            <td class="num fw-semibold">{{ peso(r.total) }}</td>
            <td class="lbl"><span class="badge" :class="badgeClass(r.status)">{{ r.status }}</span>
              <div v-if="r.status==='REJECTED' && r.rejectReason" class="text-muted small">{{ r.rejectReason }}</div></td>
            <td class="lbl">
              <div v-if="isOwner && r.status==='SUBMITTED'" class="d-flex gap-1">
                <button class="btn btn-primary btn-sm" @click="approve(r)">Approve</button>
                <button class="btn btn-ghost btn-sm" @click="reject(r)">Reject</button>
              </div>
              <span v-else-if="r.status==='APPROVED'" class="text-muted small">by {{ r.approvedBy?.name || '—' }}</span>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="7" class="text-center text-muted py-3">Wala pang reimbursement.</td></tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>
