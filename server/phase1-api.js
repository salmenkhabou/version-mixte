import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

const APP_NAME = 'phase1-api';
const PORT = Number(process.env.API_PORT || 8787);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('[phase1-api] Missing one or more required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const app = express();
const corsOrigins = String(process.env.API_CORS_ORIGIN || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

let cachedBranchTable = null;
const BRANCH_TABLE_CANDIDATES = ['branches', 'erp_branches'];
const APP_STATE_TABLE = 'app_state';
const APP_STATE_ROW_ID = 'global';

const INVENTORY_PERMISSION_KEYS = {
  LEVELS_VIEW: 'inventory.levels.view',
  ADJUSTMENTS_WRITE: 'inventory.adjustments.write',
  WASTE_WRITE: 'inventory.waste.write',
  RECIPES_VIEW: 'products.recipes.view',
  CONSUME_STOCK: 'orders.consume_stock',
  ALERTS_VIEW: 'inventory.alerts.low_stock.view',
};

const PROCUREMENT_PERMISSION_KEYS = {
  SUPPLIERS_VIEW: 'suppliers.view',
  PURCHASE_ORDERS_CREATE: 'purchase_orders.create',
  PURCHASE_ORDERS_APPROVE: 'purchase_orders.approve',
  PURCHASE_ORDERS_RECEIVE: 'purchase_orders.receive',
  PURCHASE_ORDERS_STATUS_VIEW: 'purchase_orders.status.view',
  SUPPLIERS_PRICE_HISTORY_VIEW: 'suppliers.price_history.view',
};

const FINANCE_PERMISSION_KEYS = {
  CASH_SESSIONS_OPEN: 'cash.sessions.open',
  CASH_SESSIONS_CLOSE: 'cash.sessions.close',
  EXPENSES_CREATE: 'expenses.create',
  REFUNDS_REQUEST: 'refunds.request',
  REFUNDS_APPROVE: 'refunds.approve',
  DAILY_SUMMARY_VIEW: 'finance.daily_summary.view',
  EXPORT_VIEW: 'finance.export.view',
};

const WORKFORCE_PERMISSION_KEYS = {
  SHIFTS_CREATE: 'shifts.create',
  ATTENDANCE_CHECK_IN: 'attendance.check_in',
  ATTENDANCE_CHECK_OUT: 'attendance.check_out',
  ATTENDANCE_TODAY_VIEW: 'attendance.today.view',
  CHECKLISTS_COMPLETE: 'checklists.complete',
  INCIDENTS_CREATE: 'incidents.create',
  STAFF_KPIS_VIEW: 'staff.kpis.view',
};

function toText(value) {
  return String(value ?? '').trim();
}

function toObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function toNumber(value, fallback = Number.NaN) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function extractSingleResult(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function hasPermission(roleKey, permissionKeys, permissionKey) {
  if (roleKey === 'admin') return true;
  return permissionKeys.includes(permissionKey);
}

function normalizeMovementType(rawMovementType, quantityDelta) {
  const safeType = toText(rawMovementType).toLowerCase();
  if (safeType) return safeType;
  return quantityDelta >= 0 ? 'adjustment_in' : 'adjustment_out';
}

function parseBooleanFlag(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return defaultValue;
}

function mapInventoryErrorMessage(rawMessage) {
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

function hasBranchAccess(branchId, roleKey, branchAccess) {
  const safeBranchId = toText(branchId);
  if (!safeBranchId) return false;
  if (roleKey === 'admin' || roleKey === 'manager') return true;

  return (branchAccess || [])
    .map((entry) => toText(entry.branchId))
    .filter(Boolean)
    .includes(safeBranchId);
}

function toPositiveInteger(value) {
  const parsed = Math.trunc(toNumber(value, Number.NaN));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toIsoDate(value) {
  const safeValue = toText(value);
  if (!safeValue) return null;

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toIsoTimestamp(value, fallbackIso = null) {
  const safeValue = toText(value);
  if (!safeValue) return fallbackIso;

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
}

function generateNumber(prefix) {
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

function calculateDateDifferenceInDays(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const msInDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / msInDay));
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toStartOfDayIso(dateValue) {
  const safeDate = toIsoDate(dateValue) || getTodayIsoDate();
  return `${safeDate}T00:00:00.000Z`;
}

function toEndOfDayIso(dateValue) {
  const safeDate = toIsoDate(dateValue) || getTodayIsoDate();
  return `${safeDate}T23:59:59.999Z`;
}

function toCsvCell(value) {
  const text = String(value ?? '');
  if (!text.includes(',') && !text.includes('"') && !text.includes('\n')) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((header) => toCsvCell(row[header]));
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

async function getOpenCashSessionForBranch(branchId) {
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

async function getApprovedRefundTotalForPayment(paymentId) {
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

function normalizeIncidentSeverity(rawSeverity) {
  const safeSeverity = toText(rawSeverity).toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(safeSeverity)) {
    return safeSeverity;
  }
  return 'medium';
}

function calculatePerformanceScore(kpiRow) {
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

async function upsertStaffKpiMetrics({ userId, branchId, kpiDate, deltas = {}, metadataPatch = {} }) {
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

function parseBearerToken(req) {
  const raw = String(req.headers.authorization || '');
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

function normalizeRole(rawRole) {
  const safeRole = toText(rawRole).toLowerCase();
  if (safeRole === 'admin') return 'admin';
  if (safeRole === 'manager') return 'manager';
  if (safeRole === 'staff') return 'staff';
  return 'guest';
}

async function resolveBranchTable() {
  if (cachedBranchTable) return cachedBranchTable;

  for (const candidate of BRANCH_TABLE_CANDIDATES) {
    const { error } = await adminClient
      .from(candidate)
      .select('id')
      .limit(1);

    if (!error) {
      cachedBranchTable = candidate;
      return cachedBranchTable;
    }

    const errorText = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    if (errorText.includes('does not exist') || errorText.includes('relation') || error?.code === '42P01') {
      continue;
    }

    throw new Error(`Unable to resolve branch table using candidate "${candidate}": ${error.message}`);
  }

  throw new Error('No branch table found. Expected one of: branches, erp_branches.');
}

async function getDefaultOrganizationId() {
  const { data, error } = await adminClient
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read organizations table: ${error.message}`);
  }

  if (data?.id) return data.id;

  const { data: inserted, error: insertError } = await adminClient
    .from('organizations')
    .insert({
      code: 'CORE',
      name: 'Core Organization',
      is_active: true,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Unable to create default organization: ${insertError.message}`);
  }

  return inserted.id;
}

async function ensureAppUser(user) {
  const userId = toText(user?.id);
  const email = toText(user?.email).toLowerCase();
  if (!userId || !email) return;

  const organizationId = await getDefaultOrganizationId();

  const { error: userError } = await adminClient
    .from('users')
    .upsert({
      id: userId,
      email,
      role_key: 'guest',
      organization_id: organizationId,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (userError) {
    throw new Error(`Unable to ensure app user row: ${userError.message}`);
  }

  const { error: profileError } = await adminClient
    .from('user_profiles')
    .upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (profileError) {
    throw new Error(`Unable to ensure user profile row: ${profileError.message}`);
  }
}

async function getRoleKey(userId) {
  const { data: appUser, error: appUserError } = await adminClient
    .from('users')
    .select('role_key')
    .eq('id', userId)
    .maybeSingle();

  if (!appUserError && appUser?.role_key) {
    return normalizeRole(appUser.role_key);
  }

  const { data: legacyAdmin, error: legacyAdminError } = await adminClient
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!legacyAdminError && legacyAdmin?.user_id) {
    return 'admin';
  }

  const { data: legacyStaff, error: legacyStaffError } = await adminClient
    .from('staff_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!legacyStaffError && legacyStaff) {
    if (normalizeRole(legacyStaff.role) === 'manager') return 'manager';
    return 'staff';
  }

  return 'guest';
}

async function getPermissionKeys(roleKey) {
  const { data, error } = await adminClient
    .from('role_permissions')
    .select('permission_key')
    .eq('role_key', roleKey);

  if (error) {
    throw new Error(`Unable to read role permissions: ${error.message}`);
  }

  const keys = [...new Set((data || []).map((row) => toText(row.permission_key)).filter(Boolean))];
  if (keys.length > 0) return keys.sort((a, b) => a.localeCompare(b));

  if (roleKey !== 'admin') return [];

  const { data: allData, error: allError } = await adminClient
    .from('permissions')
    .select('key');

  if (allError) {
    throw new Error(`Unable to read permissions: ${allError.message}`);
  }

  return [...new Set((allData || []).map((row) => toText(row.key)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

async function getOwnBranchAccess(userId) {
  const { data, error } = await adminClient
    .from('user_branch_access')
    .select('branch_id, role_key, is_default')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Unable to read user_branch_access: ${error.message}`);
  }

  return (data || []).map((row) => ({
    branchId: row.branch_id,
    role: normalizeRole(row.role_key),
    isDefault: Boolean(row.is_default),
  }));
}

async function getAllowedBranches(userId, roleKey) {
  const branchTable = await resolveBranchTable();
  const branchColumns = 'id, organization_id, code, name, timezone, is_active, created_at, updated_at';

  if (roleKey === 'admin' || roleKey === 'manager') {
    const { data, error } = await adminClient
      .from(branchTable)
      .select(branchColumns)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Unable to read branches: ${error.message}`);
    }

    return data || [];
  }

  const ownAccess = await getOwnBranchAccess(userId);
  const allowedBranchIds = ownAccess.map((entry) => entry.branchId).filter(Boolean);
  if (allowedBranchIds.length === 0) return [];

  const { data, error } = await adminClient
    .from(branchTable)
    .select(branchColumns)
    .in('id', allowedBranchIds)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Unable to read filtered branches: ${error.message}`);
  }

  return data || [];
}

async function writeAuditLog({ actorUserId, action, entityType = null, entityId = null, metadata = {} }) {
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

async function getAppSettings() {
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

async function isInventoryModuleEnabled() {
  const settings = await getAppSettings();
  return settings.showInventoryModule === true;
}

async function listAllBranchIds() {
  const branchTable = await resolveBranchTable();
  const { data, error } = await adminClient
    .from(branchTable)
    .select('id')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Unable to list branch ids: ${error.message}`);
  }

  return (data || []).map((row) => toText(row.id)).filter(Boolean);
}

async function resolveInventoryBranchIds({ requestedBranchId, roleKey, branchAccess }) {
  const safeRequestedBranchId = toText(requestedBranchId);
  const ownBranchIds = (branchAccess || [])
    .map((entry) => toText(entry.branchId))
    .filter(Boolean);

  if (safeRequestedBranchId) {
    if (roleKey === 'admin' || roleKey === 'manager') {
      const allBranchIds = await listAllBranchIds();
      if (!allBranchIds.includes(safeRequestedBranchId)) {
        throw new Error('Requested branch does not exist.');
      }
      return [safeRequestedBranchId];
    }

    if (ownBranchIds.includes(safeRequestedBranchId)) {
      return [safeRequestedBranchId];
    }

    throw new Error('Requested branch is not allowed for this user.');
  }

  if (roleKey === 'admin' || roleKey === 'manager') {
    const allBranchIds = await listAllBranchIds();
    return allBranchIds;
  }

  return ownBranchIds;
}

async function requireInventoryPermission(req, res, permissionKey) {
  const inventoryEnabled = await isInventoryModuleEnabled();
  if (!inventoryEnabled) {
    res.status(403).json({
      ok: false,
      message: 'Inventory module is disabled by admin settings.',
      module: 'inventory',
      enabled: false,
    });
    return null;
  }

  await ensureAppUser(req.user);

  const userId = req.user.id;
  const roleKey = await getRoleKey(userId);
  const permissionKeys = await getPermissionKeys(roleKey);
  const branchAccess = await getOwnBranchAccess(userId);

  if (!hasPermission(roleKey, permissionKeys, permissionKey)) {
    res.status(403).json({
      ok: false,
      message: `Missing required permission: ${permissionKey}`,
      role: roleKey,
    });
    return null;
  }

  return {
    userId,
    roleKey,
    permissionKeys,
    branchAccess,
  };
}

async function requireScopedPermission(req, res, permissionKey) {
  await ensureAppUser(req.user);

  const userId = req.user.id;
  const roleKey = await getRoleKey(userId);
  const permissionKeys = await getPermissionKeys(roleKey);
  const branchAccess = await getOwnBranchAccess(userId);

  if (!hasPermission(roleKey, permissionKeys, permissionKey)) {
    res.status(403).json({
      ok: false,
      message: `Missing required permission: ${permissionKey}`,
      role: roleKey,
    });
    return null;
  }

  return {
    userId,
    roleKey,
    permissionKeys,
    branchAccess,
  };
}

async function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Missing bearer token.' });
    }

    const { data, error } = await adminClient.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ ok: false, message: 'Invalid or expired bearer token.' });
    }

    req.authToken = token;
    req.user = data.user;
    return next();
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Auth validation failed.' });
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: APP_NAME,
    timestamp: new Date().toISOString(),
  });
});

app.get('/me/profile', requireAuth, async (req, res) => {
  try {
    await ensureAppUser(req.user);

    const userId = req.user.id;
    const roleKey = await getRoleKey(userId);

    const { data: appUser, error: appUserError } = await adminClient
      .from('users')
      .select('id, email, role_key, organization_id, is_active, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (appUserError) {
      throw new Error(`Unable to read users row: ${appUserError.message}`);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('user_id, display_name, phone, avatar_url, default_branch_id, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to read user profile: ${profileError.message}`);
    }

    const branchAccess = await getOwnBranchAccess(userId);
    const defaultBranchId = profile?.default_branch_id || branchAccess.find((entry) => entry.isDefault)?.branchId || null;

    return res.json({
      ok: true,
      profile: {
        userId,
        email: appUser?.email || req.user.email || null,
        role: roleKey,
        organizationId: appUser?.organization_id || null,
        isActive: appUser?.is_active ?? true,
        displayName: profile?.display_name || null,
        phone: profile?.phone || null,
        avatarUrl: profile?.avatar_url || null,
        defaultBranchId,
        branches: branchAccess,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load profile.' });
  }
});

app.get('/me/permissions', requireAuth, async (req, res) => {
  try {
    await ensureAppUser(req.user);

    const userId = req.user.id;
    const roleKey = await getRoleKey(userId);
    const permissions = await getPermissionKeys(roleKey);
    const branchAccess = await getOwnBranchAccess(userId);

    return res.json({
      ok: true,
      role: roleKey,
      permissions,
      branchAccess,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load permissions.' });
  }
});

app.get('/branches', requireAuth, async (req, res) => {
  try {
    await ensureAppUser(req.user);

    const userId = req.user.id;
    const roleKey = await getRoleKey(userId);
    const branches = await getAllowedBranches(userId, roleKey);
    const branchAccess = await getOwnBranchAccess(userId);

    return res.json({
      ok: true,
      role: roleKey,
      branches,
      branchAccess,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load branches.' });
  }
});

app.post('/sync/queue', requireAuth, async (req, res) => {
  try {
    await ensureAppUser(req.user);

    const userId = req.user.id;
    const operationType = toText(req.body?.operationType || req.body?.operation_type);
    const payload = toObject(req.body?.payload);
    const branchId = toText(req.body?.branchId || req.body?.branch_id) || null;
    const priorityRaw = Number(req.body?.priority);
    const priority = Number.isFinite(priorityRaw) ? Math.min(10, Math.max(1, Math.trunc(priorityRaw))) : 5;

    if (!operationType) {
      return res.status(400).json({ ok: false, message: 'operationType is required.' });
    }

    const { data: queued, error: queueError } = await adminClient
      .from('sync_queue')
      .insert({
        user_id: userId,
        branch_id: branchId,
        operation_type: operationType,
        payload,
        status: 'pending',
        priority,
      })
      .select('*')
      .single();

    if (queueError) {
      throw new Error(`Unable to insert sync queue row: ${queueError.message}`);
    }

    await writeAuditLog({
      actorUserId: userId,
      action: 'sync.queue.create',
      entityType: 'sync_queue',
      entityId: queued.id,
      metadata: {
        operationType,
        branchId,
        priority,
      },
    });

    return res.status(201).json({
      ok: true,
      queue: queued,
      message: 'Sync operation queued.',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to queue sync operation.' });
  }
});

app.post('/notifications/register-device', requireAuth, async (req, res) => {
  try {
    await ensureAppUser(req.user);

    const userId = req.user.id;
    const roleKey = await getRoleKey(userId);

    const deviceId = toText(req.body?.deviceId || req.body?.device_id)
      || `web-${userId.slice(0, 8)}-${Date.now()}`;
    const token = toText(req.body?.token);
    const platform = toText(req.body?.platform) || 'web';
    const userAgent = toText(req.body?.userAgent || req.body?.user_agent || req.headers['user-agent']) || null;
    const branchId = toText(req.body?.branchId || req.body?.branch_id) || null;

    if (!token) {
      return res.status(400).json({ ok: false, message: 'token is required.' });
    }

    const { error: deviceError } = await adminClient
      .from('devices')
      .upsert({
        id: deviceId,
        user_id: userId,
        branch_id: branchId,
        platform,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (deviceError) {
      throw new Error(`Unable to upsert devices row: ${deviceError.message}`);
    }

    const { error: tokenError } = await adminClient
      .from('notification_tokens')
      .upsert({
        device_id: deviceId,
        token,
        user_id: userId,
        role: roleKey,
        branch_id: branchId,
        platform,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_id' });

    if (tokenError) {
      throw new Error(`Unable to upsert notification token: ${tokenError.message}`);
    }

    await writeAuditLog({
      actorUserId: userId,
      action: 'notifications.register_device',
      entityType: 'devices',
      entityId: deviceId,
      metadata: {
        branchId,
        platform,
      },
    });

    return res.status(201).json({
      ok: true,
      device: {
        deviceId,
        branchId,
        role: roleKey,
        tokenRegistered: true,
      },
      message: 'Device registered for notifications.',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to register device.' });
  }
});

app.get('/inventory/levels', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.LEVELS_VIEW);
    if (!access) return;

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const includeInactive = parseBooleanFlag(req.query?.includeInactive || req.query?.include_inactive, false);
    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, role: access.roleKey, branches: [], levels: [] });
    }

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name, is_active')
      .in('id', branchIds)
      .order('name', { ascending: true });

    if (branchError) {
      throw new Error(`Unable to read branch metadata: ${branchError.message}`);
    }

    let ingredientsQuery = adminClient
      .from('ingredients')
      .select('id, code, name, default_unit_id, is_active')
      .order('name', { ascending: true });

    if (!includeInactive) {
      ingredientsQuery = ingredientsQuery.eq('is_active', true);
    }

    const { data: ingredients, error: ingredientsError } = await ingredientsQuery;
    if (ingredientsError) {
      throw new Error(`Unable to read ingredients: ${ingredientsError.message}`);
    }

    const ingredientIds = (ingredients || []).map((item) => item.id).filter(Boolean);
    const safeBranchRows = branchRows || [];

    let levelRows = [];
    if (ingredientIds.length > 0) {
      const { data, error } = await adminClient
        .from('inventory_levels')
        .select('ingredient_id, branch_id, on_hand_qty, reserved_qty, updated_at')
        .in('ingredient_id', ingredientIds)
        .in('branch_id', branchIds);

      if (error) {
        throw new Error(`Unable to read inventory levels: ${error.message}`);
      }

      levelRows = data || [];
    }

    const unitIds = [...new Set((ingredients || []).map((item) => toText(item.default_unit_id)).filter(Boolean))];
    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);

      if (error) {
        throw new Error(`Unable to read ingredient units: ${error.message}`);
      }

      unitRows = data || [];
    }

    const levelMap = new Map();
    for (const row of levelRows) {
      const key = `${toText(row.branch_id)}::${toText(row.ingredient_id)}`;
      levelMap.set(key, row);
    }

    const unitMap = new Map();
    for (const unit of unitRows) {
      unitMap.set(toText(unit.id), {
        id: toText(unit.id),
        name: toText(unit.name),
        symbol: toText(unit.symbol),
      });
    }

    const levels = [];
    for (const branch of safeBranchRows) {
      for (const ingredient of ingredients || []) {
        const key = `${toText(branch.id)}::${toText(ingredient.id)}`;
        const existingLevel = levelMap.get(key);
        const unit = unitMap.get(toText(ingredient.default_unit_id)) || null;

        levels.push({
          branchId: toText(branch.id),
          branchCode: toText(branch.code),
          branchName: toText(branch.name),
          ingredientId: toText(ingredient.id),
          ingredientCode: toText(ingredient.code),
          ingredientName: toText(ingredient.name),
          unit,
          onHandQty: toNumber(existingLevel?.on_hand_qty, 0),
          reservedQty: toNumber(existingLevel?.reserved_qty, 0),
          availableQty: toNumber(existingLevel?.on_hand_qty, 0) - toNumber(existingLevel?.reserved_qty, 0),
          updatedAt: existingLevel?.updated_at || null,
          ingredientActive: Boolean(ingredient.is_active),
          branchActive: Boolean(branch.is_active),
        });
      }
    }

    return res.json({
      ok: true,
      role: access.roleKey,
      branches: safeBranchRows,
      levels,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load inventory levels.' });
  }
});

app.post('/inventory/adjustments', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.ADJUSTMENTS_WRITE);
    if (!access) return;

    const ingredientId = toText(req.body?.ingredientId || req.body?.ingredient_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const reasonCode = toText(req.body?.reasonCode || req.body?.reason_code) || null;
    const reasonNote = toText(req.body?.reasonNote || req.body?.reason_note) || null;
    const metadata = toObject(req.body?.metadata);

    if (!ingredientId) {
      return res.status(400).json({ ok: false, message: 'ingredientId is required.' });
    }

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single target branch for adjustment.' });
    }

    let quantityDelta = toNumber(req.body?.quantityDelta || req.body?.quantity_delta, Number.NaN);
    if (!Number.isFinite(quantityDelta)) {
      const quantity = toNumber(req.body?.quantity, Number.NaN);
      const adjustmentType = toText(req.body?.adjustmentType || req.body?.adjustment_type || req.body?.direction).toLowerCase();
      if (Number.isFinite(quantity) && quantity > 0) {
        quantityDelta = adjustmentType === 'decrease' || adjustmentType === 'out' || adjustmentType === 'remove'
          ? -quantity
          : quantity;
      }
    }

    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      return res.status(400).json({ ok: false, message: 'quantityDelta (or quantity + adjustmentType) is required and cannot be zero.' });
    }

    const movementType = normalizeMovementType(req.body?.movementType || req.body?.movement_type, quantityDelta);

    const { data, error } = await adminClient.rpc('inventory_apply_movement', {
      p_ingredient_id: ingredientId,
      p_branch_id: branchIds[0],
      p_quantity_delta: quantityDelta,
      p_movement_type: movementType,
      p_reason_code: reasonCode,
      p_reason_note: reasonNote,
      p_reference_order_id: null,
      p_actor_user_id: access.userId,
      p_metadata: {
        ...metadata,
        source: 'api.inventory.adjustments',
      },
      p_enforce_non_negative: quantityDelta < 0,
    });

    if (error) {
      const message = mapInventoryErrorMessage(error.message);
      const statusCode = String(error.message || '').includes('INV_ERR_') ? 400 : 500;
      return res.status(statusCode).json({ ok: false, message });
    }

    const movementResult = extractSingleResult(data);
    const movementId = toText(movementResult?.movement_id);
    if (!movementId) {
      throw new Error('Inventory movement did not return a movement id.');
    }

    const { data: movement, error: movementError } = await adminClient
      .from('inventory_movements')
      .select('*')
      .eq('id', movementId)
      .maybeSingle();

    if (movementError) {
      throw new Error(`Unable to load movement row: ${movementError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'inventory.adjustment.create',
      entityType: 'inventory_movements',
      entityId: movementId,
      metadata: {
        ingredientId,
        branchId: branchIds[0],
        quantityDelta,
        movementType,
        reasonCode,
      },
    });

    return res.status(201).json({
      ok: true,
      movement,
      balanceAfter: movementResult?.balance_after ?? null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create inventory adjustment.' });
  }
});

app.post('/inventory/waste', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.WASTE_WRITE);
    if (!access) return;

    const ingredientId = toText(req.body?.ingredientId || req.body?.ingredient_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const reasonCode = toText(req.body?.reasonCode || req.body?.reason_code).toLowerCase();
    const note = toText(req.body?.note || req.body?.reasonNote || req.body?.reason_note) || null;
    const quantity = toNumber(req.body?.quantity, Number.NaN);

    if (!ingredientId) {
      return res.status(400).json({ ok: false, message: 'ingredientId is required.' });
    }

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (!reasonCode) {
      return res.status(400).json({ ok: false, message: 'reasonCode is required.' });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ ok: false, message: 'quantity must be a positive number.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single target branch for waste logging.' });
    }

    const { data: reasonRow, error: reasonError } = await adminClient
      .from('wastage_reasons')
      .select('code, requires_note, is_active')
      .eq('code', reasonCode)
      .maybeSingle();

    if (reasonError) {
      throw new Error(`Unable to read wastage reason: ${reasonError.message}`);
    }

    if (!reasonRow?.code || !reasonRow?.is_active) {
      return res.status(400).json({ ok: false, message: 'Invalid or inactive wastage reason code.' });
    }

    if (reasonRow.requires_note && !note) {
      return res.status(400).json({ ok: false, message: 'This wastage reason requires a note.' });
    }

    const { data: ingredient, error: ingredientError } = await adminClient
      .from('ingredients')
      .select('id, default_unit_id, is_active')
      .eq('id', ingredientId)
      .maybeSingle();

    if (ingredientError) {
      throw new Error(`Unable to read ingredient: ${ingredientError.message}`);
    }

    if (!ingredient?.id || !ingredient?.is_active) {
      return res.status(400).json({ ok: false, message: 'Ingredient not found or inactive.' });
    }

    const { data, error } = await adminClient.rpc('inventory_apply_movement', {
      p_ingredient_id: ingredientId,
      p_branch_id: branchIds[0],
      p_quantity_delta: -quantity,
      p_movement_type: 'waste',
      p_reason_code: reasonCode,
      p_reason_note: note,
      p_reference_order_id: null,
      p_actor_user_id: access.userId,
      p_metadata: {
        source: 'api.inventory.waste',
      },
      p_enforce_non_negative: true,
    });

    if (error) {
      const message = mapInventoryErrorMessage(error.message);
      const statusCode = String(error.message || '').includes('INV_ERR_') ? 400 : 500;
      return res.status(statusCode).json({ ok: false, message });
    }

    const movementResult = extractSingleResult(data);
    const movementId = toText(movementResult?.movement_id);
    if (!movementId) {
      throw new Error('Inventory waste movement did not return a movement id.');
    }

    const { data: insertedLog, error: insertLogError } = await adminClient
      .from('wastage_logs')
      .insert({
        ingredient_id: ingredientId,
        branch_id: branchIds[0],
        unit_id: ingredient.default_unit_id,
        quantity,
        reason_code: reasonCode,
        note,
        actor_user_id: access.userId,
        movement_id: movementId,
      })
      .select('*')
      .single();

    if (insertLogError) {
      throw new Error(`Unable to insert wastage log: ${insertLogError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'inventory.waste.create',
      entityType: 'wastage_logs',
      entityId: insertedLog.id,
      metadata: {
        ingredientId,
        branchId: branchIds[0],
        quantity,
        reasonCode,
      },
    });

    return res.status(201).json({
      ok: true,
      wasteLog: insertedLog,
      movementId,
      balanceAfter: movementResult?.balance_after ?? null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to log waste.' });
  }
});

app.get('/products/recipes', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.RECIPES_VIEW);
    if (!access) return;

    const includeInactive = parseBooleanFlag(req.query?.includeInactive || req.query?.include_inactive, false);

    let productsQuery = adminClient
      .from('products')
      .select('id, sku, name, external_key, is_active')
      .order('name', { ascending: true });

    if (!includeInactive) {
      productsQuery = productsQuery.eq('is_active', true);
    }

    const { data: products, error: productsError } = await productsQuery;
    if (productsError) {
      throw new Error(`Unable to read products: ${productsError.message}`);
    }

    const productIds = (products || []).map((row) => row.id).filter(Boolean);
    if (productIds.length === 0) {
      return res.json({ ok: true, products: [] });
    }

    let recipesQuery = adminClient
      .from('product_recipes')
      .select('product_id, ingredient_id, unit_id, qty_per_serving, waste_factor, is_active')
      .in('product_id', productIds);

    if (!includeInactive) {
      recipesQuery = recipesQuery.eq('is_active', true);
    }

    const { data: recipeRows, error: recipesError } = await recipesQuery;
    if (recipesError) {
      throw new Error(`Unable to read recipes: ${recipesError.message}`);
    }

    const ingredientIds = [...new Set((recipeRows || []).map((row) => toText(row.ingredient_id)).filter(Boolean))];
    const unitIds = [...new Set((recipeRows || []).map((row) => toText(row.unit_id)).filter(Boolean))];

    let ingredientRows = [];
    if (ingredientIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredients')
        .select('id, code, name, default_unit_id, is_active')
        .in('id', ingredientIds);

      if (error) {
        throw new Error(`Unable to read recipe ingredients: ${error.message}`);
      }

      ingredientRows = data || [];
    }

    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);

      if (error) {
        throw new Error(`Unable to read recipe units: ${error.message}`);
      }

      unitRows = data || [];
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows) {
      ingredientMap.set(toText(row.id), {
        id: toText(row.id),
        code: toText(row.code),
        name: toText(row.name),
        defaultUnitId: toText(row.default_unit_id),
        isActive: Boolean(row.is_active),
      });
    }

    const unitMap = new Map();
    for (const row of unitRows) {
      unitMap.set(toText(row.id), {
        id: toText(row.id),
        name: toText(row.name),
        symbol: toText(row.symbol),
      });
    }

    const recipesByProduct = new Map();
    for (const recipeRow of recipeRows || []) {
      const productId = toText(recipeRow.product_id);
      if (!recipesByProduct.has(productId)) recipesByProduct.set(productId, []);

      const ingredient = ingredientMap.get(toText(recipeRow.ingredient_id)) || null;
      const unit = unitMap.get(toText(recipeRow.unit_id)) || null;

      recipesByProduct.get(productId).push({
        ingredientId: toText(recipeRow.ingredient_id),
        ingredientCode: ingredient?.code || null,
        ingredientName: ingredient?.name || null,
        ingredientActive: ingredient?.isActive ?? null,
        qtyPerServing: toNumber(recipeRow.qty_per_serving, 0),
        wasteFactor: toNumber(recipeRow.waste_factor, 0),
        unit,
        recipeActive: Boolean(recipeRow.is_active),
      });
    }

    const payload = (products || []).map((product) => ({
      id: toText(product.id),
      sku: toText(product.sku),
      name: toText(product.name),
      externalKey: toText(product.external_key) || null,
      isActive: Boolean(product.is_active),
      recipes: recipesByProduct.get(toText(product.id)) || [],
    }));

    return res.json({ ok: true, products: payload });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load product recipes.' });
  }
});

app.post('/orders/consume-stock', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.CONSUME_STOCK);
    if (!access) return;

    const orderId = Math.trunc(toNumber(req.body?.orderId || req.body?.order_id, Number.NaN));
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ ok: false, message: 'orderId must be a positive integer.' });
    }

    const { data, error } = await adminClient.rpc('consume_stock_for_order', {
      p_order_id: orderId,
      p_actor_user_id: access.userId,
      p_source: 'api.consume-stock',
    });

    if (error) {
      const message = mapInventoryErrorMessage(error.message);
      const statusCode = String(error.message || '').includes('INV_ERR_') ? 400 : 500;
      return res.status(statusCode).json({ ok: false, message });
    }

    const summary = extractSingleResult(data) || {};

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'inventory.consume_stock.order',
      entityType: 'cafe_orders',
      entityId: String(orderId),
      metadata: toObject(summary),
    });

    return res.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to consume stock for order.' });
  }
});

