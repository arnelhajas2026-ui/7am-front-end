<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const data = ref(null);
const loading = ref(false);
const period = ref('month'); // 'month' | 'all'

const hour = new Date().getHours();
const greeting = computed(()=> hour<12?'Good morning':hour<18?'Good afternoon':'Good evening');
const today = new Date().toLocaleDateString('en-PH',{ weekday:'long', month:'long', day:'numeric', timeZone:'Asia/Manila' });

function range(){
  if(period.value==='all') return {};
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  return { start };
}
async function load(){
  loading.value=true;
  try { const { data:d } = await api.get('/reports/dashboard', { params: range() }); data.value = d; }
  catch { data.value = null; }
  finally { loading.value=false; }
}
const peso = (n)=> '₱'+Number(n||0).toLocaleString('en-PH',{maximumFractionDigits:0});
const maxDay = computed(()=> Math.max(1, ...(data.value?.salesByDay||[]).map(d=>d.total)));
const expenseRows = computed(()=> Object.entries(data.value?.expensesByCategory||{}).sort((a,b)=>b[1]-a[1]));
const maxExp = computed(()=> Math.max(1, ...expenseRows.value.map(([,v])=>v)));

onMounted(load);
</script>

<template>
  <div>
    <div class="greet mb-4">
      <div class="eyebrow">{{ today }}</div>
      <h2>{{ greeting }}, {{ auth.user?.name }}</h2>
      <p class="sub mb-0">Here's how the business is doing.</p>
    </div>

    <div class="d-flex justify-content-end mb-3">
      <div class="seg">
        <button :class="{active: period==='month'}" @click="period='month'; load()">This month</button>
        <button :class="{active: period==='all'}" @click="period='all'; load()">All time</button>
      </div>
    </div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <template v-else-if="data">
      <!-- Stat tiles -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Revenue</div><div class="tval">{{ peso(data.totalRevenue) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Gross profit</div><div class="tval">{{ peso(data.grossProfit) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Net profit</div><div class="tval" :class="data.netProfit<0 && 'neg'">{{ peso(data.netProfit) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile"><div class="tlabel">Operating expenses</div><div class="tval">{{ peso(data.operatingExpenses) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Vending sales</div><div class="tval">{{ peso(data.vendingSales) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Machine sales</div><div class="tval">{{ peso(data.machineSales) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Active machines</div><div class="tval">{{ data.activeMachines }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Inventory value</div><div class="tval">{{ peso(data.inventoryValue) }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Low stock items</div><div class="tval" :class="data.lowStock>0 && 'warn'">{{ data.lowStock }}</div></div></div>
        <div class="col-6 col-lg-3"><div class="tile sm"><div class="tlabel">Cash variance</div><div class="tval" :class="data.cashVariance!==0 && 'warn'">{{ peso(data.cashVariance) }}</div></div></div>
      </div>

      <div class="row g-3">
        <!-- Sales chart -->
        <div class="col-12 col-lg-7">
          <div class="card h-100"><div class="card-body">
            <p class="section-eyebrow">Sales (recent days)</p>
            <div v-if="!data.salesByDay.length" class="text-muted small py-4 text-center">No sales in this period.</div>
            <div v-else class="bars">
              <div v-for="d in data.salesByDay" :key="d.date" class="bar-col">
                <div class="bar" :style="{ height: (d.total/maxDay*100)+'%' }" :title="peso(d.total)"></div>
                <div class="bar-label">{{ d.date.slice(5) }}</div>
              </div>
            </div>
          </div></div>
        </div>
        <!-- Expenses by category -->
        <div class="col-12 col-lg-5">
          <div class="card h-100"><div class="card-body">
            <p class="section-eyebrow">Top expenses</p>
            <div v-if="!expenseRows.length" class="text-muted small py-4 text-center">No expenses in this period.</div>
            <div v-for="[cat,val] in expenseRows" :key="cat" class="mb-2">
              <div class="d-flex justify-content-between small mb-1"><span>{{ cat }}</span><span class="numeric fw-semibold">{{ peso(val) }}</span></div>
              <div class="track"><div class="fill" :style="{ width:(val/maxExp*100)+'%' }"></div></div>
            </div>
          </div></div>
        </div>
      </div>
    </template>
    <div v-else class="card"><div class="card-body text-muted text-center py-4">No data yet. Start with purchases and a sales import.</div></div>
  </div>
</template>
