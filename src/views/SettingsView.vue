<script setup>
import SystemUpdate from '../components/SystemUpdate.vue';
import { ref, onMounted, onUnmounted } from 'vue';
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

// --- Email (SMTP) ---
const smtpPass = ref('');          // bagong App Password lang (blangko = panatilihin ang naka-save)
const testing = ref(false);
const testMsg = ref('');

// --- Clear test data (danger zone) ---
const clearScope = ref('transactions');
const clearConfirm = ref('');
const clearing = ref(false);
const clearResult = ref(null);

async function clearTestData(){
  if (clearConfirm.value !== 'CLEAR') { error.value = 'I-type ang CLEAR para kumpirmahin.'; return; }
  const label = clearScope.value === 'everything'
    ? 'LAHAT — transactions, master data, AT accounting (GL, Journal Entries, Opening Balances, Fixed Assets). Ire-reset ang period lock'
    : clearScope.value === 'all'
      ? 'transactions AT master data (products, machines, customers, suppliers)'
      : 'lahat ng test transactions';
  if (!confirm(`Clear ${label}? Hindi na ito maibabalik. Ang Users, Settings, Chart of Accounts at Cost Centers ay mananatili.`)) return;
  clearing.value = true; error.value=''; clearResult.value=null;
  try {
    const { data } = await api.post('/admin/clear-test-data', { scope: clearScope.value, confirm: 'CLEAR' });
    clearResult.value = data; clearConfirm.value='';
  } catch(e){ error.value = e.response?.data?.message || 'Could not clear data.'; }
  finally { clearing.value=false; }
}

async function load(){
  loading.value=true; error.value='';
  try {
    const { data } = await api.get('/config');
    cfg.value = data.config;
    if(!cfg.value.smtp) cfg.value.smtp = { provider:'gmail', user:'', fromName:"7A'M Vending Machine Retailing", enabled:false, configured:false, host:'', port:587, secure:false };
    smtpPass.value = '';
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
      smtp: { ...cfg.value.smtp, pass: smtpPass.value || undefined },  // pass lang kung may bagong na-type
    };
    const { data } = await api.put('/config', payload);
    cfg.value = data.config;
    if(!cfg.value.smtp) cfg.value.smtp = { user:'', fromName:'', enabled:false, configured:false };
    smtpPass.value = ''; saved.value=true;
    setTimeout(()=>saved.value=false, 2500);
  } catch(e){ error.value = e.response?.data?.message || 'Could not save. (Owner only.)'; }
  finally { saving.value=false; }
}
async function testEmail(){
  testing.value=true; testMsg.value=''; error.value='';
  try { const { data } = await api.post('/config/test-email', {}); testMsg.value = `Test email sent to ${data.to}. I-check ang inbox.`; }
  catch(e){ error.value = e.response?.data?.message || 'SMTP test failed. I-check ang Gmail + App Password.'; }
  finally { testing.value=false; }
}
// --- Telegram notifications ---
const tg = ref({ enabled:false, connected:false, username:'', botUsername:'', triggers:{}, triggerKeys:[] });
const tgConnect = ref(null);
const tgBusy = ref('');
const TRIGGER_LABELS = { approval:'May bagong approval request', login:'May nag-login', purchase:'May bagong purchase (o import)', reimbursement:'May bagong reimbursement', priceAlert:'Nagbago ang unit cost (price review)' };
let tgPoll = null;
function stopTgPoll(){ if(tgPoll){ clearInterval(tgPoll); tgPoll=null; } }
function startTgPoll(){ stopTgPoll(); let tries=0;
  tgPoll = setInterval(async ()=>{ tries++; await loadTg();
    if(tg.value.connected){ tgConnect.value=null; stopTgPoll(); }
    else if(tries>=40){ stopTgPoll(); }   // ~2 min timeout
  }, 3000); }
