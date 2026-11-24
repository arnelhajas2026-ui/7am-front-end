<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';

const data = ref(null);
const loading = ref(false);
const error = ref('');
const filters = ref({ location: 'All', period: 'today' });
const showReplenish = ref(false);
const tip = ref({ show: false, x: 0, y: 0, title: '', rows: [] });

const activeTab = ref('exec');
const TABS = [
  { key: 'exec', label: '1. Executive' },
  { key: 'sales', label: '2. Sales' },
  { key: 'inventory', label: '3. Inventory' },
  { key: 'cash', label: '4. Cash recon' },
  { key: 'expenses', label: '5. Expenses' },
  { key: 'location', label: '7. Locations' },
  { key: 'alerts', label: '8. Alerts' },
];

const TREND_COLORS = ['#2e8bff', '#9b59ff', '#ff7a2e', '#27c06a', '#ff4d4d', '#ffd21a', '#ff5fa8'];

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const peso0 = (n) => '₱' + Math.round(Number(n || 0)).toLocaleString('en-PH');
const pct = (n) => (Number(n || 0)).toFixed(1) + '%';
function shortP(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return '₱' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K';
  return '₱' + Math.round(v);
}
function niceMax(v) { if (v <= 0) return 10; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return step * p; }

async function load() {
  loading.value = true; error.value = '';
  try { const r = await api.get('/dashboard/executive', { params: filters.value }); data.value = r.data; }
  catch (e) { error.value = e.response?.data?.message || 'Hindi ma-load ang dashboard.'; }
  finally { loading.value = false; }
}

const W = 700, H = 240, PL = 52, PR = 12, PT = 12, PB = 34;
const trend = computed(() => {
  const arr = data.value?.sales?.trend || [];
  const max = niceMax(Math.max(1, ...arr.map((d) => d.value)));
  const iw = W - PL - PR, ih = H - PT - PB;
  const n = arr.length || 1;
  const bw = Math.min(64, (iw / n) * 0.62);
  const gap = iw / n;
  const bars = arr.map((d, i) => {
    const h = (d.value / max) * ih;
    return { x: PL + gap * i + (gap - bw) / 2, y: PT + ih - h, w: bw, h, color: TREND_COLORS[i % TREND_COLORS.length], label: d.label, value: d.value };
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: PT + ih - t * ih, v: max * t }));
  return { bars, ticks, max, ih, iw };
});
const loc = computed(() => {
  const arr = data.value?.locationComparison || [];
  const max = niceMax(Math.max(1, ...arr.flatMap((d) => [d.sales, d.operatingProfit])));
  const iw = W - PL - PR, ih = H - PT - PB;
  const n = arr.length || 1;
  const groupW = iw / n;
  const bw = Math.min(34, groupW * 0.3);
  const groups = arr.map((d, i) => {
    const cx = PL + groupW * i + groupW / 2;
    const sh = (d.sales / max) * ih, ph = (Math.max(0, d.operatingProfit) / max) * ih;
    return {
      label: d.location, sales: d.sales, operatingProfit: d.operatingProfit,
      s: { x: cx - bw - 3, y: PT + ih - sh, w: bw, h: sh },
      p: { x: cx + 3, y: PT + ih - ph, w: bw, h: ph },
    };
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: PT + ih - t * ih, v: max * t }));
  return { groups, ticks, ih };
});

function showTip(evt, title, rows) {
  const box = evt.currentTarget.closest('.chart-wrap').getBoundingClientRect();
  tip.value = { show: true, x: evt.clientX - box.left + 10, y: evt.clientY - box.top - 10, title, rows };
}
function hideTip() { tip.value.show = false; }

function badgeClass(action) { return action === 'Urgent' ? 'bdg-urgent' : action === 'Restock' ? 'bdg-restock' : 'bdg-normal'; }
function alertClass(cat) { return ({ Inventory: 'a-inv', Stockout: 'a-stk', Finance: 'a-fin', Performance: 'a-perf' }[cat] || 'a-inv'); }