app.get('/inventory/alerts/low-stock', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.ALERTS_VIEW);
    if (!access) return;

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, alerts: [] });
    }

    const { data: ruleRows, error: rulesError } = await adminClient
      .from('reorder_rules')
      .select('ingredient_id, branch_id, min_qty, reorder_qty, alert_enabled')
      .in('branch_id', branchIds)
      .eq('alert_enabled', true);

    if (rulesError) {
      throw new Error(`Unable to read reorder rules: ${rulesError.message}`);
    }

    if ((ruleRows || []).length === 0) {
      return res.json({ ok: true, alerts: [] });
    }

    const ingredientIds = [...new Set((ruleRows || []).map((row) => toText(row.ingredient_id)).filter(Boolean))];
    const { data: levelRows, error: levelsError } = await adminClient
      .from('inventory_levels')
      .select('ingredient_id, branch_id, on_hand_qty, reserved_qty')
      .in('branch_id', branchIds)
      .in('ingredient_id', ingredientIds);

    if (levelsError) {
      throw new Error(`Unable to read inventory levels for alerts: ${levelsError.message}`);
    }

    const { data: ingredientRows, error: ingredientError } = await adminClient
      .from('ingredients')
      .select('id, code, name, default_unit_id, is_active')
      .in('id', ingredientIds);

    if (ingredientError) {
      throw new Error(`Unable to read ingredients for alerts: ${ingredientError.message}`);
    }

    const unitIds = [...new Set((ingredientRows || []).map((row) => toText(row.default_unit_id)).filter(Boolean))];
    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);

      if (error) {
        throw new Error(`Unable to read units for alerts: ${error.message}`);
      }

      unitRows = data || [];
    }

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name')
      .in('id', branchIds);

    if (branchError) {
      throw new Error(`Unable to read branches for alerts: ${branchError.message}`);
    }

    const levelMap = new Map();
    for (const row of levelRows || []) {
      const key = `${toText(row.branch_id)}::${toText(row.ingredient_id)}`;
      levelMap.set(key, row);
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows || []) {
      ingredientMap.set(toText(row.id), row);
    }

    const unitMap = new Map();
    for (const row of unitRows) {
      unitMap.set(toText(row.id), row);
    }

    const branchMap = new Map();
    for (const row of branchRows || []) {
      branchMap.set(toText(row.id), row);
    }

    const alerts = [];
    for (const rule of ruleRows || []) {
      const branchId = toText(rule.branch_id);
      const ingredientId = toText(rule.ingredient_id);
      const level = levelMap.get(`${branchId}::${ingredientId}`);

      const onHandQty = toNumber(level?.on_hand_qty, 0);
      const reservedQty = toNumber(level?.reserved_qty, 0);
      const availableQty = onHandQty - reservedQty;
      const minQty = toNumber(rule.min_qty, 0);

      if (onHandQty > minQty) continue;

      const ingredient = ingredientMap.get(ingredientId);
      const unit = unitMap.get(toText(ingredient?.default_unit_id)) || null;
      const branch = branchMap.get(branchId);

      alerts.push({
        branchId,
        branchCode: toText(branch?.code) || null,
        branchName: toText(branch?.name) || null,
        ingredientId,
        ingredientCode: toText(ingredient?.code) || null,
        ingredientName: toText(ingredient?.name) || null,
        ingredientActive: Boolean(ingredient?.is_active),
        onHandQty,
        reservedQty,
        availableQty,
        minQty,
        reorderQty: toNumber(rule.reorder_qty, 0),
        shortageQty: Math.max(0, minQty - onHandQty),
        unit,
      });
    }

    alerts.sort((a, b) => b.shortageQty - a.shortageQty);

    return res.json({
      ok: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load low-stock alerts.' });
  }
});

