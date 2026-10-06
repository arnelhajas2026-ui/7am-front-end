<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const items = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const blank = () => ({ id:null, code:'', name:'', type:'Vending Location', active:true, purpose:'' });
const form = ref(blank());

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/cost-centers'); items.value = data.costCenters; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load cost centers.'; }
  finally { loading.value=false; }
}
function openNew(){ form.value = blank(); showForm.value=true; }
function edit(c){ form.value = { id:c._id, code:c.code, name:c.name, type:c.type, active:c.active, purpose:c.purpose }; showForm.value=true; window.scrollTo({top:0,behavior:'smooth'}); }
function close(){ showForm.value=false; }
async function save(){
  saving.value=true; error.value='';
  try {
    if(form.value.id) await api.patch(`/cost-centers/${form.value.id}`, form.value);
    else await api.post('/cost-centers', form.value);
    close(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Cost Centers</h3>
      <button v-if="auth.isOwner || auth.isSuperadmin" class="btn btn-primary btn-sm" @click="showForm ? close() : openNew()">{{ showForm ? 'Close' : '+ New cost center' }}</button>
    </div>
    <p class="text-muted">Tag each transaction to a cost center (location or function) for per-machine analysis.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">{{ form.id ? 'Edit cost center' : 'New cost center' }}</p>
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label">Code</label><input v-model="form.code" class="form-control" placeholder="CC-016" :disabled="!!form.id" /></div>
        <div class="col-6 col-md-5"><label class="form-label">Name</label><input v-model="form.name" class="form-control" /></div>
        <div class="col-6 col-md-4"><label class="form-label">Type</label><input v-model="form.type" class="form-control" placeholder="Vending Location" /></div>
        <div class="col-12"><label class="form-label">Purpose</label><input v-model="form.purpose" class="form-control" /></div>
        <div class="col-12"><div class="form-check"><input v-model="form.active" class="form-check-input" type="checkbox" id="act" /><label class="form-check-label ms-1" for="act">Active</label></div></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create') }}</button>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:620px">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Name</th><th class="lbl">Type</th><th class="lbl">Active</th><th class="lbl">Purpose</th><th></th></tr></thead>
        <tbody>
          <tr v-for="c in items" :key="c._id">
            <td class="lbl">{{ c.code }}</td>
            <td class="lbl">{{ c.name }}</td>
            <td class="lbl">{{ c.type }}</td>
            <td class="lbl">{{ c.active ? 'Yes' : 'No' }}</td>
            <td class="lbl text-muted small">{{ c.purpose }}</td>
            <td class="lbl"><button v-if="auth.isOwner || auth.isSuperadmin" class="btn btn-ghost btn-sm py-0" @click="edit(c)">Edit</button></td>
          </tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>
