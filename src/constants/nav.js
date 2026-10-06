// Isang source of truth para sa navigation + access mapping.
export const NAV = [
  { name: 'dashboard', label: 'Dashboard', icon: 'grid' },

  { name: 'sales',     label: 'Sales',     icon: 'receipt',  module: 'sales',      group: 'Operations' },
  { name: 'inventory', label: 'Inventory', icon: 'layers',   module: 'inventory',  group: 'Operations' },
  { name: 'purchases', label: 'Purchases', icon: 'cart',     module: 'purchases',  group: 'Operations' },
  { name: 'transfers', label: 'Transfers', icon: 'transfer', module: 'inventory',  group: 'Operations' },
  { name: 'reconciliation', label: 'Reconcile', icon: 'scale', module: 'reconciliation', group: 'Operations' },
  { name: 'expenses',  label: 'Expenses',  icon: 'wallet',  module: 'expenses',   group: 'Operations' },
  { name: 'reports',   label: 'Income Statement', icon: 'chart', module: 'reports', group: 'Insights' },
  { name: 'balancesheet', label: 'Balance Sheet', icon: 'scale', module: 'reports', group: 'Insights' },

  { name: 'coa',        label: 'Chart of Accounts', icon: 'book',    module: 'accounting', group: 'Accounting' },
  { name: 'costcenters',label: 'Cost Centers',      icon: 'target',  module: 'accounting', group: 'Accounting' },
  { name: 'journal',    label: 'Journal Entry',     icon: 'journal', module: 'accounting', group: 'Accounting' },
  { name: 'generalledger', label: 'General Ledger', icon: 'ledger',  module: 'accounting', group: 'Accounting' },
  { name: 'quotations',  label: 'Quotations',  icon: 'quote', module: 'sales', group: 'Machine Sales' },
  { name: 'salesorders', label: 'Sales Orders', icon: 'order', module: 'sales', group: 'Machine Sales' },
  { name: 'paymentcompare', label: 'Payment Compare', icon: 'exchange', module: 'sales', group: 'Machine Sales' },
  { name: 'customerledger', label: 'Customer Ledger', icon: 'ledger', module: 'sales', group: 'Machine Sales' },

  { name: 'products',  label: 'Products',  icon: 'box',    module: 'inventory',  group: 'Master Data' },
  { name: 'machines',  label: 'Machines',  icon: 'server', module: 'machineOps', group: 'Master Data' },
  { name: 'customers', label: 'Customers', icon: 'user',   module: 'sales',      group: 'Master Data' },
  { name: 'suppliers', label: 'Suppliers', icon: 'truck',  module: 'purchases',  group: 'Master Data' },

  { name: 'approvals', label: 'Approvals', icon: 'check',  ownerOnly: true,      group: 'Admin' },
  { name: 'accounts',  label: 'Accounts',  icon: 'users',  ownerOnly: true,      group: 'Admin' },
  { name: 'settings',  label: 'Settings',  icon: 'gear',   ownerOnly: true,      group: 'Admin' },
];