app.get('/suppliers', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.SUPPLIERS_VIEW);
    if (!access) return;

    const includeInactive = parseBooleanFlag(req.query?.includeInactive || req.query?.include_inactive, false);

    let suppliersQuery = adminClient
      .from('suppliers')
      .select('id, code, name, tax_id, payment_terms_days, default_currency, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (!includeInactive) {
      suppliersQuery = suppliersQuery.eq('is_active', true);
    }

    const { data: suppliers, error: suppliersError } = await suppliersQuery;
    if (suppliersError) {
      throw new Error(`Unable to read suppliers: ${suppliersError.message}`);
    }

    const supplierIds = (suppliers || []).map((row) => row.id).filter(Boolean);
    if (supplierIds.length === 0) {
      return res.json({ ok: true, count: 0, suppliers: [] });
    }

    let contactsQuery = adminClient
      .from('supplier_contacts')
      .select('id, supplier_id, full_name, email, phone, role, is_primary, is_active')
      .in('supplier_id', supplierIds)
      .order('is_primary', { ascending: false })
      .order('full_name', { ascending: true });

    if (!includeInactive) {
      contactsQuery = contactsQuery.eq('is_active', true);
    }

    const { data: contacts, error: contactsError } = await contactsQuery;
    if (contactsError) {
      throw new Error(`Unable to read supplier contacts: ${contactsError.message}`);
    }

    const { data: historyRows, error: historyError } = await adminClient
      .from('supplier_price_history')
      .select('supplier_id, price, lead_time_days, effective_at')
      .in('supplier_id', supplierIds)
      .order('effective_at', { ascending: false });

    if (historyError) {
      throw new Error(`Unable to read supplier price history summary: ${historyError.message}`);
    }

    const contactsBySupplier = new Map();
    for (const contact of contacts || []) {
      const supplierId = toText(contact.supplier_id);
      if (!contactsBySupplier.has(supplierId)) contactsBySupplier.set(supplierId, []);
      contactsBySupplier.get(supplierId).push({
        id: contact.id,
        fullName: toText(contact.full_name),
        email: toText(contact.email) || null,
        phone: toText(contact.phone) || null,
        role: toText(contact.role) || null,
        isPrimary: Boolean(contact.is_primary),
        isActive: Boolean(contact.is_active),
      });
    }

    const historySummaryMap = new Map();
    for (const row of historyRows || []) {
      const supplierId = toText(row.supplier_id);
      const price = toNumber(row.price, Number.NaN);
      const leadTime = toNumber(row.lead_time_days, 0);

      if (!historySummaryMap.has(supplierId)) {
        historySummaryMap.set(supplierId, {
          sampleCount: 0,
          minPrice: Number.NaN,
          maxPrice: Number.NaN,
          totalLeadTime: 0,
          lastEffectiveAt: null,
        });
      }

      const summary = historySummaryMap.get(supplierId);
      summary.sampleCount += 1;
      summary.totalLeadTime += Math.max(0, leadTime);

      if (Number.isFinite(price)) {
        summary.minPrice = Number.isFinite(summary.minPrice) ? Math.min(summary.minPrice, price) : price;
        summary.maxPrice = Number.isFinite(summary.maxPrice) ? Math.max(summary.maxPrice, price) : price;
      }

      if (!summary.lastEffectiveAt && row.effective_at) {
        summary.lastEffectiveAt = row.effective_at;
      }
    }

    const payload = (suppliers || []).map((supplier) => {
      const supplierId = toText(supplier.id);
      const summary = historySummaryMap.get(supplierId) || null;

      return {
        id: supplierId,
        code: toText(supplier.code),
        name: toText(supplier.name),
        taxId: toText(supplier.tax_id) || null,
        paymentTermsDays: Math.max(0, Math.trunc(toNumber(supplier.payment_terms_days, 0))),
        defaultCurrency: toText(supplier.default_currency) || 'MAD',
        isActive: Boolean(supplier.is_active),
        contacts: contactsBySupplier.get(supplierId) || [],
        priceSnapshot: {
          sampleCount: summary?.sampleCount || 0,
          minPrice: Number.isFinite(summary?.minPrice) ? summary.minPrice : null,
          maxPrice: Number.isFinite(summary?.maxPrice) ? summary.maxPrice : null,
          averageLeadTimeDays: summary?.sampleCount ? Number((summary.totalLeadTime / summary.sampleCount).toFixed(2)) : null,
          lastEffectiveAt: summary?.lastEffectiveAt || null,
        },
      };
    });

    return res.json({
      ok: true,
      role: access.roleKey,
      count: payload.length,
      suppliers: payload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load suppliers.' });
  }
});

app.post('/purchase-orders', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_CREATE);
    if (!access) return;

    const supplierId = toText(req.body?.supplierId || req.body?.supplier_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const linesInput = Array.isArray(req.body?.lines) ? req.body.lines : [];

    if (!supplierId) {
      return res.status(400).json({ ok: false, message: 'supplierId is required.' });
    }

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (linesInput.length === 0) {
      return res.status(400).json({ ok: false, message: 'At least one purchase order line is required.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single branch for this purchase order.' });
    }

    const branchId = branchIds[0];

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, is_active, default_currency')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierError) {
      throw new Error(`Unable to read supplier: ${supplierError.message}`);
    }

    if (!supplier?.id || !supplier?.is_active) {
      return res.status(400).json({ ok: false, message: 'Supplier not found or inactive.' });
    }

    const ingredientIds = [...new Set(linesInput
      .map((line) => toText(line?.ingredientId || line?.ingredient_id))
      .filter(Boolean))];

    if (ingredientIds.length !== linesInput.length) {
      return res.status(400).json({ ok: false, message: 'Each line must include a valid ingredientId.' });
    }

    const { data: ingredientRows, error: ingredientError } = await adminClient
      .from('ingredients')
      .select('id, name, default_unit_id, is_active')
      .in('id', ingredientIds);

    if (ingredientError) {
      throw new Error(`Unable to validate ingredients: ${ingredientError.message}`);
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows || []) {
      ingredientMap.set(toText(row.id), row);
    }

    if (ingredientMap.size !== ingredientIds.length) {
      return res.status(400).json({ ok: false, message: 'One or more ingredients were not found.' });
    }

    const normalizedLines = [];
    for (let index = 0; index < linesInput.length; index += 1) {
      const line = linesInput[index];
      const ingredientId = toText(line?.ingredientId || line?.ingredient_id);
      const ingredient = ingredientMap.get(ingredientId);

      if (!ingredient?.is_active) {
        return res.status(400).json({ ok: false, message: `Ingredient ${ingredientId} is inactive.` });
      }

      const orderedQty = toNumber(line?.orderedQty || line?.ordered_qty || line?.quantity, Number.NaN);
      const unitPrice = toNumber(line?.unitPrice || line?.unit_price, Number.NaN);
      const leadTimeDays = Math.max(0, Math.trunc(toNumber(line?.leadTimeDays || line?.lead_time_days, 0)));
      const unitId = toText(line?.unitId || line?.unit_id || ingredient.default_unit_id);

      if (!Number.isFinite(orderedQty) || orderedQty <= 0) {
        return res.status(400).json({ ok: false, message: `Line ${index + 1} has invalid orderedQty.` });
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ ok: false, message: `Line ${index + 1} has invalid unitPrice.` });
      }

      if (!unitId) {
        return res.status(400).json({ ok: false, message: `Line ${index + 1} has invalid unitId.` });
      }

      normalizedLines.push({
        lineNo: index + 1,
        ingredientId,
        unitId,
        description: toText(line?.description || ingredient.name),
        orderedQty,
        unitPrice,
        leadTimeDays,
        lineTotal: Number((orderedQty * unitPrice).toFixed(2)),
      });
    }

    const unitIds = [...new Set(normalizedLines.map((line) => line.unitId))];
    const { data: unitRows, error: unitError } = await adminClient
      .from('ingredient_units')
      .select('id')
      .in('id', unitIds);

    if (unitError) {
      throw new Error(`Unable to validate units: ${unitError.message}`);
    }

    if ((unitRows || []).length !== unitIds.length) {
      return res.status(400).json({ ok: false, message: 'One or more units are invalid.' });
    }

    const subtotalAmount = Number(normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const taxAmount = Number(toNumber(req.body?.taxAmount || req.body?.tax_amount, 0).toFixed(2));
    if (taxAmount < 0) {
      return res.status(400).json({ ok: false, message: 'taxAmount cannot be negative.' });
    }

    const approvalRequired = parseBooleanFlag(req.body?.approvalRequired ?? req.body?.approval_required, true);
    const nowIso = new Date().toISOString();

    const poNumber = toText(req.body?.poNumber || req.body?.po_number) || generateNumber('PO');
    const expectedDeliveryDate = toIsoDate(req.body?.expectedDeliveryDate || req.body?.expected_delivery_date);
    const currency = toText(req.body?.currency) || toText(supplier.default_currency) || 'MAD';
    const note = toText(req.body?.note) || null;
    const metadata = toObject(req.body?.metadata);

    const { data: purchaseOrder, error: purchaseOrderError } = await adminClient
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        supplier_id: supplierId,
        branch_id: branchId,
        status: approvalRequired ? 'pending_approval' : 'approved',
        approval_required: approvalRequired,
        approved_by_user_id: approvalRequired ? null : access.userId,
        approved_at: approvalRequired ? null : nowIso,
        created_by_user_id: access.userId,
        expected_delivery_date: expectedDeliveryDate,
        currency,
        subtotal_amount: subtotalAmount,
        tax_amount: taxAmount,
        total_amount: Number((subtotalAmount + taxAmount).toFixed(2)),
        note,
        metadata,
      })
      .select('*')
      .single();

    if (purchaseOrderError) {
      throw new Error(`Unable to create purchase order: ${purchaseOrderError.message}`);
    }

    const lineRowsToInsert = normalizedLines.map((line) => ({
      purchase_order_id: purchaseOrder.id,
      line_no: line.lineNo,
      ingredient_id: line.ingredientId,
      unit_id: line.unitId,
      description: line.description,
      ordered_qty: line.orderedQty,
      received_qty: 0,
      unit_price: line.unitPrice,
      lead_time_days: line.leadTimeDays,
      line_total: line.lineTotal,
      is_closed: false,
    }));

    const { data: insertedLines, error: linesError } = await adminClient
      .from('purchase_order_lines')
      .insert(lineRowsToInsert)
      .select('*');

    if (linesError) {
      await adminClient.from('purchase_orders').delete().eq('id', purchaseOrder.id);
      throw new Error(`Unable to create purchase order lines: ${linesError.message}`);
    }

    const priceHistoryRows = (insertedLines || []).map((line) => ({
      supplier_id: supplierId,
      ingredient_id: line.ingredient_id,
      unit_id: line.unit_id,
      price: line.unit_price,
      currency,
      lead_time_days: line.lead_time_days,
      source_type: 'purchase_order',
      source_reference: `po:${purchaseOrder.id}:line:${line.id}`,
      effective_at: nowIso,
      created_by_user_id: access.userId,
    }));

    let priceHistoryWarning = null;
    if (priceHistoryRows.length > 0) {
      const { error } = await adminClient
        .from('supplier_price_history')
        .insert(priceHistoryRows);
      if (error) {
        priceHistoryWarning = `Supplier price history insert failed: ${error.message}`;
      }
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'purchase_orders.create',
      entityType: 'purchase_orders',
      entityId: String(purchaseOrder.id),
      metadata: {
        supplierId,
        branchId,
        lineCount: insertedLines?.length || 0,
      },
    });

    return res.status(201).json({
      ok: true,
      purchaseOrder,
      lines: insertedLines || [],
      warning: priceHistoryWarning,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create purchase order.' });
  }
});

app.post('/purchase-orders/:id/approve', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_APPROVE);
    if (!access) return;

    const purchaseOrderId = toPositiveInteger(req.params?.id);
    if (!purchaseOrderId) {
      return res.status(400).json({ ok: false, message: 'Invalid purchase order id.' });
    }

    const { data: purchaseOrder, error: purchaseOrderError } = await adminClient
      .from('purchase_orders')
      .select('id, branch_id, status, approval_required, approved_at')
      .eq('id', purchaseOrderId)
      .maybeSingle();

    if (purchaseOrderError) {
      throw new Error(`Unable to read purchase order: ${purchaseOrderError.message}`);
    }

    if (!purchaseOrder?.id) {
      return res.status(404).json({ ok: false, message: 'Purchase order not found.' });
    }

    if (!hasBranchAccess(purchaseOrder.branch_id, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this purchase order.' });
    }

    const currentStatus = toText(purchaseOrder.status).toLowerCase();
    if (['approved', 'partially_received', 'received'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, message: 'Purchase order is already approved or received.' });
    }

    if (['cancelled', 'rejected'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, message: 'Cancelled or rejected purchase orders cannot be approved.' });
    }

    const { data: updatedPurchaseOrder, error: updateError } = await adminClient
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by_user_id: access.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', purchaseOrderId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Unable to approve purchase order: ${updateError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'purchase_orders.approve',
      entityType: 'purchase_orders',
      entityId: String(purchaseOrderId),
      metadata: { previousStatus: currentStatus },
    });

    return res.json({ ok: true, purchaseOrder: updatedPurchaseOrder });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to approve purchase order.' });
  }
});

