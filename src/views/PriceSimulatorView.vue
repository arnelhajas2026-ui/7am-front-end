<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';

const products = ref([]);
const categories = ref([]);
const latestExpenses = ref({});
const defaultMarkup = ref(20);
const error = ref('');
const saved = ref('');
const saving = ref(false);
const savingGas = ref(false);

const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
const r2 = (n)=> Math.round(Number(n||0)*100)/100;

// --- Main simulator ---
const sim = ref({
  productId:'', unitCost:0, freight:0, expectedUnits:600,
  overheadCats:[], gasolinePerUnit:0, gasLocation:'', markupPercent:30, fixedMargin:0,
});
// Editable na halaga kada category (default = latest mula sa Expenses; pwedeng i-override at naka-save per product).
const overrideAmounts = ref({});
function initAmounts(savedArr){
  const m = {};
  for (const c of categories.value) m[c] = Number(latestExpenses.value[c]?.amount || 0);
  if (Array.isArray(savedArr)) for (const o of savedArr) { if (o && o.category != null) m[o.category] = Number(o.amount) || 0; }
  overrideAmounts.value = m;
}
function resetAmount(c){ overrideAmounts.value[c] = Number(latestExpenses.value[c]?.amount || 0); }
const overheadMonthly = computed(()=> sim.value.overheadCats.reduce((s,c)=> s+Number(overrideAmounts.value[c]||0),0));
const overheadPerUnit = computed(()=> Number(sim.value.expectedUnits)>0 ? overheadMonthly.value/Number(sim.value.expectedUnits) : 0);
const totalCostPerUnit = computed(()=> Number(sim.value.unitCost||0)+Number(sim.value.freight||0)+overheadPerUnit.value+Number(sim.value.gasolinePerUnit||0));
const recommendedPrice = computed(()=> totalCostPerUnit.value*(1+Number(sim.value.markupPercent||0)/100)+Number(sim.value.fixedMargin||0));
const marginPeso = computed(()=> recommendedPrice.value-totalCostPerUnit.value);
const marginPct = computed(()=> recommendedPrice.value>0 ? (marginPeso.value/recommendedPrice.value)*100 : 0);

function toggleCat(c){ const i=sim.value.overheadCats.indexOf(c); if(i>=0) sim.value.overheadCats.splice(i,1); else sim.value.overheadCats.push(c); }
function onPickProduct(){
  saved.value='';
  const p = products.value.find(x=>x._id===sim.value.productId);
  if(!p) return;
  sim.value.unitCost = p.purchaseCost||0;
  const pc = p.pricingConfig;
  if(pc && (pc.expectedUnits || (pc.overheadCategories&&pc.overheadCategories.length) || pc.markupPercent)){
    sim.value.freight = pc.freight||0;
    sim.value.expectedUnits = pc.expectedUnits||600;
    sim.value.overheadCats = [...(pc.overheadCategories||[])];
    sim.value.gasolinePerUnit = pc.gasolinePerUnit||0;
    sim.value.gasLocation = pc.gasLocation||'';
    sim.value.markupPercent = pc.markupPercent||defaultMarkup.value;
    sim.value.fixedMargin = pc.fixedMargin||0;
    initAmounts(pc.overheadAmounts);
  } else {
    sim.value.markupPercent = p.markupPercent||defaultMarkup.value;
    initAmounts([]);
  }
}

