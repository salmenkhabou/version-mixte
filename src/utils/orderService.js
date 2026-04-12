import { supabaseClient } from '../lib/supabaseClient';

const ORDER_TABLE = 'cafe_orders';
const VALID_STATUSES = ['pending', 'preparing', 'served', 'cancelled'];

function normalizeStatus(value) {
  return VALID_STATUSES.includes(value) ? value : 'pending';
}

function normalizeOrder(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: row.id,
    tableNumber: String(row.table_number || '').trim(),
    customerName: String(row.customer_name || '').trim(),
    notes: String(row.notes || '').trim(),
    status: normalizeStatus(row.status),
    totalAmount: Number(row.total_amount || 0),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function calculateTotal(items) {
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);
}

export async function createOrder(payload) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const tableNumber = String(payload?.tableNumber || '').trim();

  if (!tableNumber) {
    return { ok: false, message: 'Numero de table obligatoire.' };
  }

  if (items.length === 0) {
    return { ok: false, message: 'Le panier est vide.' };
  }

  const total = calculateTotal(items);

  const insertPayload = {
    table_number: tableNumber,
    customer_name: String(payload?.customerName || '').trim() || null,
    notes: String(payload?.notes || '').trim() || null,
    items,
    total_amount: total,
    status: 'pending',
  };

  const { data, error } = await supabaseClient
    .from(ORDER_TABLE)
    .insert(insertPayload);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function loadOrders() {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.', orders: [] };
  }

  const { data, error } = await supabaseClient
    .from(ORDER_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { ok: false, message: error.message, orders: [] };
  }

  return {
    ok: true,
    orders: (data || []).map(normalizeOrder),
  };
}

export async function updateOrderStatus(orderId, status) {
  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const safeStatus = normalizeStatus(status);

  const { data, error } = await supabaseClient
    .from(ORDER_TABLE)
    .update({ status: safeStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('*')
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, order: normalizeOrder(data) };
}

export async function hasServerAccess() {
  if (!supabaseClient) return false;

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !sessionData.session) return false;

  const [{ data: isStaff, error: staffError }, { data: isAdmin, error: adminError }] = await Promise.all([
    supabaseClient.rpc('is_staff'),
    supabaseClient.rpc('is_admin'),
  ]);

  if (staffError && adminError) return false;
  return Boolean(isStaff) || Boolean(isAdmin);
}
