<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const purchases = ref([]);
const suppliers = ref([]);
const products = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const form = ref({ supplier:'', reference:'', date:new Date().toISOString().slice(0,10), items:[] });

function addItem(){ form.value.items.push({ product:'', quantity:1, unitCost:0 }); }
function removeItem(i){ form.value.items.splice(i,1); }
function reset(){ form.value = { supplier:'', reference:'', date:new Date().toISOString().slice(0,10), items:[] }; showForm.value=false; }
const total = computed(()=> form.value.items.reduce((s,i)=> s + Number(i.quantity||0)*Number(i.unitCost||0), 0));
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});

async function load(){
  loading.value=true; error.value='';
  try {
    const [pu,su,pr] = await Promise.all([ api.get('/purchases'), api.get('/suppliers'), api.get('/products') ]);
    purchases.value = pu.data.purchases; suppliers.value = su.data.suppliers; products.value = pr.data.products;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load purchases.'; }
  finally { loading.value=false; }
}
async function save(){
  saving.value=true; error.value='';
  try { await api.post('/purchases', form.value); reset(); await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save purchase.'; }
  finally { saving.value=false; }
}
function openForm(){ showForm.value=true; if(!form.value.items.length) addItem(); }
const selected = ref(null);
function viewPurchase(p){ selected.value = p; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeView(){ selected.value = null; }
const lineTotal = (it)=> Number(it.quantity||0) * Number(it.unitCost||0);
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Purchases</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? reset() : openForm()">{{ showForm ? 'Close' : '+ Record purchase' }}</button>
    </div>
    <p class="text-muted">Buying stock adds it to the warehouse automatically.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.supplier?.name || 'No supplier' }}</h5>
          <div class="text-muted small">{{ fmtDate(selected.date) }}<span v-if="selected.reference"> · Ref: {{ selected.reference }}</span></div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="closeView">Close</button>
      </div>
      <table class="fin-table">
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
    </div></div>

    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New purchase</p>
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-5"><label class="form-label">Supplier</label>
          <select v-model="form.supplier" class="form-select"><option value="">—</option>
            <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option></select></div>
        <div class="col-6 col-md-4"><label class="form-label">Reference</label><input v-model="form.reference" class="form-control" placeholder="Invoice #" /></div>
        <div class="col-6 col-md-3"><label class="form-label">Date</label><input v-model="form.date" type="date" class="form-control" /></div>
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

      <div class="d-flex justify-content-between align-items-center mt-3">
        <span class="fw-semibold">Total: {{ peso(total) }}</span>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Record purchase' }}</button>
      </div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!purchases.length" class="card"><div class="card-body text-muted text-center py-4">No purchases yet.</div></div>

    <div v-for="p in purchases" :key="p._id" class="card mb-2" style="cursor:pointer" @click="viewPurchase(p)"><div class="card-body">
      <div class="d-flex justify-content-between">
        <div><div class="fw-semibold" style="font-family:var(--font-display)">{{ p.supplier?.name || 'No supplier' }}
          <span class="text-muted small ms-1">{{ p.reference }}</span></div>
          <div class="text-muted small">{{ fmtDate(p.date) }} · {{ p.items.length }} item<span v-if="p.items.length>1">s</span></div></div>
        <div class="fw-bold numeric">{{ peso(p.total) }}</div>
      </div>
    </div></div>
  </div>
</template>
