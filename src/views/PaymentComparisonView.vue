<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDateTime } from '../utils/datetime.js';

const DEFAULT_METHODS = [
  { name: 'Alibaba - T/T (Bank)', percentFee: 0, fixedFee: 0 },
  { name: 'Alibaba - PayPal', percentFee: 4.4, fixedFee: 0 },
  { name: 'Alibaba - Credit Card', percentFee: 3, fixedFee: 0 },
  { name: 'Local Bank T/T', percentFee: 0, fixedFee: 0 },
];
const CURRENCIES = ['USD', 'CNY', 'EUR', 'JPY', 'HKD', 'SGD', 'KRW', 'THB', 'MYR', 'AUD', 'GBP', 'PHP'];

const suppliers = ref([]);
const history = ref([]);
const error = ref('');
const saving = ref(false);

const title = ref('');
const supplier = ref('');
const options = ref([]);

function blankRow(m = {}) {
  return { method: m.name || '', amount: 0, currency: 'USD', fxRate: 0,
           percentFee: m.percentFee || 0, fixedFee: m.fixedFee || 0, otherCharges: 0,
           fxSource: '', fxLoading: false };
}
function addRow() { options.value.push(blankRow()); }
function removeRow(i) { options.value.splice(i, 1); }

async function getRate(o) {
  o.fxLoading = true; error.value = '';
  try {
    const { data } = await api.get('/fx', { params: { from: o.currency, to: 'PHP' } });
    o.fxRate = data.rate; o.fxSource = data.source;
  } catch (e) { error.value = e.response?.data?.message || 'Could not fetch FX rate.'; }
  finally { o.fxLoading = false; }
}
async function getAllRates() { for (const o of options.value) if (o.currency && o.currency !== 'PHP') await getRate(o); }

function phpOf(o) {
  const base = Number(o.amount || 0) * Number(o.fxRate || 0);
  return base + base * (Number(o.percentFee || 0) / 100) + Number(o.fixedFee || 0) + Number(o.otherCharges || 0);
}
const computed_ = computed(() => {
  const rows = options.value.map((o) => ({ ...o, php: phpOf(o) }));
  const valid = rows.filter((r) => r.php > 0).map((r) => r.php);
  const lowest = valid.length ? Math.min(...valid) : 0;
  const highest = valid.length ? Math.max(...valid) : 0;
  return { rows, lowest, highest, savings: highest - lowest };
});
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

