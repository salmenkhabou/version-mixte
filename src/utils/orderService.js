import { createClient } from '@supabase/supabase-js';
import { supabaseClient } from '../lib/supabaseClient';
import { getActiveBranchId } from './branchService';
import {
  enqueueOfflineOperation,
  flushOfflineQueue,
  getOfflineQueueStats,
} from './offlineQueue';

const ORDER_TABLE = 'cafe_orders';
const ORDER_EVENTS_TABLE = 'cafe_order_events';
const CASH_CLOSURES_TABLE = 'cafe_cash_closures';
const OFFLINE_ORDER_CREATE_OPERATION = 'orders.create';
const VALID_STATUSES = ['pending', 'preparing', 'served', 'cancelled'];
const TABLE_NUMBER_REGEX = /^[0-9]{1,3}$/;

export const ORDER_STATUS_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: [],
  cancelled: [],
};

function normalizeStatus(value) {
  return VALID_STATUSES.includes(value) ? value : 'pending';
}

export function isAllowedStatusTransition(fromStatus, nextStatus) {
  const from = normalizeStatus(fromStatus);
  const next = normalizeStatus(nextStatus);
  return Boolean(ORDER_STATUS_TRANSITIONS[from]?.includes(next));
}

export function dedupeNumericOrderIds(ids) {
  return [
    ...new Set(
      (ids || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

export function resolveShortcutTargets({ selectedOrderIds, focusedOrderId, pagedOrders }) {
  const selected = dedupeNumericOrderIds(selectedOrderIds);
  if (selected.length > 0) return selected;

  const focused = Number(focusedOrderId);
  if (Number.isInteger(focused) && focused > 0) return [focused];

  const firstPageOrder = Array.isArray(pagedOrders) && pagedOrders[0] ? Number(pagedOrders[0].id) : null;
  if (Number.isInteger(firstPageOrder) && firstPageOrder > 0) return [firstPageOrder];

  return [];
}

export function canManageOrdersFromRoles({ isStaff, isAdmin }) {
  return Boolean(isStaff) || Boolean(isAdmin);
}

function minutesSinceDate(value, nowMs = Date.now()) {
  const ts = new Date(value || 0).getTime();
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.floor((nowMs - ts) / 60000));
}

export function recommendSmartDispatchOrder(orders, currentUserId, options = {}) {
  const normalizedCurrentUserId = String(currentUserId || '').trim();
  if (!normalizedCurrentUserId) {
    return {
      orderId: null,
      blocked: true,
      reason: 'Utilisateur non identifie pour le dispatch.',
      currentLoad: 0,
      teamAverageLoad: 0,
    };
  }

  const list = Array.isArray(orders) ? orders : [];
  const maxActiveLoad = Number(options.maxActiveLoad) > 0 ? Number(options.maxActiveLoad) : 3;
  const nowMs = Number(options.nowMs) > 0 ? Number(options.nowMs) : Date.now();

  const pendingUnassigned = list.filter(
    (order) => String(order?.status || '') === 'pending' && !String(order?.assignedTo || '').trim(),
  );

  if (pendingUnassigned.length === 0) {
    return {
      orderId: null,
      blocked: false,
      reason: 'Aucune commande pending non assignee.',
      currentLoad: 0,
      teamAverageLoad: 0,
    };
  }

  const activeLoads = {};
  list.forEach((order) => {
    const status = String(order?.status || '');
    if (status !== 'pending' && status !== 'preparing') return;
    const assignee = String(order?.assignedTo || '').trim();
    if (!assignee) return;
    activeLoads[assignee] = (activeLoads[assignee] || 0) + 1;
  });

  const currentLoad = activeLoads[normalizedCurrentUserId] || 0;
  const teamLoadValues = Object.values(activeLoads);
  const teamAverageLoad = teamLoadValues.length
    ? Math.round((teamLoadValues.reduce((sum, value) => sum + value, 0) / teamLoadValues.length) * 10) / 10
    : 0;

  const dynamicCap = maxActiveLoad;
  if (currentLoad >= dynamicCap) {
    return {
      orderId: null,
      blocked: true,
      reason: `Charge actuelle elevee (${currentLoad}). Limite dynamique: ${dynamicCap}.`,
      currentLoad,
      teamAverageLoad,
    };
  }

  const candidate = [...pendingUnassigned]
    .sort((a, b) => {
      const delayDiff = minutesSinceDate(b?.createdAt, nowMs) - minutesSinceDate(a?.createdAt, nowMs);
      if (delayDiff !== 0) return delayDiff;

      const aTs = new Date(a?.createdAt || 0).getTime();
      const bTs = new Date(b?.createdAt || 0).getTime();
      return aTs - bTs;
    })[0];

  return {
    orderId: candidate?.id ? Number(candidate.id) : null,
    blocked: false,
    reason: candidate?.id
      ? `Commande prioritaire ${candidate.orderNumber || `#${candidate.id}`} recommandee.`
      : 'Aucune commande prioritaire disponible.',
    currentLoad,
    teamAverageLoad,
  };
}

export function formatOrderErrorMessage(message) {
  const text = String(message || 'Erreur inconnue');
  if (text.includes('Could not find the function public.update_order_status_secure')) {
    return 'Fonction SQL update_order_status_secure introuvable (cache schema). Synchronisez la base puis rechargez la page.';
  }
  if (text.includes('ORDER_ERR_CANCEL_REASON_REQUIRED')) {
    return 'Motif d annulation obligatoire.';
  }
  if (text.includes('ORDER_ERR_SERVED_REQUIRES_PREPARING')) {
    return 'Impossible de servir sans passer par Preparing.';
  }
  if (text.includes('ORDER_ERR_INVALID_TRANSITION')) {
    return 'Transition de statut non autorisee.';
  }
  if (text.includes('ORDER_ERR_NOT_FOUND')) {
    return 'Commande introuvable.';
  }
  if (text.includes('ORDER_ERR_ACCESS_DENIED')) {
    return 'Acces refuse pour cette operation.';
  }
  return text;
}

function isMissingUpdateStatusFunctionError(error) {
  const code = String(error?.code || '').trim();
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return code === 'PGRST202' || text.includes('Could not find the function public.update_order_status_secure');
}

function isMissingRpcFunctionError(error, rpcName) {
  const code = String(error?.code || '').trim();
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return code === 'PGRST202' || text.includes(`Could not find the function public.${rpcName}`);
}

async function callUpdateOrderStatusRpc({ orderId, nextStatus, reason, source, terminal }) {
  const attempts = [
    {
      p_order_id: orderId,
      p_next_status: nextStatus,
      p_reason: reason,
      p_source: source,
      p_terminal: terminal,
    },
    {
      p_order_id: orderId,
      p_next_status: nextStatus,
    },
    {
      p_next_status: nextStatus,
      p_order_id: orderId,
      p_reason: reason,
      p_source: source,
      p_terminal: terminal,
    },
    {
      p_next_status: nextStatus,
      p_order_id: orderId,
    },
  ];

  let lastError = null;

  for (const payload of attempts) {
    const { data, error } = await supabaseClient.rpc('update_order_status_secure', payload);
    if (!error) {
      return { data, error: null };
    }

    lastError = error;
    if (!isMissingUpdateStatusFunctionError(error)) {
      return { data: null, error };
    }
  }

  return { data: null, error: lastError };
}

function normalizeOrder(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    orderNumber: String(row.order_number || '').trim(),
    tableNumber: String(row.table_number || '').trim(),
    customerName: String(row.customer_name || '').trim(),
    customerPhone: String(row.customer_phone || '').trim(),
    notes: String(row.notes || '').trim(),
    status: normalizeStatus(row.status),
    totalAmount: Number(row.total_amount || 0),
    assignedTo: row.assigned_to || null,
    assignedAt: row.assigned_at || null,
    preparedAt: row.prepared_at || null,
    servedAt: row.served_at || null,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOrderEvent(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email || null,
    eventType: String(row.event_type || '').trim(),
    fromStatus: row.from_status || null,
    toStatus: row.to_status || null,
    source: row.source || null,
    terminal: row.terminal || null,
    reason: row.reason || null,
    metadata: row.metadata || null,
    createdAt: row.created_at,
  };
}

function normalizeCashClosure(row) {
  return {
    id: row.id,
    closedAt: row.closed_at || row.created_at || null,
    closedBy: String(row.closed_by_email || '').trim(),
    closedByUserId: row.closed_by_user_id || null,
    periodLabel: String(row.period_label || '').trim(),
    note: String(row.note || '').trim(),
    totalOrders: Number(row.orders_total || 0),
    servedCount: Number(row.orders_served || 0),
    cancelledCount: Number(row.orders_cancelled || 0),
    revenueServed: Number(row.revenue_served || 0),
    cancelledAmount: Number(row.amount_cancelled || 0),
    activeAmount: Number(row.amount_active || 0),
    countedCash: Number(row.counted_cash || 0),
    expectedCash: Number(row.expected_cash || 0),
    cashDifference: Number(row.cash_difference || 0),
    differenceAlert: Boolean(row.difference_alert),
    servedWithinTargetRate: Number(row.sla_rate || 0),
  };
}

function createIdempotencyKey(seed = '') {
  if (typeof globalThis?.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${seed}`;
}

function sanitizeItems(items) {
  return items
    .map((item) => {
      const quantity = Number(item?.quantity || 0);
      const price = Number(item?.price || 0);
      return {
        id: item?.id,
        name: String(item?.name || '').trim(),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
        price: Number.isFinite(price) && price >= 0 ? price : 0,
      };
    })
    .filter((item) => item.quantity > 0 && item.name);
}

async function executeCreateOrderRpc(args) {
  return supabaseClient.rpc('create_cafe_order', args);
}

function shouldRetryOrder(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout');
}

function calculateTotal(items) {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);
}

function shouldQueueOfflineOrder() {
  return globalThis.navigator?.onLine === false;
}

function enqueueOrderCreation({ rpcArgs, tableNumber, customerPhone, items, reason }) {
  const queueEntry = enqueueOfflineOperation({
    type: OFFLINE_ORDER_CREATE_OPERATION,
    payload: rpcArgs,
    meta: {
      reason,
      tableNumber,
      branchId: getActiveBranchId(),
      queuedAt: new Date().toISOString(),
    },
  });

  return {
    ok: true,
    queued: true,
    queueEntryId: queueEntry.id,
    message: 'Commande enregistree hors ligne. Synchronisation automatique des que la connexion revient.',
    order: {
      id: null,
      orderNumber: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      tableNumber,
      customerPhone,
      totalAmount: calculateTotal(items),
      idempotencyKey: rpcArgs.p_idempotency_key,
      branchId: getActiveBranchId(),
    },
  };
}

export async function createOrder(payload) {
  const items = sanitizeItems(Array.isArray(payload?.items) ? payload.items : []);
  const tableNumber = String(payload?.tableNumber || '').trim();
  const idempotencyKey = String(payload?.idempotencyKey || createIdempotencyKey(tableNumber)).trim();

  if (!TABLE_NUMBER_REGEX.test(tableNumber)) {
    return { ok: false, message: 'Numero de table invalide (1 a 3 chiffres).' };
  }

  if (items.length === 0) {
    return { ok: false, message: 'Le panier est vide.' };
  }

  const rpcArgs = {
    p_table_number: tableNumber,
    p_customer_name: String(payload?.customerName || '').trim() || null,
    p_customer_phone: String(payload?.customerPhone || '').trim() || null,
    p_notes: String(payload?.notes || '').trim() || null,
    p_items: items,
    p_idempotency_key: idempotencyKey,
  };

  if (!supabaseClient) {
    return enqueueOrderCreation({
      rpcArgs,
      tableNumber,
      customerPhone: String(payload?.customerPhone || '').trim(),
      items,
      reason: 'supabase_not_configured',
    });
  }

  if (shouldQueueOfflineOrder()) {
    return enqueueOrderCreation({
      rpcArgs,
      tableNumber,
      customerPhone: String(payload?.customerPhone || '').trim(),
      items,
      reason: 'offline',
    });
  }

  let rpcResult = await executeCreateOrderRpc(rpcArgs);

  if (rpcResult.error && shouldRetryOrder(rpcResult.error)) {
    rpcResult = await executeCreateOrderRpc(rpcArgs);
  }

  if (rpcResult.error) {
    if (shouldRetryOrder(rpcResult.error)) {
      return enqueueOrderCreation({
        rpcArgs,
        tableNumber,
        customerPhone: String(payload?.customerPhone || '').trim(),
        items,
        reason: 'network_retry_failed',
      });
    }

    return { ok: false, message: rpcResult.error.message };
  }

  const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  const order = {
    id: row?.id,
    orderNumber: row?.order_number,
    status: normalizeStatus(row?.status),
    createdAt: row?.created_at,
    tableNumber,
    customerPhone: String(payload?.customerPhone || '').trim(),
    totalAmount: calculateTotal(items),
    idempotencyKey,
  };

  return { ok: true, order };
}

async function replayQueuedOrderCreate(rpcArgs) {
  const result = await executeCreateOrderRpc(rpcArgs);
  if (result.error) {
    throw new Error(result.error.message || 'Offline order replay failed.');
  }
}

export async function syncOfflineOrderQueue() {
  if (!supabaseClient) {
    return {
      ok: false,
      message: 'Supabase non configure.',
      ...getOfflineQueueStats(),
      synced: 0,
    };
  }

  if (globalThis.navigator?.onLine === false) {
    return {
      ok: false,
      message: 'Hors ligne.',
      ...getOfflineQueueStats(),
      synced: 0,
    };
  }

  const statsBefore = getOfflineQueueStats();
  const result = await flushOfflineQueue({
    handlers: {
      [OFFLINE_ORDER_CREATE_OPERATION]: replayQueuedOrderCreate,
    },
  });

  const statsAfter = getOfflineQueueStats();

  return {
    ok: result.failed === 0,
    message:
      result.failed === 0
        ? 'File hors ligne synchronisee.'
        : 'Synchronisation partielle. Certaines operations restent en echec.',
    synced: result.succeeded,
    failed: result.failed,
    before: statsBefore,
    after: statsAfter,
  };
}

export async function loadOrders(options = {}) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.', orders: [] };
  }

  const status = options.status || 'all';
  const sort = options.sort || 'newest';

  let query = supabaseClient.from(ORDER_TABLE).select('*');
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  query = query.order('created_at', { ascending: sort === 'oldest' });

  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message, orders: [] };
  }

  return {
    ok: true,
    orders: (data || []).map(normalizeOrder),
  };
}

export async function updateOrderStatus(orderId, status, options = {}) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const safeStatus = normalizeStatus(status);

  const reason = String(options.reason || '').trim();
  const source = String(options.source || 'dashboard').trim();
  const terminal = String(options.terminal || 'web').trim();

  const { data, error } = await callUpdateOrderStatusRpc({
    orderId: Number(orderId),
    nextStatus: safeStatus,
    reason: reason || null,
    source: source || 'dashboard',
    terminal: terminal || 'web',
  });

  if (error) {
    return { ok: false, message: formatOrderErrorMessage(error.message) };
  }

  const rpcRow = Array.isArray(data) ? data[0] : data;
  if (!rpcRow?.id) {
    return { ok: false, message: 'Reponse invalide du serveur.' };
  }

  const { data: fullRow, error: fullRowError } = await supabaseClient
    .from(ORDER_TABLE)
    .select('*')
    .eq('id', rpcRow.id)
    .single();

  if (fullRowError) {
    return { ok: false, message: fullRowError.message };
  }

  return { ok: true, order: normalizeOrder(fullRow) };
}

export async function assignOrder(orderId) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !sessionData.session?.user?.id) {
    return { ok: false, message: 'Session serveur requise.' };
  }

  return updateOrderStatus(orderId, 'preparing', {
    source: 'dashboard_take',
    terminal: 'web',
  });
}

export async function getPublicOrderStatus(orderNumber, tableNumber) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const normalizedNumber = String(orderNumber || '').trim();
  const normalizedTable = String(tableNumber || '').trim();

  if (!normalizedNumber || !TABLE_NUMBER_REGEX.test(normalizedTable)) {
    return { ok: false, message: 'Informations de suivi invalides.' };
  }

  const { data, error } = await supabaseClient.rpc('get_public_order_status', {
    p_order_number: normalizedNumber,
    p_table_number: normalizedTable,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, message: 'Commande introuvable.' };
  }

  return {
    ok: true,
    status: normalizeStatus(row.status),
    orderNumber: row.order_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tableNumber: row.table_number,
  };
}

export async function loadOrderEvents(orderId, limit = 20) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.', events: [] };
  }

  const safeOrderId = Number(orderId);
  if (!Number.isFinite(safeOrderId) || safeOrderId <= 0) {
    return { ok: false, message: 'ID commande invalide.', events: [] };
  }

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const { data, error } = await supabaseClient
    .from(ORDER_EVENTS_TABLE)
    .select('id, order_id, actor_id, actor_email, event_type, from_status, to_status, source, terminal, reason, metadata, created_at')
    .eq('order_id', safeOrderId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    return { ok: false, message: error.message, events: [] };
  }

  return {
    ok: true,
    events: (data || []).map(normalizeOrderEvent),
  };
}

export async function hasServerAccess() {
  const profile = await getServerAccessProfile();
  return Boolean(profile.allowed);
}

async function detectManagerAccess(session) {
  if (!supabaseClient || !session?.user) return false;

  const userId = String(session.user.id || '').trim();
  const userEmail = String(session.user.email || '').trim().toLowerCase();

  const managerRpc = await supabaseClient.rpc('is_manager');
  if (!managerRpc.error) {
    return Boolean(managerRpc.data);
  }

  if (!isMissingRpcFunctionError(managerRpc.error, 'is_manager')) {
    console.warn('Unable to check manager role via is_manager():', managerRpc.error);
  }

  if (userId) {
    const { data, error } = await supabaseClient
      .from('staff_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data?.role) {
      return String(data.role).trim().toLowerCase() === 'manager';
    }

    if (error) {
      console.warn('Unable to resolve manager role from staff_users by user_id:', error);
    }
  }

  if (userEmail) {
    const { data, error } = await supabaseClient
      .from('staff_users')
      .select('role')
      .eq('email', userEmail)
      .maybeSingle();

    if (!error && data?.role) {
      return String(data.role).trim().toLowerCase() === 'manager';
    }

    if (error) {
      console.warn('Unable to resolve manager role from staff_users by email:', error);
    }
  }

  return false;
}

export async function getServerAccessProfile() {
  if (!supabaseClient) {
    return {
      ok: false,
      allowed: false,
      isStaff: false,
      isAdmin: false,
      isManager: false,
      role: 'guest',
      message: 'Supabase non configure.',
      userId: null,
      email: null,
    };
  }

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !sessionData.session) {
    return {
      ok: false,
      allowed: false,
      isStaff: false,
      isAdmin: false,
      isManager: false,
      role: 'guest',
      message: sessionError?.message || 'Session serveur requise.',
      userId: null,
      email: null,
    };
  }

  const session = sessionData.session;

  const [{ data: isStaff, error: staffError }, { data: isAdmin, error: adminError }] = await Promise.all([
    supabaseClient.rpc('is_staff'),
    supabaseClient.rpc('is_admin'),
  ]);

  if (staffError && adminError) {
    return {
      ok: false,
      allowed: false,
      isStaff: false,
      isAdmin: false,
      isManager: false,
      role: 'guest',
      message: adminError?.message || staffError?.message || 'Verification role impossible.',
      userId: session.user?.id || null,
      email: session.user?.email || null,
    };
  }

  const isStaffValue = Boolean(isStaff);
  const isAdminValue = Boolean(isAdmin);
  const allowed = canManageOrdersFromRoles({ isStaff: isStaffValue, isAdmin: isAdminValue });

  if (!allowed) {
    return {
      ok: true,
      allowed: false,
      isStaff: isStaffValue,
      isAdmin: isAdminValue,
      isManager: false,
      role: 'guest',
      message: 'Compte sans acces serveur.',
      userId: session.user?.id || null,
      email: session.user?.email || null,
    };
  }

  const isManagerValue = isAdminValue ? true : await detectManagerAccess(session);
  let resolvedRole = 'staff';
  if (isAdminValue) {
    resolvedRole = 'admin';
  } else if (isManagerValue) {
    resolvedRole = 'manager';
  }

  return {
    ok: true,
    allowed: true,
    isStaff: isStaffValue,
    isAdmin: isAdminValue,
    isManager: isManagerValue,
    role: resolvedRole,
    message: '',
    userId: session.user?.id || null,
    email: session.user?.email || null,
  };
}

function normalizeStaffMember(row) {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role || 'staff',
    createdAt: row.created_at,
    isPending: Boolean(row.is_pending),
  };
}

export async function loadStaffMembers() {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.', members: [] };
  }

  const { data, error } = await supabaseClient.rpc('list_staff_members');
  if (error) {
    return { ok: false, message: error.message, members: [] };
  }

  return {
    ok: true,
    members: (Array.isArray(data) ? data : []).map(normalizeStaffMember),
  };
}

export async function upsertStaffMember(email, role = 'staff') {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = role === 'manager' ? 'manager' : 'staff';

  if (!normalizedEmail) {
    return { ok: false, message: 'Email staff obligatoire.' };
  }

  const { data, error } = await supabaseClient.rpc('upsert_staff_member', {
    p_email: normalizedEmail,
    p_role: normalizedRole,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, member: normalizeStaffMember(row || {}) };
}

function createIsolatedSupabaseAuthClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  // Isolated auth client avoids replacing the current admin session while creating a staff account.
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'staff-provisioning-auth',
    },
  });
}

function isAlreadyRegisteredError(error) {
  const text = String(error?.message || '').toLowerCase();
  return text.includes('already registered') || text.includes('already been registered');
}

function isOverEmailSendRateLimitError(error) {
  const code = String(error?.code || '').trim().toLowerCase();
  const text = String(error?.message || '').toLowerCase();
  return code === 'over_email_send_rate_limit' || text.includes('email rate limit exceeded');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryPromoteStaffMembership(email, role) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await upsertStaffMember(email, role);
    if (result.ok && result.member && !result.member.isPending) {
      return result;
    }
    if (attempt < maxAttempts) {
      await sleep(700);
    }
  }
  return null;
}

export async function provisionStaffAccount(email, password, role = 'staff') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  const normalizedRole = role === 'manager' ? 'manager' : 'staff';

  if (!normalizedEmail) {
    return { ok: false, message: 'Email staff obligatoire.' };
  }

  if (rawPassword.length < 6) {
    return { ok: false, message: 'Mot de passe trop court (minimum 6 caracteres).' };
  }

  const isolatedClient = createIsolatedSupabaseAuthClient();
  if (!isolatedClient) {
    return { ok: false, message: 'Supabase auth non configure pour creation compte.' };
  }

  const { data, error } = await isolatedClient.auth.signUp({
    email: normalizedEmail,
    password: rawPassword,
  });

  if (error && isOverEmailSendRateLimitError(error)) {
    const memberResult = await upsertStaffMember(normalizedEmail, normalizedRole);
    if (!memberResult.ok) {
      return memberResult;
    }

    return {
      ok: true,
      member: memberResult.member,
      accountCreated: false,
      accountAlreadyExists: false,
      requiresEmailConfirmation: false,
      rateLimited: true,
      message: 'Limite email Supabase atteinte. Invitation staff sauvegardee; reessayez plus tard pour creer le compte Auth.',
    };
  }

  if (error && !isAlreadyRegisteredError(error)) {
    return { ok: false, message: error.message };
  }

  let memberResult = await upsertStaffMember(normalizedEmail, normalizedRole);
  if (!memberResult.ok) {
    return memberResult;
  }

  const createdNow = !error;
  const requiresEmailConfirmation = createdNow && Boolean(data?.user && !data?.session);

  // Immediately after signUp, auth.users visibility can lag briefly.
  // Retry to promote invite -> active staff row so /commande access works sooner.
  if (createdNow && memberResult.member?.isPending) {
    const promoted = await retryPromoteStaffMembership(normalizedEmail, normalizedRole);
    if (promoted?.ok) {
      memberResult = promoted;
    }
  }

  return {
    ok: true,
    member: memberResult.member,
    accountCreated: createdNow,
    accountAlreadyExists: Boolean(error && isAlreadyRegisteredError(error)),
    requiresEmailConfirmation,
    rateLimited: false,
  };
}

export async function removeStaffMember(target) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const userId = typeof target === 'object' && target !== null ? target.userId : target;
  const email = typeof target === 'object' && target !== null ? target.email : '';

  const normalizedId = String(userId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedId && !normalizedEmail) {
    return { ok: false, message: 'User ID ou email staff obligatoire.' };
  }

  const { data, error } = await supabaseClient.rpc('remove_staff_member', {
    p_user_id: normalizedId || null,
    p_email: normalizedEmail || null,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, removed: Boolean(data) };
}

export async function loadCashClosures(limit = 40) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.', closures: [] };
  }

  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 40));
  const { data, error } = await supabaseClient
    .from(CASH_CLOSURES_TABLE)
    .select('*')
    .order('closed_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code || null,
      closures: [],
    };
  }

  return {
    ok: true,
    closures: (data || []).map(normalizeCashClosure),
  };
}

export async function createCashClosure(payload = {}) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const periodLabel = String(payload.periodLabel || '').trim();
  if (!periodLabel) {
    return { ok: false, message: 'Periode de cloture obligatoire.' };
  }

  const countedCash = Number(payload.countedCash || 0);
  const expectedCash = Number(payload.expectedCash || 0);
  const cashDifference = Number(payload.cashDifference || 0);

  const insertPayload = {
    closed_by_user_id: payload.closedByUserId || null,
    closed_by_email: String(payload.closedBy || '').trim() || null,
    period_label: periodLabel,
    note: String(payload.note || '').trim() || null,
    orders_total: Math.max(0, Number(payload.totalOrders) || 0),
    orders_served: Math.max(0, Number(payload.servedCount) || 0),
    orders_cancelled: Math.max(0, Number(payload.cancelledCount) || 0),
    revenue_served: Number(payload.revenueServed || 0),
    amount_cancelled: Number(payload.cancelledAmount || 0),
    amount_active: Number(payload.activeAmount || 0),
    counted_cash: Number.isFinite(countedCash) ? countedCash : 0,
    expected_cash: Number.isFinite(expectedCash) ? expectedCash : 0,
    cash_difference: Number.isFinite(cashDifference) ? cashDifference : 0,
    difference_alert: Boolean(payload.differenceAlert),
    sla_rate: Math.max(0, Math.min(100, Number(payload.servedWithinTargetRate) || 0)),
  };

  const { data, error } = await supabaseClient
    .from(CASH_CLOSURES_TABLE)
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code || null,
    };
  }

  return {
    ok: true,
    closure: normalizeCashClosure(data || {}),
  };
}

export async function clearCashClosures() {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const { error } = await supabaseClient
    .from(CASH_CLOSURES_TABLE)
    .delete()
    .not('id', 'is', null);

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code || null,
    };
  }

  return { ok: true };
}
