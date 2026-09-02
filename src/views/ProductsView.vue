<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { PRODUCT_REFERENCE } from '../constants/productReference.js';
import { matchNames } from '../utils/match.js';

const items = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);
const vatRate = ref(12);
const configReference = ref([]);
const importing = ref(false);
const importResult = ref(null);
const search = ref('');
const visibleItems = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value
    .filter((it) => !q || (it.name||'').toLowerCase().includes(q) || (it.sku||'').toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (a.name||'').localeCompare(b.name||''));
});

const blank = () => ({
  id:null, sku:'', name:'', brand:'', category:'',
  purchaseCost:0, markupPercent:20, sellingPrice:0, vatStatus:'NON_VAT',
  reorderLevel:0, aliasText:'',
});
const form = ref(blank());

// Autocomplete suggestions para sa product name (iwas misspelling/mismatch)
const showNameSuggest = ref(false);
// Pinagsama: reference list + mga pangalang naka-record na sa database (deduped).
const referenceNames = computed(() => {
  const map = new Map();
  const base = configReference.value.length ? configReference.value : PRODUCT_REFERENCE;
  for (const n of base) map.set(n.toLowerCase(), n);
  for (const it of items.value) if (it.name) map.set(it.name.toLowerCase(), it.name);
  return [...map.values()];
});
const nameSuggestions = computed(() => matchNames(form.value.name, referenceNames.value, 5));
const nameInReference = computed(() =>
  referenceNames.value.some((n) => n.toLowerCase() === form.value.name.trim().toLowerCase()));
function pickName(n){ form.value.name = n; showNameSuggest.value = false; }

// Live preview ng presyo habang nagta-type
const suggested = computed(() => {
  const c = Number(form.value.purchaseCost)||0, m = Number(form.value.markupPercent)||0;
  return Math.round(c * (1 + m/100) * 100) / 100;
});
const vatAmount = computed(() => {
  if(form.value.vatStatus!=='VAT') return 0;
  const base = Number(form.value.sellingPrice)|| suggested.value;
  return Math.round(base * (vatRate.value/100) * 100)/100;
});

function reset(){ form.value = blank(); showForm.value=false; }

