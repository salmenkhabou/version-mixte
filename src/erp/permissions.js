export const ERP_ACTIONS = {
  CUSTOMER_ORDER_CREATE: 'customer.order.create',
  CUSTOMER_ORDER_TRACK: 'customer.order.track',
  ORDERS_STAFF_VIEW: 'orders.staff.view',
  ORDERS_STAFF_UPDATE: 'orders.staff.update_status',
  ORDERS_STAFF_ASSIGN: 'orders.staff.assign',
  ORDERS_MANAGER_VIEW: 'orders.manager.view',
  ORDERS_MANAGER_ANALYTICS: 'orders.manager.analytics',
  ORDERS_MANAGER_EXPORT: 'orders.manager.export',
  ORDERS_MANAGER_CASH_CLOSURE: 'orders.manager.cash_closure',
  ORDERS_MANAGER_STAFF_MANAGE: 'orders.manager.staff_manage',
  INVENTORY_LEVELS_VIEW: 'inventory.levels.view',
  INVENTORY_ADJUSTMENTS_WRITE: 'inventory.adjustments.write',
  INVENTORY_WASTE_WRITE: 'inventory.waste.write',
  PRODUCTS_RECIPES_VIEW: 'products.recipes.view',
  ORDERS_CONSUME_STOCK: 'orders.consume_stock',
  INVENTORY_ALERTS_VIEW: 'inventory.alerts.low_stock.view',
  SUPPLIERS_VIEW: 'suppliers.view',
  PURCHASE_ORDERS_CREATE: 'purchase_orders.create',
  PURCHASE_ORDERS_APPROVE: 'purchase_orders.approve',
  PURCHASE_ORDERS_RECEIVE: 'purchase_orders.receive',
  PURCHASE_ORDERS_STATUS_VIEW: 'purchase_orders.status.view',
  SUPPLIERS_PRICE_HISTORY_VIEW: 'suppliers.price_history.view',
  CASH_SESSIONS_OPEN: 'cash.sessions.open',
  CASH_SESSIONS_CLOSE: 'cash.sessions.close',
  EXPENSES_CREATE: 'expenses.create',
  REFUNDS_REQUEST: 'refunds.request',
  REFUNDS_APPROVE: 'refunds.approve',
  FINANCE_DAILY_SUMMARY_VIEW: 'finance.daily_summary.view',
  FINANCE_EXPORT_VIEW: 'finance.export.view',
  SHIFTS_CREATE: 'shifts.create',
  ATTENDANCE_CHECK_IN: 'attendance.check_in',
  ATTENDANCE_CHECK_OUT: 'attendance.check_out',
  ATTENDANCE_TODAY_VIEW: 'attendance.today.view',
  CHECKLISTS_COMPLETE: 'checklists.complete',
  INCIDENTS_CREATE: 'incidents.create',
  STAFF_KPIS_VIEW: 'staff.kpis.view',
  ADMIN_PANEL_VIEW: 'admin.panel.view',
  ADMIN_SETTINGS_WRITE: 'admin.settings.write',
  ADMIN_ARTICLES_WRITE: 'admin.articles.write',
  ADMIN_STAFF_MANAGE: 'admin.staff.manage',
  BRANCH_VIEW: 'branches.view',
  BRANCH_MANAGE: 'branches.manage',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  NOTIFICATIONS_PUBLISH: 'notifications.publish',
  OFFLINE_SYNC: 'offline.sync',
  ERP_CONTROL_VIEW: 'erp.control.view',
};

