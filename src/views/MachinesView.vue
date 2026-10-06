<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const items = ref([]);
const products = ref([]);
const customers = ref([]);
const costCenters = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const blank = () => ({ id:null, serialNumber:'', deviceId:'', locationName:'', customer:'', status:'ACTIVE', costCenter:'', planogram:[] });
const form = ref(blank());

function reset(){ form.value = blank(); showForm.value=false; }
function addSlot(){ form.value.planogram.push({ channel:'', product:'' }); }
function removeSlot(i){ form.value.planogram.splice(i,1); }

async function load(){
  loading.value=true; error.value='';
  try {
    const [m,p,c,cc] = await Promise.all([ api.get('/machines'), api.get('/products'), api.get('/customers'), api.get('/cost-centers') ]);
    items.value = m.data.machines; products.value = p.data.products; customers.value = c.data.customers; costCenters.value = cc.data.costCenters;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load machines.'; }
  finally { loading.value=false; }
}
async function save(){
  saving.value=true; error.value='';
  const payload = { ...form.value, customer: form.value.customer || null };
  try {
    if(form.value.id) await api.put(`/machines/${form.value.id}`, payload);
    else await api.post('/machines', payload);
    reset(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
function edit(row){
  form.value = {
    id:row._id, serialNumber:row.serialNumber, deviceId:row.deviceId, locationName:row.locationName,
    customer:row.customer?._id || '', status:row.status, costCenter:row.costCenter || '',
    planogram:(row.planogram||[]).map(s=>({ channel:s.channel, product:s.product||'' })),
  };
  showForm.value=true;
}
function productName(id){ return products.value.find(p=>p._id===id)?.name || '—'; }
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Machines</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? reset() : (showForm=true)">{{ showForm ? 'Close' : '+ New machine' }}</button>
    </div>
    <p class="text-muted">Each vending machine, its location, and which product sits in each channel (planogram).</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-4">
      <div class="card-body">
        <p class="section-eyebrow mb-3">{{ form.id ? 'Edit machine' : 'New machine' }}</p>
        <div class="row g-2">
          <div class="col-12 col-md-4"><label class="form-label">Device ID</label><input v-model="form.deviceId" class="form-control" placeholder="from the machine export" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Serial number</label><input v-model="form.serialNumber" class="form-control" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Location</label><input v-model="form.locationName" class="form-control" placeholder="e.g. AMAIA ALABANG" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Customer / location owner</label>
            <select v-model="form.customer" class="form-select"><option value="">—</option>
              <option v-for="c in customers" :key="c._id" :value="c._id">{{ c.name }}</option></select></div>
          <div class="col-12 col-md-6"><label class="form-label">Status</label>
            <select v-model="form.status" class="form-select"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>
          <div class="col-6 col-md-4"><label class="form-label">Cost Center</label>
            <select v-model="form.costCenter" class="form-select"><option value="">—</option>
              <option v-for="cc in costCenters" :key="cc._id" :value="cc.code">{{ cc.code }} · {{ cc.name }}</option></select></div>
        </div>

        <div class="d-flex align-items-center justify-content-between mt-3 mb-1">
          <p class="section-eyebrow mb-0">Planogram (channel → product)</p>
          <button class="btn btn-ghost btn-sm" @click="addSlot">+ Add slot</button>
        </div>
        <div v-for="(s,i) in form.planogram" :key="i" class="row g-2 mb-2">
          <div class="col-5"><input v-model="s.channel" class="form-control form-control-sm" placeholder="Cargo Channel 54" /></div>
          <div class="col-6"><select v-model="s.product" class="form-select form-select-sm"><option value="">— product —</option>
            <option v-for="p in products" :key="p._id" :value="p._id">{{ p.name }}</option></select></div>
          <div class="col-1"><button class="btn btn-ghost btn-sm w-100" @click="removeSlot(i)">×</button></div>
        </div>

        <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create machine') }}</button>
      </div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length" class="card"><div class="card-body text-muted text-center py-4">No machines yet.</div></div>

    <div v-for="row in items" :key="row._id" class="card mb-2">
      <div class="card-body">
        <div class="d-flex align-items-center gap-3">
          <div class="avatar"><span style="font-size:.8rem">{{ row.machineId?.split('-')[1] }}</span></div>
          <div class="flex-grow-1">
            <div class="fw-semibold" style="font-family:var(--font-display)">{{ row.locationName || 'Unassigned' }}
              <span class="text-muted small ms-1">{{ row.machineId }}</span>
              <span class="badge7 ms-1" :class="row.status==='ACTIVE' ? 'emp' : 'off'">{{ row.status }}</span></div>
            <div class="text-muted small">
              {{ row.deviceId || 'no device id' }} · {{ row.costCenter || 'no cost center' }} · {{ row.planogram?.length || 0 }} slots
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="edit(row)">Edit</button>
        </div>
      </div>
    </div>
  </div>
</template>
