<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { fmtDate } from '../utils/datetime.js';

const auth = useAuthStore();
const state = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const notice = ref('');
const closeDate = ref('');
const unlockDate = ref('');

const isOwner = computed(() => auth.isOwner || auth.isSuperadmin);

async function load() {
  loading.value = true; error.value = '';
  try { const { data } = await api.get('/period/status'); state.value = data; }
  catch (e) { error.value = e.response?.data?.message || 'Could not load.'; }
  finally { loading.value = false; }
}
async function act(fn) {
  saving.value = true; error.value = ''; notice.value = '';
  try { await fn(); await load(); }
  catch (e) { error.value = e.response?.data?.message || 'Action failed.'; }
  finally { saving.value = false; }
}
function doClose() {
  if (!closeDate.value) { error.value = 'Piliin ang close date.'; return; }
  if (!confirm(`I-close ang libro hanggang ${closeDate.value}? Hindi na makakapag-post ng entry na nasa loob o bago ng petsang ito maliban kung i-unlock.`)) return;
  act(async () => { const { data } = await api.post('/period/close', { through: closeDate.value }); notice.value = `Closed through ${closeDate.value}.`; return data; });
}
function doUnlock() {
  if (!confirm('I-unlock ang period? Mababawasan ang proteksyon sa saradong buwan.')) return;
  act(async () => { await api.post('/period/unlock', { through: unlockDate.value || null, reason: 'Owner unlocked' }); notice.value = unlockDate.value ? `Unlocked back to ${unlockDate.value}.` : 'Fully unlocked.'; });
}
function toggleAuto() {
  act(async () => { await api.post('/period/auto-close', { enabled: !state.value.autoMonthEndClose }); });
}
onMounted(load);
</script>

<template>
  <div>
    <h3 class="mb-1">Period Close</h3>
    <p class="text-muted">Sinasara ang libro hanggang sa isang petsa — hindi na mababago ang mga entry doon. Owner lang ang pwedeng mag-close o mag-unlock.</p>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <div v-if="loading" class="text-muted">Loading…</div>
    <template v-else-if="state">
      <!-- Status -->
      <div class="card mb-3"><div class="card-body">
        <div class="d-flex flex-wrap gap-4">
          <div>
            <div class="section-eyebrow mb-1">Books closed through</div>
            <div class="h5 mb-0" style="font-family:var(--font-display)">
              <span v-if="state.booksClosedThrough">🔒 {{ fmtDate(state.booksClosedThrough) }}</span>
              <span v-else class="text-muted">Open — walang saradong period</span>
            </div>
          </div>
          <div>
            <div class="section-eyebrow mb-1">Opening balances</div>
            <div class="h5 mb-0" style="font-family:var(--font-display)">
              <span v-if="state.openingApproved" style="color:var(--good)">✓ Approved</span>
              <span v-else class="text-muted">Not yet approved</span>
            </div>
          </div>
        </div>
      </div></div>

      <div v-if="!isOwner" class="text-muted">Owner lang ang makakapag-close/unlock ng period.</div>

      <template v-else>
        <!-- Close -->
        <div class="card mb-3"><div class="card-body">
          <p class="section-eyebrow mb-2">Close a period</p>
          <p class="text-muted small mb-2">Piliin ang katapusan ng buwan na sasarhan (hal. 2026-01-31). Lahat ng petsang hanggang dito ay maka-lock.</p>
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div><label class="form-label">Close through</label><input v-model="closeDate" type="date" class="form-control" style="width:180px" /></div>
            <button class="btn btn-primary" :disabled="saving" @click="doClose">Close books</button>
          </div>
        </div></div>

        <!-- Unlock -->
        <div class="card mb-3"><div class="card-body">
          <p class="section-eyebrow mb-2">Unlock (owner approval)</p>
          <p class="text-muted small mb-2">Para makapag-edit ulit ng saradong buwan. Iwan na blanko ang petsa para alisin lahat ng lock.</p>
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div><label class="form-label">Unlock back to</label><input v-model="unlockDate" type="date" class="form-control" style="width:180px" /></div>
            <button class="btn btn-ghost" :disabled="saving" @click="doUnlock">Unlock</button>
          </div>
        </div></div>

        <!-- Auto toggle -->
        <div class="card"><div class="card-body d-flex align-items-center justify-content-between">
          <div>
            <div class="fw-semibold">Auto month-end close</div>
            <div class="text-muted small">Kapag naka-on, awtomatikong isasara ang natapos na buwan. (Kapag off, manual via button sa itaas.)</div>
          </div>
          <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" role="switch" :checked="state.autoMonthEndClose" :disabled="saving" @change="toggleAuto" style="width:3rem;height:1.5rem" />
          </div>
        </div></div>
      </template>
    </template>
  </div>
</template>
