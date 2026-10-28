<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue';
import api from '../services/api.js';
import { fmtDate } from '../utils/datetime.js';
import FullscreenPanel from '../components/FullscreenPanel.vue';

// ---- Journals (ang tab ang nagde-determine ng libro) ----
const TABS = [
  { key: 'ALL', label: 'All Journal Entries' },
  { key: 'CRJ', label: 'Cash Receipts' },
  { key: 'CDJ', label: 'Cash Disbursements' },
  { key: 'SJ',  label: 'Sales Journal' },
  { key: 'PJ',  label: 'Purchases Journal' },
  { key: 'GJ',  label: 'General Journal' },
];
const TITLES = {
  ALL: ['All Journal Entries', 'Lahat ng posted na journal entries sa napiling criteria.'],
  CRJ: ['Cash Receipts Journal', 'Posted na cash at bank receipts sa napiling criteria.'],
  CDJ: ['Cash Disbursements Journal', 'Lahat ng cash at bank payments ng negosyo.'],
  SJ:  ['Sales Journal', 'Credit sales na gumagawa ng Accounts Receivable.'],
  PJ:  ['Purchases Journal', 'Credit purchases na gumagawa ng Accounts Payable.'],
  GJ:  ['General Journal', 'Non-cash adjustments, COGS, depreciation at manual entries.'],
};

const journal = ref('ALL');
const rows = ref([]);
const tiles = ref({});
const totals = ref({ debit: 0, credit: 0 });
const page = ref(1);
const pages = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');