async function loadTg(){ try { const { data } = await api.get('/telegram/status'); tg.value = data; } catch { /* non-admin / off */ } }
async function connectTg(){ tgBusy.value='connect'; error.value='';
  try { const { data } = await api.post('/telegram/connect'); tgConnect.value = data; startTgPoll(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not start connection.'; } finally { tgBusy.value=''; } }
async function refreshTg(){ await loadTg(); if(tg.value.connected) tgConnect.value=null; }
async function saveTriggers(){ tgBusy.value='triggers'; error.value='';
  try { await api.post('/telegram/triggers', { triggers: tg.value.triggers }); saved.value=true; setTimeout(()=>saved.value=false,1500); }
  catch(e){ error.value = e.response?.data?.message || 'Could not save triggers.'; } finally { tgBusy.value=''; } }
async function testTg(){ tgBusy.value='test'; error.value=''; testMsg.value='';
  try { await api.post('/telegram/test'); testMsg.value='Test notification sent — i-check ang Telegram.'; }
  catch(e){ error.value = e.response?.data?.message || 'Could not send test.'; } finally { tgBusy.value=''; } }
async function disconnectTg(){ if(!confirm('I-disconnect ang Telegram?')) return; tgBusy.value='disconnect'; error.value='';
  try { await api.post('/telegram/disconnect'); tgConnect.value=null; await loadTg(); }
  catch(e){ error.value = e.response?.data?.message || 'Could not disconnect.'; } finally { tgBusy.value=''; } }

onMounted(async ()=>{ await load(); await loadTg(); });
onUnmounted(stopTgPoll);
</script>

<template>
  <div>
    <h3 class="mb-1">Settings</h3>
    <p class="text-muted">Business-wide rules reused across pricing, VAT, and expenses.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="saved" class="alert alert-success py-2">Settings saved.</div>

    <div class="card mb-3"><div class="card-body">
      <p class="section-eyebrow mb-1">System Updates</p>
      <p class="text-muted small mb-3">Pindutin ang Update para makuha ang pinakabagong bersyon ng system.</p>
      <SystemUpdate />
    </div></div>

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

        <p class="section-eyebrow mt-4 mb-2">Controls</p>
        <div class="form-check mb-3">
          <input v-model="cfg.transferApprovalDelegated" type="checkbox" class="form-check-input" id="tfDelegate" />
          <label class="form-check-label" for="tfDelegate">Delegate transfer approval to staff (auto-approve)</label>
          <div class="text-muted small">Kapag naka-check, ang mga transfer ng staff ay <strong>agad na mako-Complete</strong> (gagalaw agad ang stock) nang hindi dumadaan sa iyong Approvals. Kapag naka-uncheck (default), <strong>kailangan ng approval mo</strong> bago gumalaw ang stock.</div>
        </div>

        <p class="section-eyebrow mt-4 mb-2">Email (for sending Quotations / Invoices)</p>
        <div v-if="cfg.smtp" class="row g-3">
          <div class="col-12 col-md-4"><label class="form-label">Provider</label>
            <select v-model="cfg.smtp.provider" class="form-select">
              <option value="gmail">Gmail</option><option value="yahoo">Yahoo Mail</option>
            </select></div>
          <div class="col-12 col-md-8"><label class="form-label">{{ cfg.smtp.provider==='yahoo' ? 'Yahoo email' : 'Gmail address' }}</label>
            <input v-model="cfg.smtp.user" type="email" class="form-control" :placeholder="cfg.smtp.provider==='yahoo' ? 'yourbusiness@yahoo.com' : 'yourbusiness@gmail.com'" /></div>
          <div class="col-12 col-md-6"><label class="form-label">App Password
            <span class="text-muted small">{{ cfg.smtp.configured ? '(naka-set na — iwanang blangko kung hindi babaguhin)' : '(hindi regular password)' }}</span></label>
            <input v-model="smtpPass" type="password" class="form-control" autocomplete="new-password" :placeholder="cfg.smtp.configured ? '•••••••••••• (naka-save na)' : 'App Password'" /></div>
          <div class="col-12 col-md-6"><label class="form-label">From name (display)</label>
            <input v-model="cfg.smtp.fromName" class="form-control" placeholder="7A'M Vending Machine Retailing" /></div>

          <div class="col-12"><div class="form-check">
            <input v-model="cfg.smtp.enabled" type="checkbox" class="form-check-input" id="smtpEn" />
            <label class="form-check-label" for="smtpEn">I-enable ang email sending</label></div></div>
        </div>
        <div class="text-muted small mt-1">
          <template v-if="cfg.smtp && cfg.smtp.provider==='yahoo'">Yahoo: kailangan ng <strong>App Password</strong> (hindi regular password). Gawa sa login.yahoo.com → Account Security → Generate app password.</template>
          <template v-else>Gmail: kailangan ng <strong>App Password</strong> (hindi regular password) + naka-ON na 2-Step Verification. Google Account → Security → App passwords.</template>
        </div>
        <div v-if="testMsg" class="alert alert-success py-2 mt-2 mb-0">{{ testMsg }}</div>

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save settings' }}</button>
          <button class="btn btn-ghost" :disabled="testing" @click="testEmail">{{ testing ? 'Testing…' : 'Send test email' }}</button>
        </div>
      </div>
    </div>

    <!-- Telegram notifications -->
    <div class="card mt-4"><div class="card-body">
      <h5 class="mb-1" style="font-family:var(--font-display)">Telegram Notifications</h5>
      <p class="text-muted small mb-3">Makakatanggap ang admin ng notification sa Telegram para sa mga piniling event.</p>
      <div v-if="!tg.enabled" class="alert alert-warning py-2 mb-0">Hindi pa naka-setup ang Telegram bot sa server (<code>TELEGRAM_BOT_TOKEN</code>). Tingnan ang setup notes.</div>
      <template v-else>
        <div v-if="tg.connected" class="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span class="badge bg-success">Connected</span>
          <span class="text-muted">{{ tg.username }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="tgBusy==='test'" @click="testTg">Send test</button>
          <button class="btn btn-ghost btn-sm" :disabled="tgBusy==='disconnect'" @click="disconnectTg">Disconnect</button>
        </div>
        <div v-else class="mb-3">
          <button class="btn btn-primary btn-sm" :disabled="tgBusy==='connect'" @click="connectTg">{{ tgBusy==='connect'?'…':'Connect Telegram' }}</button>
          <div v-if="tgConnect" class="mt-2 p-3" style="background:#F2F5F8;border-radius:10px;max-width:520px">
            <div class="small mb-1">1. Buksan ang bot sa Telegram:
              <a v-if="tgConnect.link" :href="tgConnect.link" target="_blank" rel="noopener"><strong>{{ tgConnect.botUsername ? '@'+tgConnect.botUsername : 'Open bot' }}</strong></a>
              <span v-else class="text-muted">(i-set muna ang TELEGRAM_BOT_USERNAME sa server)</span></div>
            <div class="small mb-1">2. Pindutin ang <strong>Start</strong> sa bot (awtomatikong ipapadala ang code), o i-type: <code>/start {{ tgConnect.code }}</code></div>
            <div v-if="tgConnect.webhookSet===false" class="small mb-2" style="color:#B9770E">⚠ Hindi pa naka-register ang webhook — i-set ang <code>API_BASE_URL</code> sa server (tingnan ang notes).</div>
            <div class="small d-flex align-items-center gap-2 mt-1" style="color:#2B78C5">
              <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              Hinihintay ang connection… awtomatikong mag-uupdate kapag pinindot mo ang Start.
            </div>
            <button class="btn btn-ghost btn-sm mt-1" @click="refreshTg">I-check ngayon</button>
          </div>
        </div>
        <p class="section-eyebrow mb-2">Aling notifications ang gusto mong matanggap?</p>
        <div class="form-check" v-for="k in tg.triggerKeys" :key="k">
          <input class="form-check-input" type="checkbox" :id="'tg-'+k" v-model="tg.triggers[k]" :disabled="!tg.connected" />
          <label class="form-check-label" :for="'tg-'+k">{{ TRIGGER_LABELS[k] || k }}</label>
        </div>
        <button class="btn btn-primary btn-sm mt-2" :disabled="tgBusy==='triggers' || !tg.connected" @click="saveTriggers">I-save ang mga trigger</button>
      </template>
    </div></div>

    <!-- Danger zone: clear test data -->
    <div class="card mt-4" style="border-color:#F3C7C7">
      <div class="card-body">
        <p class="section-eyebrow mb-1" style="color:var(--bad)">Danger zone — Clear test data</p>
        <p class="text-muted small mb-3">Burahin ang mga test record para mag-fresh ulit para sa testing. Ang <strong>Users</strong> at <strong>Settings</strong> ay HINDI mabubura. Hindi na ito maibabalik.</p>
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-6">
            <label class="form-label">Ano ang bubura</label>
            <select v-model="clearScope" class="form-select">
              <option value="transactions">Transactions lang (panatilihin ang products, machines, customers, suppliers)</option>
              <option value="all">Lahat — transactions + master data</option>
              <option value="everything">Everything incl. accounting — + GL, Journal Entries, Opening Balances, Fixed Assets (fully fresh)</option>
            </select>
            <p v-if="clearScope==='everything'" class="text-muted small mt-1 mb-0">
              ⚠ Buburahin din ang buong General Ledger, lahat ng Journal Entries, Opening Balances, at Fixed Assets, at ire-reset ang period lock. Mananatili ang Chart of Accounts + Cost Centers (seeded), Users, at Settings.
            </p>
          </div>
          <div class="col-8 col-md-4"><label class="form-label">I-type ang CLEAR</label><input v-model="clearConfirm" class="form-control" placeholder="CLEAR" /></div>
          <div class="col-4 col-md-2"><button class="btn btn-danger7 w-100" :disabled="clearing || clearConfirm!=='CLEAR'" @click="clearTestData">{{ clearing ? 'Clearing…' : 'Clear' }}</button></div>
        </div>
        <div v-if="clearResult" class="alert alert-success py-2 mt-3 mb-0">
          Na-clear ang {{ clearResult.total }} record(s). Fresh na para sa testing.
          <span class="d-block small text-muted">{{ Object.entries(clearResult.cleared).filter(([,n])=>n>0).map(([k,n])=>k+': '+n).join(' · ') || 'Walang records na binura.' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
