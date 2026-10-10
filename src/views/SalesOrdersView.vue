<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import InvoiceDocument from '../components/InvoiceDocument.vue';
import { fmtDate } from '../utils/datetime.js';

const orders = ref([]);
const suppliers = ref([]);
const loading = ref(false);
const error = ref('');

const selected = ref(null);
const payments = ref([]);
const pay = ref({ amount:0, type:'DOWN', reference:'' });

// supplier side
const supplierPayments = ref([]);
const supplierSummary = ref({ due:0, paid:0, balance:0 });
const spay = ref({ amount:0, currency:'PHP', fxRate:1, method:'', reference:'', supplier:'' });

const busy = ref(false);

const showDoc = ref(false);
const docData = ref(null);
function printInvoice(){
  const o = selected.value;
  const items = (o.kind === 'PRODUCT' && o.items?.length)
    ? o.items.map((it) => ({ description: it.description || it.product?.name || 'Item', qty: it.quantity, unitPrice: it.unitPrice, amount: it.lineTotal }))
    : [{ description: o.machineModel || 'Vending machine', qty: o.quantity, unitPrice: o.quantity ? o.totalAmount / o.quantity : o.totalAmount, amount: o.totalAmount }];
  docData.value = {
    title: 'SALES INVOICE', docNo: o.invoiceNumber || o.orderNumber, date: fmtDate(Date.now()),
    customerName: o.customer?.name || '', items,
    totalSales: o.totalAmount, discount: 0, withholding: 0, totalDue: o.totalAmount,
  };
  showDoc.value = true;
}

async function load(){
  loading.value=true; error.value='';
  try { const { data } = await api.get('/sales-orders'); orders.value = data.orders; }
  catch(e){ error.value = e.response?.data?.message || 'Could not load orders.'; }
  finally { loading.value=false; }
}
async function open(o){
  error.value='';
  try {
    const { data } = await api.get(`/sales-orders/${o._id}`);
    selected.value = data.order; payments.value = data.payments;
    supplierPayments.value = data.supplierPayments || [];
    supplierSummary.value = data.supplier || { due:0, paid:0, balance:0 };
    pay.value = { amount: data.order.amountPaid ? data.order.balance : Math.round(data.order.totalAmount*0.5), type: data.order.amountPaid ? 'FULL' : 'DOWN', reference:'' };
    spay.value = { amount: supplierSummary.value.balance || 0, currency:'PHP', fxRate:1, method:'', reference:'', supplier:'' };
  } catch(e){ error.value = e.response?.data?.message || 'Could not open order.'; }
}
function close(){ selected.value=null; }

