<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const CONTROL = [1100, 1050, 2010]; // control accounts — galing sa sections, hindi GL lines

const accounts = ref([]);
const suppliers = ref([]);
const customers = ref([]);
const products = ref([]);
const opening = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');

const asOfDate = ref('2026-01-01');
const memo = ref('');
const glLines = ref([]);
const ap = ref([]);
const ar = ref([]);
const inventory = ref([]);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const locked = computed(() => opening.value?.status === 'APPROVED');
const postable = computed(() => accounts.value.filter((a) => !a.isHeader && !CONTROL.includes(Number(a.code))));

const invValue = computed(() => r2(inventory.value.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unitCost || 0), 0)));
const apTotal = computed(() => r2(ap.value.reduce((s, l) => s + Number(l.amount || 0), 0)));
const arTotal = computed(() => r2(ar.value.reduce((s, l) => s + Number(l.amount || 0), 0)));
const glDebit = computed(() => r2(glLines.value.reduce((s, l) => s + Number(l.debit || 0), 0)));
const glCredit = computed(() => r2(glLines.value.reduce((s, l) => s + Number(l.credit || 0), 0)));
const totalDebit = computed(() => r2(glDebit.value + invValue.value + arTotal.value));
const totalCredit = computed(() => r2(glCredit.value + apTotal.value));
const difference = computed(() => r2(totalDebit.value - totalCredit.value));
const balanced = computed(() => difference.value === 0 && totalDebit.value > 0);

function glBlank() { return { accountCode: '', costCenter: '', debit: 0, credit: 0 }; }
function addGl() { glLines.value.push(glBlank()); }
function addAp() { ap.value.push({ supplier: '', name: '', amount: 0 }); }
function addAr() { ar.value.push({ customer: '', name: '', amount: 0 }); }
function addInv() { inventory.value.push({ product: '', name: '', qty: 0, unitCost: 0 }); }

async function load() {
  loading.value = true; error.value = '';
  try {
    const [ob, ac, su, cu, pr] = await Promise.all([
      api.get('/opening-balances'), api.get('/accounts-coa'), api.get('/suppliers'), api.get('/customers'), api.get('/products'),
    ]);
    accounts.value = ac.data.accounts; suppliers.value = su.data.suppliers; customers.value = cu.data.customers; products.value = pr.data.products;
    const o = ob.data.opening;
    if (o) {
      opening.value = o;
      asOfDate.value = o.asOfDate ? new Date(o.asOfDate).toLocaleDateString('en-CA') : '2026-01-01';
      memo.value = o.memo || '';
      glLines.value = (o.glLines || []).map((l) => ({ accountCode: l.accountCode, costCenter: l.costCenter, debit: l.debit, credit: l.credit }));
      ap.value = (o.ap || []).map((l) => ({ supplier: l.supplier, name: l.name, amount: l.amount }));
      ar.value = (o.ar || []).map((l) => ({ customer: l.customer, name: l.name, amount: l.amount }));
      inventory.value = (o.inventory || []).map((l) => ({ product: l.product, name: l.name, qty: l.qty, unitCost: l.unitCost }));
    }
    if (!glLines.value.length) addGl();
  } catch (e) { error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value = false; }
}

function payload() {
  return {
    asOfDate: asOfDate.value, memo: memo.value,
    glLines: glLines.value.filter((l) => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0)),
    ap: ap.value.filter((l) => l.supplier && Number(l.amount) > 0),
    ar: ar.value.filter((l) => l.customer && Number(l.amount) > 0),
    inventory: inventory.value.filter((l) => l.product && Number(l.qty) > 0),
  };
}

async function save() {
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const { data } = await api.put('/opening-balances', payload());
    opening.value = data.opening; notice.value = 'Na-save ang draft.';
  } catch (e) { error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value = false; }
}

async function approve() {
  if (!balanced.value) { error.value = 'Hindi balanse — ayusin muna bago i-approve.'; return; }
  if (!confirm('I-approve at i-lock ang opening balances? Magpo-post ng opening journal entry at hindi na ito mababago maliban kung i-reopen.')) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    await api.put('/opening-balances', payload());           // save latest muna
    const { data } = await api.post('/opening-balances/approve');
    opening.value = data.opening; notice.value = `Approved! Opening JE: ${data.opening.journalRef}`;
  } catch (e) { error.value = e.response?.data?.message || 'Could not approve.'; }
  finally { saving.value = false; }
}