async function load() {
  try {
    const [su, cfg, hi] = await Promise.all([ api.get('/suppliers'), api.get('/config'), api.get('/payment-comparisons') ]);
    suppliers.value = su.data.suppliers;
    history.value = hi.data.comparisons;
    const methods = (cfg.data.config?.paymentMethods?.length ? cfg.data.config.paymentMethods : DEFAULT_METHODS);
    options.value = methods.map((m) => blankRow(m));
  } catch (e) { error.value = e.response?.data?.message || 'Could not load.'; }
}
async function save() {
  if (saving.value) return;          // iwas double-submit (double-click)
  saving.value = true; error.value = '';
  try {
    const clean = options.value.map(({ fxSource, fxLoading, ...rest }) => rest);
    await api.post('/payment-comparisons', { title: title.value, supplier: supplier.value || undefined, options: clean });
    title.value = ''; await load();
  } catch (e) { error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Payment Compare</h3>
    <p class="text-muted">Compare payment methods and see which costs the least in pesos. FX rate can be fetched live or typed.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <div class="card mb-4"><div class="card-body">
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-6"><label class="form-label">Title / reference</label><input v-model="title" class="form-control" placeholder="e.g. Machine #3 procurement" /></div>
        <div class="col-12 col-md-6"><label class="form-label">Supplier (optional)</label>
          <select v-model="supplier" class="form-select"><option value="">—</option>
            <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option></select></div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-1">
        <p class="section-eyebrow mb-0">Payment options</p>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="getAllRates">↻ Get all rates</button>
          <button class="btn btn-ghost btn-sm" @click="addRow">+ Add option</button>
        </div>
      </div>

      <div class="row g-1 mb-1 d-none d-lg-flex">
        <div class="col-lg-2"><span class="form-label mb-0">Method</span></div>
        <div class="col-lg-1"><span class="form-label mb-0">Amount</span></div>
        <div class="col-lg-1"><span class="form-label mb-0">Currency</span></div>
        <div class="col-lg-3"><span class="form-label mb-0">FX rate (₱/unit)</span></div>
        <div class="col-lg-1"><span class="form-label mb-0">Fee %</span></div>
        <div class="col-lg-1"><span class="form-label mb-0">Fixed</span></div>
        <div class="col-lg-1"><span class="form-label mb-0">Other</span></div>
        <div class="col-lg-2 text-end"><span class="form-label mb-0">PHP equivalent</span></div>
      </div>

      <div v-for="(o,i) in options" :key="i" class="row g-1 mb-2 align-items-center pay-row"
           :class="{ best: computed_.rows[i]?.php===computed_.lowest && computed_.lowest>0 }">
        <div class="col-8 col-lg-2"><input v-model="o.method" class="form-control form-control-sm" placeholder="Method" /></div>
        <div class="col-4 col-lg-1"><input v-model.number="o.amount" type="number" class="form-control form-control-sm numeric" placeholder="Amount" /></div>
        <div class="col-4 col-lg-1">
          <select v-model="o.currency" class="form-select form-select-sm">
            <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="col-8 col-lg-3">
          <div class="input-group input-group-sm">
            <input v-model.number="o.fxRate" type="number" class="form-control form-control-sm numeric" placeholder="FX rate" />
            <button class="btn btn-ink" :disabled="o.fxLoading || o.currency==='PHP'" @click="getRate(o)">{{ o.fxLoading ? '…' : 'Get' }}</button>
          </div>
          <div v-if="o.fxSource" class="text-muted" style="font-size:.66rem">{{ o.fxSource }}</div>
        </div>
        <div class="col-3 col-lg-1"><input v-model.number="o.percentFee" type="number" class="form-control form-control-sm numeric" placeholder="%" /></div>
        <div class="col-2 col-lg-1"><input v-model.number="o.fixedFee" type="number" class="form-control form-control-sm numeric" placeholder="Fixed" /></div>
        <div class="col-2 col-lg-1"><input v-model.number="o.otherCharges" type="number" class="form-control form-control-sm numeric" placeholder="Other" /></div>
        <div class="col-8 col-lg-2 text-lg-end numeric fw-bold">
          {{ peso(computed_.rows[i]?.php) }}
          <span v-if="computed_.rows[i]?.php===computed_.lowest && computed_.lowest>0" class="pill ok ms-1">Best</span>
        </div>
        <div class="col-1"><button class="btn btn-ghost btn-sm" @click="removeRow(i)">×</button></div>
      </div>

      <div class="d-flex justify-content-between align-items-center mt-3">
        <span v-if="computed_.savings>0" class="fw-semibold">Potential savings: <span style="color:var(--good)">{{ peso(computed_.savings) }}</span></span>
        <button class="btn btn-primary ms-auto" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save comparison' }}</button>
      </div>
    </div></div>

    <p class="section-eyebrow">History</p>
    <div v-if="!history.length" class="text-muted">No saved comparisons yet.</div>
    <div v-for="h in history" :key="h._id" class="card mb-2"><div class="card-body py-2">
      <div class="d-flex justify-content-between align-items-center">
        <div><div class="fw-semibold">{{ h.title || 'Comparison' }}</div>
          <div class="text-muted small">{{ fmtDateTime(h.createdAt) }} · Best: {{ h.recommended }}</div></div>
        <div class="text-end"><div class="numeric fw-bold">{{ peso(h.lowest) }}</div>
          <div class="small" style="color:var(--good)">save {{ peso(h.savings) }}</div></div>
      </div>
    </div></div>
  </div>
</template>
