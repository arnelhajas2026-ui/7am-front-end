<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const accounts = ref([]);
const loading = ref(false);
const error = ref('');
const search = ref('');
const showForm = ref(false);
const saving = ref(false);

const TYPES = ['Asset','Contra Asset','Liability','Equity','Contra Equity','Revenue','Contra Revenue','COGS','Expense','Other Income','Other Expense','Header'];
const CF = ['Operating','Investing','Financing','Non-Cash','—'];
const NB = ['Debit','Credit','—'];

const blank = () => ({ id:null, code:'', name:'', type:'Asset', normalBalance:'Debit', cashFlowType:'Operating', costCenterRequired:false, description:'', isHeader:false });
const form = ref(blank());

const visible = computed(()=>{
  const q = search.value.trim().toLowerCase();
  return accounts.value.filter(a => !q || String(a.code).includes(q) || (a.name||'').toLowerCase().includes(q) || (a.type||'').toLowerCase().includes(q));
});

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/accounts-coa'); accounts.value = data.accounts; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load accounts.'; }
  finally { loading.value=false; }
}
function openNew(){ form.value = blank(); showForm.value=true; window.scrollTo({top:0,behavior:'smooth'}); }
function edit(a){ form.value = { id:a._id, code:a.code, name:a.name, type:a.type, normalBalance:a.normalBalance, cashFlowType:a.cashFlowType, costCenterRequired:a.costCenterRequired, description:a.description, isHeader:a.isHeader }; showForm.value=true; window.scrollTo({top:0,behavior:'smooth'}); }
function close(){ showForm.value=false; }
async function save(){
  saving.value=true; error.value='';
  try {
    if(form.value.id) await api.patch(`/accounts-coa/${form.value.id}`, form.value);
    else await api.post('/accounts-coa', form.value);
    close(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Chart of Accounts</h3>
      <button v-if="auth.isOwner || auth.isSuperadmin" class="btn btn-primary btn-sm" @click="showForm ? close() : openNew()">{{ showForm ? 'Close' : '+ New account' }}</button>
    </div>
    <p class="text-muted">The master list of accounts. Every journal entry posts to one of these.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">{{ form.id ? 'Edit account' : 'New account' }}</p>
      <div class="row g-2">
        <div class="col-6 col-md-2"><label class="form-label">Code</label><input v-model.number="form.code" type="number" class="form-control" :disabled="!!form.id" /></div>
        <div class="col-6 col-md-5"><label class="form-label">Name</label><input v-model="form.name" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Type</label>
          <select v-model="form.type" class="form-select"><option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label">Normal</label>
          <select v-model="form.normalBalance" class="form-select"><option v-for="n in NB" :key="n" :value="n">{{ n }}</option></select></div>
        <div class="col-6 col-md-3"><label class="form-label">Cash Flow</label>
          <select v-model="form.cashFlowType" class="form-select"><option v-for="c in CF" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="col-6 col-md-3 d-flex align-items-end"><div class="form-check">
          <input v-model="form.costCenterRequired" class="form-check-input" type="checkbox" id="ccr" /><label class="form-check-label ms-1" for="ccr">Cost center required</label></div></div>
        <div class="col-6 col-md-3 d-flex align-items-end"><div class="form-check">
          <input v-model="form.isHeader" class="form-check-input" type="checkbox" id="hdr" /><label class="form-check-label ms-1" for="hdr">Header (not postable)</label></div></div>
        <div class="col-12"><label class="form-label">Description</label><input v-model="form.description" class="form-control" /></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create account') }}</button>
    </div></div>

    <div class="mb-3" style="max-width:360px"><input v-model="search" class="form-control" placeholder="Search code, name or type…" /></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:720px">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Account Name</th><th class="lbl">Type</th><th class="lbl">Normal</th><th class="lbl">Cash Flow</th><th class="lbl">CC?</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in visible" :key="a._id" :style="a.isHeader ? 'background:#F5F7FA;font-weight:700' : ''">
            <td class="lbl">{{ a.code }}</td>
            <td class="lbl">{{ a.name }}<span v-if="!a.active" class="badge7 off ms-1">inactive</span></td>
            <td class="lbl">{{ a.type }}</td>
            <td class="lbl">{{ a.normalBalance }}</td>
            <td class="lbl">{{ a.cashFlowType }}</td>
            <td class="lbl">{{ a.costCenterRequired ? 'Yes' : '' }}</td>
            <td class="lbl"><button v-if="auth.isOwner || auth.isSuperadmin" class="btn btn-ghost btn-sm py-0" @click="edit(a)">Edit</button></td>
          </tr>
        </tbody>
      </table>
    </div></div>
    <p class="text-muted small mt-2">{{ visible.length }} of {{ accounts.length }} accounts</p>
  </div>
</template>