// --- Gasoline per-location sub-simulator (naka-save sa global config) ---
const gas = ref({ fuelPrice:65, kmPerLiter:12, tripsPerMonth:8, roundTrip:true, locations:[] });
const gasRows = computed(()=> gas.value.locations.map((L)=>{
  const kmPerTrip = Number(L.legKm||0)*(gas.value.roundTrip?2:1);
  const monthlyKm = kmPerTrip*Number(gas.value.tripsPerMonth||0);
  const liters = Number(gas.value.kmPerLiter)>0 ? monthlyKm/Number(gas.value.kmPerLiter) : 0;
  const monthlyCost = liters*Number(gas.value.fuelPrice||0);
  const perUnit = Number(L.units)>0 ? monthlyCost/Number(L.units) : 0;
  return { name:L.name, monthlyCost:r2(monthlyCost), perUnit:r2(perUnit) };
}));
function addLocation(){ gas.value.locations.push({name:'', legKm:0, units:0}); }
function removeLocation(i){ gas.value.locations.splice(i,1); }
function useGas(i){ sim.value.gasolinePerUnit = gasRows.value[i].perUnit; sim.value.gasLocation = gas.value.locations[i].name||''; saved.value=''; }
async function saveGas(){
  savingGas.value=true; error.value=''; saved.value='';
  try { await api.post('/products/pricing-gas', gas.value); saved.value='Na-save ang gasoline settings.'; }
  catch(e){ error.value = e.response?.data?.message || 'Could not save gas settings.'; }
  finally { savingGas.value=false; }
}