// ---- Filters (consistent sa lahat ng journals, per rekomendasyon ni client) ----
const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function monthRange() {
  const now = new Date();
  return { start: isoLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
           end: isoLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
const f = reactive({ ...monthRange(), costCenter: '', account: '', paymentMethod: '', status: 'POSTED', source: '' });

const costCenters = ref([]);
const accounts = ref([]);
const SOURCES = ['Sales', 'Purchases', 'Cash Receipts', 'Cash Disbursements', 'Inventory', 'Manual Journal'];
const METHODS = ['Cash', 'Bank Transfer', 'GCash'];

const ccMap = computed(() => Object.fromEntries(costCenters.value.map((c) => [c.code, c.name])));
const ccName = (code) => (code ? (ccMap.value[code] || code) : '—');

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- Column definitions kada journal (structure lang ang nagbabago) ----
const COLS = {
  ALL: [
    { k: 'date', h: 'Date', t: 'date' }, { k: 'ref', h: 'JE No.' },
    { k: 'journalClass', h: 'Journal', t: 'journal' }, { k: 'source', h: 'Source' },
    { k: 'memo', h: 'Description' }, { k: 'totalDebit', h: 'Debit', t: 'money' },
    { k: 'totalCredit', h: 'Credit', t: 'money' }, { k: 'status', h: 'Status', t: 'status' },
    { k: '_view', h: '', t: 'view' },
  ],
  CRJ: [
    { k: 'date', h: 'Date', t: 'date' }, { k: 'ref', h: 'Receipt No.' },
    { k: 'txnType', h: 'Source / Reference' }, { k: 'memo', h: 'Customer / Description' },
    { k: 'accountDebited', h: 'Account Debited' }, { k: 'accountCredited', h: 'Account Credited' },
    { k: 'amount', h: 'Amount', t: 'money' }, { k: 'costCenter', h: 'Cost Center', t: 'cc' },
    { k: 'status', h: 'Status', t: 'status' }, { k: '_view', h: '', t: 'view' },
  ],
  CDJ: [
    { k: 'date', h: 'Date', t: 'date' }, { k: 'ref', h: 'Payment No.' },
    { k: 'memo', h: 'Payee / Description' }, { k: 'accountDebited', h: 'Account Debited' },
    { k: 'accountCredited', h: 'Account Credited' }, { k: 'amount', h: 'Amount', t: 'money' },
    { k: 'paymentMethod', h: 'Payment Method' }, { k: 'costCenter', h: 'Cost Center', t: 'cc' },
    { k: 'status', h: 'Status', t: 'status' }, { k: '_view', h: '', t: 'view' },
  ],
  SJ: [
    { k: 'date', h: 'Date', t: 'date' }, { k: 'ref', h: 'Invoice No.' },
    { k: 'memo', h: 'Customer' }, { k: 'txnType', h: 'Description' },
    { k: 'salesAmount', h: 'Sales Amount', t: 'money' }, { k: 'discount', h: 'Discount', t: 'money' },
    { k: 'withholding', h: 'Withholding Tax', t: 'money' }, { k: 'arAmount', h: 'A/R Amount', t: 'money' },
    { k: 'costCenter', h: 'Cost Center', t: 'cc' }, { k: 'status', h: 'Status', t: 'status' },
    { k: '_view', h: '', t: 'view' },
  ],
  PJ: [
    { k: 'date', h: 'Date', t: 'date' }, { k: 'ref', h: 'Supplier Invoice No.' },
    { k: 'memo', h: 'Supplier' }, { k: 'txnType', h: 'Description' },
    { k: 'purchaseAmount', h: 'Purchase Amount', t: 'money' }, { k: 'discount', h: 'Discount', t: 'money' },
    { k: 'apAmount', h: 'A/P Amount', t: 'money' }, { k: 'costCenter', h: 'Cost Center', t: 'cc' },
    { k: 'status', h: 'Status', t: 'status' }, { k: '_view', h: '', t: 'view' },
  ],
  GJ: [
    { k: 'date', h: 'Date', t: 'date' }, { k: 'ref', h: 'JE No.' },
    { k: 'source', h: 'Source' }, { k: 'memo', h: 'Description' },
    { k: 'accountDebited', h: 'Account Debited' }, { k: 'accountCredited', h: 'Account Credited' },
    { k: 'amount', h: 'Amount', t: 'money' }, { k: 'costCenter', h: 'Cost Center', t: 'cc' },
    { k: 'status', h: 'Status', t: 'status' }, { k: '_view', h: '', t: 'view' },
  ],
};
const cols = computed(() => COLS[journal.value] || COLS.ALL);
const title = computed(() => TITLES[journal.value] || TITLES.ALL);
const firstMoneyIdx = computed(() => cols.value.findIndex((c) => c.t === 'money'));
const colSum = (k) => rows.value.reduce((s, r) => s + (Number(r[k]) || 0), 0);

// ---- Stat tiles kada journal ----
const tileDefs = computed(() => {
  const t = tiles.value || {};
  const m = (label, v) => ({ label, value: peso(v), icon: 'money' });
  const n = (label, v) => ({ label, value: Number(v || 0).toLocaleString('en-PH'), icon: 'count' });
  switch (journal.value) {
    case 'CRJ': return [m('Total Receipts', t.totalReceipts), m('Cash', t.cash), m('Bank / GCash', t.bankGcash), n('Transactions', t.transactions)];
    case 'CDJ': return [m('Total Disbursements', t.totalDisbursements), m('Total Debit', t.totalDebit), m('Total Credit', t.totalCredit), n('Transactions', t.transactions)];
    case 'SJ':  return [m('Total Sales', t.totalSales), m('Total A/R', t.totalAR), m('Total Discounts', t.totalDiscounts), n('Transactions', t.transactions)];
    case 'PJ':  return [m('Total Purchases', t.totalPurchases), m('Total A/P', t.totalAP), m('Total Discounts', t.totalDiscounts), n('Transactions', t.transactions)];
    default:    return [m('Total Debit', t.totalDebit), m('Total Credit', t.totalCredit), n('Transactions', t.transactions)];
  }
});

const JBADGE = { CRJ: 'j-crj', CDJ: 'j-cdj', SJ: 'j-sj', PJ: 'j-pj', GJ: 'j-gj' };

function cellValue(row, c) {
  if (c.t === 'date') return row.date ? fmtDate(row.date) : '—';
  if (c.t === 'cc') return ccName(row[c.k]);
  if (c.t === 'money') return peso(row[c.k]);
  const v = row[c.k];
  return (v === '' || v == null) ? '—' : v;
}

async function loadFilters() {
  try {
    const [cc, ac] = await Promise.all([api.get('/cost-centers'), api.get('/accounts-coa')]);
    costCenters.value = (cc.data.costCenters || []).filter((c) => c.active !== false);
    accounts.value = (ac.data.accounts || []).filter((a) => !a.isHeader);
  } catch { /* huwag i-block ang page kung pumalya ang dropdown data */ }
}

async function load(resetPage = false) {
  if (resetPage) page.value = 1;
  loading.value = true; error.value = '';
  try {
    const params = {
      journal: journal.value, start: f.start, end: f.end,
      costCenter: f.costCenter || undefined, account: f.account || undefined,
      paymentMethod: f.paymentMethod || undefined, status: f.status || undefined,
      source: f.source || undefined, page: page.value, limit: 25,
    };
    const { data } = await api.get('/journal/reports', { params });
    rows.value = data.rows || [];
    tiles.value = data.tiles || {};
    totals.value = data.totals || { debit: 0, credit: 0 };
    pages.value = data.pages || 1; total.value = data.total || 0;
  } catch (e) {
    error.value = e.response?.data?.message || 'Hindi ma-load ang journal report.';
  } finally { loading.value = false; }
}

function selectTab(key) { if (key === journal.value) return; journal.value = key; load(true); }
function apply() { load(true); }
function reset() { Object.assign(f, { ...monthRange(), costCenter: '', account: '', paymentMethod: '', status: 'POSTED', source: '' }); load(true); }
function go(p) { if (p < 1 || p > pages.value) return; page.value = p; load(); }

const shownFrom = computed(() => (total.value ? (page.value - 1) * 25 + 1 : 0));
const shownTo = computed(() => Math.min(page.value * 25, total.value));

// ---- View Journal Entry modal ----
const modal = ref(null);       // { row, entry, loading, error }
async function openEntry(row) {
  modal.value = { row, entry: null, loading: true, error: '' };
  try {
    const { data } = await api.get(`/journal/${row.id}`);
    modal.value.entry = data.entry;
  } catch (e) {
    modal.value.error = e.response?.data?.message || 'Hindi ma-load ang entry.';
  } finally { if (modal.value) modal.value.loading = false; }
}
function closeModal() { modal.value = null; }

// ---- CSV export ng kasalukuyang view (PDF/Excel server export = Chunk 3) ----
function exportCsv() {
  const cs = cols.value.filter((c) => c.t !== 'view');
  const header = cs.map((c) => c.h || c.k);
  const lines = [header.join(',')];
  for (const r of rows.value) {
    lines.push(cs.map((c) => {
      let v = c.t === 'cc' ? ccName(r[c.k]) : c.t === 'date' ? (r.date ? fmtDate(r.date) : '') : r[c.k];
      v = v == null ? '' : String(v).replace(/"/g, '""');
      return /[",\n]/.test(v) ? `"${v}"` : v;
    }).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${journal.value}_Journal_${f.start}_to_${f.end}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

onMounted(async () => { await loadFilters(); await load(); });
</script>

<template>
  <div class="jr">
    <div class="crumb">Accounting › Journal Reports</div>
    <div class="head">
      <div>
        <h3 class="mb-0">{{ title[0] }}</h3>
        <p class="text-muted mb-0">{{ title[1] }}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button v-for="t in TABS" :key="t.key" class="tab" :class="{ on: journal === t.key }" @click="selectTab(t.key)">{{ t.label }}</button>
    </div>

    <!-- Filters (consistent sa lahat ng journals) -->
    <div class="card filt">
      <div class="fgrid">
        <div><label class="form-label">From Date</label><input type="date" class="form-control" v-model="f.start"></div>
        <div><label class="form-label">To Date</label><input type="date" class="form-control" v-model="f.end"></div>
        <div><label class="form-label">Cost Center</label>
          <select class="form-select" v-model="f.costCenter">
            <option value="">All Locations</option>
            <option v-for="c in costCenters" :key="c.code" :value="c.code">{{ c.code }} — {{ c.name }}</option>
          </select>
        </div>
        <div><label class="form-label">Account</label>
          <select class="form-select" v-model="f.account">
            <option value="">All Accounts</option>
            <option v-for="a in accounts" :key="a.code" :value="a.code">{{ a.code }} — {{ a.name }}</option>
          </select>
        </div>
        <div><label class="form-label">Payment Method</label>
          <select class="form-select" v-model="f.paymentMethod">
            <option value="">All Methods</option>
            <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div><label class="form-label">Status</label>
          <select class="form-select" v-model="f.status">
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <div><label class="form-label">Source</label>
          <select class="form-select" v-model="f.source">
            <option value="">All Sources</option>
            <option v-for="s in SOURCES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="fbtns">
          <button class="btn btn-ink" @click="apply">🔍 Apply Filters</button>
          <button class="btn btn-ghost" @click="reset">Reset</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

    <!-- Stat tiles -->
    <div class="tiles">
      <div v-for="(t, i) in tileDefs" :key="i" class="tile stat">
        <div class="stat-ic" :class="t.icon">{{ t.icon === 'count' ? '#' : '₱' }}</div>
        <div><div class="stat-lbl">{{ t.label }}</div><div class="stat-val">{{ t.value }}</div></div>
      </div>
    </div>

    <!-- Table (may Fullscreen toggle) -->
    <FullscreenPanel :title="title[0]">
      <template #bar>
        <button class="btn btn-ghost btn-sm" @click="exportCsv" :disabled="!rows.length">⤓ Export CSV</button>
      </template>
    <div class="card"><div class="card-body p-0" style="overflow-x:auto">
      <table class="fin-table ruled" style="min-width:1040px">
        <thead><tr>
          <th v-for="c in cols" :key="c.h + c.k" :class="(c.t === 'money') ? '' : 'lbl'">{{ c.h }}</th>
        </tr></thead>
        <tbody>
          <tr v-if="loading"><td :colspan="cols.length" class="text-center text-muted py-4">Loading…</td></tr>
          <tr v-else-if="!rows.length"><td :colspan="cols.length" class="text-center text-muted py-4">Walang posted na entry sa napiling criteria.</td></tr>
          <tr v-for="r in rows" :key="r.id">
            <td v-for="c in cols" :key="c.k" :class="(c.t === 'money') ? 'num' : 'lbl'">
              <template v-if="c.t === 'view'">
                <button class="btn-view" @click="openEntry(r)">View</button>
              </template>
              <template v-else-if="c.t === 'journal'">
                <span class="jbadge" :class="JBADGE[r.journalClass]">{{ r.journalClass }}</span>
              </template>
              <template v-else-if="c.t === 'status'">
                <span class="pill" :class="r.status === 'POSTED' ? 'ok' : (r.status === 'VOID' ? 'warn' : '')">{{ r.status === 'POSTED' ? 'Posted' : (r.status === 'VOID' ? 'Void' : r.status) }}</span>
              </template>
              <template v-else>{{ cellValue(r, c) }}</template>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="rows.length && firstMoneyIdx >= 0"><tr class="gp">
          <td class="lbl" :colspan="firstMoneyIdx">Totals (page)</td>
          <td class="num" v-for="c in cols.slice(firstMoneyIdx)" :key="'f'+c.k">
            <template v-if="c.t==='money'">{{ peso(colSum(c.k)) }}</template>
            <template v-else>&nbsp;</template>
          </td>
        </tr></tfoot>
      </table>
    </div></div>

    <!-- Pagination -->
    <div class="pager" v-if="total">
      <span class="text-muted">Showing {{ shownFrom }} to {{ shownTo }} of {{ total }} entries</span>
      <div class="pbtns">
        <button class="pbtn" :disabled="page<=1" @click="go(page-1)">‹</button>
        <span class="pcur">{{ page }} / {{ pages }}</span>
        <button class="pbtn" :disabled="page>=pages" @click="go(page+1)">›</button>
      </div>
    </div>
    </FullscreenPanel>

    <!-- View Journal Entry modal -->
    <div v-if="modal" class="ov" @click.self="closeModal">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <div class="text-muted" style="font-size:.75rem">Journal Entry</div>
            <h4 class="mb-0">{{ modal.row.ref }}
              <span class="jbadge" :class="JBADGE[modal.row.journalClass]" style="vertical-align:middle">{{ modal.row.journalClass }}</span>
            </h4>
          </div>
          <button class="x" @click="closeModal">✕</button>
        </div>

        <div v-if="modal.loading" class="text-muted py-3">Loading…</div>
        <div v-else-if="modal.error" class="alert alert-danger py-2">{{ modal.error }}</div>
        <div v-else-if="modal.entry">
          <div class="meta">
            <div><span>Date</span>{{ fmtDate(modal.entry.date) }}</div>
            <div><span>Transaction Type</span>{{ modal.row.txnType || '—' }}</div>
            <div><span>Source Module</span>{{ modal.row.source || '—' }}</div>
            <div><span>Posting Status</span>{{ modal.entry.status }}</div>
            <div v-if="modal.row.paymentMethod"><span>Payment Method</span>{{ modal.row.paymentMethod }}</div>
            <div class="wide"><span>Memo / Reference</span>{{ modal.entry.memo || '—' }}</div>
          </div>

          <table class="fin-table ruled mt-2" style="min-width:560px">
            <thead><tr>
              <th class="lbl">Account</th><th class="lbl">Cost Center</th><th class="lbl">Machine</th><th>Debit</th><th>Credit</th>
            </tr></thead>
            <tbody>
              <tr v-for="(l, i) in modal.entry.lines" :key="i">
                <td class="lbl"><b>{{ l.accountCode }}</b> {{ l.accountName }}</td>
                <td class="lbl">{{ l.costCenter ? ccName(l.costCenter) : '—' }}</td>
                <td class="lbl">{{ l.machine?.machineId || l.machine?.locationName || '—' }}</td>
                <td class="num">{{ l.debit ? peso(l.debit) : '' }}</td>
                <td class="num">{{ l.credit ? peso(l.credit) : '' }}</td>
              </tr>
            </tbody>
            <tfoot><tr class="gp">
              <td class="lbl" colspan="3">Total</td>
              <td class="num">{{ peso(modal.entry.totalDebit) }}</td>
              <td class="num">{{ peso(modal.entry.totalCredit) }}</td>
            </tr></tfoot>
          </table>
          <p class="text-muted mt-2" style="font-size:.78rem">
            Ang report na ito ay basa lang — hindi ito gumagawa ng bagong accounting entry.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jr { display:flex; flex-direction:column; gap:1rem; }
.crumb { font-size:.78rem; color:var(--muted); }
.head { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; flex-wrap:wrap; }

/* Tabs — underline style sa dawn accent */
.tabs { display:flex; gap:.25rem; border-bottom:2px solid var(--line); overflow-x:auto; }
.tab { border:none; background:none; padding:.6rem .9rem; font-weight:600; font-size:.9rem; color:var(--muted);
  white-space:nowrap; border-bottom:2px solid transparent; margin-bottom:-2px; cursor:pointer; }
.tab:hover { color:var(--ink-2); }
.tab.on { color:var(--ink); border-bottom-color:var(--dawn-deep); }

/* Filter panel */
.filt { padding:1rem 1.1rem; }
.fgrid { display:grid; grid-template-columns:repeat(4, 1fr); gap:.8rem 1rem; align-items:end; }
.fbtns { display:flex; gap:.5rem; }
.fbtns .btn { white-space:nowrap; }
@media (max-width:1100px){ .fgrid { grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px){ .fgrid { grid-template-columns:1fr; } }

/* Stat tiles */
.tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:.8rem; }
@media (max-width:900px){ .tiles { grid-template-columns:repeat(2,1fr); } }
@media (max-width:460px){ .tiles { grid-template-columns:1fr; } }
.stat { display:flex; align-items:center; gap:.85rem; }
.stat-ic { width:40px; height:40px; border-radius:10px; display:grid; place-items:center; font-weight:800;
  font-family:var(--font-display); background:var(--dawn-tint); color:var(--dawn-deep); }
.stat-ic.count { background:#EAF0F8; color:var(--ink-2); }
.stat-lbl { font-size:.74rem; color:var(--muted); }
.stat-val { font-family:var(--font-display); font-weight:700; font-size:1.2rem; font-variant-numeric:tabular-nums; }

/* Journal badge */
.jbadge { font-size:.68rem; font-weight:800; letter-spacing:.03em; padding:.18rem .45rem; border-radius:6px; background:#EAF0F8; color:var(--ink-2); }
.jbadge.j-crj { background:#E5F6EC; color:var(--good); }
.jbadge.j-cdj { background:#FDECEC; color:var(--bad); }
.jbadge.j-sj  { background:#E7EEFC; color:#2558C8; }
.jbadge.j-pj  { background:#F0E9FC; color:#6B3FD1; }
.jbadge.j-gj  { background:#EEF1F5; color:var(--ink-2); }

.btn-view { border:1px solid var(--line); background:var(--surface); color:var(--ink-2); font-size:.78rem; font-weight:600;
  padding:.25rem .7rem; border-radius:8px; cursor:pointer; }
.btn-view:hover { border-color:var(--dawn-deep); color:var(--dawn-deep); }

/* Pagination */
.pager { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; font-size:.85rem; }
.pbtns { display:flex; align-items:center; gap:.5rem; }
.pbtn { width:34px; height:34px; border:1px solid var(--line); background:var(--surface); border-radius:8px; cursor:pointer; }
.pbtn:disabled { opacity:.4; cursor:default; }
.pcur { font-weight:600; font-variant-numeric:tabular-nums; }

/* Modal */
.ov { position:fixed; inset:0; background:rgba(15,28,46,.45); display:grid; place-items:center; padding:1rem; z-index:2000; }
.sheet { background:var(--surface); border-radius:var(--radius); width:min(680px,100%); max-height:90vh; overflow:auto; padding:1.2rem 1.3rem; box-shadow:var(--shadow-md); }
.sheet-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:.5rem; }
.x { border:none; background:none; font-size:1.1rem; color:var(--muted); cursor:pointer; }
.meta { display:grid; grid-template-columns:1fr 1fr; gap:.5rem .9rem; font-size:.85rem; }
.meta > div { display:flex; flex-direction:column; }
.meta .wide { grid-column:1 / -1; }
.meta span { font-size:.7rem; text-transform:uppercase; letter-spacing:.03em; color:var(--muted); }
@media (max-width:480px){ .meta { grid-template-columns:1fr; } }
</style>
