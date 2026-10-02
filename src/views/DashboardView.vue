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

async function load(){
  loading.value=true;
  try {
    const { data } = await api.get('/reports/dashboard');
    // Safe defaults — iwas crash kung may kulang sa sagot (hal. lumang backend).
    d.value = {
      kpi: {}, perMachine: [], topSelling: [], notSelling: [], topExpenses: [],
      stockAlert: { warehouse: 0, machine: 0, cabinet: 0, total: 0 }, lowWarehouse: [],
      payables: { total: 0, overdue: 0, items: [] },
      receivable: { total: 0, overdue: 0, count: 0 }, activeMachines: 0,
      ...data,
    };
  }
  catch { d.value = null; }  finally { loading.value=false; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{maximumFractionDigits:0});
const peso2 = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2});

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
const maxExp = computed(()=> Math.max(1, ...(d.value?.topExpenses||[]).map(e=>e.amount)));

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
      <!-- ===== KPI ROW ===== -->
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Vending Revenue (YTD)</div><div class="tval">{{ peso(d.kpi.vendingRevenueYTD) }}</div><div class="tsub">snacks &amp; drinks</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Machine Sales (YTD)</div><div class="tval">{{ peso(d.kpi.machineRevenueYTD) }}</div><div class="tsub">selling of machines</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Net Profit (YTD)</div><div class="tval" :class="d.kpi.netProfitYTD<0 && 'neg'">{{ peso(d.kpi.netProfitYTD) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Network Inventory Value</div><div class="tval">{{ peso(d.kpi.networkInventoryValue) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Sales Yesterday</div><div class="tval">{{ peso(d.kpi.salesYesterday) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Month-to-Date Sales</div><div class="tval">{{ peso(d.kpi.mtdSales) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Active Machines</div><div class="tval">{{ d.activeMachines }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Low-stock Items</div><div class="tval" :class="d.stockAlert.total>0 && 'warn'">{{ d.stockAlert.total }}</div></div></div>
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
                    <td class="r">{{ peso(m.cogs) }}</td>
                    <td class="r">{{ peso(m.operatingExpenses) }}</td>
                    <td class="r fw-semibold" :class="m.netProfit<0 && 'neg'">{{ peso(m.netProfit) }}</td>
                    <td class="r">{{ peso(m.inventoryValue) }}</td>
                    <td class="r">
                      <span class="trend" :class="m.trend>0?'up':m.trend<0?'down':''">
                        {{ m.trend>0?'▲':m.trend<0?'▼':'—' }} {{ peso(Math.abs(m.trend)) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="!d.perMachine.length"><td colspan="7" class="text-center text-muted py-3">No machines yet.</td></tr>
                </tbody>
              </table>
            </div>
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

        <!-- ===== RIGHT: alerts ===== -->
        <div class="col-12 col-lg-4">
          <!-- Outstanding Payables -->
          <div class="card mb-3" :class="d.payables.overdue>0 && 'alert-border'"><div class="card-body">
            <p class="section-eyebrow mb-2">Outstanding Payables</p>
            <div class="d-flex justify-content-between align-items-baseline">
              <span class="muted">Total owed to suppliers</span>
              <span class="fw-bold">{{ peso2(d.payables.total) }}</span>
            </div>
            <div v-if="d.payables.overdue>0" class="overdue-banner mt-2">
              ⚠️ Overdue: {{ peso2(d.payables.overdue) }} — needs attention
            </div>
            <div v-for="(p,i) in d.payables.items" :key="i" class="pay-row">
              <span class="flex-grow-1">{{ p.order }}</span>
              <span v-if="p.overdue" class="pill warn me-1">overdue</span>
              <span class="fw-semibold">{{ peso(p.balance) }}</span>
            </div>
            <div v-if="!d.payables.items.length" class="muted xs">No payables. ✓</div>
          </div></div>

          <!-- Accounts (Receivable) alert -->
          <div class="card mb-3" :class="d.receivable.overdue>0 && 'alert-border'"><div class="card-body">
            <p class="section-eyebrow mb-2">Accounts Alert (Receivable)</p>
            <div class="d-flex justify-content-between align-items-baseline">
              <span class="muted">{{ d.receivable.count }} customer order(s) unpaid</span>
              <span class="fw-bold">{{ peso2(d.receivable.total) }}</span>
            </div>
            <div v-if="d.receivable.overdue>0" class="overdue-banner mt-2">
              ⚠️ Overdue receivable: {{ peso2(d.receivable.overdue) }}
            </div>
            <div v-else class="muted xs mt-1">No overdue receivables.</div>
          </div></div>

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

          <!-- Top Expenses -->
          <div class="card"><div class="card-body">
            <p class="section-eyebrow mb-2">Top Expenses (YTD)</p>
            <div v-if="!d.topExpenses.length" class="muted xs">No expenses recorded.</div>
            <div v-for="(e,i) in d.topExpenses" :key="i" class="mb-2">
              <div class="d-flex justify-content-between xs mb-1"><span>{{ e.category }}</span><span class="fw-semibold">{{ peso(e.amount) }}</span></div>
              <div class="track"><div class="fill" :style="{ width:(e.amount/maxExp*100)+'%' }"></div></div>
            </div>
          </div></div>
        </div>
      </div>
    </template>
    <div v-else class="card"><div class="card-body text-muted text-center py-4">No data yet. Start with purchases and a sales import.</div></div>
  </div>
</template>

<style scoped>
.tile { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:.9rem 1rem; box-shadow:var(--shadow-sm); height:100%; }
.tile .tlabel { font-size:.7rem; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); }
.tile .tval { font-family:var(--font-display); font-weight:700; font-size:1.35rem; margin-top:.2rem; }
.tile.sm .tval { font-size:1.1rem; }
.tile .tval.neg { color:var(--bad); } .tile .tval.warn { color:var(--dawn-deep); }
.tile .tsub { font-size:.66rem; color:var(--muted); margin-top:1px; }

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
.pay-row { display:flex; align-items:center; gap:.4rem; padding:.3rem 0; border-bottom:1px solid var(--line); font-size:.82rem; }
.pay-row:last-child { border-bottom:none; }
.alert-border { border-color:#F3C7C7; }
.overdue-banner { background:#FDECEC; color:var(--bad); font-size:.76rem; font-weight:600; padding:.4rem .6rem; border-radius:8px; }

.stock-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; text-align:center; }
.stock-grid .sv { font-family:var(--font-display); font-weight:700; font-size:1.3rem; }
.stock-grid .sv.warn { color:var(--bad); }

.track { height:7px; background:#EEF2F7; border-radius:999px; overflow:hidden; }
.fill { height:100%; background:var(--ink); border-radius:999px; }
</style>
