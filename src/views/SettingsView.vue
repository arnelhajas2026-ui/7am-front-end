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
  </div>
</template>
