<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api.js';
import InvoiceDocument from '../components/InvoiceDocument.vue';
import { fmtDate } from '../utils/datetime.js';

const router = useRouter();
const items = ref([]);
const customers = ref([]);
const products = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const formKind = ref('MACHINE');     // MACHINE | PRODUCT
const saving = ref(false);
const showDoc = ref(false);
const docData = ref(null);
const selected = ref(null);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const round = (n) => Math.round(Number(n || 0) * 100) / 100;

function viewQuote(q){ selected.value = q; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeView(){ selected.value = null; }
function printQuote(q){
  const its = (q.kind === 'PRODUCT' && q.items?.length)
    ? q.items.map((it) => ({ description: it.description || it.product?.name || 'Item', qty: it.quantity, unitPrice: it.unitPrice, amount: it.lineTotal }))
    : [{ description: q.machineModel || 'Vending machine', qty: q.quantity, unitPrice: q.computed?.totalSelling || 0, amount: q.computed?.totalContract || 0 }];
  const total = q.kind === 'PRODUCT' ? (q.total || q.computed?.totalContract || 0) : (q.computed?.totalContract || 0);
  docData.value = { title: 'QUOTATION', docNo: q.quotationNumber, date: fmtDate(q.createdAt || Date.now()),
    customerName: q.customer?.name || '', items: its, totalSales: total, discount: 0, withholding: 0, totalDue: total };
  showDoc.value = true;
}

// ---- Machine quotation form (existing) ----
const form = reactive({ customer:'', machineModel:'', quantity:1, supplierCost:0, freight:0, importation:0, bankCharges:0, delivery:0, installation:0, otherCosts:0, markupPercent:20, vatStatus:'NON_VAT' });
const computed_ = ref(null);
let t;
watch(form, () => { if(formKind.value==='MACHINE'){ clearTimeout(t); t = setTimeout(previewMachine, 250); } }, { deep:true });
async function previewMachine(){ try { const { data } = await api.post('/quotations/preview', { kind:'MACHINE', ...form }); computed_.value = data.computed; } catch {} }

// ---- Product quotation form (bago) ----
const pform = reactive({ customer:'', newCustomer:false, newCustomerName:'', vatStatus:'NON_VAT',
  lines: [ blankLine(), blankLine() ] });
function blankLine(){ return { product:'', description:'', quantity:1, unitPrice:0 }; }
function addLine(){ pform.lines.push(blankLine()); }
function removeLine(i){ pform.lines.splice(i,1); }
function onProduct(line){
  const p = products.value.find((x) => x._id === line.product);
  if(p){ line.description = p.name; if(p.sellingPrice) line.unitPrice = p.sellingPrice; }
}
const productTotals = computed(() => {
  const lines = pform.lines.map((l) => ({ ...l, lineTotal: round((Number(l.quantity)||0) * (Number(l.unitPrice)||0)) }));
  const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vatAmount = pform.vatStatus === 'VAT' ? round(subtotal * 0.12) : 0; // ~12% (server authoritative)
  return { lines, subtotal, vatAmount, total: round(subtotal + vatAmount) };
});

async function load(){
  loading.value=true; error.value='';
  try {
    const [q,c,p] = await Promise.all([ api.get('/quotations'), api.get('/customers'), api.get('/products') ]);
    items.value = q.data.quotations; customers.value = c.data.customers; products.value = p.data.products;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value=false; }
}
function openForm(kind){ formKind.value = kind || 'MACHINE'; showForm.value=true; if(kind==='MACHINE') previewMachine(); window.scrollTo({ top:0, behavior:'smooth' }); }

async function save(){
  saving.value=true; error.value='';
  try {
    if(formKind.value === 'PRODUCT'){
      let customerId = pform.customer;
      if(pform.newCustomer && pform.newCustomerName.trim()){
        const { data } = await api.post('/customers', { name: pform.newCustomerName.trim() });
        customerId = data.customer._id;
      }
      const lines = pform.lines.filter((l) => l.product || l.description).map((l) => ({ product:l.product||undefined, description:l.description, quantity:Number(l.quantity)||0, unitPrice:Number(l.unitPrice)||0 }));
      if(!lines.length){ error.value='Magdagdag man lang ng isang produkto.'; saving.value=false; return; }
      await api.post('/quotations', { kind:'PRODUCT', customer: customerId || undefined, vatStatus: pform.vatStatus, items: lines });
    } else {
      await api.post('/quotations', { kind:'MACHINE', ...form });
    }
    showForm.value=false; await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
async function convert(q){
  try { await api.post(`/quotations/${q._id}/convert`); router.push({ name:'salesorders' }); }
  catch(e){ error.value = e.response?.data?.message || 'Could not convert.'; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-2">
      <h3 class="mb-0">Quotations</h3>
      <div class="d-flex gap-2">
        <button class="btn btn-ghost btn-sm" @click="openForm('MACHINE')">+ Machine</button>
        <button class="btn btn-primary btn-sm" @click="openForm('PRODUCT')">+ Product quotation</button>
      </div>
    </div>
    <p class="text-muted">Mag-quote ng vending machine (calculator) o ng mga produkto (line items) para sa isang customer.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- View quote -->
    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.quotationNumber }}
            <span class="badge7 ms-1" :class="selected.kind==='PRODUCT' ? 'emp' : 'owner'">{{ selected.kind==='PRODUCT' ? 'PRODUCT' : 'MACHINE' }}</span>
            <span class="badge7 ms-1" :class="selected.status==='CONVERTED' ? 'owner' : 'emp'">{{ selected.status }}</span></h5>
          <div class="text-muted small">{{ selected.customer?.name || 'No customer' }}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="printQuote(selected)">Print</button>
          <button class="btn btn-ghost btn-sm" @click="closeView">Close</button>
        </div>
      </div>

      <!-- Product items -->
      <template v-if="selected.kind==='PRODUCT'">
        <table class="fin-table ruled" style="min-width:520px">
          <thead><tr><th class="lbl">Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
          <tbody>
            <tr v-for="(it,i) in selected.items" :key="i"><td class="lbl">{{ it.description }}</td><td class="num">{{ it.quantity }}</td><td class="num">{{ peso(it.unitPrice) }}</td><td class="num fw-semibold">{{ peso(it.lineTotal) }}</td></tr>
          </tbody>
          <tfoot>
            <tr><td colspan="3" class="lbl">Subtotal</td><td class="num">{{ peso(selected.subtotal) }}</td></tr>
            <tr v-if="selected.vatAmount"><td colspan="3" class="lbl">VAT</td><td class="num">{{ peso(selected.vatAmount) }}</td></tr>
            <tr class="gp"><td colspan="3" class="lbl">Total</td><td class="num fw-bold">{{ peso(selected.total) }}</td></tr>
          </tfoot>
        </table>
      </template>
      <!-- Machine breakdown -->
      <div v-else class="row g-3">
        <div class="col-12 col-md-6">
          <p class="section-eyebrow mb-2">Cost inputs (per unit)</p>
          <div class="is-row"><span>Supplier cost</span><span class="numeric">{{ peso(selected.supplierCost) }}</span></div>
          <div class="is-row"><span>Freight</span><span class="numeric">{{ peso(selected.freight) }}</span></div>
          <div class="is-row"><span>Other costs</span><span class="numeric">{{ peso(selected.otherCosts) }}</span></div>
          <div class="is-row total"><span>Markup / VAT</span><span class="numeric">{{ selected.markupPercent }}% · {{ selected.vatStatus }}</span></div>
        </div>
        <div class="col-12 col-md-6">
          <p class="section-eyebrow mb-2">Price breakdown</p>
          <div class="is-row"><span>Selling (before VAT)</span><span class="numeric">{{ peso(selected.computed?.sellingBeforeVat) }}</span></div>
          <div class="is-row muted"><span>VAT</span><span class="numeric">{{ peso(selected.computed?.vatAmount) }}</span></div>
          <div class="is-row grand"><span>Contract ({{ selected.computed?.quantity }} unit/s)</span><span class="numeric">{{ peso(selected.computed?.totalContract) }}</span></div>
        </div>
      </div>
    </div></div>

    <!-- PRODUCT form -->
    <div v-if="showForm && formKind==='PRODUCT'" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New product quotation</p>
      <div class="row g-2 mb-2">
        <div class="col-12 col-md-5">
          <label class="form-label">Customer</label>
          <select v-if="!pform.newCustomer" v-model="pform.customer" class="form-select"><option value="">—</option>
            <option v-for="c in customers" :key="c._id" :value="c._id">{{ c.name }}</option></select>
          <input v-else v-model="pform.newCustomerName" class="form-control" placeholder="New customer name" />
        </div>
        <div class="col-12 col-md-4 d-flex align-items-end"><div class="form-check">
          <input v-model="pform.newCustomer" class="form-check-input" type="checkbox" id="newc" /><label class="form-check-label ms-1" for="newc">New customer (add to master)</label></div></div>
        <div class="col-6 col-md-3"><label class="form-label">VAT</label>
          <select v-model="pform.vatStatus" class="form-select"><option value="NON_VAT">Non-VAT</option><option value="VAT">VAT</option></select></div>
      </div>

      <div class="pq-head d-none d-md-flex"><span class="c-prod">Product</span><span class="c-desc">Description</span><span class="c-qty">Qty</span><span class="c-up">Unit Price</span><span class="c-lt">Line Total</span><span class="c-x"></span></div>
      <div v-for="(l,i) in pform.lines" :key="i" class="pq-row">
        <span class="c-prod"><select v-model="l.product" class="form-select form-select-sm" @change="onProduct(l)"><option value="">— pick —</option>
          <option v-for="p in products" :key="p._id" :value="p._id">{{ p.sku }} · {{ p.name }}</option></select></span>
        <span class="c-desc"><input v-model="l.description" class="form-control form-control-sm" placeholder="Description" /></span>
        <span class="c-qty"><input v-model.number="l.quantity" type="number" class="form-control form-control-sm numeric text-end" /></span>
        <span class="c-up"><input v-model.number="l.unitPrice" type="number" class="form-control form-control-sm numeric text-end" /></span>
        <span class="c-lt numeric text-end">{{ peso(round((l.quantity||0)*(l.unitPrice||0))) }}</span>
        <span class="c-x"><button class="btn btn-ghost btn-sm" @click="removeLine(i)">×</button></span>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="addLine">+ Add line</button>

      <div class="d-flex justify-content-end gap-3 mt-3">
        <span>Subtotal: <strong class="numeric">{{ peso(productTotals.subtotal) }}</strong></span>
        <span v-if="pform.vatStatus==='VAT'">VAT: <strong class="numeric">{{ peso(productTotals.vatAmount) }}</strong></span>
        <span>Total: <strong class="numeric">{{ peso(productTotals.total) }}</strong></span>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save quotation' }}</button>
      </div>
    </div></div>

    <!-- MACHINE form -->
    <div v-if="showForm && formKind==='MACHINE'" class="row g-3 mb-4">
      <div class="col-12 col-lg-7"><div class="card"><div class="card-body">
        <p class="section-eyebrow mb-3">Machine quotation</p>
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
      <div class="col-12 col-lg-5"><div class="card" style="position:sticky;top:1rem"><div class="card-body">
        <p class="section-eyebrow mb-3">Price breakdown</p>
        <template v-if="computed_">
          <div class="is-row"><span>Landed cost / unit</span><span class="numeric">{{ peso(computed_.landedCost) }}</span></div>
          <div class="is-row"><span>Selling (before VAT)</span><span class="numeric">{{ peso(computed_.sellingBeforeVat) }}</span></div>
          <div class="is-row muted"><span>VAT</span><span class="numeric">{{ peso(computed_.vatAmount) }}</span></div>
          <div class="is-row total"><span>Total / unit</span><span class="numeric">{{ peso(computed_.totalSelling) }}</span></div>
          <div class="is-row grand"><span>Contract ({{ computed_.quantity }} unit/s)</span><span class="numeric">{{ peso(computed_.totalContract) }}</span></div>
        </template>
      </div></div></div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length && !showForm" class="card"><div class="card-body text-muted text-center py-4">No quotations yet.</div></div>
    <div v-for="q in items" :key="q._id" class="card mb-2"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold" style="font-family:var(--font-display)">{{ q.quotationNumber }}
          <span class="badge7 ms-1" :class="q.kind==='PRODUCT' ? 'emp' : 'owner'">{{ q.kind==='PRODUCT' ? 'PRODUCT' : 'MACHINE' }}</span>
          <span class="text-muted small ms-1">{{ q.customer?.name || 'No customer' }}</span>
          <span class="badge7 ms-1" :class="q.status==='CONVERTED' ? 'owner' : 'emp'">{{ q.status }}</span></div>
        <div class="text-muted small">
          <template v-if="q.kind==='PRODUCT'">{{ q.items?.length || 0 }} item/s · {{ peso(q.total || q.computed?.totalContract) }}</template>
          <template v-else>{{ q.machineModel || '—' }} · {{ q.quantity }} unit/s · {{ peso(q.computed?.totalContract) }}</template>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="viewQuote(q)">View</button>
      <button class="btn btn-ghost btn-sm" @click="printQuote(q)">Print</button>
      <button v-if="q.status!=='CONVERTED'" class="btn btn-primary btn-sm" @click="convert(q)">Convert to order</button>
    </div></div>
    <InvoiceDocument v-if="showDoc" :doc="docData" @close="showDoc=false" />
  </div>
</template>

<style scoped>
.pq-head, .pq-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
.pq-head { font-size:.7rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.03em; }
.c-prod{ flex:0 0 26%; } .c-desc{ flex:1 1 auto; } .c-qty{ flex:0 0 10%; } .c-up{ flex:0 0 14%; } .c-lt{ flex:0 0 14%; } .c-x{ flex:0 0 28px; }
@media (max-width: 767px){ .pq-row{ flex-wrap:wrap; } .c-prod,.c-desc,.c-qty,.c-up,.c-lt{ flex:1 1 46%; } }
</style>
