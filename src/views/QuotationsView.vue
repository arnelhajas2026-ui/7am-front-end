<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api.js';
import ExportDialog from '../components/ExportDialog.vue';
import SearchableSelect from '../components/SearchableSelect.vue';
import { downloadFromApi } from '../utils/exporters.js';
import { fmtDate } from '../utils/datetime.js';

const router = useRouter();
const items = ref([]);
const customers = ref([]);
const products = ref([]);
const machines = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const formKind = ref('MACHINE');     // MACHINE | PRODUCT
const saving = ref(false);
const selected = ref(null);

// Export (server-generated PDF/Word — isang pahina, walang browser header/footer).
const showExport = ref(false);
const exporting = ref(false);
const exportTarget = ref(null);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const round = (n) => Math.round(Number(n || 0) * 100) / 100;
const today = () => new Date().toISOString().slice(0,10);
const isoDay = (d) => d ? new Date(d).toISOString().slice(0,10) : today();

function viewQuote(q){ selected.value = q; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeView(){ selected.value = null; }
// Buksan ang Export dialog (PDF/Word · Portrait/Landscape · A4/Letter).
function printQuote(q){ exportTarget.value = q; showExport.value = true; }
// Email ang quotation (PDF) sa customer.
const sendMsg = ref('');
const sending = ref('');
async function sendQuote(q){
  sending.value = q._id; error.value=''; sendMsg.value='';
  try { const { data } = await api.post(`/quotations/${q._id}/send`); sendMsg.value = `Quotation ${q.quotationNumber} na-send sa ${data.to}.`; setTimeout(()=>sendMsg.value='', 4000); }
  catch(e){ error.value = e.response?.data?.message || 'Could not send email.'; }
  finally { sending.value=''; }
}
async function doExport({ format, orientation, paper }){
  if(!exportTarget.value) return;
  exporting.value = true; error.value = '';
  try {
    const id = exportTarget.value._id;
    const base = `quotation_${exportTarget.value.quotationNumber || 'Q'}`;
    await downloadFromApi(api, `/quotations/${id}/export`, { format, orientation, paper },
      `${base}.${format==='docx' ? 'docx' : 'pdf'}`);
    showExport.value = false;
  } catch(e){ error.value = e.response?.data?.message || 'Could not export.'; }
  finally { exporting.value = false; }
}

// ---- Machine quotation form (existing) ----
const form = reactive({ customer:'', date:today(), machineModel:'', quantity:1, supplierCost:0, freight:0, importation:0, bankCharges:0, delivery:0, installation:0, otherCosts:0, markupPercent:20, vatStatus:'NON_VAT' });
const computed_ = ref(null);
let t;
watch(form, () => { if(formKind.value==='MACHINE'){ clearTimeout(t); t = setTimeout(previewMachine, 250); } }, { deep:true });
async function previewMachine(){ try { const { data } = await api.post('/quotations/preview', { kind:'MACHINE', ...form }); computed_.value = data.computed; } catch {} }

// ---- Product quotation form (bago) ----
const editingId = ref(null);     // kung may laman = nag-e-edit ng DRAFT na quotation
const pform = reactive({ customer:'', date:today(), newCustomer:false, newCustomerName:'', vatStatus:'NON_VAT',
  lines: [ blankLine(), blankLine() ] });
function blankLine(){ return { product:'', description:'', quantity:1, unitPrice:0, source:'WAREHOUSE:' }; }
function addLine(){ pform.lines.push(blankLine()); }
function removeLine(i){ pform.lines.splice(i,1); if(!pform.lines.length) addLine(); }
function onProduct(line){
  const p = products.value.find((x) => x._id === line.product);
  if(p){ line.description = p.name; if(p.sellingPrice) line.unitPrice = p.sellingPrice; }
  fetchBalances(line.product);
}

// Options para sa searchable product/customer dropdowns.
const productOptions = computed(() => products.value.map((p) => ({ value:p._id, label:`${p.sku} · ${p.name}` })));
const customerOptions = computed(() => customers.value.map((c) => ({ value:c._id, label:c.name })));

// Duplicate check para sa inline na "New customer" sa product quotation.
const custMatches = ref([]);
let custTimer;
function checkNewCustomer(){
  clearTimeout(custTimer);
  const name = (pform.newCustomerName || '').trim();
  if(!pform.newCustomer || name.length < 2){ custMatches.value = []; return; }
  custTimer = setTimeout(async () => {
    try { const { data } = await api.get('/customers/check', { params:{ q: name } }); custMatches.value = data.matches || []; }
    catch { custMatches.value = []; }
  }, 300);
}
function useExistingCustomer(m){ pform.customer = m._id; pform.newCustomer = false; pform.newCustomerName = ''; custMatches.value = []; }

// Source location options (Warehouse + bawat machine display + side cabinet) — katulad ng Transfer.
const locOptions = computed(() => {
  const opts = [{ value:'WAREHOUSE:', label:'Warehouse' }];
  for (const m of machines.value) opts.push({ value:`MACHINE_LOADED:${m._id}`, label:(m.locationName||m.machineId) });
  for (const m of machines.value) opts.push({ value:`SIDE_CABINET:${m._id}`, label:'Side Cabinet - '+(m.locationName||m.machineId) });
  return opts;
});

// Real-time na balanse per product (cache) — gamit ang parehong endpoint ng Transfer form.
const balById = reactive({});
async function fetchBalances(product){
  if(!product || balById[product]) return;
  try { const { data } = await api.get('/inventory/location-balances', { params:{ product } });
    const map = {}; for(const b of data.balances) map[`${b.type}:${b.machine||''}`] = b.qty;
    balById[product] = map;
  } catch { balById[product] = {}; }
}
function qtyAt(product, locValue){ return (balById[product]||{})[locValue] || 0; }
function srcBalance(l){ return l.product ? qtyAt(l.product, l.source) : 0; }
function afterBalance(l){ return l.product ? (srcBalance(l) - (Number(l.quantity)||0)) : 0; } // bawas (labas ang stock sa benta)
const productTotals = computed(() => {
  const lines = pform.lines.map((l) => ({ ...l, lineTotal: round((Number(l.quantity)||0) * (Number(l.unitPrice)||0)) }));
  const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vatAmount = pform.vatStatus === 'VAT' ? round(subtotal * 0.12) : 0; // ~12% (server authoritative)
  return { lines, subtotal, vatAmount, total: round(subtotal + vatAmount) };
});

async function load(){
  loading.value=true; error.value='';
  try {
    const [q,c,p,m] = await Promise.all([ api.get('/quotations'), api.get('/customers'), api.get('/products'), api.get('/machines') ]);
    items.value = q.data.quotations; customers.value = c.data.customers; products.value = p.data.products; machines.value = m.data.machines || [];
  } catch(e){ error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value=false; }
}
function resetProductForm(){
  editingId.value = null;
  pform.customer=''; pform.date=today(); pform.newCustomer=false; pform.newCustomerName=''; pform.vatStatus='NON_VAT';
  pform.lines = [ blankLine(), blankLine() ];
}
function openForm(kind){
  formKind.value = kind || 'MACHINE'; showForm.value=true;
  if(kind==='PRODUCT') resetProductForm();
  if(kind==='MACHINE') previewMachine();
  window.scrollTo({ top:0, behavior:'smooth' });
}
// I-edit ang isang DRAFT na product quotation (product + qty).
function editQuote(q){
  selected.value = null;
  formKind.value = 'PRODUCT'; showForm.value = true; editingId.value = q._id;
  pform.customer = q.customer?._id || q.customer || ''; pform.newCustomer=false; pform.newCustomerName='';
  pform.vatStatus = q.vatStatus || 'NON_VAT'; pform.date = isoDay(q.date || q.createdAt);
  pform.lines = (q.items||[]).map((it) => ({ product: it.product?._id || it.product || '', description: it.description||'', quantity: it.quantity||0, unitPrice: it.unitPrice||0, source:'WAREHOUSE:' }));
  if(!pform.lines.length) pform.lines = [ blankLine() ];
  pform.lines.forEach((l) => l.product && fetchBalances(l.product));
  window.scrollTo({ top:0, behavior:'smooth' });
}

async function save(){
  saving.value=true; error.value='';
  try {
    if(formKind.value === 'PRODUCT'){
      let customerId = pform.customer;
      if(pform.newCustomer && pform.newCustomerName.trim()){
        try {
          const { data } = await api.post('/customers', { name: pform.newCustomerName.trim() });
          customerId = data.customer._id;
        } catch(ce){
          if(ce.response?.status === 409){
            custMatches.value = ce.response.data?.matches || [];
            error.value = ce.response.data?.message || 'Existing customer na ang pangalan — piliin sa taas.';
            saving.value=false; return;
          }
          throw ce;
        }
      }
      const lines = pform.lines.filter((l) => l.product || l.description).map((l) => ({ product:l.product||undefined, description:l.description, quantity:Number(l.quantity)||0, unitPrice:Number(l.unitPrice)||0 }));
      if(!lines.length){ error.value='Magdagdag man lang ng isang produkto.'; saving.value=false; return; }
      if(editingId.value){
        await api.patch(`/quotations/${editingId.value}`, { customer: customerId || undefined, date: pform.date, vatStatus: pform.vatStatus, items: lines });
      } else {
        await api.post('/quotations', { kind:'PRODUCT', customer: customerId || undefined, date: pform.date, vatStatus: pform.vatStatus, items: lines });
      }
    } else {
      await api.post('/quotations', { kind:'MACHINE', ...form });
    }
    showForm.value=false; editingId.value=null; await load();
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
    <div v-if="sendMsg" class="alert alert-success py-2">{{ sendMsg }}</div>

    <!-- View quote -->
    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.quotationNumber }}
            <span class="badge7 ms-1" :class="selected.kind==='PRODUCT' ? 'emp' : 'owner'">{{ selected.kind==='PRODUCT' ? 'PRODUCT' : 'MACHINE' }}</span>
            <span class="badge7 ms-1" :class="selected.status==='CONVERTED' ? 'owner' : 'emp'">{{ selected.status }}</span></h5>
          <div class="text-muted small">{{ selected.customer?.name || 'No customer' }}
            <span class="ms-1">· Date: {{ fmtDate(selected.date || selected.createdAt) }}</span>
            <span class="ms-1">· Created: {{ fmtDate(selected.createdAt) }}</span></div>
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
      <p class="section-eyebrow mb-3">{{ editingId ? 'Edit quotation (Draft)' : 'New product quotation' }}</p>
      <div class="row g-2 mb-2">
        <div class="col-12 col-md-4">
          <label class="form-label">Customer</label>
          <SearchableSelect v-if="!pform.newCustomer" v-model="pform.customer" :options="customerOptions" placeholder="— search customer —" size="md" />
          <input v-else v-model="pform.newCustomerName" class="form-control" placeholder="New customer name" @input="checkNewCustomer" />
        </div>
        <div class="col-12 col-md-3 d-flex align-items-end"><div class="form-check">
          <input v-model="pform.newCustomer" class="form-check-input" type="checkbox" id="newc" @change="checkNewCustomer" /><label class="form-check-label ms-1" for="newc">New customer (add to master)</label></div></div>
        <div class="col-6 col-md-3"><label class="form-label">Date <span class="text-muted small">(editable)</span></label>
          <input v-model="pform.date" type="date" class="form-control" /></div>
        <div class="col-6 col-md-2"><label class="form-label">VAT</label>
          <select v-model="pform.vatStatus" class="form-select"><option value="NON_VAT">Non-VAT</option><option value="VAT">VAT</option></select></div>
      </div>

      <!-- Duplicate warning sa inline na new customer -->
      <div v-if="pform.newCustomer && custMatches.length" class="alert alert-warning py-2 mb-2">
        <div class="fw-semibold mb-1">⚠ May existing na pareho/halos-parehong pangalan — piliin na lang:</div>
        <div v-for="m in custMatches" :key="m._id" class="d-flex align-items-center justify-content-between py-1">
          <span>{{ m.name }} <span class="text-muted small">{{ m.customerId }}<span v-if="m.email"> · {{ m.email }}</span></span></span>
          <button class="btn btn-ghost btn-sm" @click="useExistingCustomer(m)">Use this</button>
        </div>
      </div>

      <div class="pq-head d-none d-md-flex">
        <span class="c-prod">Product</span><span class="c-src">Source location</span><span class="c-bal">Src bal</span>
        <span class="c-qty">Qty</span><span class="c-after">After</span><span class="c-up">Unit Price</span><span class="c-lt">Line Total</span><span class="c-x"></span>
      </div>
      <div v-for="(l,i) in pform.lines" :key="i" class="pq-row">
        <span class="c-prod"><SearchableSelect v-model="l.product" :options="productOptions" placeholder="— pick product —" @change="onProduct(l)" /></span>
        <span class="c-src"><select v-model="l.source" class="form-select form-select-sm">
          <option v-for="o in locOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></span>
        <span class="c-bal numeric text-end">{{ l.product ? srcBalance(l) : '—' }}</span>
        <span class="c-qty"><input v-model.number="l.quantity" type="number" class="form-control form-control-sm numeric text-end" /></span>
        <span class="c-after numeric text-end" :class="l.product && afterBalance(l)<0 ? 'text-danger fw-semibold':''">{{ l.product ? afterBalance(l) : '—' }}</span>
        <span class="c-up"><input v-model.number="l.unitPrice" type="number" class="form-control form-control-sm numeric text-end" /></span>
        <span class="c-lt numeric text-end">{{ peso(round((l.quantity||0)*(l.unitPrice||0))) }}</span>
        <span class="c-x"><button class="btn btn-ghost btn-sm" @click="removeLine(i)">×</button></span>
      </div>
      <button class="btn btn-ghost btn-sm mt-1" @click="addLine">+ Add line</button>
      <p v-if="pform.lines.some(l => l.product && afterBalance(l) < 0)" class="text-danger small mt-2 mb-0">
        ⚠ Kulang ang stock sa napiling source location para sa isa o higit pang linya (negatibo ang balance after).
      </p>

      <div class="d-flex justify-content-end align-items-center gap-3 mt-3 flex-wrap">
        <span>Subtotal: <strong class="numeric">{{ peso(productTotals.subtotal) }}</strong></span>
        <span v-if="pform.vatStatus==='VAT'">VAT: <strong class="numeric">{{ peso(productTotals.vatAmount) }}</strong></span>
        <span>Total: <strong class="numeric">{{ peso(productTotals.total) }}</strong></span>
        <button class="btn btn-ghost" @click="showForm=false; editingId=null">Cancel</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Save quotation') }}</button>
      </div>
    </div></div>

    <!-- MACHINE form -->
    <div v-if="showForm && formKind==='MACHINE'" class="row g-3 mb-4">
      <div class="col-12 col-lg-7"><div class="card"><div class="card-body">
        <p class="section-eyebrow mb-3">Machine quotation</p>
        <div class="row g-2">
          <div class="col-12 col-md-4"><label class="form-label">Customer</label>
            <SearchableSelect v-model="form.customer" :options="customerOptions" placeholder="— search customer —" size="md" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Date <span class="text-muted small">(editable)</span></label>
            <input v-model="form.date" type="date" class="form-control" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Machine model</label><input v-model="form.machineModel" class="form-control" /></div>
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
      <button class="btn btn-ghost btn-sm" :disabled="sending===q._id" @click="sendQuote(q)">{{ sending===q._id ? 'Sending…' : 'Send' }}</button>
      <button v-if="q.kind==='PRODUCT' && q.status!=='CONVERTED'" class="btn btn-ghost btn-sm" @click="editQuote(q)">Edit</button>
      <button v-if="q.status!=='CONVERTED'" class="btn btn-primary btn-sm" @click="convert(q)">Convert to order</button>
    </div></div>
    <ExportDialog :visible="showExport" :busy="exporting" title="Export quotation"
      default-orientation="portrait" :allow-excel="false" @confirm="doExport" @close="showExport=false" />
  </div>
</template>

<style scoped>
.pq-head, .pq-row { display:flex; gap:6px; align-items:center; margin-bottom:6px; }
.pq-head { font-size:.7rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.03em; }
.c-prod{ flex:0 0 22%; } .c-src{ flex:0 0 18%; } .c-bal{ flex:0 0 8%; } .c-qty{ flex:0 0 9%; }
.c-after{ flex:0 0 9%; } .c-up{ flex:0 0 12%; } .c-lt{ flex:1 1 auto; } .c-x{ flex:0 0 28px; }
@media (max-width: 767px){ .pq-row{ flex-wrap:wrap; } .c-prod,.c-src,.c-bal,.c-qty,.c-after,.c-up,.c-lt{ flex:1 1 46%; } }
</style>
