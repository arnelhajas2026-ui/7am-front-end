<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api.js';
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';
import { MODULES, LEVELS, MODULE_LABELS } from '../constants/modules.js';

const auth = useAuthStore();
const router = useRouter();
const users = ref([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const showForm = ref(false);

const form = ref({ name: '', username: '', password: '', role: 'EMPLOYEE' });
const creating = ref(false);

// per-account UI state
const editId = ref(null);
const editForm = ref({ name: '', username: '' });
const pwId = ref(null);
const pwValue = ref('');

function initials(name) { return (name || '?').charAt(0).toUpperCase(); }
function flash(msg) { notice.value = msg; setTimeout(() => (notice.value = ''), 2500); }

async function loadUsers() {
  loading.value = true; error.value = '';
  try { const { data } = await api.get('/users'); users.value = data.users; }
  catch (err) { error.value = err.response?.data?.message || 'Could not load accounts.'; }
  finally { loading.value = false; }
}

async function createUser() {
  creating.value = true; error.value = '';
  try {
    await api.post('/users', form.value);
    form.value = { name: '', username: '', password: '', role: 'EMPLOYEE' };
    showForm.value = false; await loadUsers(); flash('Account created.');
  } catch (err) { error.value = err.response?.data?.message || 'Could not create the account.'; }
  finally { creating.value = false; }
}

function startEdit(user) { editId.value = user._id; editForm.value = { name: user.name, username: user.username }; pwId.value = null; }
async function saveEdit(user) {
  error.value = '';
  try {
    const { data } = await api.patch(`/users/${user._id}`, editForm.value);
    const i = users.value.findIndex((u) => u._id === user._id); if (i !== -1) users.value[i] = data.user;
    editId.value = null; flash('Account updated.');
  } catch (err) { error.value = err.response?.data?.message || 'Could not update account.'; }
}

function startPw(user) { pwId.value = user._id; pwValue.value = ''; editId.value = null; }
async function submitPw(user) {
  error.value = '';
  try {
    await api.patch(`/users/${user._id}/password`, { password: pwValue.value });
    pwId.value = null; pwValue.value = '';
    flash(`Password reset for ${user.name}.`);
  } catch (err) { error.value = err.response?.data?.message || 'Could not reset password.'; }
}

async function updatePermission(user, module, level) {
  try {
    const { data } = await api.patch(`/users/${user._id}/permissions`, { permissions: { [module]: level } });
    const i = users.value.findIndex((u) => u._id === user._id); if (i !== -1) users.value[i] = data.user;
  } catch (err) { error.value = err.response?.data?.message || 'Could not update access.'; }
}

async function toggleActive(user) {
  try {
    const { data } = await api.patch(`/users/${user._id}/active`, { active: !user.active });
    const i = users.value.findIndex((u) => u._id === user._id); if (i !== -1) users.value[i] = data.user;
  } catch (err) { error.value = err.response?.data?.message || 'Could not update the account.'; }
}

async function removeUser(user) {
  if (!confirm(`Delete the account "${user.name}"? This cannot be undone.`)) return;
  error.value = '';
  try {
    await api.delete(`/users/${user._id}`);
    users.value = users.value.filter((u) => u._id !== user._id); flash('Account deleted.');
  } catch (err) { error.value = err.response?.data?.message || 'Could not delete the account.'; }
}

const isSelf = (user) => auth.user?.id === user._id || auth.user?._id === user._id;

async function loginAs(user){
  error.value='';
  try { await auth.impersonate(user._id); router.push({ name: 'dashboard' }); }
  catch(err){ error.value = err.response?.data?.message || 'Could not login as this account.'; }
}

onMounted(loadUsers);
</script>

<template>
  <div>
    <div class="d-flex align-items-center justify-content-between mb-1">
      <h3 class="mb-0">Accounts</h3>
      <button class="btn btn-primary btn-sm" @click="showForm = !showForm">{{ showForm ? 'Close' : '+ New account' }}</button>
    </div>
    <p class="text-muted">Create team members, set access, reset passwords, or remove accounts.</p>

    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div v-if="notice" class="alert alert-success py-2">{{ notice }}</div>

    <!-- New account form -->
    <div v-if="showForm" class="card mb-4"><div class="card-body">
      <p class="section-eyebrow mb-3">New account</p>
      <div class="row g-2">
        <div class="col-12 col-md-6"><label class="form-label">Name</label><input v-model="form.name" class="form-control" placeholder="Full name" /></div>
        <div class="col-12 col-md-6"><label class="form-label">Username</label><input v-model="form.username" class="form-control" placeholder="e.g. maria" /></div>
        <div class="col-12 col-md-6"><label class="form-label">Password</label><input v-model="form.password" type="password" class="form-control" placeholder="Temporary password" /></div>
        <div class="col-12 col-md-6"><label class="form-label">Role</label>
          <select v-model="form.role" class="form-select"><option value="EMPLOYEE">Employee</option><option value="OWNER">Owner</option></select></div>
      </div>
      <button class="btn btn-primary mt-3" :disabled="creating" @click="createUser">{{ creating ? 'Creating…' : 'Create account' }}</button>
    </div></div>

    <div v-if="loading" class="text-muted">Loading…</div>

    <!-- Account cards -->
    <div v-for="user in users" :key="user._id" class="card mb-3"><div class="card-body">
      <div class="d-flex align-items-center gap-3 mb-3">
        <div class="avatar lg">{{ initials(user.name) }}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold" style="font-family:var(--font-display)">{{ user.name }}
            <span v-if="isSelf(user)" class="badge7 emp ms-1">You</span></div>
          <div class="text-muted small">@{{ user.username }}</div>
        </div>
        <div class="text-end">
          <span class="badge7" :class="user.role === 'OWNER' ? 'owner' : 'emp'">{{ user.role }}</span>
          <span v-if="!user.active" class="badge7 off ms-1">INACTIVE</span>
        </div>
      </div>

      <!-- Edit name/username -->
      <div v-if="editId === user._id" class="row g-2 mb-3">
        <div class="col-12 col-md-5"><label class="form-label">Name</label><input v-model="editForm.name" class="form-control form-control-sm" /></div>
        <div class="col-12 col-md-5"><label class="form-label">Username</label><input v-model="editForm.username" class="form-control form-control-sm" /></div>
        <div class="col-12 col-md-2 d-flex align-items-end gap-1">
          <button class="btn btn-primary btn-sm w-100" @click="saveEdit(user)">Save</button>
          <button class="btn btn-ghost btn-sm" @click="editId = null">×</button>
        </div>
      </div>

      <!-- Reset password -->
      <div v-if="pwId === user._id" class="row g-2 mb-3">
        <div class="col-8 col-md-6"><label class="form-label">New password</label>
          <input v-model="pwValue" type="text" class="form-control form-control-sm" placeholder="At least 4 characters" /></div>
        <div class="col-4 col-md-3 d-flex align-items-end gap-1">
          <button class="btn btn-primary btn-sm w-100" :disabled="!pwValue" @click="submitPw(user)">Set</button>
          <button class="btn btn-ghost btn-sm" @click="pwId = null">×</button>
        </div>
      </div>

      <!-- Permissions (employees only) -->
      <div v-if="user.role === 'OWNER'" class="access-chip" style="border-style:dashed">
        <span class="text-muted">Owner — full access to every module</span><span class="lvl EDIT">ALL</span>
      </div>
      <template v-else>
        <p class="section-eyebrow mb-2">Access per module</p>
        <div class="row g-2">
          <div v-for="mod in MODULES" :key="mod" class="col-12 col-sm-6 col-lg-4">
            <label class="form-label mb-1">{{ MODULE_LABELS[mod] }}</label>
            <select class="form-select form-select-sm" :value="user.permissions?.[mod] || 'NONE'"
                    @change="updatePermission(user, mod, $event.target.value)">
              <option v-for="lvl in LEVELS" :key="lvl" :value="lvl">{{ lvl }}</option>
            </select>
          </div>
        </div>
      </template>

      <!-- Actions -->
      <div class="mt-3 pt-3 border-top d-flex flex-wrap justify-content-end gap-2">
        <button v-if="auth.isSuperadmin && !isSelf(user)" class="btn btn-ink btn-sm" @click="loginAs(user)">Login as</button>
        <button class="btn btn-ghost btn-sm" @click="startEdit(user)">Edit</button>
        <button class="btn btn-ghost btn-sm" @click="startPw(user)">Reset password</button>
        <button v-if="!isSelf(user)" class="btn btn-sm" :class="user.active ? 'btn-ghost' : 'btn-ink'" @click="toggleActive(user)">
          {{ user.active ? 'Deactivate' : 'Activate' }}
        </button>
        <button v-if="!isSelf(user)" class="btn btn-sm btn-danger7" @click="removeUser(user)">Delete</button>
      </div>
    </div></div>
  </div>
</template>