async function reopen() {
  if (!confirm('I-reopen ang opening balances? Ivo-void ang opening JE at aalisin ang opening inventory layers. Siguraduhing walang transaksyong nakasandal dito.')) return;
  saving.value = true; error.value = ''; notice.value = '';
  try {
    const { data } = await api.post('/opening-balances/reopen', { reason: 'Owner reopened' });
    opening.value = data.opening; notice.value = 'Na-reopen — draft na ulit.';
  } catch (e) { error.value = e.response?.data?.message || 'Could not reopen.'; }
  finally { saving.value = false; }
}

function onSupplier(l) { const s = suppliers.value.find((x) => x._id === l.supplier); if (s) l.name = s.name; }
function onCustomer(l) { const c = customers.value.find((x) => x._id === l.customer); if (c) l.name = c.name; }
function onProduct(l) { const p = products.value.find((x) => x._id === l.product); if (p) { l.name = p.name; if (!l.unitCost) l.unitCost = p.purchaseCost || 0; } }

onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Opening Balances</h3>
    <p class="text-muted">Starting point ng libro (hal. as of Jan 1, 2026). Kapag na-approve ng owner, magpo-post ng iisang opening journal entry at <strong>maka-lock</strong> na.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <div v-if="locked" class="alert alert-warning py-2 d-flex align-items-center justify-content-between">
      <span>🔒 <strong>Locked</strong> — approved as of {{ asOfDate }} · Opening JE: {{ opening?.journalRef }}</span>
      <button v-if="auth.isOwner || auth.isSuperadmin" class="btn btn-ghost btn-sm" :disabled="saving" @click="reopen">Reopen (owner)</button>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <template v-else>
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3"><label class="form-label">As of date</label><input v-model="asOfDate" type="date" class="form-control" :disabled="locked" /></div>
        <div class="col-12 col-md-6"><label class="form-label">Memo</label><input v-model="memo" class="form-control" :disabled="locked" placeholder="Opening balances cut-over" /></div>
      </div>

      <!-- GL lines -->
      <p class="section-eyebrow">General ledger balances <span class="text-muted">(maliban sa Inventory/AR/AP — nasa baba yun)</span></p>
      <div class="card mb-3"><div class="card-body p-2" style="overflow-x:auto">
        <table class="fin-table" style="min-width:620px"><thead><tr><th class="lbl">Account</th><th class="lbl">Cost Ctr</th><th>Debit</th><th>Credit</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in glLines" :key="i">
              <td><select v-model.number="l.accountCode" class="form-select form-select-sm" :disabled="locked" style="min-width:220px">
                <option value="">— account —</option>
                <option v-for="a in postable" :key="a.code" :value="a.code">{{ a.code }} · {{ a.name }}</option></select></td>
              <td><input v-model="l.costCenter" class="form-control form-control-sm" :disabled="locked" placeholder="CC-001" style="width:90px" /></td>
              <td><input v-model.number="l.debit" type="number" class="form-control form-control-sm text-end" :disabled="locked" style="width:120px" /></td>
              <td><input v-model.number="l.credit" type="number" class="form-control form-control-sm text-end" :disabled="locked" style="width:120px" /></td>
              <td><button v-if="!locked" class="btn btn-ghost btn-sm py-0" @click="glLines.splice(i,1)">×</button></td>
            </tr>
          </tbody>
        </table>
        <button v-if="!locked" class="btn btn-ghost btn-sm mt-1" @click="addGl">+ Add line</button>
      </div></div>

      <!-- Inventory -->
      <p class="section-eyebrow">Opening inventory <span class="text-muted">(per product — FIFO layers)</span></p>
      <div class="card mb-3"><div class="card-body p-2" style="overflow-x:auto">
        <table class="fin-table" style="min-width:620px"><thead><tr><th class="lbl">Product</th><th>Qty</th><th>Unit Cost</th><th>Value</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in inventory" :key="i">
              <td><select v-model="l.product" class="form-select form-select-sm" :disabled="locked" @change="onProduct(l)" style="min-width:220px">
                <option value="">— product —</option>
                <option v-for="p in products" :key="p._id" :value="p._id">{{ p.name }}</option></select></td>
              <td><input v-model.number="l.qty" type="number" class="form-control form-control-sm text-end" :disabled="locked" style="width:90px" /></td>
              <td><input v-model.number="l.unitCost" type="number" class="form-control form-control-sm text-end" :disabled="locked" style="width:110px" /></td>
              <td class="num">{{ peso((l.qty||0)*(l.unitCost||0)) }}</td>
              <td><button v-if="!locked" class="btn btn-ghost btn-sm py-0" @click="inventory.splice(i,1)">×</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="gp"><td class="lbl" colspan="3">Inventory total (→ 1100)</td><td class="num fw-bold">{{ peso(invValue) }}</td><td></td></tr></tfoot>
        </table>
        <button v-if="!locked" class="btn btn-ghost btn-sm mt-1" @click="addInv">+ Add product</button>
      </div></div>

      <!-- AR -->
      <p class="section-eyebrow">Opening receivables <span class="text-muted">(per customer → 1050)</span></p>
      <div class="card mb-3"><div class="card-body p-2" style="overflow-x:auto">
        <table class="fin-table" style="min-width:520px"><thead><tr><th class="lbl">Customer</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in ar" :key="i">
              <td><select v-model="l.customer" class="form-select form-select-sm" :disabled="locked" @change="onCustomer(l)" style="min-width:240px">
                <option value="">— customer —</option>
                <option v-for="c in customers" :key="c._id" :value="c._id">{{ c.name }}</option></select></td>
              <td><input v-model.number="l.amount" type="number" class="form-control form-control-sm text-end" :disabled="locked" style="width:130px" /></td>
              <td><button v-if="!locked" class="btn btn-ghost btn-sm py-0" @click="ar.splice(i,1)">×</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="gp"><td class="lbl">Receivables total (→ 1050)</td><td class="num fw-bold">{{ peso(arTotal) }}</td><td></td></tr></tfoot>
        </table>
        <button v-if="!locked" class="btn btn-ghost btn-sm mt-1" @click="addAr">+ Add customer</button>
      </div></div>

      <!-- AP -->
      <p class="section-eyebrow">Opening payables <span class="text-muted">(per supplier → 2010)</span></p>
      <div class="card mb-3"><div class="card-body p-2" style="overflow-x:auto">
        <table class="fin-table" style="min-width:520px"><thead><tr><th class="lbl">Supplier</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(l,i) in ap" :key="i">
              <td><select v-model="l.supplier" class="form-select form-select-sm" :disabled="locked" @change="onSupplier(l)" style="min-width:240px">
                <option value="">— supplier —</option>
                <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option></select></td>
              <td><input v-model.number="l.amount" type="number" class="form-control form-control-sm text-end" :disabled="locked" style="width:130px" /></td>
              <td><button v-if="!locked" class="btn btn-ghost btn-sm py-0" @click="ap.splice(i,1)">×</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="gp"><td class="lbl">Payables total (→ 2010)</td><td class="num fw-bold">{{ peso(apTotal) }}</td><td></td></tr></tfoot>
        </table>
        <button v-if="!locked" class="btn btn-ghost btn-sm mt-1" @click="addAp">+ Add supplier</button>
      </div></div>

      <!-- Totals + actions -->
      <div class="card"><div class="card-body d-flex flex-wrap align-items-center gap-3">
        <span>Total Debit: <strong class="numeric">{{ peso(totalDebit) }}</strong></span>
        <span>Total Credit: <strong class="numeric">{{ peso(totalCredit) }}</strong></span>
        <span class="pill" :class="balanced ? 'ok' : 'warn'">{{ balanced ? 'Balanced' : ('Off by ' + peso(Math.abs(difference))) }}</span>
        <div class="ms-auto d-flex gap-2">
          <button v-if="!locked" class="btn btn-ghost" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save draft' }}</button>
          <button v-if="!locked && (auth.isOwner || auth.isSuperadmin)" class="btn btn-primary" :disabled="saving || !balanced" @click="approve">Approve &amp; lock</button>
        </div>
      </div></div>
    </template>
  </div>
</template>

<style scoped>
.pill { font-size:.75rem; font-weight:700; padding:.2rem .6rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); } .pill.warn { background:#FDECEC; color:var(--bad); }
</style>
