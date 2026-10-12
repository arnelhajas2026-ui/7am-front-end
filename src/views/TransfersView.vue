<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';

const transfers = ref([]);
const machines = ref([]);
const products = ref([]);
const riders = ref([]);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const saving = ref(false);

const today = () => new Date().toISOString().slice(0,10);
const newLine = () => ({ product:'', source:'WAREHOUSE:', dest:'', quantity:1 });
const form = ref({ date: today(), assignedRider:'', lines: [newLine()] });

// Location dropdown options (Warehouse + bawat machine display at side cabinet).
const locOptions = computed(() => {
  const opts = [{ value:'WAREHOUSE:', label:'Warehouse' }];
  for (const m of machines.value) opts.push({ value:`MACHINE_LOADED:${m._id}`, label:(m.locationName||m.machineId) });
  for (const m of machines.value) opts.push({ value:`SIDE_CABINET:${m._id}`, label:'Side Cabinet - '+(m.locationName||m.machineId) });
  return opts;
});

// Real-time na balanse per product (cache). qty bawat location key.
const balById = reactive({});
async function fetchBalances(product){
  if (!product || balById[product]) return;
  try { const { data } = await api.get('/inventory/location-balances', { params:{ product } });
    const map = {}; for (const b of data.balances) map[`${b.type}:${b.machine||''}`] = b.qty;
    balById[product] = map;
  } catch { balById[product] = {}; }
}
function qtyAt(product, locValue){ return (balById[product]||{})[locValue] || 0; }
function srcBalance(l){ return l.product ? qtyAt(l.product, l.source) : 0; }
function destAfter(l){ return l.product && l.dest ? qtyAt(l.product, l.dest) + Number(l.quantity||0) : 0; }
function onLineProduct(l){ fetchBalances(l.product); }

function addLine(){ form.value.lines.push(newLine()); }
function removeLine(i){ form.value.lines.splice(i,1); if(!form.value.lines.length) addLine(); }
function reset(){ form.value = { date: today(), assignedRider:'', lines:[newLine()] }; showForm.value=false; }
function openForm(){ showForm.value=true; }

const selected = ref(null);
function viewTransfer(t){ selected.value=t; window.scrollTo({ top:0, behavior:'smooth' }); }
function closeView(){ selected.value=null; }