app.post('/purchase-orders/:id/receive', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_RECEIVE);
    if (!access) return;

    const purchaseOrderId = toPositiveInteger(req.params?.id);
    if (!purchaseOrderId) {
      return res.status(400).json({ ok: false, message: 'Invalid purchase order id.' });
    }

    let receiptLinesInput = [];
    if (Array.isArray(req.body?.receiptLines)) {
      receiptLinesInput = req.body.receiptLines;
    } else if (Array.isArray(req.body?.lines)) {
      receiptLinesInput = req.body.lines;
    }

    if (receiptLinesInput.length === 0) {
      return res.status(400).json({ ok: false, message: 'At least one receipt line is required.' });
    }

    const { data: purchaseOrder, error: purchaseOrderError } = await adminClient
      .from('purchase_orders')
      .select('id, po_number, supplier_id, branch_id, status, approved_at, created_at, currency')
      .eq('id', purchaseOrderId)
      .maybeSingle();

    if (purchaseOrderError) {
      throw new Error(`Unable to read purchase order: ${purchaseOrderError.message}`);
    }

    if (!purchaseOrder?.id) {
      return res.status(404).json({ ok: false, message: 'Purchase order not found.' });
    }

    if (!hasBranchAccess(purchaseOrder.branch_id, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this purchase order.' });
    }

    const purchaseOrderStatus = toText(purchaseOrder.status).toLowerCase();
    if (!['approved', 'partially_received'].includes(purchaseOrderStatus)) {
      return res.status(400).json({ ok: false, message: 'Only approved purchase orders can be received.' });
    }

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, payment_terms_days')
      .eq('id', purchaseOrder.supplier_id)
      .maybeSingle();

    if (supplierError) {
      throw new Error(`Unable to read supplier for receipt: ${supplierError.message}`);
    }

    const { data: poLines, error: poLinesError } = await adminClient
      .from('purchase_order_lines')
      .select('id, line_no, ingredient_id, unit_id, ordered_qty, received_qty, unit_price, lead_time_days')
      .eq('purchase_order_id', purchaseOrderId)
      .order('line_no', { ascending: true });

    if (poLinesError) {
      throw new Error(`Unable to read purchase order lines: ${poLinesError.message}`);
    }

    if ((poLines || []).length === 0) {
      return res.status(400).json({ ok: false, message: 'Purchase order has no lines to receive.' });
    }

    const lineById = new Map();
    const lineByNumber = new Map();
    for (const line of poLines || []) {
      lineById.set(toPositiveInteger(line.id), line);
      lineByNumber.set(toPositiveInteger(line.line_no), line);
    }

    const normalizedReceiptLines = [];
    const usedLineIds = new Set();

    for (let index = 0; index < receiptLinesInput.length; index += 1) {
      const lineInput = receiptLinesInput[index];
      const explicitLineId = toPositiveInteger(
        lineInput?.purchaseOrderLineId
        || lineInput?.purchase_order_line_id
        || lineInput?.lineId
        || lineInput?.line_id,
      );
      const lineNumber = toPositiveInteger(lineInput?.lineNo || lineInput?.line_no);

      const poLine = explicitLineId ? lineById.get(explicitLineId) : lineByNumber.get(lineNumber);
      if (!poLine) {
        return res.status(400).json({ ok: false, message: `Receipt line ${index + 1} does not reference a valid purchase order line.` });
      }

      const poLineId = toPositiveInteger(poLine.id);
      if (usedLineIds.has(poLineId)) {
        return res.status(400).json({ ok: false, message: `Duplicate purchase order line in receipt: ${poLineId}.` });
      }
      usedLineIds.add(poLineId);

      const receivedQty = toNumber(lineInput?.receivedQty || lineInput?.received_qty || lineInput?.quantity, Number.NaN);
      if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
        return res.status(400).json({ ok: false, message: `Receipt line ${index + 1} has invalid receivedQty.` });
      }

      const orderedQty = toNumber(poLine.ordered_qty, 0);
      const currentReceivedQty = toNumber(poLine.received_qty, 0);
      const remainingQty = Math.max(0, orderedQty - currentReceivedQty);
      if (receivedQty - remainingQty > 0.0001) {
        return res.status(400).json({
          ok: false,
          message: `Receipt line ${index + 1} exceeds remaining quantity for line ${poLine.line_no}.`,
        });
      }

      const unitPriceCandidate = toNumber(lineInput?.unitPrice || lineInput?.unit_price, Number.NaN);
      const unitPrice = Number.isFinite(unitPriceCandidate)
        ? unitPriceCandidate
        : toNumber(poLine.unit_price, Number.NaN);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ ok: false, message: `Receipt line ${index + 1} has invalid unitPrice.` });
      }

      normalizedReceiptLines.push({
        poLineId,
        lineNo: toPositiveInteger(poLine.line_no),
        ingredientId: toText(poLine.ingredient_id),
        unitId: toText(poLine.unit_id),
        receivedQty,
        unitPrice,
        orderedQty,
        currentReceivedQty,
        leadTimeDays: Math.max(0, Math.trunc(toNumber(poLine.lead_time_days, 0))),
        lineTotal: Number((receivedQty * unitPrice).toFixed(2)),
      });
    }

    const computedTotal = Number(normalizedReceiptLines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const invoiceTotalCandidate = toNumber(req.body?.invoiceTotal || req.body?.invoice_total, Number.NaN);
    const invoiceTotal = Number.isFinite(invoiceTotalCandidate) && invoiceTotalCandidate >= 0
      ? Number(invoiceTotalCandidate.toFixed(2))
      : computedTotal;

    const receivedAtInput = toText(req.body?.receivedAt || req.body?.received_at);
    const receivedAt = (() => {
      if (!receivedAtInput) return new Date().toISOString();
      const parsed = new Date(receivedAtInput);
      if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
      return parsed.toISOString();
    })();

    const receiptNumber = toText(req.body?.receiptNumber || req.body?.receipt_number) || generateNumber('GR');
    const invoiceNumber = toText(req.body?.invoiceNumber || req.body?.invoice_number) || null;
    const invoiceDate = toIsoDate(req.body?.invoiceDate || req.body?.invoice_date);
    const matchStatus = Math.abs(invoiceTotal - computedTotal) <= 0.01 ? 'matched' : 'mismatch';

    const { data: receipt, error: receiptError } = await adminClient
      .from('goods_receipts')
      .insert({
        receipt_number: receiptNumber,
        purchase_order_id: purchaseOrderId,
        supplier_id: purchaseOrder.supplier_id,
        branch_id: purchaseOrder.branch_id,
        received_by_user_id: access.userId,
        received_at: receivedAt,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_total: invoiceTotal,
        currency: toText(purchaseOrder.currency) || 'MAD',
        match_status: matchStatus,
        note: toText(req.body?.note) || null,
        metadata: toObject(req.body?.metadata),
      })
      .select('*')
      .single();

    if (receiptError) {
      throw new Error(`Unable to create goods receipt: ${receiptError.message}`);
    }

    const receiptLineRows = normalizedReceiptLines.map((line) => ({
      goods_receipt_id: receipt.id,
      purchase_order_line_id: line.poLineId,
      ingredient_id: line.ingredientId,
      unit_id: line.unitId,
      quantity_received: line.receivedQty,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }));

    const { data: insertedReceiptLines, error: receiptLinesError } = await adminClient
      .from('goods_receipt_lines')
      .insert(receiptLineRows)
      .select('*');

    if (receiptLinesError) {
      await adminClient.from('goods_receipts').delete().eq('id', receipt.id);
      throw new Error(`Unable to create goods receipt lines: ${receiptLinesError.message}`);
    }

    for (const line of normalizedReceiptLines) {
      const nextReceivedQty = Number((line.currentReceivedQty + line.receivedQty).toFixed(3));
      const isClosed = nextReceivedQty + 0.0001 >= line.orderedQty;

      const { error: updateLineError } = await adminClient
        .from('purchase_order_lines')
        .update({
          received_qty: nextReceivedQty,
          is_closed: isClosed,
        })
        .eq('id', line.poLineId);

      if (updateLineError) {
        throw new Error(`Unable to update purchase order line ${line.poLineId}: ${updateLineError.message}`);
      }
    }

    const warnings = [];
    for (const line of normalizedReceiptLines) {
      const { error } = await adminClient.rpc('inventory_apply_movement', {
        p_ingredient_id: line.ingredientId,
        p_branch_id: purchaseOrder.branch_id,
        p_quantity_delta: line.receivedQty,
        p_movement_type: 'adjustment_in',
        p_reason_code: 'purchase_receive',
        p_reason_note: toText(req.body?.note) || null,
        p_reference_order_id: purchaseOrderId,
        p_actor_user_id: access.userId,
        p_metadata: {
          source: 'api.purchase-orders.receive',
          purchaseOrderId,
          receiptId: receipt.id,
        },
        p_enforce_non_negative: false,
      });

      if (error) {
        warnings.push(`Inventory movement failed for ingredient ${line.ingredientId}: ${mapInventoryErrorMessage(error.message)}`);
      }
    }

    const baseLeadTimeDate = purchaseOrder.approved_at || purchaseOrder.created_at || receivedAt;
    const priceHistoryRows = normalizedReceiptLines.map((line) => ({
      supplier_id: purchaseOrder.supplier_id,
      ingredient_id: line.ingredientId,
      unit_id: line.unitId,
      price: line.unitPrice,
      currency: toText(purchaseOrder.currency) || 'MAD',
      lead_time_days: line.leadTimeDays > 0
        ? line.leadTimeDays
        : calculateDateDifferenceInDays(baseLeadTimeDate, receivedAt),
      source_type: 'goods_receipt',
      source_reference: `gr:${receipt.id}:line:${line.poLineId}`,
      effective_at: receivedAt,
      created_by_user_id: access.userId,
    }));

    const { error: priceHistoryError } = await adminClient
      .from('supplier_price_history')
      .insert(priceHistoryRows);

    if (priceHistoryError) {
      warnings.push(`Price history tracking failed: ${priceHistoryError.message}`);
    }

    const providedDueDate = toIsoDate(req.body?.dueDate || req.body?.due_date);
    const paymentTermsDays = Math.max(0, Math.trunc(toNumber(supplier?.payment_terms_days, 0)));
    const dueDate = (() => {
      if (providedDueDate) return providedDueDate;
      const baseDateValue = invoiceDate || receivedAt;
      const baseDate = new Date(baseDateValue);
      if (Number.isNaN(baseDate.getTime())) return null;
      baseDate.setUTCDate(baseDate.getUTCDate() + paymentTermsDays);
      return baseDate.toISOString().slice(0, 10);
    })();

    const explicitBillNumber = toText(req.body?.billNumber || req.body?.bill_number);
    let insertedBill = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const candidateBillNumber = explicitBillNumber || generateNumber('BILL');
      const { data, error } = await adminClient
        .from('payable_bills')
        .insert({
          bill_number: candidateBillNumber,
          goods_receipt_id: receipt.id,
          supplier_id: purchaseOrder.supplier_id,
          branch_id: purchaseOrder.branch_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          amount_due: invoiceTotal,
          amount_paid: 0,
          due_date: dueDate,
          currency: toText(purchaseOrder.currency) || 'MAD',
          status: invoiceTotal > 0 ? 'open' : 'paid',
        })
        .select('*')
        .single();

      if (!error) {
        insertedBill = data;
        break;
      }

      if (explicitBillNumber || !String(error.message || '').toLowerCase().includes('duplicate')) {
        warnings.push(`Payable bill creation failed: ${error.message}`);
        break;
      }
    }

    const { data: refreshedPoLines, error: refreshedPoLinesError } = await adminClient
      .from('purchase_order_lines')
      .select('ordered_qty, received_qty')
      .eq('purchase_order_id', purchaseOrderId);

    if (refreshedPoLinesError) {
      throw new Error(`Unable to refresh purchase order status: ${refreshedPoLinesError.message}`);
    }

    const orderedTotal = (refreshedPoLines || []).reduce((sum, line) => sum + toNumber(line.ordered_qty, 0), 0);
    const receivedTotal = (refreshedPoLines || []).reduce((sum, line) => sum + toNumber(line.received_qty, 0), 0);
    const nextPoStatus = receivedTotal + 0.0001 >= orderedTotal ? 'received' : 'partially_received';

    const { data: updatedPurchaseOrder, error: statusUpdateError } = await adminClient
      .from('purchase_orders')
      .update({ status: nextPoStatus })
      .eq('id', purchaseOrderId)
      .select('*')
      .single();

    if (statusUpdateError) {
      throw new Error(`Unable to update purchase order status: ${statusUpdateError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'purchase_orders.receive',
      entityType: 'goods_receipts',
      entityId: String(receipt.id),
      metadata: {
        purchaseOrderId,
        receiptNumber,
        matchStatus,
        lineCount: insertedReceiptLines?.length || 0,
      },
    });

    return res.status(201).json({
      ok: true,
      purchaseOrder: updatedPurchaseOrder,
      receipt,
      receiptLines: insertedReceiptLines || [],
      payableBill: insertedBill,
      invoiceMatch: {
        computedTotal,
        invoiceTotal,
        matchStatus,
      },
      warnings,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to receive purchase order.' });
  }
});

app.get('/purchase-orders/status', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_STATUS_VIEW);
    if (!access) return;

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const supplierFilter = toText(req.query?.supplierId || req.query?.supplier_id) || null;
    const statusFilter = toText(req.query?.status).toLowerCase() || null;
    const limit = Math.min(200, Math.max(1, toPositiveInteger(req.query?.limit) || 50));

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, count: 0, statusSummary: {}, orders: [] });
    }

    let ordersQuery = adminClient
      .from('purchase_orders')
      .select('id, po_number, supplier_id, branch_id, status, approval_required, approved_at, expected_delivery_date, total_amount, currency, created_at')
      .in('branch_id', branchIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (supplierFilter) {
      ordersQuery = ordersQuery.eq('supplier_id', supplierFilter);
    }

    if (statusFilter) {
      ordersQuery = ordersQuery.eq('status', statusFilter);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      throw new Error(`Unable to read purchase orders: ${ordersError.message}`);
    }

    let summaryQuery = adminClient
      .from('purchase_orders')
      .select('status')
      .in('branch_id', branchIds);

    if (supplierFilter) {
      summaryQuery = summaryQuery.eq('supplier_id', supplierFilter);
    }

    if (statusFilter) {
      summaryQuery = summaryQuery.eq('status', statusFilter);
    }

    const { data: summaryRows, error: summaryError } = await summaryQuery;
    if (summaryError) {
      throw new Error(`Unable to build purchase-order status summary: ${summaryError.message}`);
    }

    const supplierIds = [...new Set((orders || []).map((row) => toText(row.supplier_id)).filter(Boolean))];
    let supplierRows = [];
    if (supplierIds.length > 0) {
      const { data, error } = await adminClient
        .from('suppliers')
        .select('id, code, name')
        .in('id', supplierIds);
      if (error) {
        throw new Error(`Unable to read suppliers for status endpoint: ${error.message}`);
      }
      supplierRows = data || [];
    }

    const orderBranchIds = [...new Set((orders || []).map((row) => toText(row.branch_id)).filter(Boolean))];
    let branchRows = [];
    if (orderBranchIds.length > 0) {
      const branchTable = await resolveBranchTable();
      const { data, error } = await adminClient
        .from(branchTable)
        .select('id, code, name')
        .in('id', orderBranchIds);

      if (error) {
        throw new Error(`Unable to read branches for status endpoint: ${error.message}`);
      }
      branchRows = data || [];
    }

    const supplierMap = new Map();
    for (const row of supplierRows) {
      supplierMap.set(toText(row.id), row);
    }

    const branchMap = new Map();
    for (const row of branchRows) {
      branchMap.set(toText(row.id), row);
    }

    const statusSummary = {};
    for (const row of summaryRows || []) {
      const key = toText(row.status) || 'unknown';
      statusSummary[key] = (statusSummary[key] || 0) + 1;
    }

    const payload = (orders || []).map((order) => {
      const supplier = supplierMap.get(toText(order.supplier_id));
      const branch = branchMap.get(toText(order.branch_id));

      return {
        id: order.id,
        poNumber: toText(order.po_number),
        status: toText(order.status),
        approvalRequired: Boolean(order.approval_required),
        approvedAt: order.approved_at || null,
        expectedDeliveryDate: order.expected_delivery_date || null,
        totalAmount: toNumber(order.total_amount, 0),
        currency: toText(order.currency) || 'MAD',
        createdAt: order.created_at || null,
        supplier: supplier
          ? {
              id: toText(supplier.id),
              code: toText(supplier.code),
              name: toText(supplier.name),
            }
          : null,
        branch: branch
          ? {
              id: toText(branch.id),
              code: toText(branch.code),
              name: toText(branch.name),
            }
          : null,
      };
    });

    return res.json({
      ok: true,
      role: access.roleKey,
      count: payload.length,
      statusSummary,
      orders: payload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load purchase-order status.' });
  }
});

app.get('/suppliers/:id/price-history', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.SUPPLIERS_PRICE_HISTORY_VIEW);
    if (!access) return;

    const supplierId = toText(req.params?.id);
    if (!supplierId) {
      return res.status(400).json({ ok: false, message: 'Supplier id is required.' });
    }

    const ingredientFilter = toText(req.query?.ingredientId || req.query?.ingredient_id) || null;
    const limit = Math.min(500, Math.max(1, toPositiveInteger(req.query?.limit) || 100));

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, code, name, is_active')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierError) {
      throw new Error(`Unable to read supplier: ${supplierError.message}`);
    }

    if (!supplier?.id) {
      return res.status(404).json({ ok: false, message: 'Supplier not found.' });
    }

    let historyQuery = adminClient
      .from('supplier_price_history')
      .select('id, supplier_id, ingredient_id, unit_id, price, currency, lead_time_days, source_type, source_reference, effective_at, created_at')
      .eq('supplier_id', supplierId)
      .order('effective_at', { ascending: false })
      .limit(limit);

    if (ingredientFilter) {
      historyQuery = historyQuery.eq('ingredient_id', ingredientFilter);
    }

    const { data: historyRows, error: historyError } = await historyQuery;
    if (historyError) {
      throw new Error(`Unable to read supplier price history: ${historyError.message}`);
    }

    const ingredientIds = [...new Set((historyRows || []).map((row) => toText(row.ingredient_id)).filter(Boolean))];
    const unitIds = [...new Set((historyRows || []).map((row) => toText(row.unit_id)).filter(Boolean))];

    let ingredientRows = [];
    if (ingredientIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredients')
        .select('id, code, name')
        .in('id', ingredientIds);
      if (error) {
        throw new Error(`Unable to read ingredients for price history: ${error.message}`);
      }
      ingredientRows = data || [];
    }

    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);
      if (error) {
        throw new Error(`Unable to read units for price history: ${error.message}`);
      }
      unitRows = data || [];
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows) {
      ingredientMap.set(toText(row.id), row);
    }

    const unitMap = new Map();
    for (const row of unitRows) {
      unitMap.set(toText(row.id), row);
    }

    const comparisonMap = new Map();
    const historyPayload = (historyRows || []).map((row) => {
      const ingredientId = toText(row.ingredient_id);
      const ingredient = ingredientMap.get(ingredientId);
      const unit = unitMap.get(toText(row.unit_id));
      const price = toNumber(row.price, 0);
      const leadTimeDays = Math.max(0, Math.trunc(toNumber(row.lead_time_days, 0)));

      if (!comparisonMap.has(ingredientId)) {
        comparisonMap.set(ingredientId, {
          ingredientId,
          ingredientCode: toText(ingredient?.code) || null,
          ingredientName: toText(ingredient?.name) || null,
          sampleCount: 0,
          minPrice: price,
          maxPrice: price,
          latestPrice: null,
          latestAt: null,
          totalLeadTime: 0,
        });
      }

      const summary = comparisonMap.get(ingredientId);
      summary.sampleCount += 1;
      summary.minPrice = Math.min(summary.minPrice, price);
      summary.maxPrice = Math.max(summary.maxPrice, price);
      summary.totalLeadTime += leadTimeDays;
      if (!summary.latestAt) {
        summary.latestAt = row.effective_at;
        summary.latestPrice = price;
      }

      return {
        id: row.id,
        ingredientId,
        ingredientCode: toText(ingredient?.code) || null,
        ingredientName: toText(ingredient?.name) || null,
        unit: unit
          ? {
              id: toText(unit.id),
              name: toText(unit.name),
              symbol: toText(unit.symbol),
            }
          : null,
        price,
        currency: toText(row.currency) || 'MAD',
        leadTimeDays,
        sourceType: toText(row.source_type),
        sourceReference: toText(row.source_reference) || null,
        effectiveAt: row.effective_at || null,
        createdAt: row.created_at || null,
      };
    });

    const comparison = [...comparisonMap.values()]
      .map((summary) => ({
        ingredientId: summary.ingredientId,
        ingredientCode: summary.ingredientCode,
        ingredientName: summary.ingredientName,
        sampleCount: summary.sampleCount,
        minPrice: summary.minPrice,
        maxPrice: summary.maxPrice,
        latestPrice: summary.latestPrice,
        latestAt: summary.latestAt,
        averageLeadTimeDays: summary.sampleCount
          ? Number((summary.totalLeadTime / summary.sampleCount).toFixed(2))
          : null,
      }))
      .sort((a, b) => String(a.ingredientName || '').localeCompare(String(b.ingredientName || '')));

    return res.json({
      ok: true,
      supplier: {
        id: toText(supplier.id),
        code: toText(supplier.code),
        name: toText(supplier.name),
        isActive: Boolean(supplier.is_active),
      },
      count: historyPayload.length,
      comparison,
      history: historyPayload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load supplier price history.' });
  }
});

app.post('/cash-sessions/open', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.CASH_SESSIONS_OPEN);
    if (!access) return;

    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const shiftLabel = toText(req.body?.shiftLabel || req.body?.shift_label || 'default-shift');
    const openingBalance = toNumber(req.body?.openingBalance || req.body?.opening_balance, Number.NaN);
    const note = toText(req.body?.note) || null;

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (!shiftLabel) {
      return res.status(400).json({ ok: false, message: 'shiftLabel is required.' });
    }

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      return res.status(400).json({ ok: false, message: 'openingBalance must be a valid number >= 0.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single branch for this session.' });
    }

    const branchId = branchIds[0];
    const existingSession = await getOpenCashSessionForBranch(branchId);
    if (existingSession?.id) {
      return res.status(409).json({
        ok: false,
        message: 'An open cash session already exists for this branch.',
        sessionId: existingSession.id,
      });
    }

    const nowIso = new Date().toISOString();
    const { data: session, error: sessionError } = await adminClient
      .from('cash_sessions')
      .insert({
        branch_id: branchId,
        shift_label: shiftLabel,
        status: 'open',
        opening_balance: Number(openingBalance.toFixed(2)),
        expected_closing_balance: Number(openingBalance.toFixed(2)),
        note,
        opened_by_user_id: access.userId,
        opened_at: nowIso,
      })
      .select('*')
      .single();

    if (sessionError) {
      throw new Error(`Unable to open cash session: ${sessionError.message}`);
    }

    let openingMovement = null;
    if (openingBalance > 0) {
      const { data, error } = await adminClient
        .from('cash_movements')
        .insert({
          cash_session_id: session.id,
          branch_id: branchId,
          movement_kind: 'opening',
          direction: 'in',
          amount: Number(openingBalance.toFixed(2)),
          currency: 'MAD',
          reference_type: 'cash_session',
          reference_id: String(session.id),
          note: 'Opening balance',
          actor_user_id: access.userId,
          metadata: { source: 'api.cash-sessions.open' },
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Unable to insert opening movement: ${error.message}`);
      }

      openingMovement = data;
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'cash_sessions.open',
      entityType: 'cash_sessions',
      entityId: String(session.id),
      metadata: {
        branchId,
        shiftLabel,
        openingBalance: Number(openingBalance.toFixed(2)),
      },
    });

    return res.status(201).json({
      ok: true,
      session,
      openingMovement,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to open cash session.' });
  }
});