async function recordPayment(){
  busy.value=true; error.value='';
  try {
    const { data } = await api.post(`/sales-orders/${selected.value._id}/payments`, pay.value);
    selected.value = data.order;
    const r = await api.get(`/sales-orders/${selected.value._id}`); payments.value = r.data.payments;
    pay.value = { amount: data.order.balance, type:'FULL', reference:'' };
    await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not record payment.'; }
  finally { busy.value=false; }
}
async function recordSupplierPayment(){
  busy.value=true; error.value='';
  try {
    const { data } = await api.post(`/sales-orders/${selected.value._id}/supplier-payments`, spay.value);
    supplierPayments.value = data.supplierPayments; supplierSummary.value = data.supplier;
    spay.value = { amount: data.supplier.balance || 0, currency:'PHP', fxRate:1, method:'', reference:'', supplier:'' };
  } catch(e){ error.value = e.response?.data?.message || 'Could not record supplier payment.'; }
  finally { busy.value=false; }
}
async function invoice(){
  busy.value=true; error.value='';
  try { const { data } = await api.post(`/sales-orders/${selected.value._id}/invoice`); selected.value = data.order; await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not generate invoice.'; }
  finally { busy.value=false; }
}

const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
const dt = fmtDate;
const statusClass = (s)=> s==='COMPLETED'?'ok': s==='FULLY_PAID'?'ok': s==='PARTIALLY_PAID'?'warn':'';

onMounted(async ()=>{ await load(); try { const { data } = await api.get('/suppliers'); suppliers.value = data.suppliers; } catch {} });
</script>

<template>
  <div>
    <h3 class="mb-1">Sales Orders</h3>
    <p class="text-muted">Collect the down payment, pay the supplier, settle the balance, then invoice.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.orderNumber }}
            <span class="badge7 ms-1" :class="selected.kind==='PRODUCT' ? 'emp' : 'owner'">{{ selected.kind==='PRODUCT' ? 'PRODUCT' : 'MACHINE' }}</span></h5>
          <div class="text-muted small">{{ selected.customer?.name }} ·
            <template v-if="selected.kind==='PRODUCT'">Product order · {{ selected.items?.length || 0 }} item/s</template>
            <template v-else>{{ selected.machineModel }} · {{ selected.quantity }} unit/s</template>
          </div>
        </div>
        <div class="d-flex gap-2"><button class="btn btn-ghost btn-sm" @click="printInvoice">Print invoice</button>
        <button class="btn btn-ghost btn-sm" @click="close">Close</button></div>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-4"><div class="tile sm"><div class="tlabel">Total</div><div class="tval">{{ peso(selected.totalAmount) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Paid</div><div class="tval">{{ peso(selected.amountPaid) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Balance</div><div class="tval" :class="selected.balance>0 && 'warn'">{{ peso(selected.balance) }}</div></div></div>
      </div>

      <div class="mb-3"><span class="pill" :class="statusClass(selected.status)">{{ selected.status }}</span>
        <span v-if="selected.invoiceNumber" class="pill ok ms-1">{{ selected.invoiceNumber }}</span></div>

      <!-- Product line items -->
      <div v-if="selected.kind==='PRODUCT' && selected.items?.length" class="card mb-3"><div class="card-body p-0" style="overflow-x:auto">
        <table class="fin-table ruled" style="min-width:520px">
          <thead><tr><th class="lbl">Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
          <tbody>
            <tr v-for="(it,i) in selected.items" :key="i">
              <td class="lbl">{{ it.description || it.product?.name || 'Item' }}</td>
              <td class="num">{{ it.quantity }}</td>
              <td class="num">{{ peso(it.unitPrice) }}</td>
              <td class="num fw-semibold">{{ peso(it.lineTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div></div>

      <!-- Customer payment -->
      <template v-if="selected.balance>0">
        <p class="section-eyebrow mb-2">Record customer payment</p>
        <div class="row g-2 align-items-end">
          <div class="col-4"><label class="form-label">Amount</label><input v-model.number="pay.amount" type="number" class="form-control numeric" /></div>
          <div class="col-4"><label class="form-label">Type</label>
            <select v-model="pay.type" class="form-select"><option value="DOWN">Down</option><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></div>
          <div class="col-4"><button class="btn btn-primary w-100" :disabled="busy" @click="recordPayment">Record</button></div>
        </div>
      </template>
      <template v-else>
        <div class="alert alert-success py-2">Fully paid by customer.
          <button v-if="!selected.invoiceNumber" class="btn btn-primary btn-sm ms-2" :disabled="busy" @click="invoice">Generate invoice</button>
        </div>
      </template>

      <p class="section-eyebrow mt-3 mb-2">Customer payment history</p>
      <div v-if="!payments.length" class="text-muted small">No payments yet.</div>
      <div v-for="p in payments" :key="p._id" class="is-row"><span>{{ dt(p.date) }} · {{ p.type }} <span class="text-muted small">{{ p.reference }}</span></span><span class="numeric">{{ peso(p.amount) }}</span></div>

      <!-- ===== Supplier payments (machine procurement lang) ===== -->
      <template v-if="selected.kind!=='PRODUCT'">
      <hr class="my-3" />
      <p class="section-eyebrow mb-2">Supplier (machine procurement)</p>
      <div class="row g-2 mb-3">
        <div class="col-4"><div class="tile sm"><div class="tlabel">Supplier cost</div><div class="tval">{{ peso(supplierSummary.due) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Paid</div><div class="tval">{{ peso(supplierSummary.paid) }}</div></div></div>
        <div class="col-4"><div class="tile sm"><div class="tlabel">Balance</div><div class="tval" :class="supplierSummary.balance>0 && 'warn'">{{ peso(supplierSummary.balance) }}</div></div></div>
      </div>

      <div class="row g-2 align-items-end mb-2">
        <div class="col-6 col-md-3"><label class="form-label">Amount</label><input v-model.number="spay.amount" type="number" class="form-control form-control-sm numeric" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Currency</label><input v-model="spay.currency" class="form-control form-control-sm" placeholder="PHP/USD" /></div>
        <div class="col-6 col-md-2"><label class="form-label">FX rate</label><input v-model.number="spay.fxRate" type="number" class="form-control form-control-sm numeric" /></div>
        <div class="col-6 col-md-2"><label class="form-label">Method</label><input v-model="spay.method" class="form-control form-control-sm" placeholder="T/T" /></div>
        <div class="col-8 col-md-2"><label class="form-label">Supplier</label>
          <select v-model="spay.supplier" class="form-select form-select-sm"><option value="">—</option>
            <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option></select></div>
        <div class="col-4 col-md-1"><button class="btn btn-primary btn-sm w-100" :disabled="busy" @click="recordSupplierPayment">Pay</button></div>
      </div>
      <div class="text-muted small mb-2">PHP equivalent: {{ peso((spay.amount||0)*(spay.fxRate||1)) }}</div>

      <div v-if="!supplierPayments.length" class="text-muted small">No supplier payments yet.</div>
      <div v-for="p in supplierPayments" :key="p._id" class="is-row">
        <span>{{ dt(p.date) }} · {{ p.method || '—' }} <span class="text-muted small">{{ p.supplier?.name }} {{ p.reference }}</span></span>
        <span class="numeric">{{ peso(p.phpAmount) }}<span v-if="p.currency!=='PHP'" class="text-muted small"> ({{ p.amount }} {{ p.currency }})</span></span>
      </div>
      </template>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!orders.length" class="card"><div class="card-body text-muted text-center py-4">No orders yet. Convert a quotation first.</div></div>
    <div v-for="o in orders" :key="o._id" class="card mb-2" style="cursor:pointer" @click="open(o)"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold" style="font-family:var(--font-display)">{{ o.orderNumber }}
          <span class="badge7 ms-1" :class="o.kind==='PRODUCT' ? 'emp' : 'owner'">{{ o.kind==='PRODUCT' ? 'PRODUCT' : 'MACHINE' }}</span>
          <span class="text-muted small ms-1">{{ o.customer?.name }}</span></div>
        <div class="text-muted small">{{ o.kind==='PRODUCT' ? 'Product order' : o.machineModel }} · Balance {{ peso(o.balance) }}</div>
      </div>
      <span class="pill" :class="statusClass(o.status)">{{ o.status }}</span>
    </div></div>

    <InvoiceDocument v-if="showDoc" :doc="docData" @close="showDoc=false" />
  </div>
</template>