onMounted(load);
</script>

<template>
  <div class="exec-dash">
    <!-- Header + controls (laging nakikita) -->
    <div class="panel head">
      <div class="d-flex justify-content-between align-items-start">
        <div><div class="h5 mb-0 fw-bold">7A'M Operations</div><div class="muted sm">MULTI-LOCATION MANAGEMENT SYSTEM</div></div>
        <span class="chip green">Live dashboard</span>
      </div>
      <div class="mt-3">
        <div class="muted sm mb-1">LOCATION SELECTION</div>
        <select v-model="filters.location" class="ctl" @change="load">
          <option v-for="l in (data?.filters?.locations || ['All'])" :key="l" :value="l">{{ l }}</option>
        </select>
      </div>
      <div class="mt-2 d-flex align-items-center gap-2">
        <div class="muted sm" style="width:92px">REPORTING PERIOD</div>
        <select v-model="filters.period" class="ctl flex-grow-1" @change="load">
          <option v-for="p in (data?.filters?.periods || [])" :key="p.key" :value="p.key">{{ p.label }}</option>
        </select>
      </div>
      <div v-if="data" class="mt-3">
        <div class="muted sm">SELECTED OPERATING LOCATION</div>
        <div class="fw-bold">{{ data.locationInfo.name }}</div>
        <span class="chip green sm">{{ data.locationInfo.activeMachines }} Active Machines</span>
        <span class="muted sm ms-2">{{ data.locationInfo.totalMachines }} Total Machines</span>
      </div>
    </div>

    <div v-if="error" class="panel err">{{ error }}</div>
    <div v-if="loading" class="muted p-2">Loading…</div>

    <template v-if="data && !loading">
      <!-- Tab bar -->
      <div class="tabs">
        <button v-for="t in TABS" :key="t.key" class="tab" :class="{ active: activeTab === t.key }" @click="activeTab = t.key">{{ t.label }}</button>
      </div>

      <!-- 1. Executive -->
      <div class="panel" v-show="activeTab === 'exec'">
        <div class="sec">1. Executive performance overview</div>
        <div class="grid2">
          <div class="kpi"><div class="muted sm">Gross sales</div><div class="big green">{{ peso0(data.executive.grossSales) }}</div><div class="muted sm">{{ data.filters.periodLabel }}</div></div>
          <div class="kpi"><div class="muted sm">Net operating profit</div><div class="big" :class="data.executive.netOperatingProfit >= 0 ? 'green' : 'red'">{{ peso0(data.executive.netOperatingProfit) }}</div><div class="muted sm">After operating expenses</div></div>
          <div class="kpi"><div class="muted sm">COGS</div><div class="big">{{ peso0(data.executive.cogs) }}</div><div class="muted sm">Cost of goods sold</div></div>
          <div class="kpi"><div class="muted sm">Transactions</div><div class="big">{{ data.executive.transactions }}</div><div class="muted sm">Completed sales</div></div>
        </div>
        <div class="prof">
          <div class="prof-h">Profitability indicators</div>
          <div class="prow"><span>Gross profit</span><span class="fw-bold">{{ peso0(data.executive.grossProfit) }}</span></div>
          <div class="prow"><span>Gross margin</span><span class="fw-bold">{{ pct(data.executive.grossMargin) }}</span></div>
          <div class="prow"><span>Operating expenses</span><span class="fw-bold">{{ peso0(data.executive.operatingExpenses) }}</span></div>
          <div class="prow top"><span class="fw-bold">Net operating margin</span><span class="fw-bold green">{{ pct(data.executive.netOperatingMargin) }}</span></div>
        </div>
      </div>

      <!-- 2. Sales performance -->
      <div class="panel" v-show="activeTab === 'sales'">
        <div class="sec">2. Sales performance</div>
        <div class="muted sm mb-2">Daily sales trend · {{ data.locationInfo.name }}</div>
        <div class="chart-wrap" @mouseleave="hideTip">
          <svg viewBox="0 0 700 240" class="chart">
            <line v-for="(t,i) in trend.ticks" :key="'g'+i" :x1="52" :x2="688" :y1="t.y" :y2="t.y" class="grid" />
            <text v-for="(t,i) in trend.ticks" :key="'l'+i" :x="46" :y="t.y+3" class="axl" text-anchor="end">{{ shortP(t.v) }}</text>
            <g v-for="(b,i) in trend.bars" :key="'b'+i">
              <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" :fill="b.color" rx="4"
                    @mousemove="showTip($event, b.label, [{label:'Sales', val: peso(b.value)}])" />
              <text :x="b.x + b.w/2" :y="222" class="axl" text-anchor="middle">{{ b.label }}</text>
            </g>
          </svg>
          <div v-if="tip.show" class="tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
            <div class="tip-t">{{ tip.title }}</div>
            <div v-for="(r,i) in tip.rows" :key="i" class="tip-r"><span>{{ r.label }}</span><span>{{ r.val }}</span></div>
          </div>
        </div>
        <div class="legend"><span class="dot" style="background:#2e8bff"></span> Sales</div>
        <div class="prof mt-2">
          <div class="prof-h">Sales breakdown</div>
          <div class="prow"><span>Average transaction value</span><span class="fw-bold">{{ peso(data.sales.avgTransactionValue) }}</span></div>
          <div class="prow"><span>Units sold</span><span class="fw-bold">{{ data.sales.unitsSold }}</span></div>
          <div class="prow"><span>Sales per machine</span><span class="fw-bold">{{ peso(data.sales.salesPerMachine) }}</span></div>
        </div>
      </div>

      <!-- 3. Inventory -->
      <div class="panel" v-show="activeTab === 'inventory'">
        <div class="sec">3. Inventory management</div>
        <div class="grid2">
          <div class="kpi"><div class="muted sm">Inventory on hand</div><div class="big">{{ peso0(data.inventory.onHandValue) }}</div><div class="muted sm">Current stock value</div></div>
          <div class="kpi"><div class="muted sm">Low-stock products</div><div class="big orange">{{ data.inventory.lowStockCount }}</div><div class="muted sm">Require replenishment</div></div>
          <div class="kpi"><div class="muted sm">Stockout items</div><div class="big red">{{ data.inventory.stockoutCount }}</div><div class="muted sm">Potential lost sales</div></div>
          <div class="kpi"><div class="muted sm">Inventory turnover</div><div class="big muted">—</div><div class="muted sm">Requires historical data</div></div>
        </div>
        <button class="linkbtn mt-2" @click="showReplenish = !showReplenish">{{ showReplenish ? 'Hide' : 'Show' }} replenishment details {{ showReplenish ? '▲' : '▼' }}</button>
        <table v-if="showReplenish" class="tbl mt-2">
          <thead><tr><th>Product</th><th class="r">Stock</th><th class="r">Reorder level</th><th class="r">Action</th></tr></thead>
          <tbody>
            <tr v-for="(p,i) in data.inventory.replenishment" :key="i"><td>{{ p.product }}</td><td class="r">{{ p.stock }}</td><td class="r">{{ p.reorderLevel }}</td><td class="r"><span class="bdg" :class="badgeClass(p.action)">{{ p.action }}</span></td></tr>
            <tr v-if="!data.inventory.replenishment.length"><td colspan="4" class="muted">Walang produktong kulang sa stock.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 4. Cash recon -->
      <div class="panel" v-show="activeTab === 'cash'">
        <div class="sec">4. Cash and sales reconciliation</div>
        <div class="prow"><span>Recorded sales</span><span class="fw-bold">{{ peso0(data.cash.recordedSales) }}</span></div>
        <div class="prow"><span>Actual collections</span><span class="fw-bold">{{ peso0(data.cash.actualCollections) }}</span></div>
        <div class="prow top"><span>Collection variance</span><span class="fw-bold" :class="data.cash.variance < 0 ? 'red' : 'green'">{{ peso0(data.cash.variance) }}</span></div>
        <div class="mt-1">
          <span v-if="data.cash.hasReconData && data.cash.variance !== 0" class="bdg bdg-restock">For investigation</span>
          <span v-else-if="!data.cash.hasReconData" class="muted sm">Walang cash recon sa period — illustrative (recorded = actual).</span>
          <span v-else class="bdg bdg-normal">Matched</span>
        </div>
      </div>

      <!-- 5. Operating expenses -->
      <div class="panel" v-show="activeTab === 'expenses'">
        <div class="sec">5. Operating expense management</div>
        <template v-if="data.expenses.length">
          <div v-for="(e,i) in data.expenses" :key="i" class="exp">
            <div class="d-flex justify-content-between"><span>{{ e.category }}</span><span class="fw-bold">{{ peso0(e.amount) }}</span></div>
            <div class="bar-bg"><div class="bar-fill" :style="{ width: Math.min(100, (e.amount / data.expenses[0].amount) * 100) + '%' }"></div></div>
          </div>
        </template>
        <div v-else class="muted sm">Walang expense sa period na ito.</div>
      </div>

      <!-- 7. Location comparison -->
      <div class="panel" v-show="activeTab === 'location'">
        <div class="sec">7. Location comparison</div>
        <div class="muted sm mb-2">Sales at operating profit kada lokasyon</div>
        <div class="chart-wrap" @mouseleave="hideTip">
          <svg viewBox="0 0 700 240" class="chart">
            <line v-for="(t,i) in loc.ticks" :key="'lg'+i" :x1="52" :x2="688" :y1="t.y" :y2="t.y" class="grid" />
            <text v-for="(t,i) in loc.ticks" :key="'ll'+i" :x="46" :y="t.y+3" class="axl" text-anchor="end">{{ shortP(t.v) }}</text>
            <g v-for="(g,i) in loc.groups" :key="'lg2'+i"
               @mousemove="showTip($event, g.label, [{label:'Sales', val: peso(g.sales)},{label:'Operating profit', val: peso(g.operatingProfit)}])">
              <rect :x="g.s.x" :y="g.s.y" :width="g.s.w" :height="g.s.h" fill="#2e6bd6" rx="3" />
              <rect :x="g.p.x" :y="g.p.y" :width="g.p.w" :height="g.p.h" fill="#2e9e5b" rx="3" />
              <text :x="(g.s.x + g.p.x + g.p.w)/2" :y="222" class="axl" text-anchor="middle">{{ g.label }}</text>
            </g>
          </svg>
          <div v-if="tip.show" class="tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
            <div class="tip-t">{{ tip.title }}</div>
            <div v-for="(r,i) in tip.rows" :key="i" class="tip-r"><span>{{ r.label }}</span><span>{{ r.val }}</span></div>
          </div>
        </div>
        <div class="legend"><span class="dot" style="background:#2e6bd6"></span> Sales <span class="dot ms-3" style="background:#2e9e5b"></span> Operating profit</div>
      </div>

      <!-- 8. Alerts -->
      <div class="panel" v-show="activeTab === 'alerts'">
        <div class="sec">8. Management alerts and action center</div>
        <div class="alert-h">⚠ Operational attention</div>
        <div v-for="(a,i) in data.alerts" :key="i" class="al">
          <span class="bdg" :class="alertClass(a.category)">{{ a.category }}</span>
          <div><div class="fw-bold">{{ a.title }}</div><div class="muted sm">{{ a.detail }}</div></div>
        </div>
      </div>

      <div class="muted sm p-2">
        <strong>Mga tala:</strong>
        <div v-for="(n,i) in data.illustrativeNotes" :key="i">• {{ n }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.exec-dash { background:#0b0f14; margin:-1rem; padding:16px; min-height:100%; color:#e6edf3; }
.panel { background:#11161d; border:1px solid #1e2631; border-radius:12px; padding:16px; margin-bottom:14px; }
.panel.head { background:linear-gradient(180deg,#0f141b,#11161d); }
.panel.err { background:#2a1316; border-color:#5a1f25; color:#ff8a8a; }
.muted { color:#8b97a5; } .sm { font-size:.76rem; } .big { font-size:1.6rem; font-weight:700; line-height:1.2; }
.green { color:#36d47f; } .red { color:#ff5d5d; } .orange { color:#ff9f45; }
.sec { font-weight:700; font-size:1.02rem; margin-bottom:12px; }
.chip { background:#14361f; color:#36d47f; border-radius:20px; padding:3px 12px; font-size:.72rem; font-weight:600; }
.chip.sm { padding:2px 9px; }
.ctl { width:100%; background:#0c1016; color:#e6edf3; border:1px solid #273040; border-radius:10px; padding:9px 12px; font-size:.9rem; }
.tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:6px; margin-bottom:12px; }
.tab { white-space:nowrap; background:#11161d; color:#9aa7b5; border:1px solid #1e2631; border-radius:20px; padding:7px 14px; font-size:.82rem; font-weight:600; cursor:pointer; transition:all .12s; }
.tab:hover { color:#e6edf3; border-color:#2a3442; }
.tab.active { background:#14361f; color:#36d47f; border-color:#1f5c37; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.kpi { background:#0e131a; border:1px solid #1b2330; border-radius:10px; padding:14px; }
.prof { background:#171d26; border-radius:10px; padding:14px; margin-top:12px; }
.prof-h { font-weight:700; margin-bottom:8px; }
.prow { display:flex; justify-content:space-between; padding:6px 0; font-size:.9rem; }
.prow.top { border-top:1px solid #273040; margin-top:4px; padding-top:10px; }
.chart-wrap { position:relative; }
.chart { width:100%; height:auto; }
.grid { stroke:#1c2430; stroke-dasharray:3 3; }
.axl { fill:#7a8695; font-size:11px; }
.tip { position:absolute; background:#0b0f14; border:1px solid #2a3442; border-radius:8px; padding:7px 10px; font-size:.76rem; pointer-events:none; z-index:5; min-width:120px; }
.tip-t { font-weight:700; margin-bottom:3px; }
.tip-r { display:flex; justify-content:space-between; gap:12px; }
.legend { text-align:center; font-size:.78rem; color:#8b97a5; margin-top:6px; }
.dot { display:inline-block; width:9px; height:9px; border-radius:50%; vertical-align:middle; margin-right:4px; }
.linkbtn { background:#0e131a; border:1px solid #273040; color:#cdd7e1; border-radius:8px; padding:7px 12px; width:100%; font-size:.84rem; cursor:pointer; }
.tbl { width:100%; border-collapse:collapse; font-size:.84rem; }
.tbl th, .tbl td { padding:8px 6px; border-bottom:1px solid #1b2330; text-align:left; }
.tbl th { color:#8b97a5; font-weight:600; } .tbl .r { text-align:right; }
.bdg { border-radius:20px; padding:2px 10px; font-size:.7rem; font-weight:600; }
.bdg-urgent { background:#3a1620; color:#ff6b8a; } .bdg-restock { background:#3a2416; color:#ff9f45; } .bdg-normal { background:#14361f; color:#36d47f; }
.a-inv { background:#3a2416; color:#ff9f45; } .a-stk { background:#3a1620; color:#ff6b8a; } .a-fin { background:#3a2416; color:#ff9f45; } .a-perf { background:#14361f; color:#36d47f; }
.exp { margin-bottom:12px; }
.bar-bg { background:#1b2330; border-radius:6px; height:8px; margin-top:5px; overflow:hidden; }
.bar-fill { background:linear-gradient(90deg,#2e9e5b,#36d47f); height:100%; border-radius:6px; }
.alert-h { color:#ff9f45; font-weight:700; margin-bottom:10px; }
.al { display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-bottom:1px solid #1b2330; }
@media (max-width:560px){ .grid2 { grid-template-columns:1fr; } }
</style>