app.post('/cash-sessions/:id/close', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.CASH_SESSIONS_CLOSE);
    if (!access) return;

    const cashSessionId = toPositiveInteger(req.params?.id);
    const countedCash = toNumber(req.body?.countedCash || req.body?.counted_closing_balance, Number.NaN);
    const note = toText(req.body?.note) || null;

    if (!cashSessionId) {
      return res.status(400).json({ ok: false, message: 'Invalid cash session id.' });
    }

    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return res.status(400).json({ ok: false, message: 'countedCash must be a valid number >= 0.' });
    }

    const { data: session, error: sessionError } = await adminClient
      .from('cash_sessions')
      .select('*')
      .eq('id', cashSessionId)
      .maybeSingle();

    if (sessionError) {
      throw new Error(`Unable to read cash session: ${sessionError.message}`);
    }

    if (!session?.id) {
      return res.status(404).json({ ok: false, message: 'Cash session not found.' });
    }

    if (!hasBranchAccess(session.branch_id, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this cash session.' });
    }

    if (toText(session.status) !== 'open') {
      return res.status(400).json({ ok: false, message: 'Only open cash sessions can be closed.' });
    }

    const { data: movementRows, error: movementError } = await adminClient
      .from('cash_movements')
      .select('movement_kind, direction, amount')
      .eq('cash_session_id', cashSessionId);

    if (movementError) {
      throw new Error(`Unable to read cash movements: ${movementError.message}`);
    }

    let totalIn = 0;
    let totalOut = 0;
    for (const movement of movementRows || []) {
      const movementKind = toText(movement.movement_kind);
      if (movementKind === 'opening' || movementKind === 'closing') continue;

      const amount = Math.max(0, toNumber(movement.amount, 0));
      if (toText(movement.direction) === 'in') {
        totalIn += amount;
      } else {
        totalOut += amount;
      }
    }

    const openingBalance = toNumber(session.opening_balance, 0);
    const expectedClosingBalance = Number((openingBalance + totalIn - totalOut).toFixed(2));
    const safeCountedCash = Number(countedCash.toFixed(2));
    const differenceAmount = Number((safeCountedCash - expectedClosingBalance).toFixed(2));
    const nowIso = new Date().toISOString();

    const { data: updatedSession, error: updateError } = await adminClient
      .from('cash_sessions')
      .update({
        status: 'closed',
        expected_closing_balance: expectedClosingBalance,
        counted_closing_balance: safeCountedCash,
        difference_amount: differenceAmount,
        closed_by_user_id: access.userId,
        closed_at: nowIso,
        note: note || session.note || null,
      })
      .eq('id', cashSessionId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Unable to close cash session: ${updateError.message}`);
    }

    let closingMovement = null;
    if (Math.abs(differenceAmount) >= 0.01) {
      const { data, error } = await adminClient
        .from('cash_movements')
        .insert({
          cash_session_id: cashSessionId,
          branch_id: session.branch_id,
          movement_kind: 'closing',
          direction: differenceAmount >= 0 ? 'in' : 'out',
          amount: Number(Math.abs(differenceAmount).toFixed(2)),
          currency: 'MAD',
          reference_type: 'cash_session',
          reference_id: String(cashSessionId),
          note: 'Closing difference adjustment',
          actor_user_id: access.userId,
          metadata: { source: 'api.cash-sessions.close' },
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Unable to create closing movement: ${error.message}`);
      }
      closingMovement = data;
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'cash_sessions.close',
      entityType: 'cash_sessions',
      entityId: String(cashSessionId),
      metadata: {
        branchId: session.branch_id,
        expectedClosingBalance,
        countedCash: safeCountedCash,
        differenceAmount,
      },
    });

    return res.json({
      ok: true,
      session: updatedSession,
      totals: {
        cashIn: Number(totalIn.toFixed(2)),
        cashOut: Number(totalOut.toFixed(2)),
        openingBalance: Number(openingBalance.toFixed(2)),
        expectedClosingBalance,
        countedCash: safeCountedCash,
        differenceAmount,
      },
      closingMovement,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to close cash session.' });
  }
});

app.post('/expenses', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.EXPENSES_CREATE);
    if (!access) return;

    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const categoryId = toText(req.body?.categoryId || req.body?.category_id);
    const categoryCode = toText(req.body?.categoryCode || req.body?.category_code).toLowerCase();
    const paymentMethod = toText(req.body?.paymentMethod || req.body?.payment_method || 'cash').toLowerCase();
    const taxAmount = Number(Math.max(0, toNumber(req.body?.taxAmount || req.body?.tax_amount, 0)).toFixed(2));
    const expenseDate = toIsoDate(req.body?.expenseDate || req.body?.expense_date) || getTodayIsoDate();
    const currency = toText(req.body?.currency) || 'MAD';
    const vendorName = toText(req.body?.vendorName || req.body?.vendor_name) || null;
    const description = toText(req.body?.description) || null;
    const receiptNumber = toText(req.body?.receiptNumber || req.body?.receipt_number) || null;
    const note = toText(req.body?.note) || null;

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (!categoryId && !categoryCode) {
      return res.status(400).json({ ok: false, message: 'categoryId or categoryCode is required.' });
    }

    const amountGrossInput = toNumber(req.body?.amountGross || req.body?.amount_gross || req.body?.amount, Number.NaN);
    const amountNetInput = toNumber(req.body?.amountNet || req.body?.amount_net, Number.NaN);

    let amountNet = Number.isFinite(amountNetInput) ? amountNetInput : Number.NaN;
    let amountGross = Number.isFinite(amountGrossInput) ? amountGrossInput : Number.NaN;

    if (!Number.isFinite(amountNet) && Number.isFinite(amountGross)) {
      amountNet = amountGross - taxAmount;
    }
    if (!Number.isFinite(amountGross) && Number.isFinite(amountNet)) {
      amountGross = amountNet + taxAmount;
    }

    if (!Number.isFinite(amountNet) || !Number.isFinite(amountGross) || amountGross <= 0 || amountNet < 0) {
      return res.status(400).json({ ok: false, message: 'Invalid amountNet/amountGross values.' });
    }

    const validPaymentMethods = ['cash', 'card', 'mobile', 'transfer', 'other'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ ok: false, message: 'Unsupported paymentMethod.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single branch for expense entry.' });
    }

    const branchId = branchIds[0];

    let categoryQuery = adminClient
      .from('expense_categories')
      .select('id, code, name, is_active')
      .limit(1);

    if (categoryId) {
      categoryQuery = categoryQuery.eq('id', categoryId);
    } else {
      categoryQuery = categoryQuery.eq('code', categoryCode);
    }

    const { data: category, error: categoryError } = await categoryQuery.maybeSingle();
    if (categoryError) {
      throw new Error(`Unable to validate expense category: ${categoryError.message}`);
    }

    if (!category?.id || !category?.is_active) {
      return res.status(400).json({ ok: false, message: 'Expense category not found or inactive.' });
    }

    const nowIso = new Date().toISOString();
    const isAutoApproved = access.roleKey === 'manager' || access.roleKey === 'admin';
    const openSession = paymentMethod === 'cash' ? await getOpenCashSessionForBranch(branchId) : null;

    const { data: expense, error: expenseError } = await adminClient
      .from('expenses')
      .insert({
        branch_id: branchId,
        cash_session_id: openSession?.id || null,
        category_id: category.id,
        amount_net: Number(amountNet.toFixed(2)),
        tax_amount: Number(taxAmount.toFixed(2)),
        amount_gross: Number(amountGross.toFixed(2)),
        currency,
        payment_method: paymentMethod,
        vendor_name: vendorName,
        description,
        expense_date: expenseDate,
        receipt_number: receiptNumber,
        status: isAutoApproved ? 'approved' : 'recorded',
        entered_by_user_id: access.userId,
        approved_by_user_id: isAutoApproved ? access.userId : null,
        approved_at: isAutoApproved ? nowIso : null,
        metadata: {
          note,
          source: 'api.expenses.create',
        },
      })
      .select('*')
      .single();

    if (expenseError) {
      throw new Error(`Unable to create expense: ${expenseError.message}`);
    }

    let cashMovement = null;
    if (isAutoApproved && paymentMethod === 'cash' && openSession?.id) {
      const { data, error } = await adminClient
        .from('cash_movements')
        .insert({
          cash_session_id: openSession.id,
          branch_id: branchId,
          movement_kind: 'expense',
          direction: 'out',
          amount: Number(amountGross.toFixed(2)),
          currency,
          reference_type: 'expense',
          reference_id: String(expense.id),
          note: description || note || null,
          actor_user_id: access.userId,
          metadata: {
            source: 'api.expenses.create',
            categoryCode: toText(category.code),
          },
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Unable to insert expense cash movement: ${error.message}`);
      }

      cashMovement = data;
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'expenses.create',
      entityType: 'expenses',
      entityId: String(expense.id),
      metadata: {
        branchId,
        categoryCode: toText(category.code),
        amountGross: Number(amountGross.toFixed(2)),
        paymentMethod,
      },
    });

    return res.status(201).json({
      ok: true,
      expense,
      cashMovement,
      autoApproved: isAutoApproved,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create expense.' });
  }
});

app.post('/refunds/request', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.REFUNDS_REQUEST);
    if (!access) return;

    const paymentIdInput = toPositiveInteger(req.body?.paymentId || req.body?.payment_id);
    const orderIdInput = toPositiveInteger(req.body?.orderId || req.body?.order_id);
    const reason = toText(req.body?.reason);
    const requestTypeRaw = toText(req.body?.requestType || req.body?.request_type || 'refund').toLowerCase();
    const note = toText(req.body?.note) || null;

    if (!reason) {
      return res.status(400).json({ ok: false, message: 'reason is required.' });
    }

    if (!['refund', 'void'].includes(requestTypeRaw)) {
      return res.status(400).json({ ok: false, message: 'requestType must be refund or void.' });
    }

    let payment = null;
    if (paymentIdInput) {
      const { data, error } = await adminClient
        .from('payments')
        .select('*')
        .eq('id', paymentIdInput)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read payment: ${error.message}`);
      }
      payment = data || null;
    }

    if (!payment && orderIdInput) {
      const { data: orderRow, error: orderError } = await adminClient
        .from('cafe_orders')
        .select('id, branch_id, total_amount, status, created_at')
        .eq('id', orderIdInput)
        .maybeSingle();

      if (orderError) {
        throw new Error(`Unable to read order for payment backfill: ${orderError.message}`);
      }

      if (!orderRow?.id) {
        return res.status(404).json({ ok: false, message: 'Order not found for refund request.' });
      }

      const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id || orderRow.branch_id || 'main');
      const branchIds = await resolveInventoryBranchIds({
        requestedBranchId,
        roleKey: access.roleKey,
        branchAccess: access.branchAccess,
      });

      if (branchIds.length !== 1) {
        return res.status(400).json({ ok: false, message: 'Unable to resolve branch for fallback payment creation.' });
      }

      const branchId = branchIds[0];
      const paymentMethod = toText(req.body?.paymentMethod || req.body?.payment_method || 'cash').toLowerCase();
      const validPaymentMethods = ['cash', 'card', 'mobile', 'transfer', 'other'];
      if (!validPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ ok: false, message: 'Unsupported paymentMethod for fallback payment.' });
      }

      const gross = Number(Math.max(0, toNumber(orderRow.total_amount, 0)).toFixed(2));
      const tax = Number(Math.max(0, toNumber(req.body?.taxAmount || req.body?.tax_amount, 0)).toFixed(2));
      const net = Number(Math.max(0, gross - tax).toFixed(2));
      const paidAtRaw = toText(req.body?.paidAt || req.body?.paid_at);
      const paidAt = paidAtRaw ? new Date(paidAtRaw).toISOString() : new Date().toISOString();
      const openSession = paymentMethod === 'cash' ? await getOpenCashSessionForBranch(branchId) : null;

      const { data, error } = await adminClient
        .from('payments')
        .insert({
          order_id: orderRow.id,
          branch_id: branchId,
          cash_session_id: openSession?.id || null,
          payment_method: paymentMethod,
          status: 'captured',
          currency: toText(req.body?.currency) || 'MAD',
          amount_gross: gross,
          tax_amount: tax,
          amount_net: net,
          paid_at: paidAt,
          captured_by_user_id: access.userId,
          metadata: {
            source: 'api.refunds.request.payment_backfill',
            orderStatus: toText(orderRow.status) || null,
            orderCreatedAt: orderRow.created_at || null,
          },
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Unable to create fallback payment: ${error.message}`);
      }
      payment = data;
    }

    if (!payment?.id) {
      return res.status(400).json({ ok: false, message: 'Provide a valid paymentId or orderId.' });
    }

    const branchId = toText(payment.branch_id);
    if (!hasBranchAccess(branchId, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this refund request.' });
    }

    const approvedTotal = await getApprovedRefundTotalForPayment(payment.id);
    const paymentGross = Math.max(0, toNumber(payment.amount_gross, 0));
    const remainingRefundable = Number(Math.max(0, paymentGross - approvedTotal).toFixed(2));

    let requestedAmount = toNumber(req.body?.requestedAmount || req.body?.requested_amount || req.body?.amount, Number.NaN);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      requestedAmount = paymentGross;
    }
    if (requestTypeRaw === 'void') {
      requestedAmount = remainingRefundable;
    }
    requestedAmount = Number(requestedAmount.toFixed(2));

    if (requestedAmount <= 0) {
      return res.status(400).json({ ok: false, message: 'No refundable amount remains for this payment.' });
    }

    if (requestedAmount > remainingRefundable + 0.01) {
      return res.status(400).json({
        ok: false,
        message: 'Requested amount exceeds remaining refundable balance.',
        remainingRefundable,
      });
    }

    const { data: refund, error: refundError } = await adminClient
      .from('refunds')
      .insert({
        payment_id: payment.id,
        order_id: payment.order_id || orderIdInput || null,
        branch_id: branchId,
        request_type: requestTypeRaw,
        status: 'requested',
        requested_amount: requestedAmount,
        reason,
        note,
        requested_by_user_id: access.userId,
        requested_at: new Date().toISOString(),
        metadata: {
          source: 'api.refunds.request',
          paymentMethod: toText(payment.payment_method),
        },
      })
      .select('*')
      .single();

    if (refundError) {
      throw new Error(`Unable to create refund request: ${refundError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'refunds.request',
      entityType: 'refunds',
      entityId: String(refund.id),
      metadata: {
        paymentId: payment.id,
        branchId,
        requestType: requestTypeRaw,
        requestedAmount,
      },
    });

    return res.status(201).json({
      ok: true,
      refund,
      payment,
      remainingRefundable,
      remainingAfterRequest: Number(Math.max(0, remainingRefundable - requestedAmount).toFixed(2)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to request refund.' });
  }
});

app.post('/refunds/:id/approve', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.REFUNDS_APPROVE);
    if (!access) return;

    const refundId = toPositiveInteger(req.params?.id);
    if (!refundId) {
      return res.status(400).json({ ok: false, message: 'Invalid refund id.' });
    }

    const { data: refund, error: refundError } = await adminClient
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .maybeSingle();

    if (refundError) {
      throw new Error(`Unable to read refund request: ${refundError.message}`);
    }

    if (!refund?.id) {
      return res.status(404).json({ ok: false, message: 'Refund request not found.' });
    }

    if (!hasBranchAccess(refund.branch_id, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this refund request.' });
    }

    if (toText(refund.status) !== 'requested') {
      return res.status(400).json({ ok: false, message: 'Only requested refunds can be approved.' });
    }

    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .select('*')
      .eq('id', refund.payment_id)
      .maybeSingle();

    if (paymentError) {
      throw new Error(`Unable to read linked payment: ${paymentError.message}`);
    }

    if (!payment?.id) {
      return res.status(404).json({ ok: false, message: 'Linked payment not found.' });
    }

    const approvedTotalBefore = await getApprovedRefundTotalForPayment(payment.id);
    const remainingRefundable = Number(Math.max(0, toNumber(payment.amount_gross, 0) - approvedTotalBefore).toFixed(2));

    let approvedAmount = toNumber(req.body?.approvedAmount || req.body?.approved_amount, Number.NaN);
    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      approvedAmount = Math.max(0, toNumber(refund.requested_amount, 0));
    }

    if (toText(refund.request_type) === 'void') {
      approvedAmount = remainingRefundable;
    }

    approvedAmount = Number(approvedAmount.toFixed(2));

    if (approvedAmount <= 0) {
      return res.status(400).json({ ok: false, message: 'Approved amount must be greater than zero.' });
    }

    if (approvedAmount > remainingRefundable + 0.01) {
      return res.status(400).json({
        ok: false,
        message: 'Approved amount exceeds remaining refundable amount.',
        remainingRefundable,
      });
    }

    if (approvedAmount > toNumber(refund.requested_amount, 0) + 0.01 && toText(refund.request_type) !== 'void') {
      return res.status(400).json({ ok: false, message: 'Approved amount cannot exceed requested amount.' });
    }

    const nowIso = new Date().toISOString();
    const { data: approvedRefund, error: approveError } = await adminClient
      .from('refunds')
      .update({
        status: 'approved',
        approved_amount: approvedAmount,
        approved_by_user_id: access.userId,
        approved_at: nowIso,
        note: toText(req.body?.note) || refund.note || null,
      })
      .eq('id', refundId)
      .select('*')
      .single();

    if (approveError) {
      throw new Error(`Unable to approve refund: ${approveError.message}`);
    }

    const approvedTotalAfter = Number((approvedTotalBefore + approvedAmount).toFixed(2));
    const paymentGross = Number(Math.max(0, toNumber(payment.amount_gross, 0)).toFixed(2));

    let paymentStatus = 'partially_refunded';
    if (toText(refund.request_type) === 'void') {
      paymentStatus = 'voided';
    } else if (approvedTotalAfter + 0.01 >= paymentGross) {
      paymentStatus = 'refunded';
    }

    const { data: updatedPayment, error: updatePaymentError } = await adminClient
      .from('payments')
      .update({ status: paymentStatus })
      .eq('id', payment.id)
      .select('*')
      .single();

    if (updatePaymentError) {
      throw new Error(`Unable to update payment after refund approval: ${updatePaymentError.message}`);
    }

    let cashMovement = null;
    if (toText(payment.payment_method) === 'cash') {
      const openSession = await getOpenCashSessionForBranch(refund.branch_id);
      const { data, error } = await adminClient
        .from('cash_movements')
        .insert({
          cash_session_id: openSession?.id || null,
          branch_id: refund.branch_id,
          movement_kind: 'refund',
          direction: 'out',
          amount: approvedAmount,
          currency: toText(payment.currency) || 'MAD',
          reference_type: 'refund',
          reference_id: String(approvedRefund.id),
          note: toText(approvedRefund.reason) || null,
          actor_user_id: access.userId,
          metadata: {
            source: 'api.refunds.approve',
            paymentId: payment.id,
          },
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Unable to create cash movement for approved refund: ${error.message}`);
      }

      cashMovement = data;
    }

    let voidedOrder = null;
    if (toText(refund.request_type) === 'void' && toPositiveInteger(payment.order_id)) {
      const { data, error } = await adminClient
        .from('cafe_orders')
        .update({ status: 'cancelled' })
        .eq('id', payment.order_id)
        .select('id, status')
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to mark order as cancelled after void approval: ${error.message}`);
      }

      voidedOrder = data || null;
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'refunds.approve',
      entityType: 'refunds',
      entityId: String(refundId),
      metadata: {
        paymentId: payment.id,
        approvedAmount,
        requestType: toText(refund.request_type),
        paymentStatus,
      },
    });

    return res.json({
      ok: true,
      refund: approvedRefund,
      payment: updatedPayment,
      cashMovement,
      voidedOrder,
      remainingRefundable: Number(Math.max(0, paymentGross - approvedTotalAfter).toFixed(2)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to approve refund.' });
  }
});