// --- Bulk import ---
const showImport = ref(false);
const importing = ref(false);
const importFile = ref(null);
const importResult = ref(null);
function onImportPick(e){ importFile.value = e.target.files?.[0] || null; importResult.value = null; }
async function runImport(){
  if (!importFile.value){ error.value='Pumili muna ng .xlsx o .csv file.'; return; }
  importing.value=true; error.value=''; importResult.value=null;
  try {
    const fd = new FormData(); fd.append('file', importFile.value);
    const { data } = await api.post('/transfers/import', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
    importResult.value = data; importFile.value=null; await load();
  } catch(e){ error.value = e.response?.data?.message || 'Could not import.'; }
  finally { importing.value=false; }
}

const STATUS = {
  POSTED:{ label:'Posted', cls:'ok' }, PARKED:{ label:'Parked', cls:'park' },
  UNDER_REVIEW:{ label:'Under Review', cls:'warn' }, COMPLETED:{ label:'Completed', cls:'ok' },
  ACKNOWLEDGED:{ label:'Acknowledged', cls:'ack' },
};
const statusOf = (s)=> STATUS[s] || { label:s||'—', cls:'' };
const locLabelOf = (value)=> (locOptions.value.find(o=>o.value===value)?.label) || value;
function lineRoute(l){
  const s = l.sourceMachine ? (l.sourceMachine.locationName||l.sourceMachine.machineId) : 'Warehouse';
  const d = l.destMachine ? (l.destMachine.locationName||l.destMachine.machineId) : 'Warehouse';
  const typeTag = (t)=> t==='SIDE_CABINET' ? ' (side cab)' : t==='MACHINE_LOADED' ? ' (display)' : '';
  return `${s}${typeTag(l.sourceType)} → ${d}${typeTag(l.destType)}`;
}

async function load(){
  loading.value=true; error.value='';
  try {
    const [tr,ma,pr,rd] = await Promise.all([ api.get('/transfers'), api.get('/machines'), api.get('/products'), api.get('/riders') ]);
    transfers.value = tr.data.transfers; machines.value = ma.data.machines; products.value = pr.data.products; riders.value = rd.data.riders;
  } catch(e){ error.value = e.response?.data?.message || 'Could not load transfers.'; }
  finally { loading.value=false; }
}

function payload(saveDraft){
  const lines = form.value.lines
    .filter(l => l.product && Number(l.quantity)>0 && l.source && l.dest)
    .map(l => {
      const [st,sm] = l.source.split(':'); const [dt,dm] = l.dest.split(':');
      return { product:l.product, sourceType:st, sourceMachine: sm||null, destType:dt, destMachine: dm||null, quantity:Number(l.quantity) };
    });
  return { date: form.value.date, assignedRider: form.value.assignedRider || null, lines, saveDraft };
}
async function submit(saveDraft){
  saving.value=true; error.value='';
  try { await api.post('/transfers', payload(saveDraft)); reset(); await load(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save transfer.'; }
  finally { saving.value=false; }
}
async function submitDraft(t){
  error.value='';
  try { await api.post(`/transfers/${t._id}/submit`); await load(); if(selected.value?._id===t._id) closeView(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not submit draft.'; }
}
async function delDraft(t){
  if(!confirm('Burahin ang draft na '+t.transferNo+'?')) return;
  try { await api.delete(`/transfers/${t._id}`); await load(); if(selected.value?._id===t._id) closeView(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not delete draft.'; }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Transfers</h3>
      <div class="d-flex gap-2">
        <button class="btn btn-ghost btn-sm" @click="showImport = !showImport">{{ showImport ? 'Hide import' : 'Import' }}</button>
        <button class="btn btn-primary btn-sm" @click="showForm ? reset() : openForm()">{{ showForm ? 'Close' : '+ New transfer' }}</button>
      </div>
    </div>
    <p class="text-muted">Move stock between any locations — warehouse, machine display, or side cabinet. Blocked if the source is short.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Bulk import (xlsx/csv) -->
    <div v-if="showImport" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-2">Import transfers (.xlsx / .csv)</p>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <input type="file" accept=".xlsx,.xls,.csv" class="form-control form-control-sm" style="max-width:320px" @change="onImportPick" />
        <button class="btn btn-primary btn-sm" :disabled="importing" @click="runImport">{{ importing ? 'Importing…' : 'Import' }}</button>
      </div>
      <div class="text-muted small mt-2">
        Columns: <strong>Transfer No, Date, SKU</strong> (o Product), <strong>Source Type</strong> (Warehouse/Machine/Side Cabinet), <strong>Source Machine, Destination Type, Destination Machine, Qty, Assigned Rider</strong>.
        Ang mga row na may parehong <strong>Transfer No</strong> ay pinagsasama. Ang na-import ay <strong>Completed</strong> agad (historical) — gumagalaw ang stock.
      </div>
      <div v-if="importResult" class="alert alert-success py-2 mt-2 mb-0">
        Na-import: <strong>{{ importResult.created }}</strong> transfer(s), {{ importResult.lines }} line(s). Skipped: {{ importResult.skipped }}.
        <div v-if="importResult.errors?.length" class="small mt-1" style="color:var(--bad)">
          <div v-for="(er,i) in importResult.errors" :key="i">· {{ er }}</div>
        </div>
      </div>
    </div></div>

    <!-- Detail view -->
    <div v-if="selected" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0" style="font-family:var(--font-display)">{{ selected.transferNo || 'Transfer' }}
            <span class="pill ms-1" :class="statusOf(selected.status).cls">{{ statusOf(selected.status).label }}</span></h5>
          <div class="text-muted small">{{ fmtDate(selected.date) }} ·
            Prepared by: {{ selected.preparedBy?.name || '—' }} ·
            Assigned to: {{ selected.assignedRider?.name || '—' }}</div>
        </div>
        <div class="d-flex gap-2">
          <button v-if="selected.status==='PARKED'" class="btn btn-primary btn-sm" @click="submitDraft(selected)">Submit</button>
          <button v-if="selected.status==='PARKED'" class="btn btn-ghost btn-sm" @click="delDraft(selected)">Delete</button>
          <button class="btn btn-ghost btn-sm" @click="closeView">Close</button>
        </div>
      </div>
      <table class="fin-table ruled" style="width:100%">
        <thead><tr><th class="lbl">Product</th><th class="lbl">Route (source → destination)</th><th>Qty</th></tr></thead>
        <tbody>
          <tr v-for="(l,i) in (selected.lines||[])" :key="i">
            <td class="lbl">{{ l.product?.name || 'Product' }} <span class="text-muted small">{{ l.product?.sku }}</span></td>
            <td class="lbl">{{ lineRoute(l) }}</td>
            <td class="num">{{ l.quantity }}</td>
          </tr>
          <!-- legacy fallback -->
          <tr v-for="(it,i) in (selected.items||[])" :key="'lg'+i">
            <td class="lbl">{{ it.product?.name || 'Product' }}</td>
            <td class="lbl">Warehouse → {{ selected.machine?.locationName || selected.machine?.machineId }}</td>
            <td class="num">{{ it.quantity }}</td>
          </tr>
        </tbody>
      </table>
    </div></div>

    <!-- New transfer form -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <p class="section-eyebrow mb-0">New transfer <span class="text-muted small">· Transfer No. auto on save (TRF-YYYY-#####)</span></p>
        <div class="d-flex gap-2">
          <select v-model="form.assignedRider" class="form-select form-select-sm" style="max-width:190px">
            <option value="">Assign to rider…</option>
            <option v-for="r in riders" :key="r._id" :value="r._id">{{ r.name }}</option>
          </select>
          <input v-model="form.date" type="date" class="form-control form-control-sm" style="max-width:160px" />
        </div>
      </div>

      <div class="table-responsive">
        <table class="tf-table">
          <thead><tr>
            <th>Product</th><th>Source location</th><th class="r">Src bal.</th>
            <th>Destination</th><th class="r">Dest after</th><th class="r">Qty</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="(l,i) in form.lines" :key="i">
              <td><select v-model="l.product" class="form-select form-select-sm" @change="onLineProduct(l)">
                <option value="">— product —</option>
                <option v-for="p in products" :key="p._id" :value="p._id">{{ p.name }}</option></select></td>
              <td><select v-model="l.source" class="form-select form-select-sm">
                <option v-for="o in locOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></td>
              <td class="r"><span :class="srcBalance(l)<Number(l.quantity||0) ? 'text-danger fw-semibold':''">{{ srcBalance(l) }}</span></td>
              <td><select v-model="l.dest" class="form-select form-select-sm">
                <option value="">— destination —</option>
                <option v-for="o in locOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></td>
              <td class="r">{{ l.dest ? destAfter(l) : '—' }}</td>
              <td class="r" style="width:84px"><input v-model.number="l.quantity" type="number" class="form-control form-control-sm numeric" /></td>
              <td><button class="btn btn-ghost btn-sm" @click="removeLine(i)">×</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="d-flex justify-content-between align-items-center mt-2">
        <button class="btn btn-ghost btn-sm" @click="addLine">+ Add transfer</button>
        <div class="d-flex gap-2">
          <button class="btn btn-ghost" :disabled="saving" @click="submit(true)">{{ saving ? '…' : 'Save as draft' }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="submit(false)">{{ saving ? 'Saving…' : 'Submit' }}</button>
        </div>
      </div>
      <div class="text-muted small mt-2">Pag-submit: kung ikaw ang owner o naka-delegate ang approval sa Settings, <strong>agad gagalaw ang stock (Completed)</strong>. Kung hindi, mapupunta muna sa <strong>Under Review</strong> at kailangan ng approval ng owner sa Approvals section bago gumalaw ang stock.</div>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <div v-else-if="!transfers.length" class="card"><div class="card-body text-muted text-center py-4">No transfers yet.</div></div>

    <div v-for="t in transfers" :key="t._id" class="card mb-2" style="cursor:pointer" @click="viewTransfer(t)"><div class="card-body py-2 d-flex align-items-center gap-3">
      <div class="flex-grow-1">
        <div class="fw-semibold" style="font-family:var(--font-display)">{{ t.transferNo || 'Transfer' }}
          <span class="pill ms-1" :class="statusOf(t.status).cls">{{ statusOf(t.status).label }}</span></div>
        <div class="text-muted small">{{ fmtDate(t.date) }} · {{ (t.lines?.length || t.items?.length || 0) }} line<span v-if="(t.lines?.length||t.items?.length||0)>1">s</span></div>
      </div>
      <button v-if="t.status==='PARKED'" class="btn btn-primary btn-sm" @click.stop="submitDraft(t)">Submit</button>
    </div></div>
  </div>
</template>

<style scoped>
.tf-table { width:100%; border-collapse:collapse; font-size:.85rem; min-width:720px; }
.tf-table thead th { text-align:left; font-size:.64rem; text-transform:uppercase; letter-spacing:.03em; color:#3A4A5E; padding:.3rem .4rem; border-bottom:1px solid var(--line); }
.tf-table thead th.r { text-align:right; }
.tf-table tbody td { padding:.3rem .4rem; vertical-align:middle; border-bottom:1px solid var(--line); }
.tf-table tbody td.r { text-align:right; font-variant-numeric:tabular-nums; }
.pill { font-size:.66rem; font-weight:700; padding:.12rem .55rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.ok { background:#E5F6EC; color:var(--good); }
.pill.warn { background:#FFF3DF; color:var(--dawn-deep); }
.pill.park { background:#E7F5E9; color:#2E7D32; }
.pill.ack { background:#E6EEFB; color:#2451B3; }
</style>
