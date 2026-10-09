<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { fmtDate } from '../utils/datetime.js';

const auth = useAuthStore();
const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

const assets = ref([]);
const summary = ref(null);
const categories = ref([]);
const costCenters = ref([]);
const machines = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');

const showForm = ref(false);
const depDate = ref(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
const disposeFor = ref(null);
const disposeForm = ref({ date: '', proceeds: 0 });
const schedule = ref(null);          // { asset, schedule:[...] }
const scheduleLoading = ref(false);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const round = (n) => Math.round(Number(n || 0) * 100) / 100;
const machineById = computed(() => Object.fromEntries(machines.value.map((m) => [m._id, m])));

function blank() { return { id: null, deviceId: '', name: '', category: 'Vending Machine', installationDate: '', acquisitionDate: '', cost: 0, salvagePercent: 0, usefulLifeYears: 5, costCenter: '', machine: '', openingAccumulated: 0 }; }
const form = ref(blank());

// Auto-compute (gaya ng excel formula ni client)
const salvageValueCalc = computed(() => round(Number(form.value.cost || 0) * Number(form.value.salvagePercent || 0) / 100));
const depreciableCalc = computed(() => round(Number(form.value.cost || 0) - salvageValueCalc.value));

async function load() {
  loading.value = true; error.value = '';
  try {
    const [fa, cc, ma] = await Promise.all([api.get('/fixed-assets'), api.get('/cost-centers'), api.get('/machines')]);
    assets.value = fa.data.assets; summary.value = fa.data.summary; categories.value = fa.data.categories;
    costCenters.value = cc.data.costCenters; machines.value = ma.data.machines;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value = false; }
}
function openNew() { form.value = blank(); schedule.value = null; showForm.value = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function edit(a) {
  form.value = { id: a._id, deviceId: a.deviceId || a.name || '', name: a.name, category: a.category,
    installationDate: a.installationDate ? a.installationDate.slice(0, 10) : '',
    acquisitionDate: a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : '',
    cost: a.cost, salvagePercent: a.salvagePercent || 0, usefulLifeYears: a.usefulLifeYears, costCenter: a.costCenter || '',
    machine: a.machine?._id || a.machine || '', openingAccumulated: a.openingAccumulated };
  showForm.value = true; loadSchedule(a._id); window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Machine → autofill Device ID (editable pa rin)
function onMachine() {
  const m = machineById.value[form.value.machine];
  if (m && m.deviceId) form.value.deviceId = m.deviceId;
}
async function save() {
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const payload = { ...form.value, salvageValue: salvageValueCalc.value };
    if (form.value.id) await api.patch(`/fixed-assets/${form.value.id}`, payload);
    else await api.post('/fixed-assets', payload);
    showForm.value = false; await load();
  } catch (e) { error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value = false; }
}
async function loadSchedule(id) {
  scheduleLoading.value = true; schedule.value = null;
  try { const { data } = await api.get(`/fixed-assets/${id}/schedule`); schedule.value = data; }
  catch { schedule.value = null; }
  finally { scheduleLoading.value = false; }
}
async function runThrough(monthEnd) {
  if (!confirm(`I-run ang month-end depreciation hanggang ${monthEnd}? Magpo-post ng journal entry para sa lahat ng active assets.`)) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const { data } = await api.post('/fixed-assets/run-depreciation', { through: monthEnd });
    notice.value = `Depreciation posted: ${peso(data.totalDepreciation)} (${data.posted} asset/s) — ${data.entryRef}`;
    await load(); if (form.value.id) await loadSchedule(form.value.id);
  } catch (e) { error.value = e.response?.data?.message || 'Could not run depreciation.'; }
  finally { saving.value = false; }
}
async function runDep() {
  if (!confirm(`I-run ang depreciation hanggang ${depDate.value}? Magpo-post ng journal entry.`)) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const { data } = await api.post('/fixed-assets/run-depreciation', { through: depDate.value });
    notice.value = `Depreciation posted: ${peso(data.totalDepreciation)} (${data.posted} asset/s) — ${data.entryRef}`;
    await load();
  } catch (e) { error.value = e.response?.data?.message || 'Could not run depreciation.'; }
  finally { saving.value = false; }
}
function openDispose(a) { disposeFor.value = a; disposeForm.value = { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), proceeds: 0 }; }
async function doDispose() {
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const { data } = await api.post(`/fixed-assets/${disposeFor.value._id}/dispose`, disposeForm.value);
    const gl = data.gainLoss >= 0 ? `Gain ${peso(data.gainLoss)}` : `Loss ${peso(-data.gainLoss)}`;
    notice.value = `Disposed ${disposeFor.value.assetTag} — ${gl} (${data.entryRef})`;
    disposeFor.value = null; await load();
  } catch (e) { error.value = e.response?.data?.message || 'Could not dispose.'; }
  finally { saving.value = false; }
}
const badge = (s) => s === 'ACTIVE' ? 'emp' : (s === 'DISPOSED' ? 'off' : '');
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Fixed Assets</h3>
      <button v-if="isOwner" class="btn btn-primary btn-sm" @click="showForm ? (showForm = false) : openNew()">{{ showForm ? 'Close' : '+ New asset' }}</button>
    </div>
    <p class="text-muted">Registry ng fixed assets — straight-line depreciation (prorated daily, mula sa Installation Date). Month-end JE: Dr Depreciation Expense / Cr Accumulated Depreciation.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- Summary -->
    <div v-if="summary" class="row g-2 mb-3">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2"><div class="section-eyebrow">Total Cost</div><div class="h5 mb-0 numeric">{{ peso(summary.totalCost) }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2"><div class="section-eyebrow">Accumulated Dep.</div><div class="h5 mb-0 numeric">{{ peso(summary.totalAccumulated) }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2"><div class="section-eyebrow">Book Value</div><div class="h5 mb-0 numeric">{{ peso(summary.totalBookValue) }}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2"><div class="section-eyebrow">Active</div><div class="h5 mb-0">{{ summary.activeCount }}</div></div></div></div>
    </div>

    <!-- Run depreciation (owner) -->
    <div v-if="isOwner" class="card mb-3"><div class="card-body d-flex flex-wrap align-items-end gap-2">
      <div><label class="form-label">Run depreciation through</label><input v-model="depDate" type="date" class="form-control" style="width:180px" /></div>
      <button class="btn btn-ghost" :disabled="saving" @click="runDep">Run month-end depreciation</button>
      <span class="text-muted small">Patakbuhin bago mag-period close ng buwan.</span>
    </div></div>

    <!-- Form -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">{{ form.id ? 'Edit asset' : 'New asset' }}</p>
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label">Device ID</label><input v-model="form.deviceId" class="form-control" placeholder="autofill from Machine" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Installation date</label><input v-model="form.installationDate" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Category</label>
          <select v-model="form.category" class="form-select"><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="col-6 col-md-3"><label class="form-label">Acquisition date <span class="text-muted">(optional)</span></label><input v-model="form.acquisitionDate" type="date" class="form-control" /></div>

        <div class="col-6 col-md-3"><label class="form-label">Cost</label><input v-model.number="form.cost" type="number" class="form-control text-end" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Salvage %</label><input v-model.number="form.salvagePercent" type="number" class="form-control text-end" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Salvage value <span class="text-muted">(auto)</span></label><input :value="peso(salvageValueCalc)" class="form-control text-end ro" readonly /></div>
        <div class="col-6 col-md-4"><label class="form-label">Depreciable <span class="text-muted">(auto = Cost − Salvage)</span></label><input :value="peso(depreciableCalc)" class="form-control text-end ro" readonly /></div>

        <div class="col-6 col-md-3"><label class="form-label">Useful life (years)</label><input v-model.number="form.usefulLifeYears" type="number" class="form-control text-end" /></div>
        <div class="col-6 col-md-4"><label class="form-label">Machine (optional)</label>
          <select v-model="form.machine" class="form-select" @change="onMachine"><option value="">—</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label">Cost Center</label>
          <select v-model="form.costCenter" class="form-select"><option value="">—</option>
            <option v-for="c in costCenters" :key="c._id" :value="c.code">{{ c.code }}</option></select></div>
        <div class="col-6 col-md-3"><label class="form-label">Opening accum. dep. <span class="text-muted">(existing)</span></label><input v-model.number="form.openingAccumulated" type="number" class="form-control text-end" :disabled="!!form.id" /></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create asset') }}</button>

      <!-- Depreciation schedule (pag-edit) -->
      <div v-if="form.id" class="mt-4">
        <p class="section-eyebrow mb-2">Depreciation schedule</p>
        <div v-if="scheduleLoading" class="text-muted small">Loading schedule…</div>
        <div v-else-if="schedule" class="card"><div class="card-body p-0" style="overflow-x:auto">
          <div class="px-3 py-2 small text-muted">
            Depreciable: <strong>{{ peso(schedule.asset.depreciable) }}</strong> ·
            Daily: <strong>{{ peso(schedule.asset.dailyRate) }}</strong> ·
            Installation: <strong>{{ schedule.asset.installationDate ? fmtDate(schedule.asset.installationDate) : '—' }}</strong>
          </div>
          <table class="fin-table ruled" style="min-width:640px">
            <thead><tr><th class="lbl">Month</th><th>Days</th><th>Monthly Dep.</th><th>Accum. Dep.</th><th>Book Value</th><th class="lbl" style="text-align:center">Action</th></tr></thead>
            <tbody>
              <tr v-for="(r,i) in schedule.schedule" :key="i">
                <td class="lbl">{{ r.monthLabel }}</td>
                <td class="num">{{ r.days }}</td>
                <td class="num">{{ peso(r.monthlyDep) }}</td>
                <td class="num">{{ peso(r.accumDep) }}</td>
                <td class="num fw-semibold">{{ peso(r.bookValue) }}</td>
                <td class="lbl" style="text-align:center">
                  <span v-if="r.posted" class="badge7 emp">Posted</span>
                  <button v-else-if="isOwner" class="btn btn-ghost btn-sm py-0" @click="runThrough(r.monthEnd)">Run depreciation</button>
                  <span v-else class="text-muted small">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div></div>
      </div>
    </div></div>

    <!-- Dispose panel -->
    <div v-if="disposeFor" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-2">Dispose {{ disposeFor.assetTag }} · {{ disposeFor.deviceId || disposeFor.name }}</p>
      <p class="text-muted small">Book value: {{ peso(disposeFor.bookValue) }} — ang gain/loss ay proceeds − book value.</p>
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3"><label class="form-label">Disposal date</label><input v-model="disposeForm.date" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Proceeds</label><input v-model.number="disposeForm.proceeds" type="number" class="form-control text-end" /></div>
        <div class="col-12 col-md-6 d-flex gap-2">
          <button class="btn btn-primary" :disabled="saving" @click="doDispose">Confirm disposal</button>
          <button class="btn btn-ghost" @click="disposeFor = null">Cancel</button>
        </div>
      </div>
    </div></div>

    <!-- List -->
    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:900px">
        <thead><tr><th class="lbl">Tag</th><th class="lbl">Device ID</th><th class="lbl">Category</th><th class="lbl">Installation</th><th>Cost</th><th>Accum. Dep.</th><th>Book Value</th><th class="lbl">Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in assets" :key="a._id">
            <td class="lbl">{{ a.assetTag }}</td>
            <td class="lbl">{{ a.deviceId || a.name }}</td>
            <td class="lbl">{{ a.category }}</td>
            <td class="lbl">{{ a.installationDate ? fmtDate(a.installationDate) : (a.acquisitionDate ? fmtDate(a.acquisitionDate) : '—') }}</td>
            <td class="num">{{ peso(a.cost) }}</td>
            <td class="num">{{ peso(a.accumulatedDepreciation) }}</td>
            <td class="num fw-semibold">{{ peso(a.bookValue) }}</td>
            <td class="lbl"><span class="badge7" :class="badge(a.status)">{{ a.status }}</span></td>
            <td class="lbl">
              <button class="btn btn-ghost btn-sm py-0" @click="edit(a)">Edit</button>
              <button v-if="isOwner && a.status !== 'DISPOSED'" class="btn btn-ghost btn-sm py-0" @click="openDispose(a)">Dispose</button>
            </td>
          </tr>
          <tr v-if="!assets.length"><td colspan="9" class="text-center text-muted py-3">Wala pang naka-rehistrong asset.</td></tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>

<style scoped>
.ro { background:#F3F6FA; color:var(--ink-2); }
</style>