app.get('/finance/daily-summary', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.DAILY_SUMMARY_VIEW);
    if (!access) return;

    const targetDate = toIsoDate(req.query?.date) || getTodayIsoDate();
    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, date: targetDate, summary: null, branches: [] });
    }

    const rangeStart = toStartOfDayIso(targetDate);
    const rangeEnd = toEndOfDayIso(targetDate);

    const [{ data: paymentRows, error: paymentError }, { data: refundRows, error: refundError }, { data: expenseRows, error: expenseError }, { data: openedSessions, error: openedError }, { data: closedSessions, error: closedError }] = await Promise.all([
      adminClient
        .from('payments')
        .select('branch_id, status, amount_gross, amount_net, tax_amount')
        .in('branch_id', branchIds)
        .gte('paid_at', rangeStart)
        .lte('paid_at', rangeEnd),
      adminClient
        .from('refunds')
        .select('branch_id, approved_amount, requested_amount')
        .in('branch_id', branchIds)
        .eq('status', 'approved')
        .gte('approved_at', rangeStart)
        .lte('approved_at', rangeEnd),
      adminClient
        .from('expenses')
        .select('branch_id, amount_gross, tax_amount, status')
        .in('branch_id', branchIds)
        .eq('expense_date', targetDate),
      adminClient
        .from('cash_sessions')
        .select('branch_id, opening_balance')
        .in('branch_id', branchIds)
        .gte('opened_at', rangeStart)
        .lte('opened_at', rangeEnd),
      adminClient
        .from('cash_sessions')
        .select('branch_id, expected_closing_balance, counted_closing_balance')
        .in('branch_id', branchIds)
        .eq('status', 'closed')
        .gte('closed_at', rangeStart)
        .lte('closed_at', rangeEnd),
    ]);

    if (paymentError) throw new Error(`Unable to read payments for summary: ${paymentError.message}`);
    if (refundError) throw new Error(`Unable to read refunds for summary: ${refundError.message}`);
    if (expenseError) throw new Error(`Unable to read expenses for summary: ${expenseError.message}`);
    if (openedError) throw new Error(`Unable to read opened sessions for summary: ${openedError.message}`);
    if (closedError) throw new Error(`Unable to read closed sessions for summary: ${closedError.message}`);

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name')
      .in('id', branchIds);

    if (branchError) {
      throw new Error(`Unable to read branch metadata for summary: ${branchError.message}`);
    }

    const branchSummaryMap = new Map();
    for (const branchId of branchIds) {
      branchSummaryMap.set(branchId, {
        branchId,
        branchCode: null,
        branchName: null,
        salesGross: 0,
        salesTax: 0,
        salesNet: 0,
        refundsTotal: 0,
        expensesTotal: 0,
        expenseTax: 0,
        grossProfit: 0,
        netProfit: 0,
        cashOpening: 0,
        cashClosing: 0,
        taxLiability: 0,
      });
    }

    for (const row of branchRows || []) {
      const branchId = toText(row.id);
      if (!branchSummaryMap.has(branchId)) continue;

      const summary = branchSummaryMap.get(branchId);
      summary.branchCode = toText(row.code) || null;
      summary.branchName = toText(row.name) || null;
    }

    for (const row of paymentRows || []) {
      const branchId = toText(row.branch_id);
      const summary = branchSummaryMap.get(branchId);
      if (!summary) continue;
      if (toText(row.status) === 'voided') continue;

      summary.salesGross += Math.max(0, toNumber(row.amount_gross, 0));
      summary.salesTax += Math.max(0, toNumber(row.tax_amount, 0));
      summary.salesNet += Math.max(0, toNumber(row.amount_net, 0));
    }

    for (const row of refundRows || []) {
      const branchId = toText(row.branch_id);
      const summary = branchSummaryMap.get(branchId);
      if (!summary) continue;

      const approvedAmount = toNumber(row.approved_amount, Number.NaN);
      summary.refundsTotal += Number.isFinite(approvedAmount)
        ? Math.max(0, approvedAmount)
        : Math.max(0, toNumber(row.requested_amount, 0));
    }

    for (const row of expenseRows || []) {
      if (toText(row.status) === 'voided') continue;

      const branchId = toText(row.branch_id);
      const summary = branchSummaryMap.get(branchId);
      if (!summary) continue;

      summary.expensesTotal += Math.max(0, toNumber(row.amount_gross, 0));
      summary.expenseTax += Math.max(0, toNumber(row.tax_amount, 0));
    }

    for (const row of openedSessions || []) {
      const branchId = toText(row.branch_id);
      const summary = branchSummaryMap.get(branchId);
      if (!summary) continue;

      summary.cashOpening += Math.max(0, toNumber(row.opening_balance, 0));
    }

    for (const row of closedSessions || []) {
      const branchId = toText(row.branch_id);
      const summary = branchSummaryMap.get(branchId);
      if (!summary) continue;

      const counted = toNumber(row.counted_closing_balance, Number.NaN);
      const expected = Math.max(0, toNumber(row.expected_closing_balance, 0));
      summary.cashClosing += Number.isFinite(counted) ? Math.max(0, counted) : expected;
    }

    const branchPayload = [...branchSummaryMap.values()].map((summary) => {
      const salesGross = Number(summary.salesGross.toFixed(2));
      const salesTax = Number(summary.salesTax.toFixed(2));
      const salesNet = Number(summary.salesNet.toFixed(2));
      const refundsTotal = Number(summary.refundsTotal.toFixed(2));
      const expensesTotal = Number(summary.expensesTotal.toFixed(2));
      const cashOpening = Number(summary.cashOpening.toFixed(2));
      const cashClosing = Number(summary.cashClosing.toFixed(2));
      const grossProfit = Number((salesNet - refundsTotal).toFixed(2));
      const netProfit = Number((grossProfit - expensesTotal).toFixed(2));
      const taxLiability = Number((salesTax - summary.expenseTax).toFixed(2));

      return {
        branchId: summary.branchId,
        branchCode: summary.branchCode,
        branchName: summary.branchName,
        salesGross,
        salesTax,
        salesNet,
        refundsTotal,
        expensesTotal,
        grossProfit,
        netProfit,
        cashOpening,
        cashClosing,
        taxLiability,
      };
    });

    const totals = branchPayload.reduce((acc, row) => ({
      salesGross: acc.salesGross + row.salesGross,
      salesTax: acc.salesTax + row.salesTax,
      salesNet: acc.salesNet + row.salesNet,
      refundsTotal: acc.refundsTotal + row.refundsTotal,
      expensesTotal: acc.expensesTotal + row.expensesTotal,
      grossProfit: acc.grossProfit + row.grossProfit,
      netProfit: acc.netProfit + row.netProfit,
      cashOpening: acc.cashOpening + row.cashOpening,
      cashClosing: acc.cashClosing + row.cashClosing,
      taxLiability: acc.taxLiability + row.taxLiability,
    }), {
      salesGross: 0,
      salesTax: 0,
      salesNet: 0,
      refundsTotal: 0,
      expensesTotal: 0,
      grossProfit: 0,
      netProfit: 0,
      cashOpening: 0,
      cashClosing: 0,
      taxLiability: 0,
    });

    const closureRows = branchPayload.map((row) => ({
      branch_id: row.branchId,
      closure_date: targetDate,
      sales_gross: row.salesGross,
      sales_tax: row.salesTax,
      sales_net: row.salesNet,
      refunds_total: row.refundsTotal,
      expenses_total: row.expensesTotal,
      gross_profit: row.grossProfit,
      net_profit: row.netProfit,
      cash_opening: row.cashOpening,
      cash_closing: row.cashClosing,
      tax_liability: row.taxLiability,
      snapshot_by_user_id: access.userId,
      snapshot_at: new Date().toISOString(),
      metadata: {
        source: 'api.finance.daily-summary',
      },
    }));

    const { error: closureError } = await adminClient
      .from('financial_closures')
      .upsert(closureRows, { onConflict: 'branch_id,closure_date' });

    if (closureError) {
      throw new Error(`Unable to snapshot daily financial closure: ${closureError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'finance.daily_summary.view',
      entityType: 'financial_closures',
      entityId: targetDate,
      metadata: {
        branchCount: branchPayload.length,
        totals,
      },
    });

    return res.json({
      ok: true,
      date: targetDate,
      role: access.roleKey,
      summary: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(2))])),
      branches: branchPayload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load daily finance summary.' });
  }
});

app.get('/finance/export', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, FINANCE_PERMISSION_KEYS.EXPORT_VIEW);
    if (!access) return;

    const fromDate = toIsoDate(req.query?.from || req.query?.startDate) || getTodayIsoDate();
    const toDate = toIsoDate(req.query?.to || req.query?.endDate) || fromDate;
    if (fromDate > toDate) {
      return res.status(400).json({ ok: false, message: 'from date must be <= to date.' });
    }

    const format = ['csv', 'json'].includes(toText(req.query?.format).toLowerCase())
      ? toText(req.query?.format).toLowerCase()
      : 'json';
    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, format, fromDate, toDate, rowCount: 0, totals: {}, data: format === 'csv' ? '' : [] });
    }

    const rangeStart = toStartOfDayIso(fromDate);
    const rangeEnd = toEndOfDayIso(toDate);

    const [{ data: paymentRows, error: paymentError }, { data: refundRows, error: refundError }, { data: expenseRows, error: expenseError }] = await Promise.all([
      adminClient
        .from('payments')
        .select('id, order_id, branch_id, payment_method, status, currency, amount_gross, amount_net, tax_amount, paid_at')
        .in('branch_id', branchIds)
        .gte('paid_at', rangeStart)
        .lte('paid_at', rangeEnd),
      adminClient
        .from('refunds')
        .select('id, payment_id, branch_id, request_type, approved_amount, requested_amount, approved_at')
        .in('branch_id', branchIds)
        .eq('status', 'approved')
        .gte('approved_at', rangeStart)
        .lte('approved_at', rangeEnd),
      adminClient
        .from('expenses')
        .select('id, branch_id, category_id, amount_gross, amount_net, tax_amount, currency, expense_date, vendor_name, receipt_number, status')
        .in('branch_id', branchIds)
        .gte('expense_date', fromDate)
        .lte('expense_date', toDate),
    ]);

    if (paymentError) throw new Error(`Unable to read payments for export: ${paymentError.message}`);
    if (refundError) throw new Error(`Unable to read refunds for export: ${refundError.message}`);
    if (expenseError) throw new Error(`Unable to read expenses for export: ${expenseError.message}`);

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name')
      .in('id', branchIds);
    if (branchError) throw new Error(`Unable to read branch metadata for export: ${branchError.message}`);

    const expenseCategoryIds = [...new Set((expenseRows || []).map((row) => toText(row.category_id)).filter(Boolean))];
    let categoryRows = [];
    if (expenseCategoryIds.length > 0) {
      const { data, error } = await adminClient
        .from('expense_categories')
        .select('id, code, gl_account_code')
        .in('id', expenseCategoryIds);
      if (error) throw new Error(`Unable to read expense categories for export: ${error.message}`);
      categoryRows = data || [];
    }

    const [globalMappingsResult, branchMappingsResult] = await Promise.all([
      adminClient
        .from('gl_mappings')
        .select('branch_id, mapping_type, source_key, gl_account_code, is_active')
        .is('branch_id', null)
        .eq('is_active', true),
      adminClient
        .from('gl_mappings')
        .select('branch_id, mapping_type, source_key, gl_account_code, is_active')
        .in('branch_id', branchIds)
        .eq('is_active', true),
    ]);

    if (globalMappingsResult.error) {
      throw new Error(`Unable to read global GL mappings: ${globalMappingsResult.error.message}`);
    }
    if (branchMappingsResult.error) {
      throw new Error(`Unable to read branch GL mappings: ${branchMappingsResult.error.message}`);
    }

    const branchMap = new Map();
    for (const row of branchRows || []) {
      branchMap.set(toText(row.id), row);
    }

    const categoryMap = new Map();
    for (const row of categoryRows) {
      categoryMap.set(toText(row.id), row);
    }

    const mappingMap = new Map();
    const allMappings = [...(globalMappingsResult.data || []), ...(branchMappingsResult.data || [])];
    for (const mapping of allMappings) {
      const key = `${toText(mapping.branch_id) || '*'}::${toText(mapping.mapping_type)}::${toText(mapping.source_key)}`;
      mappingMap.set(key, toText(mapping.gl_account_code));
    }

    const resolveGlCode = (branchId, mappingType, sourceKey, fallbackCode) => {
      const branchKey = `${toText(branchId)}::${mappingType}::${sourceKey}`;
      if (mappingMap.has(branchKey)) return mappingMap.get(branchKey);

      const globalKey = `*::${mappingType}::${sourceKey}`;
      if (mappingMap.has(globalKey)) return mappingMap.get(globalKey);

      return fallbackCode;
    };

    const exportRows = [];
    const totals = {
      salesGross: 0,
      salesNet: 0,
      salesTax: 0,
      refundsTotal: 0,
      expensesTotal: 0,
    };

    for (const payment of paymentRows || []) {
      if (toText(payment.status) === 'voided') continue;

      const branchId = toText(payment.branch_id);
      const branch = branchMap.get(branchId);
      const gross = Number(Math.max(0, toNumber(payment.amount_gross, 0)).toFixed(2));
      const net = Number(Math.max(0, toNumber(payment.amount_net, 0)).toFixed(2));
      const tax = Number(Math.max(0, toNumber(payment.tax_amount, 0)).toFixed(2));

      totals.salesGross += gross;
      totals.salesNet += net;
      totals.salesTax += tax;

      exportRows.push({
        recordType: 'sale',
        date: toIsoDate(payment.paid_at) || null,
        branchId,
        branchCode: toText(branch?.code) || null,
        reference: `PAY-${payment.id}`,
        sourceId: payment.id,
        glAccountCode: resolveGlCode(branchId, 'sales', 'default', '7010'),
        counterAccountCode: resolveGlCode(branchId, 'payment_method', toText(payment.payment_method), '5199'),
        amountNet: net,
        taxAmount: tax,
        grossAmount: gross,
        currency: toText(payment.currency) || 'MAD',
        note: `payment_method=${toText(payment.payment_method) || 'n/a'}`,
      });
    }

    for (const refund of refundRows || []) {
      const branchId = toText(refund.branch_id);
      const branch = branchMap.get(branchId);
      const amount = Number(Math.max(0, toNumber(refund.approved_amount, toNumber(refund.requested_amount, 0))).toFixed(2));

      totals.refundsTotal += amount;

      exportRows.push({
        recordType: 'refund',
        date: toIsoDate(refund.approved_at) || null,
        branchId,
        branchCode: toText(branch?.code) || null,
        reference: `RF-${refund.id}`,
        sourceId: refund.id,
        glAccountCode: resolveGlCode(branchId, 'refund', 'default', '7090'),
        counterAccountCode: resolveGlCode(branchId, 'sales', 'default', '7010'),
        amountNet: Number((-amount).toFixed(2)),
        taxAmount: 0,
        grossAmount: Number((-amount).toFixed(2)),
        currency: 'MAD',
        note: `request_type=${toText(refund.request_type) || 'refund'}`,
      });
    }

    for (const expense of expenseRows || []) {
      if (toText(expense.status) === 'voided') continue;

      const branchId = toText(expense.branch_id);
      const branch = branchMap.get(branchId);
      const category = categoryMap.get(toText(expense.category_id));
      const gross = Number(Math.max(0, toNumber(expense.amount_gross, 0)).toFixed(2));
      const net = Number(Math.max(0, toNumber(expense.amount_net, 0)).toFixed(2));
      const tax = Number(Math.max(0, toNumber(expense.tax_amount, 0)).toFixed(2));
      const categoryCode = toText(category?.code) || 'other';

      totals.expensesTotal += gross;

      exportRows.push({
        recordType: 'expense',
        date: toIsoDate(expense.expense_date) || expense.expense_date || null,
        branchId,
        branchCode: toText(branch?.code) || null,
        reference: `EXP-${expense.id}`,
        sourceId: expense.id,
        glAccountCode: resolveGlCode(branchId, 'expense_category', categoryCode, toText(category?.gl_account_code) || '6199'),
        counterAccountCode: resolveGlCode(branchId, 'payment_method', 'cash', '5310'),
        amountNet: Number((-net).toFixed(2)),
        taxAmount: Number((-tax).toFixed(2)),
        grossAmount: Number((-gross).toFixed(2)),
        currency: toText(expense.currency) || 'MAD',
        note: toText(expense.vendor_name || expense.receipt_number) || null,
      });
    }

    exportRows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    const normalizedTotals = {
      salesGross: Number(totals.salesGross.toFixed(2)),
      salesNet: Number(totals.salesNet.toFixed(2)),
      salesTax: Number(totals.salesTax.toFixed(2)),
      refundsTotal: Number(totals.refundsTotal.toFixed(2)),
      expensesTotal: Number(totals.expensesTotal.toFixed(2)),
      netBeforeExpenses: Number((totals.salesNet - totals.refundsTotal).toFixed(2)),
      netAfterExpenses: Number((totals.salesNet - totals.refundsTotal - totals.expensesTotal).toFixed(2)),
    };

    const exportNumber = generateNumber('FX');
    const singleBranchId = branchIds.length === 1 ? branchIds[0] : null;
    const payload = format === 'json'
      ? { rows: exportRows }
      : { csv: buildCsv(exportRows) };

    const { data: exportLog, error: exportLogError } = await adminClient
      .from('fiscal_exports')
      .insert({
        export_number: exportNumber,
        branch_id: singleBranchId,
        period_start: fromDate,
        period_end: toDate,
        format,
        status: 'generated',
        row_count: exportRows.length,
        totals: normalizedTotals,
        payload,
        generated_by_user_id: access.userId,
        generated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (exportLogError) {
      throw new Error(`Unable to persist fiscal export: ${exportLogError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'finance.export.view',
      entityType: 'fiscal_exports',
      entityId: String(exportLog.id),
      metadata: {
        format,
        rowCount: exportRows.length,
        fromDate,
        toDate,
      },
    });

    return res.json({
      ok: true,
      export: {
        id: exportLog.id,
        exportNumber,
        format,
        fromDate,
        toDate,
        rowCount: exportRows.length,
        totals: normalizedTotals,
      },
      data: format === 'csv' ? payload.csv : exportRows,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to generate finance export.' });
  }
});

