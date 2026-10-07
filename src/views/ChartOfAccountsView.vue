<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const accounts = ref([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const search = ref('');
const showInactive = ref(true);
const showForm = ref(false);
const saving = ref(false);

const TYPES = ['Asset','Contra Asset','Liability','Equity','Contra Equity','Revenue','Contra Revenue','COGS','Expense','Other Income','Other Expense','Header'];
const CF = ['Operating','Investing','Financing','Non-Cash','—'];
const NB = ['Debit','Credit','—'];

const isOwner = computed(()=> auth.isOwner || auth.isSuperadmin);
const blank = () => ({ id:null, code:'', name:'', type:'Asset', normalBalance:'Debit', cashFlowType:'Operating', costCenterRequired:false, description:'', isHeader:false, active:true });
const form = ref(blank());

function flash(msg){ notice.value = msg; setTimeout(()=> notice.value='', 2500); }

const visible = computed(()=>{
  const q = search.value.trim().toLowerCase();
  return accounts.value.filter(a => {
    if(!showInactive.value && a.active === false) return false;
    return !q || String(a.code).includes(q) || (a.name||'').toLowerCase().includes(q) || (a.type||'').toLowerCase().includes(q);
  });
});

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/accounts-coa'); accounts.value = data.accounts; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load accounts.'; }
  finally { loading.value=false; }
}
function openNew(){ form.value = blank(); showForm.value=true; window.scrollTo({top:0,behavior:'smooth'}); }
function edit(a){ form.value = { id:a._id, code:a.code, name:a.name, type:a.type, normalBalance:a.normalBalance, cashFlowType:a.cashFlowType, costCenterRequired:a.costCenterRequired, description:a.description, isHeader:a.isHeader, active:a.active !== false }; showForm.value=true; window.scrollTo({top:0,behavior:'smooth'}); }
function close(){ showForm.value=false; }
async function save(){
  saving.value=true; error.value='';
  try {
    if(form.value.id) await api.patch(`/accounts-coa/${form.value.id}`, form.value);
    else await api.post('/accounts-coa', form.value);
    close(); await load(); flash('Saved.');
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
async function toggleActive(a){
  error.value='';
  try { await api.patch(`/accounts-coa/${a._id}`, { active: a.active === false }); await load(); flash(a.active === false ? 'Account activated.' : 'Account deactivated.'); }
  catch(e){ error.value = e.response?.data?.message || 'Could not update.'; }
}
async function remove(a){
  if(!confirm(`Delete account ${a.code} · ${a.name}? Bawal kung nagamit na sa journal/opening balances — i-deactivate na lang kung ganun.`)) return;
  error.value='';
  try { await api.delete(`/accounts-coa/${a._id}`); await load(); flash('Account deleted.'); }
  catch(e){ error.value = e.response?.data?.message || 'Could not delete.'; }
}
function history(a){ router.push({ name:'audittrail', query:{ entityType:'Account', entityId:a._id, name:`${a.code} · ${a.name}` } }); }
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Chart of Accounts</h3>
      <div class="d-flex gap-2">
        <button v-if="isOwner" class="btn btn-ghost btn-sm" @click="router.push({ name:'audittrail', query:{ entityType:'Account' } })">⟲ Audit trail</button>
        <button v-if="isOwner" class="btn btn-primary btn-sm" @click="showForm ? close() : openNew()">{{ showForm ? 'Close' : '+ New account' }}</button>
      </div>
    </div>
    <p class="text-muted">The master list of accounts. Every journal entry posts to one of these.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

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
        <div class="col-6 col-md-3 d-flex align-items-end"><div class="form-check">
          <input v-model="form.active" class="form-check-input" type="checkbox" id="act" /><label class="form-check-label ms-1" for="act">Active</label></div></div>
        <div class="col-12"><label class="form-label">Description</label><input v-model="form.description" class="form-control" /></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create account') }}</button>
    </div></div>

    <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
      <div style="max-width:360px;flex:1 1 240px"><input v-model="search" class="form-control" placeholder="Search code, name or type…" /></div>
      <div class="form-check"><input v-model="showInactive" class="form-check-input" type="checkbox" id="showInact" /><label class="form-check-label ms-1" for="showInact">Show inactive</label></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table" style="min-width:820px">
        <thead><tr><th class="lbl">Code</th><th class="lbl">Account Name</th><th class="lbl">Type</th><th class="lbl">Normal</th><th class="lbl">Cash Flow</th><th class="lbl">CC?</th><th class="lbl">Status</th><th class="lbl" style="text-align:right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="a in visible" :key="a._id" :style="a.isHeader ? 'background:#F5F7FA;font-weight:700' : (a.active===false ? 'opacity:.6' : '')">
            <td class="lbl">{{ a.code }}</td>
            <td class="lbl">{{ a.name }}</td>
            <td class="lbl">{{ a.type }}</td>
            <td class="lbl">{{ a.normalBalance }}</td>
            <td class="lbl">{{ a.cashFlowType }}</td>
            <td class="lbl">{{ a.costCenterRequired ? 'Yes' : '' }}</td>
            <td class="lbl"><span class="badge7" :class="a.active===false ? 'off' : 'emp'">{{ a.active===false ? 'Inactive' : 'Active' }}</span></td>
            <td class="lbl" style="text-align:right;white-space:nowrap">
              <template v-if="isOwner">
                <button class="btn btn-ghost btn-sm py-0" @click="edit(a)">Edit</button>
                <button class="btn btn-ghost btn-sm py-0" @click="toggleActive(a)">{{ a.active===false ? 'Activate' : 'Deactivate' }}</button>
                <button class="btn btn-ghost btn-sm py-0" @click="history(a)" title="Audit trail">⟲</button>
                <button class="btn btn-sm btn-danger7 py-0" @click="remove(a)">Delete</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div></div>
    <p class="text-muted small mt-2">{{ visible.length }} of {{ accounts.length }} accounts</p>
  </div>
</template>
