<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const items = ref([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const showForm = ref(false);
const saving = ref(false);

const isOwner = computed(()=> auth.isOwner || auth.isSuperadmin);
const blank = () => ({ id:null, code:'', name:'', type:'Vending Location', active:true, purpose:'' });
const form = ref(blank());

function flash(msg){ notice.value = msg; setTimeout(()=> notice.value='', 2500); }

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
    close(); await load(); flash('Saved.');
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
async function toggleActive(c){
  error.value='';
  try { await api.patch(`/cost-centers/${c._id}`, { active: !c.active }); await load(); flash(c.active ? 'Deactivated.' : 'Activated.'); }
  catch(e){ error.value = e.response?.data?.message || 'Could not update.'; }
}
async function remove(c){
  if(!confirm(`Delete cost center ${c.code}? Bawal kung naka-tag pa sa machine/journal — i-deactivate na lang kung ganun.`)) return;
  error.value='';
  try { await api.delete(`/cost-centers/${c._id}`); await load(); flash('Deleted.'); }
  catch(e){ error.value = e.response?.data?.message || 'Could not delete.'; }
}
function history(c){ router.push({ name:'audittrail', query:{ entityType:'CostCenter', entityId:c._id, name:`${c.code} · ${c.name}` } }); }
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Cost Centers</h3>
      <div class="d-flex gap-2">
        <button v-if="isOwner" class="btn btn-ghost btn-sm" @click="router.push({ name:'audittrail', query:{ entityType:'CostCenter' } })">⟲ Audit trail</button>
        <button v-if="isOwner" class="btn btn-primary btn-sm" @click="showForm ? close() : openNew()">{{ showForm ? 'Close' : '+ New cost center' }}</button>
      </div>
    </div>
    <p class="text-muted">Tag each transaction to a cost center (location or function) for per-machine analysis.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

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
      <table class="fin-table" style="min-width:720px">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Name</th><th class="lbl">Type</th><th class="lbl">Status</th><th class="lbl">Purpose</th><th class="lbl" style="text-align:right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="c in items" :key="c._id" :style="c.active ? '' : 'opacity:.6'">
            <td class="lbl">{{ c.code }}</td>
            <td class="lbl">{{ c.name }}</td>
            <td class="lbl">{{ c.type }}</td>
            <td class="lbl"><span class="badge7" :class="c.active ? 'emp' : 'off'">{{ c.active ? 'Active' : 'Inactive' }}</span></td>
            <td class="lbl text-muted small">{{ c.purpose }}</td>
            <td class="lbl" style="text-align:right;white-space:nowrap">
              <template v-if="isOwner">
                <button class="btn btn-ghost btn-sm py-0" @click="edit(c)">Edit</button>
                <button class="btn btn-ghost btn-sm py-0" @click="toggleActive(c)">{{ c.active ? 'Deactivate' : 'Activate' }}</button>
                <button class="btn btn-ghost btn-sm py-0" @click="history(c)" title="Audit trail">⟲</button>
                <button class="btn btn-sm btn-danger7 py-0" @click="remove(c)">Delete</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div></div>
  </div>
</template>
