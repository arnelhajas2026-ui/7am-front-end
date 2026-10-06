import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import AccountsView from '../views/AccountsView.vue';
import ApprovalsView from '../views/ApprovalsView.vue';
import ProductsView from '../views/ProductsView.vue';
import MachinesView from '../views/MachinesView.vue';
import CustomersView from '../views/CustomersView.vue';
import SuppliersView from '../views/SuppliersView.vue';
import SettingsView from '../views/SettingsView.vue';
import InventoryView from '../views/InventoryView.vue';
import SalesView from '../views/SalesView.vue';
import ReconciliationView from '../views/ReconciliationView.vue';
import ExpensesView from '../views/ExpensesView.vue';
import ReportsView from '../views/ReportsView.vue';
import BalanceSheetView from '../views/BalanceSheetView.vue';
import ChartOfAccountsView from '../views/ChartOfAccountsView.vue';
import CostCentersView from '../views/CostCentersView.vue';
import JournalEntryView from '../views/JournalEntryView.vue';
import GeneralLedgerView from '../views/GeneralLedgerView.vue';
import QuotationsView from '../views/QuotationsView.vue';
import SalesOrdersView from '../views/SalesOrdersView.vue';
import PaymentComparisonView from '../views/PaymentComparisonView.vue';
import CustomerLedgerView from '../views/CustomerLedgerView.vue';
import PurchasesView from '../views/PurchasesView.vue';
import TransfersView from '../views/TransfersView.vue';

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/products',  name: 'products',  component: ProductsView,  meta: { requiresAuth: true, module: 'inventory' } },
  { path: '/machines',  name: 'machines',  component: MachinesView,  meta: { requiresAuth: true, module: 'machineOps' } },
  { path: '/customers', name: 'customers', component: CustomersView, meta: { requiresAuth: true, module: 'sales' } },
  { path: '/suppliers', name: 'suppliers', component: SuppliersView, meta: { requiresAuth: true, module: 'purchases' } },
  { path: '/sales', name: 'sales', component: SalesView, meta: { requiresAuth: true, module: 'sales' } },
  { path: '/inventory', name: 'inventory', component: InventoryView, meta: { requiresAuth: true, module: 'inventory' } },
  { path: '/purchases', name: 'purchases', component: PurchasesView, meta: { requiresAuth: true, module: 'purchases' } },
  { path: '/transfers', name: 'transfers', component: TransfersView, meta: { requiresAuth: true, module: 'inventory' } },
  { path: '/reconciliation', name: 'reconciliation', component: ReconciliationView, meta: { requiresAuth: true, module: 'reconciliation' } },
  { path: '/expenses', name: 'expenses', component: ExpensesView, meta: { requiresAuth: true, module: 'expenses' } },
  { path: '/reports', name: 'reports', component: ReportsView, meta: { requiresAuth: true, module: 'reports' } },
  { path: '/balance-sheet', name: 'balancesheet', component: BalanceSheetView, meta: { requiresAuth: true, module: 'reports' } },
  { path: '/coa', name: 'coa', component: ChartOfAccountsView, meta: { requiresAuth: true, module: 'accounting' } },
  { path: '/cost-centers', name: 'costcenters', component: CostCentersView, meta: { requiresAuth: true, module: 'accounting' } },
  { path: '/journal', name: 'journal', component: JournalEntryView, meta: { requiresAuth: true, module: 'accounting' } },
  { path: '/general-ledger', name: 'generalledger', component: GeneralLedgerView, meta: { requiresAuth: true, module: 'accounting' } },
  { path: '/quotations', name: 'quotations', component: QuotationsView, meta: { requiresAuth: true, module: 'sales' } },
  { path: '/sales-orders', name: 'salesorders', component: SalesOrdersView, meta: { requiresAuth: true, module: 'sales' } },
  { path: '/payment-compare', name: 'paymentcompare', component: PaymentComparisonView, meta: { requiresAuth: true, module: 'sales' } },
  { path: '/customer-ledger', name: 'customerledger', component: CustomerLedgerView, meta: { requiresAuth: true, module: 'sales' } },
  { path: '/approvals', name: 'approvals', component: ApprovalsView, meta: { requiresAuth: true, ownerOnly: true } },
  { path: '/accounts',  name: 'accounts',  component: AccountsView,  meta: { requiresAuth: true, ownerOnly: true } },
  { path: '/settings',  name: 'settings',  component: SettingsView,  meta: { requiresAuth: true, ownerOnly: true } },
];

const router = createRouter({ history: createWebHistory(), routes });

// Helper: may access ba ang user sa isang module? (VIEW pataas)
function canAccessModule(auth, module) {
  if (auth.isOwner) return true;
  const lvl = auth.user?.permissions?.[module];
  return lvl && lvl !== 'NONE';
}

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login' };
  if (to.meta.ownerOnly && !(auth.isOwner || auth.isSuperadmin)) return { name: 'dashboard' };
  if (to.meta.module && !canAccessModule(auth, to.meta.module)) return { name: 'dashboard' };
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'dashboard' };
  return true;
});

export default router;
