export const APP_NAME = 'phase1-api';
export const APP_STATE_TABLE = 'app_state';
export const APP_STATE_ROW_ID = 'global';
export const BRANCH_TABLE_CANDIDATES = ['branches', 'erp_branches'];

export const INVENTORY_PERMISSION_KEYS = {
  LEVELS_VIEW: 'inventory.levels.view',
  ADJUSTMENTS_WRITE: 'inventory.adjustments.write',
  WASTE_WRITE: 'inventory.waste.write',
  RECIPES_VIEW: 'products.recipes.view',
  CONSUME_STOCK: 'orders.consume_stock',
  ALERTS_VIEW: 'inventory.alerts.low_stock.view',
};

export const PROCUREMENT_PERMISSION_KEYS = {
  SUPPLIERS_VIEW: 'suppliers.view',
  PURCHASE_ORDERS_CREATE: 'purchase_orders.create',
  PURCHASE_ORDERS_APPROVE: 'purchase_orders.approve',
  PURCHASE_ORDERS_RECEIVE: 'purchase_orders.receive',
  PURCHASE_ORDERS_STATUS_VIEW: 'purchase_orders.status.view',
  SUPPLIERS_PRICE_HISTORY_VIEW: 'suppliers.price_history.view',
};

export const FINANCE_PERMISSION_KEYS = {
  CASH_SESSIONS_OPEN: 'cash.sessions.open',
  CASH_SESSIONS_CLOSE: 'cash.sessions.close',
  EXPENSES_CREATE: 'expenses.create',
  REFUNDS_REQUEST: 'refunds.request',
  REFUNDS_APPROVE: 'refunds.approve',
  DAILY_SUMMARY_VIEW: 'finance.daily_summary.view',
  EXPORT_VIEW: 'finance.export.view',
};

export const WORKFORCE_PERMISSION_KEYS = {
  SHIFTS_CREATE: 'shifts.create',
  ATTENDANCE_CHECK_IN: 'attendance.check_in',
  ATTENDANCE_CHECK_OUT: 'attendance.check_out',
  ATTENDANCE_TODAY_VIEW: 'attendance.today.view',
  CHECKLISTS_COMPLETE: 'checklists.complete',
  INCIDENTS_CREATE: 'incidents.create',
  STAFF_KPIS_VIEW: 'staff.kpis.view',
};

export function toText(value) {
  return String(value ?? '').trim();
}

export function toObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

