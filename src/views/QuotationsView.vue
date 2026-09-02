<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api.js';
import InvoiceDocument from '../components/InvoiceDocument.vue';
import { fmtDate } from '../utils/datetime.js';

const router = useRouter();
const items = ref([]);
const customers = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);
const showDoc = ref(false);
const docData = ref(null);
const selected = ref(null);
function viewQuote(q){ selected.value = q; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeView(){ selected.value = null; }
function printQuote(q){
  docData.value = {
    title: 'QUOTATION',
    docNo: q.quotationNumber,
    date: fmtDate(q.createdAt || Date.now()),
    customerName: q.customer?.name || '',
    items: [{ description: q.machineModel || 'Vending machine', qty: q.quantity,
              unitPrice: q.computed?.totalSelling || 0, amount: q.computed?.totalContract || 0 }],
    totalSales: q.computed?.totalContract || 0, discount: 0, withholding: 0,
    totalDue: q.computed?.totalContract || 0,
  };
  showDoc.value = true;
}

const form = reactive({
  customer:'', machineModel:'', quantity:1,
  supplierCost:0, freight:0, importation:0, bankCharges:0,
  delivery:0, installation:0, otherCosts:0, markupPercent:20, vatStatus:'NON_VAT',
});
const computed_ = ref(null);
let t;
watch(form, () => { clearTimeout(t); t = setTimeout(preview, 250); }, { deep:true });

async function preview(){
  try { const { data } = await api.post('/quotations/preview', form); computed_.value = data.computed; } catch {}
}
async function load(){
  loading.value=true; error.value='';
  try {
    const [q,c] = await Promise.all([ api.get('/quotations'), api.get('/customers') ]);
    items.value = q.data.quotations; customers.value = c.data.customers;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value=false; }
}
async function save(){
  saving.value=true; error.value='';
  try { await api.post('/quotations', form); showForm.value=false; await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
async function convert(q){
  try { await api.post(`/quotations/${q._id}/convert`); router.push({ name:'salesorders' }); }
  catch(e){ error.value = e.response?.data?.message || 'Could not convert.'; }
}
function openForm(){ showForm.value=true; preview(); }
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Quotations</h3>
      <button class="btn btn-primary btn-sm" @click="showForm ? (showForm=false) : openForm()">{{ showForm ? 'Close' : '+ New quotation' }}</button>
    </div>
    <p class="text-muted">Price a vending machine for a customer. The calculator updates live.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.quotationNumber }}
            <span class="badge7 ms-1" :class="selected.status==='CONVERTED' ? 'owner' : 'emp'">{{ selected.status }}</span></h5>
          <div class="text-muted small">{{ selected.customer?.name || 'No customer' }} · {{ selected.machineModel || '—' }} · {{ selected.quantity }} unit/s</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="printQuote(selected)">Print</button>
          <button class="btn btn-ghost btn-sm" @click="closeView">Close</button>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-md-6">
          <p class="section-eyebrow mb-2">Cost inputs (per unit)</p>
          <div class="is-row"><span>Supplier cost</span><span class="numeric">{{ peso(selected.supplierCost) }}</span></div>
          <div class="is-row"><span>Freight</span><span class="numeric">{{ peso(selected.freight) }}</span></div>
          <div class="is-row"><span>Importation</span><span class="numeric">{{ peso(selected.importation) }}</span></div>
          <div class="is-row"><span>Bank charges</span><span class="numeric">{{ peso(selected.bankCharges) }}</span></div>
          <div class="is-row"><span>Delivery</span><span class="numeric">{{ peso(selected.delivery) }}</span></div>
          <div class="is-row"><span>Installation</span><span class="numeric">{{ peso(selected.installation) }}</span></div>
          <div class="is-row"><span>Other costs</span><span class="numeric">{{ peso(selected.otherCosts) }}</span></div>
          <div class="is-row total"><span>Markup / VAT</span><span class="numeric">{{ selected.markupPercent }}% · {{ selected.vatStatus }}</span></div>
        </div>
        <div class="col-12 col-md-6">
          <p class="section-eyebrow mb-2">Price breakdown</p>
          <div class="is-row"><span>Landed cost / unit</span><span class="numeric">{{ peso(selected.computed?.landedCost) }}</span></div>
          <div class="is-row"><span>Selling (before VAT)</span><span class="numeric">{{ peso(selected.computed?.sellingBeforeVat) }}</span></div>
          <div class="is-row muted"><span>VAT</span><span class="numeric">{{ peso(selected.computed?.vatAmount) }}</span></div>
          <div class="is-row total"><span>Total / unit</span><span class="numeric">{{ peso(selected.computed?.totalSelling) }}</span></div>
          <div class="is-row"><span>Gross profit / unit</span><span class="numeric">{{ peso(selected.computed?.grossProfit) }} ({{ selected.computed?.grossMargin }}%)</span></div>
          <div class="is-row grand"><span>Contract ({{ selected.computed?.quantity }} unit/s)</span><span class="numeric">{{ peso(selected.computed?.totalContract) }}</span></div>
        </div>
      </div>
    </div></div>

    <div v-if="showForm" class="row g-3 mb-4">
      <div class="col-12 col-lg-7"><div class="card"><div class="card-body">
        <p class="section-eyebrow mb-3">Quotation details</p>
        <div class="row g-2">
          <div class="col-12 col-md-6"><label class="form-label">Customer</label>
            <select v-model="form.customer" class="form-select"><option value="">—</option>
              <option v-for="c in customers" :key="c._id" :value="c._id">{{ c.name }}</option></select></div>
          <div class="col-8 col-md-4"><label class="form-label">Machine model</label><input v-model="form.machineModel" class="form-control" /></div>
          <div class="col-4 col-md-2"><label class="form-label">Qty</label><input v-model.number="form.quantity" type="number" class="form-control numeric" /></div>

          <div class="col-6 col-md-4"><label class="form-label">Supplier cost</label><input v-model.number="form.supplierCost" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Freight</label><input v-model.number="form.freight" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Importation</label><input v-model.number="form.importation" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Bank charges</label><input v-model.number="form.bankCharges" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Delivery</label><input v-model.number="form.delivery" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Installation</label><input v-model.number="form.installation" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Other costs</label><input v-model.number="form.otherCosts" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Markup %</label><input v-model.number="form.markupPercent" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">VAT</label>
            <select v-model="form.vatStatus" class="form-select"><option value="VAT">VAT</option><option value="NON_VAT">Non-VAT</option></select></div>
        </div>
        <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save quotation' }}</button>
      </div></div></div>

      <!-- Live pricing panel -->
      <div class="col-12 col-lg-5"><div class="card" style="position:sticky;top:1rem"><div class="card-body">
        <p class="section-eyebrow mb-3">Price breakdown</p>
        <template v-if="computed_">
          <div class="is-row"><span>Landed cost / unit</span><span class="numeric">{{ peso(computed_.landedCost) }}</span></div>
          <div class="is-row"><span>Selling (before VAT)</span><span class="numeric">{{ peso(computed_.sellingBeforeVat) }}</span></div>
          <div class="is-row muted"><span>VAT</span><span class="numeric">{{ peso(computed_.vatAmount) }}</span></div>
          <div class="is-row total"><span>Total / unit</span><span class="numeric">{{ peso(computed_.totalSelling) }}</span></div>
          <div class="is-row"><span>Gross profit / unit</span><span class="numeric">{{ peso(computed_.grossProfit) }} ({{ computed_.grossMargin }}%)</span></div>
          <div class="is-row grand"><span>Contract ({{ computed_.quantity }} unit/s)</span><span class="numeric">{{ peso(computed_.totalContract) }}</span></div>
        </template>
      </div></div></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length && !showForm" class="card"><div class="card-body text-muted text-center py-4">No quotations yet.</div></div>
    <div v-for="q in items" :key="q._id" class="card mb-2"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold" style="font-family:var(--font-display)">{{ q.quotationNumber }}
          <span class="text-muted small ms-1">{{ q.customer?.name || 'No customer' }}</span>
          <span class="badge7 ms-1" :class="q.status==='CONVERTED' ? 'owner' : 'emp'">{{ q.status }}</span></div>
        <div class="text-muted small">{{ q.machineModel || '—' }} · {{ q.quantity }} unit/s · {{ peso(q.computed?.totalContract) }}</div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="viewQuote(q)">View</button>
      <button class="btn btn-ghost btn-sm" @click="printQuote(q)">Print</button>
      <button v-if="q.status!=='CONVERTED'" class="btn btn-primary btn-sm" @click="convert(q)">Convert to order</button>
    </div></div>
    <InvoiceDocument v-if="showDoc" :doc="docData" @close="showDoc=false" />
  </div>
</template>
