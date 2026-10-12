<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';

const riders = ref([]);
const loading = ref(false);
const error = ref('');
const saved = ref('');
const busy = ref(false);

const form = ref({ name:'', username:'', password:'', phone:'' });
const editing = ref(null); // rider being edited
const editForm = ref({ name:'', phone:'', active:true, password:'' });

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/riders'); riders.value = data.riders; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load riders.'; }
  finally { loading.value=false; }
}
async function create(){
  busy.value=true; error.value=''; saved.value='';
  try {
    await api.post('/riders', form.value);
    form.value = { name:'', username:'', password:'', phone:'' };
    saved.value = 'Rider added.'; await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not add rider.'; }
  finally { busy.value=false; }
}
function openEdit(r){ editing.value = r; editForm.value = { name:r.name, phone:r.phone||'', active:r.active, password:'' }; }
async function saveEdit(){
  busy.value=true; error.value='';
  try {
    await api.patch(`/riders/${editing.value._id}`, editForm.value);
    editing.value=null; saved.value='Rider updated.'; await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not update rider.'; }
  finally { busy.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Riders</h3>
    <p class="text-muted">Simpleng master data + login para sa mga rider. Lumalabas sila sa "Assign to" ng Transfer form, at sa sarili nilang Rider section lang sila makaka-access.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="saved" class="alert alert-success py-2">{{ saved }}</div>

    <!-- Add rider -->
    <div class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">Add rider</p>
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-3"><label class="form-label">Name</label><input v-model="form.name" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Username</label><input v-model="form.username" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Password</label><input v-model="form.password" type="text" class="form-control form-control-sm" /></div>
        <div class="col-8 col-md-3"><label class="form-label">Phone</label><input v-model="form.phone" class="form-control form-control-sm" placeholder="optional" /></div>
        <div class="col-4 col-md-2"><button class="btn btn-primary btn-sm w-100" :disabled="busy" @click="create">Add</button></div>
      </div>
    </div></div>

    <!-- Edit panel -->
    <div v-if="editing" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <p class="section-eyebrow mb-0">Edit rider · {{ editing.username }}</p>
        <button class="btn btn-ghost btn-sm" @click="editing=null">Close</button>
      </div>
      <div class="row g-2 align-items-end">
        <div class="col-12 col-md-3"><label class="form-label">Name</label><input v-model="editForm.name" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Phone</label><input v-model="editForm.phone" class="form-control form-control-sm" /></div>
        <div class="col-6 col-md-3"><label class="form-label">New password</label><input v-model="editForm.password" type="text" class="form-control form-control-sm" placeholder="iwan blangko kung walang palit" /></div>
        <div class="col-6 col-md-2"><div class="form-check mt-3"><input v-model="editForm.active" type="checkbox" class="form-check-input" id="ract" /><label class="form-check-label small" for="ract">Active</label></div></div>
        <div class="col-6 col-md-1"><button class="btn btn-primary btn-sm w-100" :disabled="busy" @click="saveEdit">Save</button></div>
      </div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!riders.length" class="card"><div class="card-body text-muted text-center py-4">No riders yet.</div></div>
    <div v-for="r in riders" :key="r._id" class="card mb-2" style="cursor:pointer" @click="openEdit(r)"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold">{{ r.name }} <span class="text-muted small">@{{ r.username }}</span></div>
        <div class="text-muted small">{{ r.phone || 'no phone' }}</div>
      </div>
      <span class="pill" :class="r.active ? 'ok':'off'">{{ r.active ? 'Active':'Inactive' }}</span>
    </div></div>
  </div>
</template>

<style scoped>
.pill { font-size:.68rem; font-weight:700; padding:.12rem .55rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); }
.pill.off { background:#FDECEC; color:var(--bad); }
</style>
