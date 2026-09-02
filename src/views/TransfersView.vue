<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const transfers = ref([]);
const machines = ref([]);
const products = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const form = ref({ machine:'', destination:'MACHINE_LOADED', date:new Date().toISOString().slice(0,10), items:[] });
function addItem(){ form.value.items.push({ product:'', quantity:1 }); }
function removeItem(i){ form.value.items.splice(i,1); }
function reset(){ form.value = { machine:'', destination:'MACHINE_LOADED', date:new Date().toISOString().slice(0,10), items:[] }; showForm.value=false; }
function openForm(){ showForm.value=true; if(!form.value.items.length) addItem(); }
const destLabel = (d)=> d==='MACHINE_LOADED' ? 'Machine (display)' : 'Side cabinet';
const selected = ref(null);
function viewTransfer(t){ selected.value = t; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeView(){ selected.value = null; }

async function load(){
  loading.value=true; error.value='';
  try {
    const [tr,ma,pr] = await Promise.all([ api.get('/transfers'), api.get('/machines'), api.get('/products') ]);
    transfers.value = tr.data.transfers; machines.value = ma.data.machines; products.value = pr.data.products;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load transfers.'; }
  finally { loading.value=false; }
}
async function save(){
  saving.value=true; error.value='';
  try { await api.post('/transfers', form.value); reset(); await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save transfer.'; }
  finally { saving.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Transfers</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? reset() : openForm()">{{ showForm ? 'Close' : '+ New transfer' }}</button>
    </div>
    <p class="text-muted">Move stock from the warehouse into a machine. Blocked if the warehouse is short.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.machine?.locationName || selected.machine?.machineId }}</h5>
          <div class="text-muted small">{{ fmtDate(selected.date) }} · {{ destLabel(selected.destination) }}</div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="closeView">Close</button>
      </div>
      <table class="fin-table">
        <thead><tr><th class="lbl">Product</th><th>Qty</th></tr></thead>
        <tbody>
          <tr v-for="(it,i) in selected.items" :key="i">
            <td class="lbl">{{ it.product?.name || 'Product' }} <span class="text-muted small">{{ it.product?.sku }}</span></td>
            <td class="num">{{ it.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </div></div>

    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New transfer</p>
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-5"><label class="form-label">Machine</label>
          <select v-model="form.machine" class="form-select"><option value="">— machine —</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select></div>
        <div class="col-7 col-md-4"><label class="form-label">Destination</label>
          <select v-model="form.destination" class="form-select">
            <option value="MACHINE_LOADED">Machine (display)</option>
            <option value="SIDE_CABINET">Side cabinet</option></select></div>
        <div class="col-5 col-md-3"><label class="form-label">Date</label><input v-model="form.date" type="date" class="form-control" /></div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-1">
        <p class="section-eyebrow mb-0">Items</p>
        <button class="btn btn-ghost btn-sm" @click="addItem">+ Add item</button>
      </div>
      <div v-if="form.items.length" class="row g-2 mb-1">
        <div class="col-8"><span class="form-label mb-0">Product</span></div>
        <div class="col-3"><span class="form-label mb-0">Qty</span></div>
        <div class="col-1"></div>
      </div>
      <div v-for="(it,i) in form.items" :key="i" class="row g-2 mb-2">
        <div class="col-8"><select v-model="it.product" class="form-select form-select-sm"><option value="">— product —</option>
          <option v-for="p in products" :key="p._id" :value="p._id">{{ p.name }}</option></select></div>
        <div class="col-3"><input v-model.number="it.quantity" type="number" class="form-control form-control-sm numeric" placeholder="Qty" /></div>
        <div class="col-1"><button class="btn btn-ghost btn-sm w-100" @click="removeItem(i)">×</button></div>
      </div>

      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Transfer stock' }}</button>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!transfers.length" class="card"><div class="card-body text-muted text-center py-4">No transfers yet.</div></div>

    <div v-for="t in transfers" :key="t._id" class="card mb-2" style="cursor:pointer" @click="viewTransfer(t)"><div class="card-body">
      <div class="fw-semibold" style="font-family:var(--font-display)">{{ t.machine?.locationName || t.machine?.machineId }}
        <span class="badge7 emp ms-1">{{ destLabel(t.destination) }}</span></div>
      <div class="text-muted small">{{ fmtDate(t.date) }} · {{ t.items.length }} item<span v-if="t.items.length>1">s</span></div>
    </div></div>
  </div>
</template>