const ROLE_PERMISSION_MAP = {
  guest: [
    ERP_ACTIONS.CUSTOMER_ORDER_CREATE,
    ERP_ACTIONS.CUSTOMER_ORDER_TRACK,
  ],
  staff: [
    ERP_ACTIONS.CUSTOMER_ORDER_CREATE,
    ERP_ACTIONS.CUSTOMER_ORDER_TRACK,
    ERP_ACTIONS.ORDERS_STAFF_VIEW,
    ERP_ACTIONS.ORDERS_STAFF_UPDATE,
    ERP_ACTIONS.ORDERS_STAFF_ASSIGN,
    ERP_ACTIONS.INVENTORY_LEVELS_VIEW,
    ERP_ACTIONS.PRODUCTS_RECIPES_VIEW,
    ERP_ACTIONS.ORDERS_CONSUME_STOCK,
    ERP_ACTIONS.INVENTORY_ALERTS_VIEW,
    ERP_ACTIONS.SUPPLIERS_VIEW,
    ERP_ACTIONS.PURCHASE_ORDERS_CREATE,
    ERP_ACTIONS.PURCHASE_ORDERS_RECEIVE,
    ERP_ACTIONS.PURCHASE_ORDERS_STATUS_VIEW,
    ERP_ACTIONS.SUPPLIERS_PRICE_HISTORY_VIEW,
    ERP_ACTIONS.CASH_SESSIONS_OPEN,
    ERP_ACTIONS.EXPENSES_CREATE,
    ERP_ACTIONS.REFUNDS_REQUEST,
    ERP_ACTIONS.FINANCE_DAILY_SUMMARY_VIEW,
    ERP_ACTIONS.ATTENDANCE_CHECK_IN,
    ERP_ACTIONS.ATTENDANCE_CHECK_OUT,
    ERP_ACTIONS.ATTENDANCE_TODAY_VIEW,
    ERP_ACTIONS.CHECKLISTS_COMPLETE,
    ERP_ACTIONS.INCIDENTS_CREATE,
    ERP_ACTIONS.BRANCH_VIEW,
    ERP_ACTIONS.NOTIFICATIONS_MANAGE,
    ERP_ACTIONS.OFFLINE_SYNC,
    ERP_ACTIONS.ERP_CONTROL_VIEW,
  ],
  manager: [
    ERP_ACTIONS.CUSTOMER_ORDER_CREATE,
    ERP_ACTIONS.CUSTOMER_ORDER_TRACK,
    'orders.staff.*',
    'orders.manager.*',
    'inventory.*',
    'purchase_orders.*',
    'suppliers.*',
    'cash.sessions.*',
    'refunds.*',
    'finance.*',
    'attendance.*',
    'checklists.*',
    'incidents.*',
    'shifts.*',
    'staff.kpis.*',
    ERP_ACTIONS.PRODUCTS_RECIPES_VIEW,
    ERP_ACTIONS.ORDERS_CONSUME_STOCK,
    ERP_ACTIONS.PURCHASE_ORDERS_APPROVE,
    ERP_ACTIONS.CASH_SESSIONS_CLOSE,
    ERP_ACTIONS.EXPENSES_CREATE,
    ERP_ACTIONS.REFUNDS_REQUEST,
    ERP_ACTIONS.REFUNDS_APPROVE,
    ERP_ACTIONS.FINANCE_DAILY_SUMMARY_VIEW,
    ERP_ACTIONS.FINANCE_EXPORT_VIEW,
    ERP_ACTIONS.SHIFTS_CREATE,
    ERP_ACTIONS.ATTENDANCE_CHECK_IN,
    ERP_ACTIONS.ATTENDANCE_CHECK_OUT,
    ERP_ACTIONS.ATTENDANCE_TODAY_VIEW,
    ERP_ACTIONS.CHECKLISTS_COMPLETE,
    ERP_ACTIONS.INCIDENTS_CREATE,
    ERP_ACTIONS.STAFF_KPIS_VIEW,
    ERP_ACTIONS.BRANCH_VIEW,
    ERP_ACTIONS.BRANCH_MANAGE,
    ERP_ACTIONS.NOTIFICATIONS_MANAGE,
    ERP_ACTIONS.NOTIFICATIONS_PUBLISH,
    ERP_ACTIONS.OFFLINE_SYNC,
    ERP_ACTIONS.ERP_CONTROL_VIEW,
  ],
  admin: ['*'],
};

const KNOWN_ROLES = new Set(['guest', 'staff', 'manager', 'admin']);

export function normalizeAccessRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return KNOWN_ROLES.has(normalized) ? normalized : 'guest';
}

export function resolveRoleFromAccessProfile(profile) {
  const role = normalizeAccessRole(profile?.role);
  if (role !== 'guest') return role;

  if (profile?.isAdmin) return 'admin';
  if (profile?.isManager) return 'manager';
  if (profile?.isStaff) return 'staff';
  return 'guest';
}

export function getPermissionsForRole(role) {
  const normalized = normalizeAccessRole(role);
  return ROLE_PERMISSION_MAP[normalized] || ROLE_PERMISSION_MAP.guest;
}

function hasWildcardPermission(action, permissions) {
  return permissions.some((permission) => {
    if (permission === '*') return true;
    if (!permission.endsWith('.*')) return false;

    const prefix = permission.slice(0, -1);
    return action.startsWith(prefix);
  });
}

export function hasActionPermission(role, action) {
  const normalizedAction = String(action || '').trim();
  if (!normalizedAction) return false;

  const permissions = getPermissionsForRole(role);
  if (permissions.includes('*') || permissions.includes(normalizedAction)) {
    return true;
  }

  return hasWildcardPermission(normalizedAction, permissions);
}