app.post('/shifts', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.SHIFTS_CREATE);
    if (!access) return;

    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const shiftLabel = toText(req.body?.shiftLabel || req.body?.shift_label || req.body?.name);
    const shiftType = toText(req.body?.shiftType || req.body?.shift_type || 'general').toLowerCase();
    const startsAt = toIsoTimestamp(req.body?.startsAt || req.body?.starts_at, null);
    const endsAt = toIsoTimestamp(req.body?.endsAt || req.body?.ends_at, null);
    const notes = toText(req.body?.notes || req.body?.note) || null;
    const assignmentsInput = Array.isArray(req.body?.assignments) ? req.body.assignments : [];

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (!shiftLabel) {
      return res.status(400).json({ ok: false, message: 'shiftLabel is required.' });
    }

    if (!startsAt || !endsAt) {
      return res.status(400).json({ ok: false, message: 'startsAt and endsAt are required (valid timestamps).' });
    }

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return res.status(400).json({ ok: false, message: 'endsAt must be greater than startsAt.' });
    }

    const allowedShiftTypes = ['opening', 'closing', 'general', 'morning', 'evening', 'night'];
    if (!allowedShiftTypes.includes(shiftType)) {
      return res.status(400).json({ ok: false, message: 'Invalid shiftType.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single branch for this shift.' });
    }

    const branchId = branchIds[0];
    const nowMs = Date.now();
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();

    const requestedStatus = toText(req.body?.status).toLowerCase();
    const defaultStatus = nowMs >= startMs && nowMs <= endMs ? 'in_progress' : 'scheduled';
    const shiftStatus = ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(requestedStatus)
      ? requestedStatus
      : defaultStatus;

    const { data: shift, error: shiftError } = await adminClient
      .from('shifts')
      .insert({
        branch_id: branchId,
        shift_label: shiftLabel,
        shift_type: shiftType,
        starts_at: startsAt,
        ends_at: endsAt,
        status: shiftStatus,
        notes,
        created_by_user_id: access.userId,
      })
      .select('*')
      .single();

    if (shiftError) {
      throw new Error(`Unable to create shift: ${shiftError.message}`);
    }

    const normalizedAssignments = [];
    const assignmentUsers = new Set();

    for (let index = 0; index < assignmentsInput.length; index += 1) {
      const assignmentInput = assignmentsInput[index];
      const userId = toText(assignmentInput?.userId || assignmentInput?.user_id);
      if (!userId) {
        return res.status(400).json({ ok: false, message: `Assignment ${index + 1} is missing userId.` });
      }
      if (assignmentUsers.has(userId)) continue;
      assignmentUsers.add(userId);

      normalizedAssignments.push({
        shift_id: shift.id,
        user_id: userId,
        role_key: normalizeRole(toText(assignmentInput?.roleKey || assignmentInput?.role_key || 'staff')),
        status: 'assigned',
        assigned_by_user_id: access.userId,
        assigned_at: new Date().toISOString(),
        note: toText(assignmentInput?.note) || null,
      });
    }

    let assignmentRows = [];
    if (normalizedAssignments.length > 0) {
      const { data, error } = await adminClient
        .from('shift_assignments')
        .insert(normalizedAssignments)
        .select('*');

      if (error) {
        throw new Error(`Unable to create shift assignments: ${error.message}`);
      }

      assignmentRows = data || [];
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'shifts.create',
      entityType: 'shifts',
      entityId: String(shift.id),
      metadata: {
        branchId,
        shiftLabel,
        shiftType,
        assignments: assignmentRows.length,
      },
    });

    return res.status(201).json({
      ok: true,
      shift,
      assignments: assignmentRows,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create shift.' });
  }
});

app.post('/attendance/check-in', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.ATTENDANCE_CHECK_IN);
    if (!access) return;

    const userId = access.userId;
    const explicitShiftId = toPositiveInteger(req.body?.shiftId || req.body?.shift_id);
    const explicitAssignmentId = toPositiveInteger(req.body?.assignmentId || req.body?.assignment_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const eventAt = toIsoTimestamp(req.body?.eventAt || req.body?.event_at, new Date().toISOString());
    const note = toText(req.body?.note) || null;

    const { data: lastLog, error: lastLogError } = await adminClient
      .from('attendance_logs')
      .select('id, event_type, event_at, branch_id, shift_id, assignment_id')
      .eq('user_id', userId)
      .order('event_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastLogError) {
      throw new Error(`Unable to read previous attendance logs: ${lastLogError.message}`);
    }

    if (toText(lastLog?.event_type) === 'check_in') {
      return res.status(409).json({ ok: false, message: 'User is already checked in.' });
    }

    let assignment = null;
    let shift = null;

    if (explicitAssignmentId) {
      const { data, error } = await adminClient
        .from('shift_assignments')
        .select('*')
        .eq('id', explicitAssignmentId)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read assignment for check-in: ${error.message}`);
      }

      if (!data?.id) {
        return res.status(404).json({ ok: false, message: 'Shift assignment not found.' });
      }

      if (toText(data.user_id) !== userId) {
        return res.status(403).json({ ok: false, message: 'This assignment is not linked to the current user.' });
      }

      assignment = data;
    }

    if (explicitShiftId && !assignment) {
      const { data, error } = await adminClient
        .from('shift_assignments')
        .select('*')
        .eq('shift_id', explicitShiftId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read assignment by shift: ${error.message}`);
      }

      assignment = data || null;
    }

    if (assignment?.shift_id) {
      const { data, error } = await adminClient
        .from('shifts')
        .select('*')
        .eq('id', assignment.shift_id)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read shift for assignment: ${error.message}`);
      }

      shift = data || null;
    } else if (explicitShiftId) {
      const { data, error } = await adminClient
        .from('shifts')
        .select('*')
        .eq('id', explicitShiftId)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read explicit shift: ${error.message}`);
      }

      shift = data || null;
    }

    if (!assignment && !shift) {
      const { data: recentAssignments, error: recentAssignmentsError } = await adminClient
        .from('shift_assignments')
        .select('*')
        .eq('user_id', userId)
        .order('assigned_at', { ascending: false })
        .limit(30);

      if (recentAssignmentsError) {
        throw new Error(`Unable to read recent assignments: ${recentAssignmentsError.message}`);
      }

      const shiftIds = [...new Set((recentAssignments || []).map((row) => toPositiveInteger(row.shift_id)).filter(Boolean))];
      if (shiftIds.length > 0) {
        const { data: candidateShifts, error: candidateShiftsError } = await adminClient
          .from('shifts')
          .select('*')
          .in('id', shiftIds)
          .order('starts_at', { ascending: false });

        if (candidateShiftsError) {
          throw new Error(`Unable to read candidate shifts: ${candidateShiftsError.message}`);
        }

        const eventMs = new Date(eventAt).getTime();
        const activeShift = (candidateShifts || []).find((row) => {
          const status = toText(row.status);
          if (status === 'cancelled' || status === 'completed') return false;

          const startMs = new Date(row.starts_at).getTime();
          const endMs = new Date(row.ends_at).getTime();
          return Number.isFinite(startMs) && Number.isFinite(endMs) && eventMs >= startMs && eventMs <= endMs;
        });

        if (activeShift?.id) {
          shift = activeShift;
          assignment = (recentAssignments || []).find((row) => toPositiveInteger(row.shift_id) === toPositiveInteger(activeShift.id)) || null;
        }
      }
    }

    let branchId = toText(shift?.branch_id || requestedBranchId);
    if (!branchId) {
      branchId = toText(access.branchAccess.find((entry) => entry.isDefault)?.branchId || access.branchAccess[0]?.branchId || 'main');
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId: branchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve branch for check-in.' });
    }

    branchId = branchIds[0];

    if (shift?.id && toText(shift.branch_id) !== branchId) {
      branchId = toText(shift.branch_id);
      if (!hasBranchAccess(branchId, access.roleKey, access.branchAccess)) {
        return res.status(403).json({ ok: false, message: 'Branch access denied for this shift.' });
      }
    }

    if (shift?.id && toText(shift.status) === 'scheduled') {
      const eventMs = new Date(eventAt).getTime();
      const startMs = new Date(shift.starts_at).getTime();
      const endMs = new Date(shift.ends_at).getTime();

      if (Number.isFinite(eventMs) && Number.isFinite(startMs) && Number.isFinite(endMs) && eventMs >= startMs && eventMs <= endMs) {
        await adminClient
          .from('shifts')
          .update({ status: 'in_progress' })
          .eq('id', shift.id);
      }
    }

    const latitude = toNumber(req.body?.latitude, Number.NaN);
    const longitude = toNumber(req.body?.longitude, Number.NaN);

    const { data: attendanceLog, error: attendanceError } = await adminClient
      .from('attendance_logs')
      .insert({
        user_id: userId,
        branch_id: branchId,
        shift_id: shift?.id || null,
        assignment_id: assignment?.id || null,
        event_type: 'check_in',
        event_at: eventAt,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        device_info: toText(req.body?.deviceInfo || req.body?.device_info) || null,
        note,
        metadata: {
          source: 'api.attendance.check-in',
        },
      })
      .select('*')
      .single();

    if (attendanceError) {
      throw new Error(`Unable to create attendance check-in log: ${attendanceError.message}`);
    }

    if (assignment?.id) {
      const assignmentUpdate = {
        status: 'checked_in',
        check_in_at: eventAt,
      };
      if (!assignment.assigned_at) {
        assignmentUpdate.assigned_at = eventAt;
      }

      await adminClient
        .from('shift_assignments')
        .update(assignmentUpdate)
        .eq('id', assignment.id);
    }

    let lateArrival = 0;
    if (shift?.starts_at) {
      const shiftStartMs = new Date(shift.starts_at).getTime();
      const eventMs = new Date(eventAt).getTime();
      if (Number.isFinite(shiftStartMs) && Number.isFinite(eventMs) && eventMs - shiftStartMs > 5 * 60 * 1000) {
        lateArrival = 1;
      }
    }

    const kpiDate = toIsoDate(eventAt) || getTodayIsoDate();
    const updatedKpi = await upsertStaffKpiMetrics({
      userId,
      branchId,
      kpiDate,
      deltas: {
        late_arrivals: lateArrival,
      },
      metadataPatch: {
        lastCheckInAt: eventAt,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: 'attendance.check_in',
      entityType: 'attendance_logs',
      entityId: String(attendanceLog.id),
      metadata: {
        branchId,
        shiftId: shift?.id || null,
        assignmentId: assignment?.id || null,
        lateArrival,
      },
    });

    return res.status(201).json({
      ok: true,
      attendance: attendanceLog,
      shift,
      assignment,
      lateArrival: Boolean(lateArrival),
      staffKpi: updatedKpi,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to check in attendance.' });
  }
});

app.post('/attendance/check-out', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.ATTENDANCE_CHECK_OUT);
    if (!access) return;

    const userId = access.userId;
    const eventAt = toIsoTimestamp(req.body?.eventAt || req.body?.event_at, new Date().toISOString());
    const note = toText(req.body?.note) || null;

    const { data: recentLogs, error: recentLogsError } = await adminClient
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .order('event_at', { ascending: false })
      .limit(20);

    if (recentLogsError) {
      throw new Error(`Unable to read recent attendance logs: ${recentLogsError.message}`);
    }

    const latestLog = (recentLogs || [])[0] || null;
    if (!latestLog || toText(latestLog.event_type) !== 'check_in') {
      return res.status(400).json({ ok: false, message: 'No active check-in found. Check-in is required before check-out.' });
    }

    const branchId = toText(latestLog.branch_id);
    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId: branchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this attendance log.' });
    }

    const assignmentId = toPositiveInteger(req.body?.assignmentId || req.body?.assignment_id || latestLog.assignment_id);
    let assignment = null;
    if (assignmentId) {
      const { data, error } = await adminClient
        .from('shift_assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read assignment for check-out: ${error.message}`);
      }

      if (data?.id && toText(data.user_id) !== userId) {
        return res.status(403).json({ ok: false, message: 'Assignment is not linked to the current user.' });
      }

      assignment = data || null;
    }

    const eventMs = new Date(eventAt).getTime();
    const checkInMs = new Date(latestLog.event_at).getTime();
    const workedMinutes = Number.isFinite(eventMs) && Number.isFinite(checkInMs)
      ? Math.max(0, Math.round((eventMs - checkInMs) / 60000))
      : 0;

    const latitude = toNumber(req.body?.latitude, Number.NaN);
    const longitude = toNumber(req.body?.longitude, Number.NaN);

    const { data: attendanceLog, error: attendanceError } = await adminClient
      .from('attendance_logs')
      .insert({
        user_id: userId,
        branch_id: branchId,
        shift_id: latestLog.shift_id || assignment?.shift_id || null,
        assignment_id: assignment?.id || latestLog.assignment_id || null,
        event_type: 'check_out',
        event_at: eventAt,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        device_info: toText(req.body?.deviceInfo || req.body?.device_info) || null,
        note,
        metadata: {
          source: 'api.attendance.check-out',
          checkInLogId: latestLog.id,
        },
      })
      .select('*')
      .single();

    if (attendanceError) {
      throw new Error(`Unable to create attendance check-out log: ${attendanceError.message}`);
    }

    if (assignment?.id) {
      await adminClient
        .from('shift_assignments')
        .update({
          status: 'checked_out',
          check_out_at: eventAt,
        })
        .eq('id', assignment.id);
    }

    const shiftId = toPositiveInteger(latestLog.shift_id || assignment?.shift_id);
    if (shiftId) {
      const { data: shiftAssignments, error: shiftAssignmentsError } = await adminClient
        .from('shift_assignments')
        .select('status')
        .eq('shift_id', shiftId);

      if (shiftAssignmentsError) {
        throw new Error(`Unable to verify shift completion state: ${shiftAssignmentsError.message}`);
      }

      const allDone = (shiftAssignments || []).length > 0 && (shiftAssignments || []).every((row) => {
        const status = toText(row.status);
        return status === 'checked_out' || status === 'absent';
      });

      if (allDone) {
        await adminClient
          .from('shifts')
          .update({ status: 'completed' })
          .eq('id', shiftId);
      }
    }

    const kpiDate = toIsoDate(eventAt) || getTodayIsoDate();
    const updatedKpi = await upsertStaffKpiMetrics({
      userId,
      branchId,
      kpiDate,
      deltas: {
        attendance_minutes: workedMinutes,
      },
      metadataPatch: {
        lastCheckOutAt: eventAt,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: 'attendance.check_out',
      entityType: 'attendance_logs',
      entityId: String(attendanceLog.id),
      metadata: {
        branchId,
        workedMinutes,
        shiftId,
      },
    });

    return res.status(201).json({
      ok: true,
      attendance: attendanceLog,
      workedMinutes,
      staffKpi: updatedKpi,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to check out attendance.' });
  }
});