async function load(){
  try {
    const [pr, pd] = await Promise.all([ api.get('/products'), api.get('/products/pricing-data') ]);
    products.value = pr.data.products;
    categories.value = pd.data.categories || [];
    latestExpenses.value = pd.data.latestExpenses || {};
    defaultMarkup.value = pd.data.defaultMarkupPercent || 20;
    if (pd.data.gas) gas.value = { roundTrip:true, locations:[], ...pd.data.gas };
    if (!sim.value.overheadCats.length) sim.value.overheadCats = [...categories.value];  // default: isama lahat
    initAmounts([]);
    if (!gas.value.locations.length) gas.value.locations = [{name:'Amaia Steps Sucat', legKm:12, units:600}, {name:'Avida', legKm:3, units:400}];
  } catch(e){ error.value = e.response?.data?.message || 'Could not load data.'; }
}
async function savePricing(){
  if(!sim.value.productId){ error.value='Pumili muna ng produkto para ma-save ang config at presyo.'; return; }
  saving.value=true; error.value=''; saved.value='';
  try {
    await api.post(`/products/${sim.value.productId}/pricing`, {
      freight:sim.value.freight, expectedUnits:sim.value.expectedUnits, overheadCategories:sim.value.overheadCats,
      overheadAmounts: categories.value.map(c=>({ category:c, amount:Number(overrideAmounts.value[c])||0 })),
      gasolinePerUnit:sim.value.gasolinePerUnit, gasLocation:sim.value.gasLocation,
      markupPercent:sim.value.markupPercent, fixedMargin:sim.value.fixedMargin,
      sellingPrice:r2(recommendedPrice.value),
    });
    saved.value = `Na-save ang config at ${peso(r2(recommendedPrice.value))} bilang selling price. (Na-clear din ang price-review alert, kung meron.)`;
    await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not save.'; }
  finally { saving.value=false; }
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-0">Selling Price Simulator</h3>
    <p class="text-muted">Recommended selling price kada produkto — unit cost + freight + allocated overhead (awtomatikong kinukuha ang <strong>pinakabagong halaga sa Expenses</strong>) + gasolina + target mark-up. Naka-save ang config kada produkto.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="saved" class="alert alert-success py-2">{{ saved }}</div>

    <div class="row g-3">
      <div class="col-12 col-lg-7">
        <div class="card mb-3"><div class="card-body">
          <p class="section-eyebrow mb-2">1 · Produkto at unit cost</p>
          <div class="row g-2">
            <div class="col-12 col-md-6"><label class="form-label mb-0 small text-muted">Produkto</label>
              <select v-model="sim.productId" class="form-select form-select-sm" @change="onPickProduct">
                <option value="">— manual (walang save) —</option>
                <option v-for="p in products" :key="p._id" :value="p._id">{{ p.name }}<span v-if="p.sku"> ({{ p.sku }})</span></option>
              </select></div>
            <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Unit / purchase cost</label>
              <input v-model.number="sim.unitCost" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" /></div>
            <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Freight / handling</label>
              <input v-model.number="sim.freight" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" /></div>
          </div>
        </div></div>

        <div class="card mb-3"><div class="card-body">
          <p class="section-eyebrow mb-2">2 · Allocated overhead (auto mula sa Expenses ÷ expected units)</p>
          <div class="mb-2" style="max-width:280px"><label class="form-label mb-0 small text-muted">Expected monthly units (kada machine)</label>
            <input v-model.number="sim.expectedUnits" type="number" min="1" step="1" class="form-control form-control-sm text-end" /></div>
          <table class="table table-sm align-middle" style="max-width:560px">
            <thead><tr><th style="width:40px"></th><th>Expense category</th><th class="text-end" style="width:190px">Halaga / buwan</th><th class="text-end" style="width:110px">Kada unit</th></tr></thead>
            <tbody>
              <tr v-for="c in categories" :key="c">
                <td><input type="checkbox" class="form-check-input" :checked="sim.overheadCats.includes(c)" @change="toggleCat(c)" /></td>
                <td class="lbl">{{ c }}</td>
                <td><div class="d-flex align-items-center gap-1 justify-content-end">
                  <input v-model.number="overrideAmounts[c]" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" style="max-width:120px" />
                  <button class="btn btn-ghost btn-sm px-1" title="Balik sa latest expense" @click="resetAmount(c)">↺</button>
                </div></td>
                <td class="num text-muted">{{ sim.overheadCats.includes(c) && Number(sim.expectedUnits)>0 ? peso(Number(overrideAmounts[c]||0)/Number(sim.expectedUnits)) : '—' }}</td>
              </tr>
              <tr v-if="!categories.length"><td colspan="4" class="text-muted small py-2">Walang expense category pa. Magdagdag muna ng expenses.</td></tr>
            </tbody>
            <tfoot><tr><td></td><td class="fw-semibold">Overhead (napili)</td><td class="num fw-semibold">{{ peso(overheadMonthly) }}</td><td class="num fw-bold">{{ peso(overheadPerUnit) }}</td></tr></tfoot>
          </table>
          <div class="form-text">Naka-default sa pinakabagong halaga mula sa Expenses, pero <strong>pwede mong i-edit</strong> ang "Halaga / buwan" (hal. Kuryente ₱1,200 ÷ 600 = ₱2.00/unit). Ang ↺ ay nagbabalik sa latest expense. Naka-save kada produkto ang override mo.</div>
        </div></div>

        <div class="card"><div class="card-body">
          <p class="section-eyebrow mb-2">3 · Gasolina at target</p>
          <div class="row g-2">
            <div class="col-6 col-md-4"><label class="form-label mb-0 small text-muted">Gasolina kada unit</label>
              <input v-model.number="sim.gasolinePerUnit" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" />
              <div class="form-text">{{ sim.gasLocation ? sim.gasLocation : 'Galing sa simulator sa kanan ↗' }}</div></div>
            <div class="col-6 col-md-4"><label class="form-label mb-0 small text-muted">Mark-up %</label>
              <input v-model.number="sim.markupPercent" type="number" min="0" step="1" class="form-control form-control-sm text-end" /></div>
            <div class="col-6 col-md-4"><label class="form-label mb-0 small text-muted">Fixed margin (₱)</label>
              <input v-model.number="sim.fixedMargin" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" /></div>
          </div>
        </div></div>
      </div>

      <div class="col-12 col-lg-5">
        <div class="card mb-3" style="border-color:#8FD3A8"><div class="card-body">
          <p class="section-eyebrow mb-2">Recommended Selling Price</p>
          <div style="font-family:var(--font-display); font-weight:700; font-size:2rem; color:#1F3A5F">{{ peso(recommendedPrice) }}</div>
          <table class="fin-table mt-2" style="width:100%"><tbody>
            <tr><td class="lbl">Unit / purchase cost</td><td class="num">{{ peso(sim.unitCost) }}</td></tr>
            <tr><td class="lbl">Freight / handling</td><td class="num">{{ peso(sim.freight) }}</td></tr>
            <tr><td class="lbl">Overhead kada unit</td><td class="num">{{ peso(overheadPerUnit) }}</td></tr>
            <tr><td class="lbl">Gasolina kada unit</td><td class="num">{{ peso(sim.gasolinePerUnit) }}</td></tr>
            <tr class="gp"><td class="lbl fw-semibold">Total cost kada unit</td><td class="num fw-bold">{{ peso(totalCostPerUnit) }}</td></tr>
            <tr><td class="lbl">Margin (₱) / (%)</td><td class="num">{{ peso(marginPeso) }} · {{ r2(marginPct) }}%</td></tr>
          </tbody></table>
          <button class="btn btn-primary btn-sm mt-2 w-100" :disabled="saving || !sim.productId" @click="savePricing">
            {{ saving ? 'Saving…' : 'I-save ang config + selling price' }}</button>
          <div v-if="!sim.productId" class="form-text">Pumili ng produkto para ma-save ang config.</div>
        </div></div>

        <div class="card"><div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <p class="section-eyebrow mb-0">Gasoline Cost Simulator (per location)</p>
            <button class="btn btn-ghost btn-sm" :disabled="savingGas" @click="saveGas">{{ savingGas ? 'Saving…' : 'Save settings' }}</button>
          </div>
          <div class="row g-2 mb-2">
            <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Presyo ₱/L</label>
              <input v-model.number="gas.fuelPrice" type="number" min="0" step="0.01" class="form-control form-control-sm text-end" /></div>
            <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Km / Litro</label>
              <input v-model.number="gas.kmPerLiter" type="number" min="0.1" step="0.1" class="form-control form-control-sm text-end" /></div>
            <div class="col-6 col-md-3"><label class="form-label mb-0 small text-muted">Trips / buwan</label>
              <input v-model.number="gas.tripsPerMonth" type="number" min="0" step="1" class="form-control form-control-sm text-end" /></div>
            <div class="col-6 col-md-3 d-flex align-items-end"><div class="form-check">
              <input v-model="gas.roundTrip" type="checkbox" class="form-check-input" id="rt" />
              <label class="form-check-label small" for="rt">Round trip (×2)</label></div></div>
          </div>
          <div style="overflow-x:auto">
            <table class="fin-table" style="min-width:540px">
              <thead><tr><th class="lbl">Location</th><th>Leg (km)</th><th>Units/buwan</th><th>Gas/unit</th><th class="lbl"></th></tr></thead>
              <tbody>
                <tr v-for="(L,i) in gas.locations" :key="i">
                  <td><input v-model="L.name" class="form-control form-control-sm" placeholder="Pangalan" /></td>
                  <td><input v-model.number="L.legKm" type="number" min="0" step="0.1" class="form-control form-control-sm text-end" style="max-width:85px" /></td>
                  <td><input v-model.number="L.units" type="number" min="0" step="1" class="form-control form-control-sm text-end" style="max-width:85px" /></td>
                  <td class="num fw-semibold">{{ peso(gasRows[i].perUnit) }}</td>
                  <td class="lbl"><div class="d-flex gap-1">
                    <button class="btn btn-ghost btn-sm" @click="useGas(i)">Use</button>
                    <button class="btn btn-ghost btn-sm" @click="removeLocation(i)">✕</button>
                  </div></td>
                </tr>
              </tbody>
            </table>
          </div>
          <button class="btn btn-ghost btn-sm mt-1" @click="addLocation">+ Add location</button>
          <div class="form-text">Incremental ang leg (Shop→Amaia Sucat 12 km, Amaia→Avida +3 km). Ang "Use" ay ilalagay ang gas-kada-unit sa simulator. I-save ang settings para magamit ulit.</div>
        </div></div>
      </div>
    </div>
  </div>
</template>
