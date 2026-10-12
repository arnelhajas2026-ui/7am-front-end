<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const d = ref(null);
const loading = ref(false);

const hour = new Date().getHours();
const greeting = computed(()=> hour<12?'Good morning':hour<18?'Good afternoon':'Good evening');
const today = new Date().toLocaleDateString('en-PH',{ weekday:'long', month:'long', day:'numeric', timeZone:'Asia/Manila' });

const emptyGroup = { items:[], total:0, overdue:0, count:0, alerts:0 };
async function load(){
  loading.value=true;
  try {
    const { data } = await api.get('/reports/dashboard');
    d.value = {
      kpi: { snacks:{}, machine:{} }, perMachine: [], topSelling: [], notSelling: [],
      stockAlert: { warehouse: 0, machine: 0, cabinet: 0, total: 0 }, lowWarehouse: [],
      payables: { machine:{...emptyGroup}, snacks:{...emptyGroup}, total:0, overdue:0 },
      receivable: { machine:{...emptyGroup}, snacks:{...emptyGroup}, total:0, overdue:0, count:0 },
      activeMachines: 0,
      ...data,
    };
  }
  catch { d.value = null; }  finally { loading.value=false; }
}

// Dalawang decimal places lahat (consistent appearance — hiling ni client).
const peso2 = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
const mdy = (dt)=> dt ? new Date(dt).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric',timeZone:'Asia/Manila'}) : '—';

