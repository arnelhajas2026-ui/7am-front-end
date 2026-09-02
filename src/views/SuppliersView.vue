<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const items = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);
const form = ref({ id: null, name: '', store: '', contact: '', notes: '' });

function initials(n){ return (n||'?').charAt(0).toUpperCase(); }
function reset(){ form.value = { id:null, name:'', store:'', contact:'', notes:'' }; showForm.value=false; }

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/suppliers'); items.value = data.suppliers; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load suppliers.'; }
  finally { loading.value=false; }
}
async function save(){
  if(!form.value.name){ error.value='Name is required.'; return; }
  saving.value=true; error.value='';
  try {
    if(form.value.id) await api.put(`/suppliers/${form.value.id}`, form.value);
    else await api.post('/suppliers', form.value);
    reset(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
function edit(row){ form.value = { id:row._id, name:row.name, store:row.store, contact:row.contact, notes:row.notes }; showForm.value=true; }
async function toggle(row){
  try { const { data } = await api.put(`/suppliers/${row._id}`, { ...row, active: !row.active });
    const i = items.value.findIndex(x=>x._id===row._id); if(i!==-1) items.value[i]=data.supplier;
  } catch(e){ error.value = e.response?.data?.message || 'Could not update.'; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Suppliers</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? reset() : (showForm=true)">{{ showForm ? 'Close' : '+ New supplier' }}</button>
    </div>
    <p class="text-muted">Stores and vendors you buy machines and stock from.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-4">
      <div class="card-body">
        <p class="section-eyebrow mb-3">{{ form.id ? 'Edit supplier' : 'New supplier' }}</p>
        <div class="row g-2">
          <div class="col-12 col-md-6"><label class="form-label">Name</label><input v-model="form.name" class="form-control" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Store / brand</label><input v-model="form.store" class="form-control" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Contact</label><input v-model="form.contact" class="form-control" /></div>
          <div class="col-12"><label class="form-label">Notes</label><input v-model="form.notes" class="form-control" /></div>
        </div>
        <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create supplier') }}</button>
      </div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length" class="card"><div class="card-body text-muted text-center py-4">No suppliers yet.</div></div>

    <div v-for="row in items" :key="row._id" class="card mb-2">
      <div class="card-body d-flex align-items-center gap-3">
        <div class="avatar">{{ initials(row.name) }}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold" style="font-family:var(--font-display)">{{ row.name }}
            <span v-if="!row.active" class="badge7 off ms-1">INACTIVE</span></div>
          <div class="text-muted small">{{ row.store || '—' }}<span v-if="row.contact"> · {{ row.contact }}</span></div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="edit(row)">Edit</button>
        <button class="btn btn-sm" :class="row.active ? 'btn-ghost' : 'btn-ink'" @click="toggle(row)">{{ row.active ? 'Deactivate' : 'Activate' }}</button>
      </div>
    </div>
  </div>
</template>
