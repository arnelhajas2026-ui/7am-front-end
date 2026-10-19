<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const items = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);
const form = ref({ id: null, name: '', email: '', contact: '', address: '', notes: '' });

// Duplicate detection (live habang nagta-type ng pangalan).
const dupMatches = ref([]);
let dupTimer;
function checkDup(){
  clearTimeout(dupTimer);
  const name = (form.value.name || '').trim();
  if(form.value.id || name.length < 2){ dupMatches.value = []; return; }
  dupTimer = setTimeout(async () => {
    try { const { data } = await api.get('/customers/check', { params:{ q: name } }); dupMatches.value = data.matches || []; }
    catch { dupMatches.value = []; }
  }, 300);
}
function editExisting(m){ const row = items.value.find(x => x._id === m._id); if(row) edit(row); dupMatches.value = []; }

function initials(n){ return (n||'?').charAt(0).toUpperCase(); }
function reset(){ form.value = { id:null, name:'', email:'', contact:'', address:'', notes:'' }; dupMatches.value=[]; showForm.value=false; }

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/customers'); items.value = data.customers; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load customers.'; }
  finally { loading.value=false; }
}
async function save(force){
  if(!form.value.name){ error.value='Name is required.'; return; }
  saving.value=true; error.value='';
  try {
    if(form.value.id) await api.put(`/customers/${form.value.id}`, form.value);
    else await api.post('/customers', { ...form.value, force: !!force });
    reset(); await load();
  } catch(e){
    if(e.response?.status === 409){ dupMatches.value = e.response.data?.matches || []; error.value = e.response.data?.message || 'Duplicate customer.'; }
    else error.value = e.response?.data?.message || 'Could not save.';
  }
  finally { saving.value=false; }
}
function edit(row){ form.value = { id:row._id, name:row.name, email:row.email, contact:row.contact, address:row.address, notes:row.notes }; dupMatches.value=[]; showForm.value=true; }
async function toggle(row){
  try { const { data } = await api.put(`/customers/${row._id}`, { ...row, active: !row.active });
    const i = items.value.findIndex(x=>x._id===row._id); if(i!==-1) items.value[i]=data.customer;
  } catch(e){ error.value = e.response?.data?.message || 'Could not update.'; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Customers</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? reset() : (showForm=true)">
        {{ showForm ? 'Close' : '+ New customer' }}
      </button>
    </div>
    <p class="text-muted">People and businesses you sell machines to.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-4">
      <div class="card-body">
        <p class="section-eyebrow mb-3">{{ form.id ? 'Edit customer' : 'New customer' }}</p>
        <div class="row g-2">
          <div class="col-12 col-md-6"><label class="form-label">Name</label><input v-model="form.name" class="form-control" @input="checkDup" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Email</label><input v-model="form.email" type="email" class="form-control" placeholder="customer@email.com" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Contact number</label><input v-model="form.contact" class="form-control" placeholder="Phone" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Address</label><input v-model="form.address" class="form-control" /></div>
          <div class="col-12"><label class="form-label">Notes</label><input v-model="form.notes" class="form-control" /></div>
        </div>

        <!-- Duplicate / similar-name warning -->
        <div v-if="!form.id && dupMatches.length" class="alert alert-warning py-2 mt-3 mb-0">
          <div class="fw-semibold mb-1">⚠ May existing na pareh/halos-parehong pangalan — piliin na lang para iwas duplicate:</div>
          <div v-for="m in dupMatches" :key="m._id" class="d-flex align-items-center justify-content-between py-1">
            <span>{{ m.name }} <span class="text-muted small">{{ m.customerId }}<span v-if="m.email"> · {{ m.email }}</span></span></span>
            <button class="btn btn-ghost btn-sm" @click="editExisting(m)">Use / edit this</button>
          </div>
        </div>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary" :disabled="saving" @click="save(false)">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create customer') }}</button>
          <button v-if="!form.id && dupMatches.length" class="btn btn-ghost" :disabled="saving" @click="save(true)">Create anyway</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length" class="card"><div class="card-body text-muted text-center py-4">No customers yet. Add your first one.</div></div>

    <div v-for="row in items" :key="row._id" class="card mb-2">
      <div class="card-body d-flex align-items-center gap-3">
        <div class="avatar">{{ initials(row.name) }}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold" style="font-family:var(--font-display)">{{ row.name }}
            <span class="text-muted small ms-1">{{ row.customerId }}</span>
            <span v-if="!row.active" class="badge7 off ms-1">INACTIVE</span>
          </div>
          <div class="text-muted small">
            <span v-if="row.email">✉ {{ row.email }}</span><span v-if="row.email && row.contact"> · </span>
            <span v-if="row.contact">☎ {{ row.contact }}</span><span v-if="!row.email && !row.contact">—</span>
            <span v-if="row.address"> · {{ row.address }}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="edit(row)">Edit</button>
        <button class="btn btn-sm" :class="row.active ? 'btn-ghost' : 'btn-ink'" @click="toggle(row)">{{ row.active ? 'Deactivate' : 'Activate' }}</button>
      </div>
    </div>
  </div>
</template>
