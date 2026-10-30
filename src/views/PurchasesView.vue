<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';
import AttachmentLinks from '../components/AttachmentLinks.vue';

const purchases = ref([]);
const suppliers = ref([]);
const products = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const today = () => new Date().toISOString().slice(0,10);
const plus30 = (d) => { const x = new Date(d||Date.now()); x.setDate(x.getDate()+30); return x.toISOString().slice(0,10); };
const form = ref({ supplier:'', reference:'', date:today(), dueDate:plus30(today()), paymentMethod:'CREDIT', items:[], attachments:[] });
// Kapag binago ang Date at walang manual na Due Date pa, i-default sa +30 araw (editable pa rin).
function onDateChange(){ if(form.value.date) form.value.dueDate = plus30(form.value.date); }

// --- Bulk import ---
const showImport = ref(false);
const importing = ref(false);
const importFile = ref(null);
const importResult = ref(null);
function onImportPick(e){ importFile.value = e.target.files?.[0] || null; importResult.value = null; }
async function runImport(){
  if (!importFile.value) { error.value = 'Pumili muna ng .xlsx o .csv file.'; return; }
  importing.value = true; error.value=''; importResult.value=null;
  try {
    const fd = new FormData(); fd.append('file', importFile.value);
    const { data } = await api.post('/purchases/import', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
    importResult.value = data; importFile.value = null; await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not import.'; }
  finally { importing.value=false; }
}

function addItem(){ form.value.items.push({ product:'', quantity:1, unitCost:0 }); }
function removeItem(i){ form.value.items.splice(i,1); }
function reset(){ form.value = { supplier:'', reference:'', date:today(), dueDate:plus30(today()), paymentMethod:'CREDIT', items:[], attachments:[] }; showForm.value=false; }
const total = computed(()=> form.value.items.reduce((s,i)=> s + Number(i.quantity||0)*Number(i.unitCost||0), 0));
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
const balOf = (p)=> Number(p.total||0) - Number(p.amountPaid||0);
const methodLabel = (m)=> m==='CASH' ? 'Cash (paid)' : m==='BANK' ? 'Bank (paid)' : m==='CREDIT_CARD' ? 'Credit Card' : 'Supplier Credit (AP)';

async function load(){
  loading.value=true; error.value='';
  try {
    const [pu,su,pr] = await Promise.all([ api.get('/purchases'), api.get('/suppliers'), api.get('/products') ]);
    purchases.value = pu.data.purchases; suppliers.value = su.data.suppliers; products.value = pr.data.products;
    if (selected.value) selected.value = purchases.value.find(x=>x._id===selected.value._id) || null;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load purchases.'; }
  finally { loading.value=false; }
}
async function save(){
  saving.value=true; error.value='';
  try { await api.post('/purchases', form.value); reset(); await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save purchase.'; }
  finally { saving.value=false; }
}
function openForm(){ showForm.value=true; selected.value=null; if(!form.value.items.length) addItem(); }

const selected = ref(null);
const pay = ref({ amount:0, payType:'BANK' });
const settling = ref(false);
function viewPurchase(p){ selected.value = p; pay.value = { amount: balOf(p), payType: pay.value.payType || 'BANK' }; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeView(){ selected.value = null; }
const savingAtts = ref(false);
async function saveAtts(){
  if(!selected.value) return;
  savingAtts.value = true;
  try { const { data } = await api.patch(`/purchases/${selected.value._id}/attachments`, { attachments: selected.value.attachments || [] }); selected.value = data.purchase; await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save attachments.'; }
  finally { savingAtts.value = false; }
}
const lineTotal = (it)=> Number(it.quantity||0) * Number(it.unitCost||0);

async function settle(){
  settling.value=true; error.value='';
  try {
    const { data } = await api.post(`/purchases/${selected.value._id}/payments`, { amount: pay.value.amount, payType: pay.value.payType });
    selected.value = data.purchase;
    pay.value = { amount: balOf(data.purchase), payType: pay.value.payType };
    await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not record payment.'; }
  finally { settling.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Purchases</h3>
      <div class="d-flex gap-2">
        <button class="btn btn-ghost btn-sm" @click="showImport = !showImport">{{ showImport ? 'Hide import' : 'Import' }}</button>
        <button class="btn btn-primary btn-sm" @click="showForm ? reset() : openForm()">{{ showForm ? 'Close' : '+ Record purchase' }}</button>
      </div>
    </div>
    <p class="text-muted">Credit purchases become payable — Supplier Credit → Accounts Payable, Credit Card → Credit Card Payable. Settle them to reduce cash. Cash/Bank purchases are paid outright.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Bulk import (xlsx/csv) -->
    <div v-if="showImport" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-2">Import purchases (.xlsx / .csv)</p>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <input type="file" accept=".xlsx,.xls,.csv" class="form-control form-control-sm" style="max-width:320px" @change="onImportPick" />
        <button class="btn btn-primary btn-sm" :disabled="importing" @click="runImport">{{ importing ? 'Importing…' : 'Import Purchase' }}</button>
      </div>
      <div class="text-muted small mt-2">
        Columns: <strong>Reference, Date, Due Date, Supplier, SKU</strong> (o Product name), <strong>Qty, Unit Cost, Payment</strong> (CREDIT/CASH/BANK).
        Ang mga row na may parehong <strong>Reference</strong> ay pinagsasama sa iisang purchase. Pang-migrate ng Jan-to-present.
      </div>
      <div v-if="importResult" class="alert alert-success py-2 mt-2 mb-0">
        Na-import: <strong>{{ importResult.created }}</strong> purchase(s), {{ importResult.lines }} line(s). Skipped: {{ importResult.skipped }}.
        <div v-if="importResult.errors?.length" class="small mt-1" style="color:var(--bad)">
          <div v-for="(er,i) in importResult.errors" :key="i">· {{ er }}</div>
        </div>
      </div>
    </div></div>

    <!-- Detail -->
    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.supplier?.name || 'No supplier' }}</h5>
          <div class="text-muted small">{{ fmtDate(selected.date) }}<span v-if="selected.dueDate"> · Due: {{ fmtDate(selected.dueDate) }}</span><span v-if="selected.reference"> · Ref: {{ selected.reference }}</span></div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="closeView">Close</button>
      </div>

      <table class="fin-table mb-3">
        <thead><tr><th class="lbl">Product</th><th>Qty</th><th>Unit cost</th><th>Line total</th></tr></thead>
        <tbody>
          <tr v-for="(it,i) in selected.items" :key="i">
            <td class="lbl">{{ it.product?.name || 'Product' }} <span class="text-muted small">{{ it.product?.sku }}</span></td>
            <td class="num">{{ it.quantity }}</td>
            <td class="num">{{ peso(it.unitCost) }}</td>
            <td class="num">{{ peso(lineTotal(it)) }}</td>
          </tr>
          <tr class="gp"><td class="lbl">Total</td><td></td><td></td><td class="num">{{ peso(selected.total) }}</td></tr>
        </tbody>
      </table>

      <div class="mb-3">
        <div class="d-flex align-items-center justify-content-between mb-1">
          <label class="form-label mb-0">Attachments (links)</label>
          <button class="btn btn-ghost btn-sm" :disabled="savingAtts" @click="saveAtts">{{ savingAtts ? 'Saving…' : 'Save attachments' }}</button>
        </div>
        <AttachmentLinks :model-value="selected.attachments || []" @update:model-value="v => selected.attachments = v" />
      </div>

      <!-- Payment status -->
      <div class="row g-2 mb-2">
        <div class="col-4"><div class="tile sm"><div class="tlabel">Method</div><div class="tval" style="font-size:1rem">{{ methodLabel(selected.paymentMethod) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Paid</div><div class="tval" style="font-size:1rem">{{ peso(selected.amountPaid) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Payable balance</div><div class="tval" style="font-size:1rem" :class="balOf(selected)>0 && 'warn'">{{ peso(balOf(selected)) }}</div></div></div>
      </div>

      <template v-if="balOf(selected)>0">
        <p class="section-eyebrow mb-2">Settle payable (reduces cash)</p>
        <div class="row g-2 align-items-end">
          <div class="col-6 col-md-3"><label class="form-label">Amount</label><input v-model.number="pay.amount" type="number" class="form-control form-control-sm numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Payment type</label>
            <select v-model="pay.payType" class="form-select form-select-sm">
              <option value="ON_HAND">Cash on Hand</option>
              <option value="BANK">Cash in Bank</option>
              <option value="GCASH">Cash in GCash / E-Wallet</option>
            </select></div>
          <div class="col-6 col-md-3"><button class="btn btn-primary btn-sm w-100" :disabled="settling" @click="settle">Record payment</button></div>
        </div>
      </template>
      <div v-else class="alert alert-success py-2 mb-0">Fully settled. ✓</div>
    </div></div>

    <!-- New purchase form -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New purchase</p>
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-4"><label class="form-label">Supplier</label>
          <select v-model="form.supplier" class="form-select"><option value="">—</option>
            <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option></select></div>
        <div class="col-6 col-md-4"><label class="form-label">Reference</label><input v-model="form.reference" class="form-control" placeholder="Invoice #" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Date</label><input v-model="form.date" type="date" class="form-control" @change="onDateChange" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Due date</label><input v-model="form.dueDate" type="date" class="form-control" /></div>
        <div class="col-6 col-md-4"><label class="form-label">Payment</label>
          <select v-model="form.paymentMethod" class="form-select">
            <option value="CREDIT">Supplier Credit / Payable (AP)</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="CASH">Cash (paid now)</option>
            <option value="BANK">Bank (paid now)</option>
          </select></div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-1">
        <p class="section-eyebrow mb-0">Items</p>
        <button class="btn btn-ghost btn-sm" @click="addItem">+ Add item</button>
      </div>
      <div v-if="form.items.length" class="row g-2 mb-1">
        <div class="col-6"><span class="form-label mb-0">Product</span></div>
        <div class="col-3"><span class="form-label mb-0">Qty</span></div>
        <div class="col-2"><span class="form-label mb-0">Unit cost</span></div>
        <div class="col-1"></div>
      </div>
      <div v-for="(it,i) in form.items" :key="i" class="row g-2 mb-2">
        <div class="col-6"><select v-model="it.product" class="form-select form-select-sm"><option value="">— product —</option>
          <option v-for="p in products" :key="p._id" :value="p._id">{{ p.name }}</option></select></div>
        <div class="col-3"><input v-model.number="it.quantity" type="number" class="form-control form-control-sm numeric" placeholder="Qty" /></div>
        <div class="col-2"><input v-model.number="it.unitCost" type="number" class="form-control form-control-sm numeric" placeholder="Unit cost" /></div>
        <div class="col-1"><button class="btn btn-ghost btn-sm w-100" @click="removeItem(i)">×</button></div>
      </div>

      <div class="mt-3 mb-2">
        <label class="form-label">Attachments (links)</label>
        <AttachmentLinks v-model="form.attachments" />
      </div>
      <div class="d-flex justify-content-between align-items-center mt-3">
        <span class="fw-semibold">Total: {{ peso(total) }}</span>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Record purchase' }}</button>
      </div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!purchases.length" class="card"><div class="card-body text-muted text-center py-4">No purchases yet.</div></div>

    <div v-for="p in purchases" :key="p._id" class="card mb-2" style="cursor:pointer" @click="viewPurchase(p)"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center">
        <div><div class="fw-semibold" style="font-family:var(--font-display)">{{ p.supplier?.name || 'No supplier' }}
          <span class="text-muted small ms-1">{{ p.reference }}</span>
          <span v-if="p.attachments?.length" class="ms-1" title="May attachment">📎</span></div>
          <div class="text-muted small">{{ fmtDate(p.date) }} · {{ p.items.length }} item<span v-if="p.items.length>1">s</span> · {{ methodLabel(p.paymentMethod) }}</div></div>
        <div class="text-end">
          <div class="fw-bold numeric">{{ peso(p.total) }}</div>
          <span v-if="balOf(p)>0" class="pill warn">payable {{ peso(balOf(p)) }}</span>
          <span v-else class="pill ok">settled</span>
        </div>
      </div>
    </div></div>
  </div>
</template>

<style scoped>
.pill { font-size:.7rem; font-weight:700; padding:.15rem .5rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); }
.pill.warn { background:#FDECEC; color:var(--bad); }
.tile.sm { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:.5rem .7rem; }
.tile.sm .tlabel { font-size:.66rem; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--muted); }
.tile.sm .tval { font-family:var(--font-display); font-weight:700; }
.tile.sm .tval.warn { color:var(--bad); }
</style>