export function toNumber(value, fallback = Number.NaN) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function extractSingleResult(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

export function hasPermission(roleKey, permissionKeys, permissionKey) {
  if (roleKey === 'admin') return true;
  return permissionKeys.includes(permissionKey);
}

export function normalizeMovementType(rawMovementType, quantityDelta) {
  const safeType = toText(rawMovementType).toLowerCase();
  if (safeType) return safeType;
  return quantityDelta >= 0 ? 'adjustment_in' : 'adjustment_out';
}

export function parseBooleanFlag(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return defaultValue;
}

export function mapInventoryErrorMessage(rawMessage) {
  const safeMessage = String(rawMessage || 'Inventory error');

  if (safeMessage.includes('INV_ERR_INSUFFICIENT_STOCK')) {
    return 'Insufficient stock for this movement.';
  }

  if (safeMessage.includes('INV_ERR_ORDER_NOT_FOUND')) {
    return 'Order not found for stock consumption.';
  }

  if (safeMessage.includes('INV_ERR_ORDER_NOT_SERVED')) {
    return 'Order must be in served status before stock consumption.';
  }

  if (safeMessage.includes('INV_ERR_ZERO_DELTA')) {
    return 'Adjustment delta cannot be zero.';
  }

  if (safeMessage.includes('inventory_apply_movement')) {
    return 'Inventory movement function is missing. Apply Phase 2 migration first.';
  }

  if (safeMessage.includes('consume_stock_for_order')) {
    return 'Consume-stock function is missing. Apply Phase 2 migration first.';
  }

  return safeMessage;
}

export function hasBranchAccess(branchId, roleKey, branchAccess) {
  const safeBranchId = toText(branchId);
  if (!safeBranchId) return false;
  if (roleKey === 'admin' || roleKey === 'manager') return true;

  return (branchAccess || [])
    .map((entry) => toText(entry.branchId))
    .filter(Boolean)
    .includes(safeBranchId);
}

export function toPositiveInteger(value) {
  const parsed = Math.trunc(toNumber(value, Number.NaN));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function toIsoDate(value) {
  const safeValue = toText(value);
  if (!safeValue) return null;

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function toIsoTimestamp(value, fallbackIso = null) {
  const safeValue = toText(value);
  if (!safeValue) return fallbackIso;

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
}

export function generateNumber(prefix) {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .replaceAll('.', '')
    .slice(0, 14);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${stamp}-${random}`;
}

export function calculateDateDifferenceInDays(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const msInDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / msInDay));
}

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function toStartOfDayIso(dateValue) {
  const safeDate = toIsoDate(dateValue) || getTodayIsoDate();
  return `${safeDate}T00:00:00.000Z`;
}

export function toEndOfDayIso(dateValue) {
  const safeDate = toIsoDate(dateValue) || getTodayIsoDate();
  return `${safeDate}T23:59:59.999Z`;
}

export function toCsvCell(value) {
  const text = String(value ?? '');
  if (!text.includes(',') && !text.includes('"') && !text.includes('\n')) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((header) => toCsvCell(row[header]));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export async function writeAuditLog({ actorUserId, action, entityType = null, entityId = null, metadata = {} }) {
  const { adminClient } = await import('./supabase.js');
  const payload = {
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: toObject(metadata),
  };

  const { error } = await adminClient
    .from('audit_logs')
    .insert(payload);

  if (error) {
    console.warn(`[${APP_NAME}] audit log insert failed for action ${action}: ${error.message}`);
  }
}

export async function getAppSettings() {
  const { adminClient } = await import('./supabase.js');
  try {
    const { data, error } = await adminClient
      .from(APP_STATE_TABLE)
      .select('settings')
      .eq('id', APP_STATE_ROW_ID)
      .maybeSingle();

    if (error) return {};
    return toObject(data?.settings);
  } catch {
    return {};
  }
}

export async function isInventoryModuleEnabled() {
  const settings = await getAppSettings();
  return settings.showInventoryModule === true;
}

export async function getOpenCashSessionForBranch(branchId) {
  const { adminClient } = await import('./supabase.js');
  const safeBranchId = toText(branchId);
  if (!safeBranchId) return null;

  const { data, error } = await adminClient
    .from('cash_sessions')
    .select('*')
    .eq('branch_id', safeBranchId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read open cash session: ${error.message}`);
  }

  return data || null;
}

export async function getApprovedRefundTotalForPayment(paymentId) {
  const { adminClient } = await import('./supabase.js');
  const safePaymentId = toPositiveInteger(paymentId);
  if (!safePaymentId) return 0;

  const { data, error } = await adminClient
    .from('refunds')
    .select('approved_amount, requested_amount, status')
    .eq('payment_id', safePaymentId)
    .eq('status', 'approved');

  if (error) {
    throw new Error(`Unable to read approved refunds: ${error.message}`);
  }

  return (data || []).reduce((sum, row) => {
    const amount = toNumber(row.approved_amount, Number.NaN);
    if (Number.isFinite(amount) && amount >= 0) {
      return sum + amount;
    }
    return sum + Math.max(0, toNumber(row.requested_amount, 0));
  }, 0);
}

export function normalizeIncidentSeverity(rawSeverity) {
  const safeSeverity = toText(rawSeverity).toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(safeSeverity)) {
    return safeSeverity;
  }
  return 'medium';
}