// Sparkline path from spark[{date,total}]
function sparkPath(spark){
  if(!spark || spark.length<2) return '';
  const vals = spark.map(s=>s.total);
  const max = Math.max(1,...vals), min = Math.min(...vals);
  const w=90, h=26, span=max-min||1;
  return spark.map((s,i)=>{
    const x = (i/(spark.length-1))*w;
    const y = h - ((s.total-min)/span)*h;
    return (i===0?'M':'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}

// KPI tile definitions — iisang hanay ng metrics, ina-apply sa snacks at machine.
const KPI_FIELDS = [
  { key:'revenue', label:'Vending Revenue (YTD)' },
  { key:'cogs', label:'COGS (YTD)' },
  { key:'netProfit', label:'Net Profit (YTD)' },
  { key:'salesYesterday', label:'Sales (Yesterday)' },
  { key:'salesMTD', label:'Sales (Month-To-Date)' },
  { key:'inventoryValue', label:'Network Inventory Value' },
];

onMounted(load);
</script>

<template>
  <div>
    <div class="greet mb-3">
      <div class="eyebrow">{{ today }}</div>
      <h2>{{ greeting }}, {{ auth.user?.name }}</h2>
      <p class="sub mb-0">Network-wide performance across all machines.</p>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <template v-else-if="d">
      <!-- ===== KPI — Snacks & Drinks ===== -->
      <p class="kpi-band">Snacks &amp; Drinks</p>
      <div class="row g-3 mb-3">
        <div v-for="f in KPI_FIELDS" :key="'s-'+f.key" class="col-6 col-md-4 col-xl-2">
          <div class="tile">
            <div class="tlabel">{{ f.label }}</div>
            <div class="tval" :class="(d.kpi.snacks?.[f.key]||0)<0 && 'neg'">{{ peso2(d.kpi.snacks?.[f.key]) }}</div>
            <div class="tsub">Snacks &amp; Drinks</div>
          </div>
        </div>
      </div>

      <!-- ===== KPI — Selling of Machines ===== -->
      <p class="kpi-band">Selling of Machines</p>
      <div class="row g-3 mb-3">
        <div v-for="f in KPI_FIELDS" :key="'m-'+f.key" class="col-6 col-md-4 col-xl-2">
          <div class="tile">
            <div class="tlabel">{{ f.label }}</div>
            <div class="tval" :class="(d.kpi.machine?.[f.key]||0)<0 && 'neg'">{{ peso2(d.kpi.machine?.[f.key]) }}</div>
            <div class="tsub">Selling of Machines</div>
          </div>
        </div>
      </div>

      <div class="row g-3">
        <!-- ===== LEFT: per-machine + top/not selling ===== -->
        <div class="col-12 col-lg-8">
          <!-- Per-Machine Location Analytics -->
          <div class="card mb-3"><div class="card-body">
            <p class="section-eyebrow mb-2">Per-Machine Location Analytics</p>
            <div class="pm-scroll">
              <table class="pm-table">
                <thead>
                  <tr>
                    <th>Location</th><th>Sales trend</th><th class="r">COGS</th><th class="r">Op. Exp.</th>
                    <th class="r">Net Profit</th><th class="r">Inv. Value</th><th class="r">Last → Now</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in d.perMachine" :key="m._id">
                    <td><div class="fw-semibold">{{ m.locationName || m.machineId }}</div><div class="muted xs">{{ m.machineId }}</div></td>
                    <td>
                      <svg v-if="m.spark.length>1" width="90" height="26" class="spark">
                        <path :d="sparkPath(m.spark)" fill="none" stroke="var(--dawn-deep)" stroke-width="1.6" />
                      </svg>
                      <span v-else class="muted xs">—</span>
                    </td>
                    <td class="r">{{ peso2(m.cogs) }}</td>
                    <td class="r">{{ peso2(m.operatingExpenses) }}</td>
                    <td class="r fw-semibold" :class="m.netProfit<0 && 'neg'">{{ peso2(m.netProfit) }}</td>
                    <td class="r">{{ peso2(m.inventoryValue) }}</td>
                    <td class="r">
                      <span class="trend" :class="m.trend>0?'up':m.trend<0?'down':''">
                        {{ m.trend>0?'▲':m.trend<0?'▼':'—' }} {{ peso2(Math.abs(m.trend)) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!d.perMachine.length"><td colspan="7" class="text-center text-muted py-3">No machines yet.</td></tr>
                </tbody>
              </table>
            </div>
            <div class="muted xs mt-1">“Last → Now” = pagbabago ng benta ngayong buwan kumpara noong nakaraang buwan.</div>
          </div></div>

          <!-- Top Selling / Not Selling -->
          <div class="row g-3">
            <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
              <p class="section-eyebrow mb-2">Top Selling (2 weeks)</p>
              <div v-if="!d.topSelling.length" class="muted xs">No sales yet.</div>
              <div v-for="(p,i) in d.topSelling" :key="i" class="ts-row">
                <span class="rank">{{ i+1 }}</span>
                <span class="flex-grow-1">{{ p.name }}</span>
                <span class="fw-semibold">{{ p.qty }}<span class="muted xs"> pcs</span></span>
              </div>
            </div></div></div>
            <div class="col-12 col-md-6"><div class="card h-100"><div class="card-body">
              <p class="section-eyebrow mb-2" style="color:var(--bad)">Not Selling — replace</p>
              <p class="muted xs mb-2">No sales in the last 2 weeks.</p>
              <div v-if="!d.notSelling.length" class="muted xs">Everything is moving. 🎉</div>
              <div v-for="(p,i) in d.notSelling" :key="i" class="ts-row">
                <span class="flex-grow-1">{{ p.name }}</span>
                <span class="pill warn">0 sold</span>
              </div>
            </div></div></div>
          </div>
        </div>

        <!-- ===== RIGHT: stock + top expenses per location ===== -->
        <div class="col-12 col-lg-4">
          <!-- Overall Network Stock Alert -->
          <div class="card mb-3"><div class="card-body">
            <p class="section-eyebrow mb-2">Network Stock Alert</p>
            <div class="stock-grid">
              <div><div class="muted xs">Warehouse</div><div class="sv" :class="d.stockAlert.warehouse>0 && 'warn'">{{ d.stockAlert.warehouse }}</div></div>
              <div><div class="muted xs">Machine</div><div class="sv" :class="d.stockAlert.machine>0 && 'warn'">{{ d.stockAlert.machine }}</div></div>
              <div><div class="muted xs">Cabinet</div><div class="sv" :class="d.stockAlert.cabinet>0 && 'warn'">{{ d.stockAlert.cabinet }}</div></div>
            </div>
            <div class="muted xs mt-2">{{ d.stockAlert.total }} low-stock item(s) total</div>
          </div></div>

          <!-- Low stock per location -->
          <div class="card mb-3"><div class="card-body">
            <p class="section-eyebrow mb-2">Low Stock per Location</p>
            <template v-for="m in d.perMachine" :key="m._id">
              <div v-if="m.lowStock.length" class="mb-2">
                <div class="fw-semibold xs">{{ m.locationName || m.machineId }}</div>
                <div v-for="(it,i) in m.lowStock" :key="i" class="muted xs">· {{ it.name }} ({{ it.qty }} left)</div>
              </div>
            </template>
            <div v-if="!d.perMachine.some(m=>m.lowStock.length)" class="muted xs">All machines stocked. ✓</div>
          </div></div>

          <!-- Top Expenses per Machine/Location -->
          <div class="card"><div class="card-body">
            <p class="section-eyebrow mb-2">Top Expenses per Location (YTD)</p>
            <template v-for="m in d.perMachine" :key="'exp-'+m._id">
              <div v-if="m.topExpenses && m.topExpenses.length" class="mb-3">
                <div class="fw-semibold xs mb-1">{{ m.locationName || m.machineId }}</div>
                <div v-for="(e,i) in m.topExpenses" :key="i" class="d-flex justify-content-between xs exp-row">
                  <span>{{ e.category }}</span><span class="fw-semibold">{{ peso2(e.amount) }}</span>
                </div>
              </div>
            </template>
            <div v-if="!d.perMachine.some(m=>m.topExpenses && m.topExpenses.length)" class="muted xs">No machine-tagged expenses yet.</div>
          </div></div>
        </div>
      </div>

      <!-- ===== OUTSTANDING PAYABLES — Machine | Snacks/Drinks ===== -->
      <div class="row g-3 mt-1">
        <div class="col-12 col-md-6">
          <div class="card h-100" :class="d.payables.machine.overdue>0 && 'alert-border'"><div class="card-body">
            <p class="section-eyebrow mb-2">Outstanding Payables — Machine <span class="tagpill">MPO</span></p>
            <table class="ar-table">
              <thead><tr><th>Supplier Payable</th><th>Date Due</th><th class="r">Amount Due</th></tr></thead>
              <tbody>
                <tr v-for="(p,i) in d.payables.machine.items" :key="i">
                  <td>{{ p.ref }}</td>
                  <td>{{ mdy(p.dueDate) }} <span v-if="p.overdue" class="alrt od" title="Overdue">⚠</span><span v-else-if="p.upcoming" class="alrt up" title="Due within 5 days">⚠</span></td>
                  <td class="r">{{ peso2(p.amount) }}</td>
                </tr>
                <tr v-if="!d.payables.machine.items.length"><td colspan="3" class="muted xs py-2">No machine payables. ✓</td></tr>
              </tbody>
              <tfoot v-if="d.payables.machine.items.length"><tr><td colspan="2" class="fw-semibold">Total</td><td class="r fw-bold">{{ peso2(d.payables.machine.total) }}</td></tr></tfoot>
            </table>
          </div></div>
        </div>
        <div class="col-12 col-md-6">
          <div class="card h-100" :class="d.payables.snacks.overdue>0 && 'alert-border'"><div class="card-body">
            <p class="section-eyebrow mb-2">Outstanding Payables — Snacks/Drinks <span class="tagpill">SPO</span></p>
            <table class="ar-table">
              <thead><tr><th>Supplier Payable</th><th>Date Due</th><th class="r">Amount Due</th></tr></thead>
              <tbody>
                <tr v-for="(p,i) in d.payables.snacks.items" :key="i">
                  <td>{{ p.ref }}</td>
                  <td>{{ mdy(p.dueDate) }} <span v-if="p.overdue" class="alrt od" title="Overdue">⚠</span><span v-else-if="p.upcoming" class="alrt up" title="Due within 5 days">⚠</span></td>
                  <td class="r">{{ peso2(p.amount) }}</td>
                </tr>
                <tr v-if="!d.payables.snacks.items.length"><td colspan="3" class="muted xs py-2">No snacks payables. ✓</td></tr>
              </tbody>
              <tfoot v-if="d.payables.snacks.items.length"><tr><td colspan="2" class="fw-semibold">Total</td><td class="r fw-bold">{{ peso2(d.payables.snacks.total) }}</td></tr></tfoot>
            </table>
          </div></div>
        </div>
      </div>

      <!-- ===== ACCOUNTS RECEIVABLE — Machine | Snacks/Drinks (magkatabi) ===== -->
      <div class="row g-3 mt-1">
        <div class="col-12 col-md-6">
          <div class="card h-100" :class="d.receivable.machine.overdue>0 && 'alert-border'"><div class="card-body">
            <p class="section-eyebrow mb-2">Accounts Receivable — Machine <span class="tagpill">MSI</span></p>
            <table class="ar-table">
              <thead><tr><th>Accts. Rec.</th><th>Date Due</th><th class="r">Age</th><th class="r">Balance</th></tr></thead>
              <tbody>
                <tr v-for="(r,i) in d.receivable.machine.items" :key="i">
                  <td>{{ r.ref }}</td>
                  <td>{{ mdy(r.dueDate) }} <span v-if="r.overdue" class="alrt od" title="Overdue">⚠</span><span v-else-if="r.upcoming" class="alrt up" title="Due within 5 days">⚠</span></td>
                  <td class="r">{{ r.age }}</td>
                  <td class="r">{{ peso2(r.balance) }}</td>
                </tr>
                <tr v-if="!d.receivable.machine.items.length"><td colspan="4" class="muted xs py-2">No machine receivables. ✓</td></tr>
              </tbody>
              <tfoot v-if="d.receivable.machine.items.length"><tr><td colspan="3" class="fw-semibold">Total</td><td class="r fw-bold">{{ peso2(d.receivable.machine.total) }}</td></tr></tfoot>
            </table>
          </div></div>
        </div>
        <div class="col-12 col-md-6">
          <div class="card h-100" :class="d.receivable.snacks.overdue>0 && 'alert-border'"><div class="card-body">
            <p class="section-eyebrow mb-2">Accounts Receivable — Snacks/Drinks <span class="tagpill">SSI</span></p>
            <table class="ar-table">
              <thead><tr><th>Accts. Rec.</th><th>Date Due</th><th class="r">Age</th><th class="r">Balance</th></tr></thead>
              <tbody>
                <tr v-for="(r,i) in d.receivable.snacks.items" :key="i">
                  <td>{{ r.ref }}</td>
                  <td>{{ mdy(r.dueDate) }} <span v-if="r.overdue" class="alrt od" title="Overdue">⚠</span><span v-else-if="r.upcoming" class="alrt up" title="Due within 5 days">⚠</span></td>
                  <td class="r">{{ r.age }}</td>
                  <td class="r">{{ peso2(r.balance) }}</td>
                </tr>
                <tr v-if="!d.receivable.snacks.items.length"><td colspan="4" class="muted xs py-2">No snacks receivables. ✓</td></tr>
              </tbody>
              <tfoot v-if="d.receivable.snacks.items.length"><tr><td colspan="3" class="fw-semibold">Total</td><td class="r fw-bold">{{ peso2(d.receivable.snacks.total) }}</td></tr></tfoot>
            </table>
          </div></div>
        </div>
      </div>
    </template>
    <div v-else class="card"><div class="card-body text-muted text-center py-4">No data yet. Start with purchases and a sales import.</div></div>
  </div>
</template>

<style scoped>
.kpi-band { font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2); margin:0 0 .4rem; }
.tile { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:.8rem .9rem; box-shadow:var(--shadow-sm); height:100%; }
.tile .tlabel { font-size:.66rem; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--muted); }
.tile .tval { font-family:var(--font-display); font-weight:700; font-size:1.2rem; margin-top:.2rem; }
.tile .tval.neg { color:var(--bad); }
.tile .tsub { font-size:.62rem; color:var(--muted); margin-top:1px; }

.pm-scroll { overflow-x:auto; max-height:420px; overflow-y:auto; }
.pm-table { width:100%; border-collapse:collapse; font-size:.82rem; min-width:620px; }
.pm-table thead th { position:sticky; top:0; background:#F5F7FA; text-align:left; font-size:.66rem; text-transform:uppercase;
  letter-spacing:.03em; color:#3A4A5E; padding:.5rem .6rem; border-bottom:1px solid var(--line); }
.pm-table thead th.r { text-align:right; }
.pm-table tbody td { padding:.5rem .6rem; border-bottom:1px solid var(--line); vertical-align:middle; }
.pm-table tbody td.r { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.pm-table tbody tr:hover td { background:#FAFBFC; }
.spark { display:block; }
.muted { color:var(--muted); } .xs { font-size:.72rem; }
.neg { color:var(--bad); }
.trend.up { color:var(--good); font-weight:600; } .trend.down { color:var(--bad); font-weight:600; }

.ts-row { display:flex; align-items:center; gap:.5rem; padding:.35rem 0; border-bottom:1px solid var(--line); font-size:.85rem; }
.ts-row:last-child { border-bottom:none; }
.rank { width:18px; height:18px; border-radius:50%; background:var(--dawn-tint); color:var(--dawn-deep); font-size:.68rem; font-weight:700; display:flex; align-items:center; justify-content:center; }

.pill { font-size:.68rem; font-weight:700; padding:.1rem .5rem; border-radius:999px; background:#EAF0F8; color:var(--ink-2); }
.pill.warn { background:#FDECEC; color:var(--bad); }
.tagpill { font-size:.6rem; font-weight:800; letter-spacing:.05em; padding:.08rem .4rem; border-radius:6px; background:var(--dawn-tint); color:var(--dawn-deep); vertical-align:middle; }
.alert-border { border-color:#F3C7C7; }

.exp-row { padding:.15rem 0; }

/* AR / AP mini-tables */
.ar-table { width:100%; border-collapse:collapse; font-size:.82rem; }
.ar-table thead th { text-align:left; font-size:.64rem; text-transform:uppercase; letter-spacing:.03em; color:#3A4A5E; padding:.35rem .4rem; border-bottom:1px solid var(--line); }
.ar-table th.r { text-align:right; }
.ar-table tbody td { padding:.4rem .4rem; border-bottom:1px solid var(--line); vertical-align:middle; white-space:nowrap; }
.ar-table tbody td.r { text-align:right; font-variant-numeric:tabular-nums; }
.ar-table tfoot td { padding:.45rem .4rem; border-top:2px solid var(--ink); }
.ar-table tfoot td.r { text-align:right; font-variant-numeric:tabular-nums; }
.alrt { font-size:.82rem; } .alrt.od { color:var(--bad); } .alrt.up { color:var(--dawn-deep); }

.stock-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; text-align:center; }
.stock-grid .sv { font-family:var(--font-display); font-weight:700; font-size:1.3rem; }
.stock-grid .sv.warn { color:var(--bad); }
</style>
