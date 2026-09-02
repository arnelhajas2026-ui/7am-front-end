<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const items = ref([]);
const categories = ref([]);
const machines = ref([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const showForm = ref(false);
const saving = ref(false);
const form = ref({ category:'', description:'', amount:0, date:new Date().toISOString().slice(0,10), machine:'' });

function reset(){ form.value = { category:'', description:'', amount:0, date:new Date().toISOString().slice(0,10), machine:'' }; showForm.value=false; }

async function load(){
  loading.value=true; error.value='';
  try {
    const [ex,cfg,ma] = await Promise.all([ api.get('/expenses'), api.get('/config'), api.get('/machines') ]);
    items.value = ex.data.expenses;
    categories.value = cfg.data.config?.expenseCategories || [];
    machines.value = ma.data.machines;
    if(!form.value.category && categories.value.length) form.value.category = categories.value[0];
  } catch(e){ error.value = e.response?.data?.message || 'Could not load expenses.'; }
  finally { loading.value=false; }
}
async function save(){
  if(!form.value.category || !form.value.amount){ error.value='Category and amount required.'; return; }
  saving.value=true; error.value=''; notice.value='';
  try {
    const { data } = await api.post('/expenses', form.value);
    reset();
    if (data.pending) { notice.value = 'Naipadala para sa approval ni Owner.'; }
    else { await load(); }
  }
  catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
async function voidExpense(row){
  try { const { data } = await api.patch(`/expenses/${row._id}/active`, { active: !row.active });
    const i=items.value.findIndex(x=>x._id===row._id); if(i!==-1) items.value[i]=data.expense;
  } catch(e){ error.value = e.response?.data?.message || 'Could not update.'; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
const dt = fmtDate;
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Expenses</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? reset() : (showForm=true)">{{ showForm ? 'Close' : '+ New expense' }}</button>
    </div>
    <p class="text-muted">Salary, rent, utilities and more — feeds the income statement.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New expense</p>
      <div class="row g-2">
        <div class="col-6 col-md-3"><label class="form-label">Category</label>
          <select v-model="form.category" class="form-select"><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="col-6 col-md-3"><label class="form-label">Amount</label><input v-model.number="form.amount" type="number" class="form-control numeric" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Date</label><input v-model="form.date" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Machine (optional)</label>
          <select v-model="form.machine" class="form-select"><option value="">—</option>
            <option v-for="m in machines" :key="m._id" :value="m._id">{{ m.locationName || m.machineId }}</option></select></div>
        <div class="col-12"><label class="form-label">Description</label><input v-model="form.description" class="form-control" /></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Add expense' }}</button>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length" class="card"><div class="card-body text-muted text-center py-4">No expenses yet.</div></div>
    <div v-for="e in items" :key="e._id" class="card mb-2"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold">{{ e.category }} <span class="text-muted small">{{ e.description }}</span>
          <span v-if="!e.active" class="badge7 off ms-1">VOID</span></div>
        <div class="text-muted small">{{ dt(e.date) }}<span v-if="e.machine"> · {{ e.machine.locationName || e.machine.machineId }}</span></div>
      </div>
      <div class="numeric fw-bold" :style="!e.active && 'text-decoration:line-through;opacity:.5'">{{ peso(e.amount) }}</div>
      <button class="btn btn-ghost btn-sm" @click="voidExpense(e)">{{ e.active ? 'Void' : 'Restore' }}</button>
    </div></div>
  </div>
</template>