app.get('/attendance/today', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.ATTENDANCE_TODAY_VIEW);
    if (!access) return;

    const targetDate = toIsoDate(req.query?.date) || getTodayIsoDate();
    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, date: targetDate, logs: [], summary: [] });
    }

    let query = adminClient
      .from('attendance_logs')
      .select('*')
      .in('branch_id', branchIds)
      .gte('event_at', toStartOfDayIso(targetDate))
      .lte('event_at', toEndOfDayIso(targetDate))
      .order('event_at', { ascending: true });

    if (access.roleKey === 'staff') {
      query = query.eq('user_id', access.userId);
    }

    const { data: logs, error: logsError } = await query;
    if (logsError) {
      throw new Error(`Unable to load attendance logs: ${logsError.message}`);
    }

    const userIds = [...new Set((logs || []).map((row) => toText(row.user_id)).filter(Boolean))];
    let userRows = [];
    if (userIds.length > 0) {
      const { data, error } = await adminClient
        .from('users')
        .select('id, email, role_key')
        .in('id', userIds);
      if (error) {
        throw new Error(`Unable to load users for attendance summary: ${error.message}`);
      }
      userRows = data || [];
    }

    const shiftIds = [...new Set((logs || []).map((row) => toPositiveInteger(row.shift_id)).filter(Boolean))];
    let shiftRows = [];
    if (shiftIds.length > 0) {
      const { data, error } = await adminClient
        .from('shifts')
        .select('id, shift_label, shift_type, starts_at, ends_at, status')
        .in('id', shiftIds);
      if (error) {
        throw new Error(`Unable to load shifts for attendance summary: ${error.message}`);
      }
      shiftRows = data || [];
    }

    const userMap = new Map();
    for (const row of userRows) {
      userMap.set(toText(row.id), row);
    }

    const shiftMap = new Map();
    for (const row of shiftRows) {
      shiftMap.set(toPositiveInteger(row.id), row);
    }

    const summaryMap = new Map();
    const logsByUser = new Map();
    for (const log of logs || []) {
      const userId = toText(log.user_id);
      if (!logsByUser.has(userId)) logsByUser.set(userId, []);
      logsByUser.get(userId).push(log);
    }

    for (const [userId, userLogs] of logsByUser.entries()) {
      let workedMinutes = 0;
      let openCheckInAt = null;
      let checkInCount = 0;
      let checkOutCount = 0;

      for (const row of userLogs) {
        const eventType = toText(row.event_type);
        const eventTime = new Date(row.event_at).getTime();

        if (eventType === 'check_in') {
          checkInCount += 1;
          openCheckInAt = Number.isFinite(eventTime) ? eventTime : openCheckInAt;
        } else if (eventType === 'check_out') {
          checkOutCount += 1;
          if (openCheckInAt && Number.isFinite(eventTime) && eventTime >= openCheckInAt) {
            workedMinutes += Math.round((eventTime - openCheckInAt) / 60000);
          }
          openCheckInAt = null;
        }
      }

      const user = userMap.get(userId);
      summaryMap.set(userId, {
        userId,
        email: toText(user?.email) || null,
        role: normalizeRole(user?.role_key),
        checkIns: checkInCount,
        checkOuts: checkOutCount,
        workedMinutes,
        openSession: openCheckInAt !== null,
      });
    }

    const payloadLogs = (logs || []).map((row) => {
      const user = userMap.get(toText(row.user_id));
      const shift = shiftMap.get(toPositiveInteger(row.shift_id));

      return {
        id: row.id,
        userId: toText(row.user_id),
        userEmail: toText(user?.email) || null,
        branchId: toText(row.branch_id),
        shiftId: toPositiveInteger(row.shift_id),
        shiftLabel: toText(shift?.shift_label) || null,
        shiftType: toText(shift?.shift_type) || null,
        assignmentId: toPositiveInteger(row.assignment_id),
        eventType: toText(row.event_type),
        eventAt: row.event_at,
        latitude: row.latitude,
        longitude: row.longitude,
        deviceInfo: toText(row.device_info) || null,
        note: toText(row.note) || null,
      };
    });

    return res.json({
      ok: true,
      date: targetDate,
      role: access.roleKey,
      logs: payloadLogs,
      summary: [...summaryMap.values()].sort((a, b) => String(a.email || '').localeCompare(String(b.email || ''))),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load today attendance.' });
  }
});

app.post('/checklists/:id/complete', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.CHECKLISTS_COMPLETE);
    if (!access) return;

    const templateId = toText(req.params?.id);
    if (!templateId) {
      return res.status(400).json({ ok: false, message: 'Checklist template id is required.' });
    }

    const { data: template, error: templateError } = await adminClient
      .from('checklist_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    if (templateError) {
      throw new Error(`Unable to load checklist template: ${templateError.message}`);
    }

    if (!template?.id || !template.is_active) {
      return res.status(404).json({ ok: false, message: 'Checklist template not found or inactive.' });
    }

    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id || template.branch_id);
    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve branch for checklist completion.' });
    }

    const branchId = branchIds[0];
    const shiftId = toPositiveInteger(req.body?.shiftId || req.body?.shift_id);
    const assignmentId = toPositiveInteger(req.body?.assignmentId || req.body?.assignment_id);
    let completedItems = [];
    if (Array.isArray(req.body?.completedItems)) {
      completedItems = req.body.completedItems;
    } else if (Array.isArray(req.body?.items)) {
      completedItems = req.body.items;
    }
    const runDate = toIsoDate(req.body?.runDate || req.body?.run_date) || getTodayIsoDate();
    const notes = toText(req.body?.notes || req.body?.note) || null;
    const requestedStatus = toText(req.body?.status).toLowerCase();
    let status = 'completed';
    if (['in_progress', 'completed', 'failed'].includes(requestedStatus)) {
      status = requestedStatus;
    }

    const { data: checklistRun, error: checklistError } = await adminClient
      .from('checklist_runs')
      .insert({
        template_id: template.id,
        branch_id: branchId,
        shift_id: shiftId || null,
        assignment_id: assignmentId || null,
        run_date: runDate,
        status,
        completed_items: completedItems,
        notes,
        completed_by_user_id: access.userId,
      })
      .select('*')
      .single();

    if (checklistError) {
      throw new Error(`Unable to create checklist run: ${checklistError.message}`);
    }

    const updatedKpi = await upsertStaffKpiMetrics({
      userId: access.userId,
      branchId,
      kpiDate: runDate,
      deltas: {
        checklists_completed: status === 'completed' ? 1 : 0,
      },
      metadataPatch: {
        lastChecklistRunId: checklistRun.id,
      },
    });

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'checklists.complete',
      entityType: 'checklist_runs',
      entityId: String(checklistRun.id),
      metadata: {
        templateId,
        branchId,
        status,
      },
    });

    return res.status(201).json({
      ok: true,
      checklistRun,
      staffKpi: updatedKpi,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to complete checklist.' });
  }
});

app.post('/incidents', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.INCIDENTS_CREATE);
    if (!access) return;

    const shiftId = toPositiveInteger(req.body?.shiftId || req.body?.shift_id);
    const incidentType = toText(req.body?.incidentType || req.body?.incident_type);
    const severity = normalizeIncidentSeverity(req.body?.severity);
    const title = toText(req.body?.title);
    const description = toText(req.body?.description) || null;
    const occurredAt = toIsoTimestamp(req.body?.occurredAt || req.body?.occurred_at, new Date().toISOString());
    const attachmentsInput = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

    if (!incidentType) {
      return res.status(400).json({ ok: false, message: 'incidentType is required.' });
    }

    if (!title) {
      return res.status(400).json({ ok: false, message: 'title is required.' });
    }

    let shift = null;
    if (shiftId) {
      const { data, error } = await adminClient
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .maybeSingle();

      if (error) {
        throw new Error(`Unable to read shift for incident: ${error.message}`);
      }

      shift = data || null;
      if (!shift?.id) {
        return res.status(404).json({ ok: false, message: 'Shift not found for incident report.' });
      }
    }

    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id || shift?.branch_id);
    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single branch for incident.' });
    }

    const branchId = branchIds[0];
    if (shift?.id && toText(shift.branch_id) !== branchId) {
      return res.status(400).json({ ok: false, message: 'Shift branch does not match incident branch.' });
    }

    const { data: incident, error: incidentError } = await adminClient
      .from('incidents')
      .insert({
        branch_id: branchId,
        shift_id: shiftId || null,
        reported_by_user_id: access.userId,
        incident_type: incidentType,
        severity,
        status: 'open',
        title,
        description,
        occurred_at: occurredAt,
        metadata: {
          source: 'api.incidents.create',
          extra: toObject(req.body?.metadata),
        },
      })
      .select('*')
      .single();

    if (incidentError) {
      throw new Error(`Unable to create incident: ${incidentError.message}`);
    }

    const normalizedAttachments = [];
    for (const entry of attachmentsInput) {
      const fileUrl = toText(entry?.fileUrl || entry?.file_url);
      if (!fileUrl) continue;

      normalizedAttachments.push({
        incident_id: incident.id,
        file_url: fileUrl,
        mime_type: toText(entry?.mimeType || entry?.mime_type) || null,
        file_name: toText(entry?.fileName || entry?.file_name) || null,
        size_bytes: toPositiveInteger(entry?.sizeBytes || entry?.size_bytes) || null,
        uploaded_by_user_id: access.userId,
      });
    }

    let attachmentRows = [];
    if (normalizedAttachments.length > 0) {
      const { data, error } = await adminClient
        .from('incident_attachments')
        .insert(normalizedAttachments)
        .select('*');

      if (error) {
        throw new Error(`Unable to create incident attachments: ${error.message}`);
      }
      attachmentRows = data || [];
    }

    const updatedKpi = await upsertStaffKpiMetrics({
      userId: access.userId,
      branchId,
      kpiDate: toIsoDate(occurredAt) || getTodayIsoDate(),
      deltas: {
        incidents_reported: 1,
      },
      metadataPatch: {
        lastIncidentId: incident.id,
      },
    });

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'incidents.create',
      entityType: 'incidents',
      entityId: String(incident.id),
      metadata: {
        branchId,
        shiftId: shiftId || null,
        severity,
        attachmentCount: attachmentRows.length,
      },
    });

    return res.status(201).json({
      ok: true,
      incident,
      attachments: attachmentRows,
      staffKpi: updatedKpi,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create incident report.' });
  }
});

app.get('/staff/kpis', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, WORKFORCE_PERMISSION_KEYS.STAFF_KPIS_VIEW);
    if (!access) return;

    const explicitDate = toIsoDate(req.query?.date);
    const fromDate = explicitDate || toIsoDate(req.query?.from || req.query?.startDate) || getTodayIsoDate();
    const toDate = explicitDate || toIsoDate(req.query?.to || req.query?.endDate) || fromDate;
    if (fromDate > toDate) {
      return res.status(400).json({ ok: false, message: 'from date must be <= to date.' });
    }

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const requestedUserId = toText(req.query?.userId || req.query?.user_id) || null;
    const limit = Math.min(400, Math.max(1, toPositiveInteger(req.query?.limit) || 120));

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, rows: [], summary: null });
    }

    let userFilter = requestedUserId;
    if (access.roleKey === 'staff') {
      if (requestedUserId && requestedUserId !== access.userId) {
        return res.status(403).json({ ok: false, message: 'Staff can only view their own KPI data.' });
      }
      userFilter = access.userId;
    }

    let query = adminClient
      .from('staff_kpis')
      .select('*')
      .in('branch_id', branchIds)
      .gte('kpi_date', fromDate)
      .lte('kpi_date', toDate)
      .order('kpi_date', { ascending: false })
      .limit(limit);

    if (userFilter) {
      query = query.eq('user_id', userFilter);
    }

    const { data: kpiRows, error: kpiError } = await query;
    if (kpiError) {
      throw new Error(`Unable to load staff KPIs: ${kpiError.message}`);
    }

    const userIds = [...new Set((kpiRows || []).map((row) => toText(row.user_id)).filter(Boolean))];
    let userRows = [];
    if (userIds.length > 0) {
      const { data, error } = await adminClient
        .from('users')
        .select('id, email, role_key')
        .in('id', userIds);
      if (error) {
        throw new Error(`Unable to load users for KPI dashboard: ${error.message}`);
      }
      userRows = data || [];
    }

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name')
      .in('id', branchIds);
    if (branchError) {
      throw new Error(`Unable to load branches for KPI dashboard: ${branchError.message}`);
    }

    const userMap = new Map();
    for (const row of userRows) {
      userMap.set(toText(row.id), row);
    }

    const branchMap = new Map();
    for (const row of branchRows || []) {
      branchMap.set(toText(row.id), row);
    }

    const payloadRows = (kpiRows || []).map((row) => {
      const user = userMap.get(toText(row.user_id));
      const branch = branchMap.get(toText(row.branch_id));

      return {
        id: row.id,
        userId: toText(row.user_id),
        userEmail: toText(user?.email) || null,
        userRole: normalizeRole(user?.role_key),
        branchId: toText(row.branch_id),
        branchCode: toText(branch?.code) || null,
        branchName: toText(branch?.name) || null,
        kpiDate: row.kpi_date,
        ordersHandled: Math.max(0, Math.trunc(toNumber(row.orders_handled, 0))),
        ordersServed: Math.max(0, Math.trunc(toNumber(row.orders_served, 0))),
        ordersCancelled: Math.max(0, Math.trunc(toNumber(row.orders_cancelled, 0))),
        attendanceMinutes: Math.max(0, Math.trunc(toNumber(row.attendance_minutes, 0))),
        checklistsCompleted: Math.max(0, Math.trunc(toNumber(row.checklists_completed, 0))),
        incidentsReported: Math.max(0, Math.trunc(toNumber(row.incidents_reported, 0))),
        lateArrivals: Math.max(0, Math.trunc(toNumber(row.late_arrivals, 0))),
        performanceScore: Number(toNumber(row.performance_score, 0).toFixed(2)),
      };
    });

    const summaryTotals = payloadRows.reduce((acc, row) => ({
      ordersHandled: acc.ordersHandled + row.ordersHandled,
      ordersServed: acc.ordersServed + row.ordersServed,
      ordersCancelled: acc.ordersCancelled + row.ordersCancelled,
      attendanceMinutes: acc.attendanceMinutes + row.attendanceMinutes,
      checklistsCompleted: acc.checklistsCompleted + row.checklistsCompleted,
      incidentsReported: acc.incidentsReported + row.incidentsReported,
      lateArrivals: acc.lateArrivals + row.lateArrivals,
      performanceScoreTotal: acc.performanceScoreTotal + row.performanceScore,
    }), {
      ordersHandled: 0,
      ordersServed: 0,
      ordersCancelled: 0,
      attendanceMinutes: 0,
      checklistsCompleted: 0,
      incidentsReported: 0,
      lateArrivals: 0,
      performanceScoreTotal: 0,
    });

    const summary = {
      rowCount: payloadRows.length,
      uniqueStaff: new Set(payloadRows.map((row) => row.userId)).size,
      totals: {
        ordersHandled: summaryTotals.ordersHandled,
        ordersServed: summaryTotals.ordersServed,
        ordersCancelled: summaryTotals.ordersCancelled,
        attendanceMinutes: summaryTotals.attendanceMinutes,
        checklistsCompleted: summaryTotals.checklistsCompleted,
        incidentsReported: summaryTotals.incidentsReported,
        lateArrivals: summaryTotals.lateArrivals,
      },
      averagePerformanceScore: payloadRows.length > 0
        ? Number((summaryTotals.performanceScoreTotal / payloadRows.length).toFixed(2))
        : 0,
      topPerformers: [...payloadRows]
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 5)
        .map((row) => ({
          userId: row.userId,
          userEmail: row.userEmail,
          branchId: row.branchId,
          branchCode: row.branchCode,
          performanceScore: row.performanceScore,
          attendanceMinutes: row.attendanceMinutes,
          ordersServed: row.ordersServed,
        })),
    };

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'staff.kpis.view',
      entityType: 'staff_kpis',
      entityId: `${fromDate}:${toDate}`,
      metadata: {
        branchCount: branchIds.length,
        rowCount: payloadRows.length,
        filteredUserId: userFilter || null,
      },
    });

    return res.json({
      ok: true,
      role: access.roleKey,
      fromDate,
      toDate,
      rows: payloadRows,
      summary,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load staff KPI dashboard.' });
  }
});

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  console.error(`[${APP_NAME}] unhandled error`, error);
  return res.status(500).json({ ok: false, message: error?.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`[${APP_NAME}] running on http://localhost:${PORT}`);
});
