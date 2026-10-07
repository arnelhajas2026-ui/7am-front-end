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

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
function blank() { return { id: null, name: '', category: 'Vending Machine', acquisitionDate: '', cost: 0, salvageValue: 0, usefulLifeYears: 5, costCenter: '', machine: '', openingAccumulated: 0, depreciatedThrough: '' }; }
const form = ref(blank());

async function load() {
  loading.value = true; error.value = '';
  try {
    const [fa, cc, ma] = await Promise.all([api.get('/fixed-assets'), api.get('/cost-centers'), api.get('/machines')]);
    assets.value = fa.data.assets; summary.value = fa.data.summary; categories.value = fa.data.categories;
    costCenters.value = cc.data.costCenters; machines.value = ma.data.machines;
  } catch (e) { error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value = false; }
}
function openNew() { form.value = blank(); showForm.value = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function edit(a) {
  form.value = { id: a._id, name: a.name, category: a.category, acquisitionDate: a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : '',
    cost: a.cost, salvageValue: a.salvageValue, usefulLifeYears: a.usefulLifeYears, costCenter: a.costCenter || '',
    machine: a.machine?._id || a.machine || '', openingAccumulated: a.openingAccumulated, depreciatedThrough: a.lastDepreciatedThrough ? a.lastDepreciatedThrough.slice(0, 10) : '' };
  showForm.value = true; window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function save() {
  saving.value = true; error.value = ''; notice.value = '';
  try {
    if (form.value.id) await api.patch(`/fixed-assets/${form.value.id}`, form.value);
    else await api.post('/fixed-assets', form.value);
    showForm.value = false; await load();
  } catch (e) { error.value = e.response?.data?.message || 'Could not save.'; }
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
    <p class="text-muted">Registry ng fixed assets — straight-line depreciation (prorated daily). Month-end JE: Dr Depreciation Expense / Cr Accumulated Depreciation.</p>
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
        <div class="col-12 col-md-5"><label class="form-label">Name</label><input v-model="form.name" class="form-control" placeholder="e.g. Snack Vending Machine #3" /></div>
        <div class="col-6 col-md-4"><label class="form-label">Category</label>
          <select v-model="form.category" class="form-select"><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="col-6 col-md-3"><label class="form-label">Acquisition date</label><input v-model="form.acquisitionDate" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Cost</label><input v-model.number="form.cost" type="number" class="form-control text-end" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Salvage value</label><input v-model.number="form.salvageValue" type="number" class="form-control text-end" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Useful life (years)</label><input v-model.number="form.usefulLifeYears" type="number" class="form-control text-end" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Cost Center</label>
          <select v-model="form.costCenter" class="form-select"><option value="">—</option>
            <option v-for="c in costCenters" :key="c._id" :value="c.code">{{ c.code }}</option></select></div>
        <div class="col-6 col-md-4"><label class="form-label">Machine (optional)</label>
          <select v-model="form.machine" class="form-select"><option value="">—</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select></div>
        <div class="col-6 col-md-4"><label class="form-label">Opening accum. dep. <span class="text-muted">(existing asset)</span></label><input v-model.number="form.openingAccumulated" type="number" class="form-control text-end" :disabled="!!form.id" /></div>
        <div class="col-6 col-md-4"><label class="form-label">Depreciated through <span class="text-muted">(existing)</span></label><input v-model="form.depreciatedThrough" type="date" class="form-control" :disabled="!!form.id" /></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create asset') }}</button>
    </div></div>

    <!-- Dispose panel -->
    <div v-if="disposeFor" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-2">Dispose {{ disposeFor.assetTag }} · {{ disposeFor.name }}</p>
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
      <table class="fin-table" style="min-width:860px">
        <thead><tr><th class="lbl">Tag</th><th class="lbl">Name</th><th class="lbl">Category</th><th class="lbl">Acquired</th><th>Cost</th><th>Accum. Dep.</th><th>Book Value</th><th class="lbl">Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in assets" :key="a._id">
            <td class="lbl">{{ a.assetTag }}</td>
            <td class="lbl">{{ a.name }}</td>
            <td class="lbl">{{ a.category }}</td>
            <td class="lbl">{{ fmtDate(a.acquisitionDate) }}</td>
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