export function calculatePerformanceScore(kpiRow) {
  const served = Math.max(0, toNumber(kpiRow.orders_served, 0));
  const handled = Math.max(0, toNumber(kpiRow.orders_handled, 0));
  const cancelled = Math.max(0, toNumber(kpiRow.orders_cancelled, 0));
  const attendanceMinutes = Math.max(0, toNumber(kpiRow.attendance_minutes, 0));
  const checklists = Math.max(0, toNumber(kpiRow.checklists_completed, 0));
  const incidents = Math.max(0, toNumber(kpiRow.incidents_reported, 0));
  const lateArrivals = Math.max(0, toNumber(kpiRow.late_arrivals, 0));

  const productivity = served * 2 + (handled - served) * 0.5;
  const reliability = Math.min(20, attendanceMinutes / 30);
  const discipline = checklists * 1.5;
  const penalties = cancelled * 1.5 + incidents * 2 + lateArrivals * 2.5;

  const score = productivity + reliability + discipline - penalties;
  return Number(Math.max(0, Math.min(100, score)).toFixed(2));
}

export async function upsertStaffKpiMetrics({ userId, branchId, kpiDate, deltas = {}, metadataPatch = {} }) {
  const { adminClient } = await import('./supabase.js');
  const safeUserId = toText(userId);
  const safeBranchId = toText(branchId);
  const safeKpiDate = toIsoDate(kpiDate) || getTodayIsoDate();
  if (!safeUserId || !safeBranchId) return null;

  const { data: existingRow, error: existingError } = await adminClient
    .from('staff_kpis')
    .select('*')
    .eq('user_id', safeUserId)
    .eq('branch_id', safeBranchId)
    .eq('kpi_date', safeKpiDate)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Unable to read staff_kpis row: ${existingError.message}`);
  }

  const base = existingRow || {
    user_id: safeUserId,
    branch_id: safeBranchId,
    kpi_date: safeKpiDate,
    orders_handled: 0,
    orders_served: 0,
    orders_cancelled: 0,
    attendance_minutes: 0,
    checklists_completed: 0,
    incidents_reported: 0,
    late_arrivals: 0,
    performance_score: 0,
    metadata: {},
  };

  const next = {
    user_id: safeUserId,
    branch_id: safeBranchId,
    kpi_date: safeKpiDate,
    orders_handled: Math.max(0, Math.trunc(toNumber(base.orders_handled, 0) + toNumber(deltas.orders_handled, 0))),
    orders_served: Math.max(0, Math.trunc(toNumber(base.orders_served, 0) + toNumber(deltas.orders_served, 0))),
    orders_cancelled: Math.max(0, Math.trunc(toNumber(base.orders_cancelled, 0) + toNumber(deltas.orders_cancelled, 0))),
    attendance_minutes: Math.max(0, Math.trunc(toNumber(base.attendance_minutes, 0) + toNumber(deltas.attendance_minutes, 0))),
    checklists_completed: Math.max(0, Math.trunc(toNumber(base.checklists_completed, 0) + toNumber(deltas.checklists_completed, 0))),
    incidents_reported: Math.max(0, Math.trunc(toNumber(base.incidents_reported, 0) + toNumber(deltas.incidents_reported, 0))),
    late_arrivals: Math.max(0, Math.trunc(toNumber(base.late_arrivals, 0) + toNumber(deltas.late_arrivals, 0))),
    metadata: {
      ...(toObject(base.metadata)),
      ...(toObject(metadataPatch)),
    },
  };

  next.performance_score = calculatePerformanceScore(next);

  const { data: upsertedRow, error: upsertError } = await adminClient
    .from('staff_kpis')
    .upsert(next, { onConflict: 'user_id,branch_id,kpi_date' })
    .select('*')
    .single();

  if (upsertError) {
    throw new Error(`Unable to upsert staff_kpis row: ${upsertError.message}`);
  }

  return upsertedRow;
}
