<script setup>
import { computed } from 'vue';
import { BRAND } from '../constants/brand.js';

const props = defineProps({ doc: { type: Object, required: true } });
defineEmits(['close']);

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

// Punuin ang table hanggang 6 na row para tumulad sa pisikal na form.
const rows = computed(() => {
  const items = props.doc.items || [];
  const blanks = Math.max(0, 4 - items.length);
  return [...items, ...Array.from({ length: blanks }, () => null)];
});

function printDoc() { window.print(); }
</script>

<template>
  <div class="invoice-overlay">
    <div class="invoice-toolbar">
      <button class="btn btn-primary btn-sm" @click="printDoc">🖨 Print</button>
      <button class="btn btn-sm" style="background:#fff;border:1px solid #ccc" @click="$emit('close')">Close</button>
    </div>

    <div class="invoice-paper">
      <!-- Header -->
      <div class="inv-head">
        <img :src="BRAND.logo" class="inv-logo" alt="" onerror="this.style.display='none'" />
        <div class="inv-company">
          <div class="inv-name">{{ BRAND.name }}</div>
          <div>{{ BRAND.vatLine }}</div>
          <div v-for="(a,i) in BRAND.address" :key="i">{{ a }}</div>
          <div>{{ BRAND.proprietor }}</div>
        </div>
      </div>

      <div class="inv-titlerow">
        <div class="inv-title">{{ doc.title }}</div>
        <div class="inv-no">No. <b>{{ doc.docNo }}</b></div>
      </div>

      <div class="inv-checks">
        <label><span class="chk"></span> Cash Sales</label>
        <label><span class="chk"></span> Charge Sales</label>
        <div class="inv-date">Date: <u>{{ doc.date || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' }}</u></div>
      </div>

      <div class="inv-soldto">
        <div>SOLD TO: <u>{{ doc.customerName || '' }}</u></div>
        <div>REGISTERED NAME: <u>&nbsp;</u></div>
        <div>TIN: <u>&nbsp;</u></div>
        <div>BUSINESS ADDRESS: <u>&nbsp;</u></div>
      </div>

      <table class="inv-table">
        <thead>
          <tr><th>ITEM DESCRIPTION / NATURE OF SERVICE</th><th>QTY</th><th>UNIT PRICE</th><th>AMOUNT</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r,i) in rows" :key="i">
            <td>{{ r ? r.description : '' }}</td>
            <td class="num">{{ r ? r.qty : '' }}</td>
            <td class="num">{{ r ? peso(r.unitPrice) : '' }}</td>
            <td class="num">{{ r ? peso(r.amount) : '' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="inv-bottom">
        <div class="inv-note">"{{ BRAND.notInputTax }}"</div>
        <table class="inv-totals">
          <tbody>
            <tr><td>Total Sales</td><td class="num">{{ peso(doc.totalSales) }}</td></tr>
            <tr><td>Less Discount (SC/PWD/NAAC/MOV/SP)</td><td class="num">{{ peso(doc.discount) }}</td></tr>
            <tr><td>Less Withholding Tax</td><td class="num">{{ peso(doc.withholding) }}</td></tr>
            <tr class="grand"><td>TOTAL AMOUNT DUE</td><td class="num">{{ peso(doc.totalDue) }}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="inv-signrow">
        <div class="inv-footer">
          <div v-for="(f,i) in BRAND.footer" :key="i">{{ f }}</div>
        </div>
        <div class="inv-by">
          <div class="inv-byline"><span>By:</span><span class="line"></span></div>
          <div class="inv-bylabel">Cashier/Authorized Representative</div>
        </div>
      </div>
    </div>
  </div>
</template>
