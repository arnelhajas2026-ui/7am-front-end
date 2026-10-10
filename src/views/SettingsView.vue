<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { PRODUCT_REFERENCE } from '../constants/productReference.js';

const cfg = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const saved = ref(false);
const expenseText = ref('');
const currencyText = ref('');
const referenceText = ref('');

// --- Clear test data (danger zone) ---
const clearScope = ref('transactions');
const clearConfirm = ref('');
const clearing = ref(false);
const clearResult = ref(null);

async function clearTestData(){
  if (clearConfirm.value !== 'CLEAR') { error.value = 'I-type ang CLEAR para kumpirmahin.'; return; }
  const label = clearScope.value === 'everything'
    ? 'LAHAT — transactions, master data, AT accounting (GL, Journal Entries, Opening Balances, Fixed Assets). Ire-reset ang period lock'
    : clearScope.value === 'all'
      ? 'transactions AT master data (products, machines, customers, suppliers)'
      : 'lahat ng test transactions';
  if (!confirm(`Clear ${label}? Hindi na ito maibabalik. Ang Users, Settings, Chart of Accounts at Cost Centers ay mananatili.`)) return;
  clearing.value = true; error.value=''; clearResult.value=null;
  try {
    const { data } = await api.post('/admin/clear-test-data', { scope: clearScope.value, confirm: 'CLEAR' });
    clearResult.value = data; clearConfirm.value='';
  } catch(e){ error.value = e.response?.data?.message || 'Could not clear data.'; }
  finally { clearing.value=false; }
}

async function load(){
  loading.value=true; error.value='';
  try {
    const { data } = await api.get('/config');
    cfg.value = data.config;
    expenseText.value = (data.config.expenseCategories||[]).join(', ');
    currencyText.value = (data.config.currencies||[]).join(', ');
    const ref = (data.config.productReference && data.config.productReference.length) ? data.config.productReference : PRODUCT_REFERENCE;
    referenceText.value = ref.join('\n');
  } catch(e){ error.value = e.response?.data?.message || 'Could not load settings.'; }
  finally { loading.value=false; }
}
async function save(){
  saving.value=true; error.value=''; saved.value=false;
  try {
    const payload = {
      ...cfg.value,
      expenseCategories: expenseText.value.split(',').map(s=>s.trim()).filter(Boolean),
      currencies: currencyText.value.split(',').map(s=>s.trim()).filter(Boolean),
      productReference: referenceText.value.split('\n').map(s=>s.trim()).filter(Boolean),
    };
    const { data } = await api.put('/config', payload);
    cfg.value = data.config; saved.value=true;
    setTimeout(()=>saved.value=false, 2500);
  } catch(e){ error.value = e.response?.data?.message || 'Could not save. (Owner only.)'; }
  finally { saving.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Settings</h3>
    <p class="text-muted">Business-wide rules reused across pricing, VAT, and expenses.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="saved" class="alert alert-success py-2">Settings saved.</div>

    <div v-if="cfg" class="card">
      <div class="card-body">
        <p class="section-eyebrow mb-3">Pricing & tax</p>
        <div class="row g-3">
          <div class="col-6 col-md-4"><label class="form-label">VAT rate (%)</label><input v-model.number="cfg.vatRate" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Default markup (%)</label><input v-model.number="cfg.defaultMarkupPercent" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Target margin (%)</label><input v-model.number="cfg.targetMarginPercent" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Delivery charge</label><input v-model.number="cfg.deliveryCharge" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-4"><label class="form-label">Installation charge</label><input v-model.number="cfg.installationCharge" type="number" class="form-control numeric" /></div>
        </div>

        <p class="section-eyebrow mt-4 mb-2">Lists</p>
        <div class="mb-3"><label class="form-label">Expense categories (comma-separated)</label>
          <input v-model="expenseText" class="form-control" /></div>
        <div class="mb-3"><label class="form-label">Currencies (comma-separated)</label>
          <input v-model="currencyText" class="form-control" /></div>
        <div class="mb-3"><label class="form-label">Product name reference (one per line)</label>
          <textarea v-model="referenceText" class="form-control" rows="8" placeholder="One product name per line"></textarea>
          <div class="text-muted small mt-1">Used for autocomplete suggestions on the Products page.</div></div>

        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save settings' }}</button>
      </div>
    </div>

    <!-- Danger zone: clear test data -->
    <div class="card mt-4" style="border-color:#F3C7C7">
      <div class="card-body">
        <p class="section-eyebrow mb-1" style="color:var(--bad)">Danger zone — Clear test data</p>
        <p class="text-muted small mb-3">Burahin ang mga test record para mag-fresh ulit para sa testing. Ang <strong>Users</strong> at <strong>Settings</strong> ay HINDI mabubura. Hindi na ito maibabalik.</p>
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label">Ano ang bubura</label>
            <select v-model="clearScope" class="form-select">
              <option value="transactions">Transactions lang (panatilihin ang products, machines, customers, suppliers)</option>
              <option value="all">Lahat — transactions + master data</option>
              <option value="everything">Everything incl. accounting — + GL, Journal Entries, Opening Balances, Fixed Assets (fully fresh)</option>
            </select>
            <p v-if="clearScope==='everything'" class="text-muted small mt-1 mb-0">
              ⚠ Buburahin din ang buong General Ledger, lahat ng Journal Entries, Opening Balances, at Fixed Assets, at ire-reset ang period lock. Mananatili ang Chart of Accounts + Cost Centers (seeded), Users, at Settings.
            </p>
          </div>
          <div class="col-8 col-md-4"><label class="form-label">I-type ang CLEAR</label><input v-model="clearConfirm" class="form-control" placeholder="CLEAR" /></div>
          <div class="col-4 col-md-2"><button class="btn btn-danger7 w-100" :disabled="clearing || clearConfirm!=='CLEAR'" @click="clearTestData">{{ clearing ? 'Clearing…' : 'Clear' }}</button></div>
        </div>
        <div v-if="clearResult" class="alert alert-success py-2 mt-3 mb-0">
          Na-clear ang {{ clearResult.total }} record(s). Fresh na para sa testing.
          <span class="d-block small text-muted">{{ Object.entries(clearResult.cleared).filter(([,n])=>n>0).map(([k,n])=>k+': '+n).join(' · ') || 'Walang records na binura.' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