async function load(){
  loading.value=true; error.value='';
  try {
    const [{ data:p }, cfg] = await Promise.all([ api.get('/products'), api.get('/config') ]);
    items.value = p.products;
    vatRate.value = cfg.data.config?.vatRate ?? 12;
    configReference.value = cfg.data.config?.productReference || [];
    form.value.markupPercent = cfg.data.config?.defaultMarkupPercent ?? 20;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load products.'; }
  finally { loading.value=false; }
}

async function save(){
  if(!form.value.sku || !form.value.name){ error.value='SKU and Name are required.'; return; }
  saving.value=true; error.value='';
  const payload = {
    ...form.value,
    sellingPrice: Number(form.value.sellingPrice) || suggested.value,
    aliases: form.value.aliasText.split(',').map(s=>s.trim()).filter(Boolean),
  };
  try {
    if(form.value.id) await api.put(`/products/${form.value.id}`, payload);
    else await api.post('/products', payload);
    reset(); await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
function edit(row){
  form.value = {
    id:row._id, sku:row.sku, name:row.name, brand:row.brand, category:row.category,
    purchaseCost:row.purchaseCost, markupPercent:row.markupPercent, sellingPrice:row.sellingPrice,
    vatStatus:row.vatStatus, reorderLevel:row.reorderLevel, aliasText:(row.aliases||[]).join(', '),
  };
  showForm.value=true;
  window.scrollTo({ top: 0, behavior: 'smooth' }); // dalhin sa edit form sa taas
}
async function toggle(row){
  try { const { data } = await api.put(`/products/${row._id}`, { active: !row.active });
    const i=items.value.findIndex(x=>x._id===row._id); if(i!==-1) items.value[i]=data.product;
  } catch(e){ error.value = e.response?.data?.message || 'Could not update.'; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});
async function importFile(e){
  const file = e.target.files[0]; if(!file) return;
  importing.value=true; importResult.value=null; error.value='';
  try {
    const fd = new FormData(); fd.append('file', file);
    const { data } = await api.post('/products/import', fd);
    importResult.value = data; await load();
  } catch(err){ error.value = err.response?.data?.message || 'Import failed.'; }
  finally { importing.value=false; e.target.value=''; }
}
onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Products</h3>
      <div class="d-flex gap-2">
        <label class="btn btn-ghost btn-sm mb-0" style="cursor:pointer">
          {{ importing ? 'Importing…' : 'Import' }}
          <input type="file" accept=".xlsx,.xls,.csv" hidden @change="importFile" />
        </label>
        <button class="btn btn-primary btn-sm" @click="showForm ? reset() : (showForm=true)">{{ showForm ? 'Close' : '+ New product' }}</button>
      </div>
    </div>
    <p class="text-muted">Snacks and drinks sold in the machines. Aliases let sales imports match automatically.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="importResult" class="alert alert-success py-2">
      Imported: {{ importResult.created }} new, {{ importResult.updated }} updated, {{ importResult.skipped }} skipped (of {{ importResult.total }}).
      <span v-if="importResult.errors?.length" class="d-block small">Errors: {{ importResult.errors.join('; ') }}</span>
    </div>

    <div v-if="showForm" class="card mb-4">
      <div class="card-body">
        <p class="section-eyebrow mb-3">{{ form.id ? 'Edit product' : 'New product' }}</p>
        <div class="row g-2">
          <div class="col-6 col-md-3"><label class="form-label">SKU</label><input v-model="form.sku" class="form-control" :disabled="!!form.id" /></div>
          <div class="col-6 col-md-5" style="position:relative">
            <label class="form-label">Name</label>
            <input v-model="form.name" class="form-control" autocomplete="off"
                   @focus="showNameSuggest=true" @input="showNameSuggest=true"
                   @blur="showNameSuggest=false" />
            <div v-if="showNameSuggest && nameSuggestions.length" class="suggest">
              <div class="suggest-hint">Suggestions</div>
              <button v-for="sug in nameSuggestions" :key="sug" type="button" class="suggest-item"
                      @mousedown.prevent="pickName(sug)">{{ sug }}</button>
            </div>
            <div v-if="form.name && !nameInReference && !nameSuggestions.length" class="suggest-new">
              Bagong pangalan — wala sa reference list
            </div>
          </div>
          <div class="col-6 col-md-2"><label class="form-label">Brand</label><input v-model="form.brand" class="form-control" /></div>
          <div class="col-6 col-md-2"><label class="form-label">Category</label><input v-model="form.category" class="form-control" /></div>

          <div class="col-6 col-md-3"><label class="form-label">Purchase cost</label><input v-model.number="form.purchaseCost" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-2"><label class="form-label">Markup %</label><input v-model.number="form.markupPercent" type="number" class="form-control numeric" /></div>
          <div class="col-6 col-md-3"><label class="form-label">Selling price</label><input v-model.number="form.sellingPrice" type="number" class="form-control numeric" :placeholder="String(suggested)" /></div>
          <div class="col-6 col-md-2"><label class="form-label">VAT</label>
            <select v-model="form.vatStatus" class="form-select"><option value="VAT">VAT</option><option value="NON_VAT">Non-VAT</option></select>
          </div>
          <div class="col-6 col-md-2"><label class="form-label">Reorder level</label><input v-model.number="form.reorderLevel" type="number" class="form-control numeric" /></div>

          <div class="col-12"><label class="form-label">Aliases (comma-separated — names from the machine's sales export)</label>
            <input v-model="form.aliasText" class="form-control" placeholder="e.g. Nova Cheedar, Nova Cheddar 78g" /></div>
        </div>

        <!-- Price preview -->
        <div class="access-chip mt-3" style="border-style:dashed">
          <span class="text-muted small">Suggested price at {{ form.markupPercent }}% markup: <strong>{{ peso(suggested) }}</strong>
            <span v-if="form.vatStatus==='VAT'"> · VAT ({{ vatRate }}%): {{ peso(vatAmount) }}</span></span>
        </div>

        <button class="btn btn-primary mt-3" :disabled="saving" @click="save">{{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create product') }}</button>
      </div>
    </div>

    <div class="mb-3" style="max-width:360px">
      <input v-model="search" class="form-control" placeholder="Search products by name or SKU…" />
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!items.length" class="card"><div class="card-body text-muted text-center py-4">No products yet.</div></div>
    <div v-else-if="!visibleItems.length" class="card"><div class="card-body text-muted text-center py-4">No products match "{{ search }}".</div></div>

    <div v-for="row in visibleItems" :key="row._id" class="card mb-2">
      <div class="card-body">
        <div class="d-flex align-items-center gap-3">
          <div class="flex-grow-1">
            <div class="fw-semibold" style="font-family:var(--font-display)">{{ row.name }}
              <span class="text-muted small ms-1">{{ row.sku }}</span>
              <span class="badge7 emp ms-1">{{ row.vatStatus }}</span>
              <span v-if="!row.active" class="badge7 off ms-1">INACTIVE</span>
            </div>
            <div class="text-muted small">
              Cost {{ peso(row.purchaseCost) }} · Sell {{ peso(row.sellingPrice) }}
              <span v-if="row.aliases?.length"> · {{ row.aliases.length }} alias<span v-if="row.aliases.length>1">es</span></span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="edit(row)">Edit</button>
          <button class="btn btn-sm" :class="row.active ? 'btn-ghost' : 'btn-ink'" @click="toggle(row)">{{ row.active ? 'Off' : 'On' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
