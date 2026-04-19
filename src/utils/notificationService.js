import { supabaseClient } from '../lib/supabaseClient';

const DEVICE_ID_STORAGE_KEY = 'erp_device_id';
const DEVICE_PUSH_TOKEN_KEY = 'erp_device_push_token';
const NOTIFICATION_TABLE = 'notification_tokens';
const NOTIFICATION_EVENTS_TABLE = 'notification_events';

const ROLE_SET = new Set(['guest', 'customer', 'staff', 'manager', 'admin', 'all']);

function normalizeRole(role, fallback = 'guest') {
  const normalized = String(role || '').trim().toLowerCase();
  return ROLE_SET.has(normalized) ? normalized : fallback;
}

function normalizeNotificationEvent(row = {}) {
  return {
    id: row.id,
    title: String(row.title || '').trim(),
    body: String(row.body || '').trim(),
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    targetRole: normalizeRole(row.target_role, 'all'),
    targetUserId: row.target_user_id || null,
    branchId: row.branch_id || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
  };
}

function isRoleMatch(targetRole, currentRole) {
  const target = normalizeRole(targetRole, 'all');
  const current = normalizeRole(currentRole, 'guest');

  if (target === 'all') return true;
  if (target === current) return true;

  // Admin receives all staff/manager/admin operational notifications.
  if (current === 'admin' && (target === 'staff' || target === 'manager' || target === 'admin')) {
    return true;
  }

  return false;
}

function shouldDeliverNotification(event, context) {
  const currentUserId = String(context?.userId || '').trim();
  const targetUserId = String(event?.targetUserId || '').trim();
  const currentBranchId = String(context?.branchId || '').trim();
  const targetBranchId = String(event?.branchId || '').trim();

  if (targetUserId) {
    return Boolean(currentUserId) && currentUserId === targetUserId;
  }

  if (targetBranchId && currentBranchId && targetBranchId !== currentBranchId) {
    return false;
  }

  if (targetBranchId && !currentBranchId) {
    return false;
  }

  return isRoleMatch(event?.targetRole, context?.role);
}

function getOrCreateDeviceId() {
  const saved = String(globalThis.localStorage?.getItem(DEVICE_ID_STORAGE_KEY) || '').trim();
  if (saved) return saved;

  const generated =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  globalThis.localStorage?.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

function getOrCreatePushToken() {
  const saved = String(globalThis.localStorage?.getItem(DEVICE_PUSH_TOKEN_KEY) || '').trim();
  if (saved) return saved;

  const token =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `push-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  globalThis.localStorage?.setItem(DEVICE_PUSH_TOKEN_KEY, token);
  return token;
}

export function isNotificationSupported() {
  return Boolean(globalThis.Notification && globalThis.navigator?.serviceWorker);
}

export function getNotificationPermissionState() {
  if (!isNotificationSupported()) return 'unsupported';
  return globalThis.Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return { ok: false, permission: 'unsupported', message: 'Notifications non supportees sur cet appareil.' };
  }

  const permission = await globalThis.Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, permission, message: 'Permission notifications refusee.' };
  }

  return { ok: true, permission };
}

export async function registerPushDevice({ userId = null, role = 'guest', branchId = null } = {}) {
  const deviceId = getOrCreateDeviceId();
  const token = getOrCreatePushToken();

  if (!supabaseClient) {
    return {
      ok: true,
      remoteSaved: false,
      token,
      deviceId,
      message: 'Token local enregistre (mode sans Supabase).',
    };
  }

  try {
    const payload = {
      device_id: deviceId,
      token,
      user_id: userId || null,
      role: String(role || 'guest').trim().toLowerCase(),
      branch_id: branchId || null,
      platform: globalThis.navigator?.platform || 'unknown',
      user_agent: globalThis.navigator?.userAgent || 'unknown',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient
      .from(NOTIFICATION_TABLE)
      .upsert(payload, { onConflict: 'device_id' });

    if (error) {
      return {
        ok: false,
        remoteSaved: false,
        token,
        deviceId,
        message: error.message,
      };
    }

    return {
      ok: true,
      remoteSaved: true,
      token,
      deviceId,
      message: 'Device notification token enregistre.',
    };
  } catch (error) {
    return {
      ok: false,
      remoteSaved: false,
      token,
      deviceId,
      message: String(error?.message || 'Erreur inconnue push.'),
    };
  }
}

export function showLocalNotification(title, options = {}) {
  if (!isNotificationSupported()) return false;
  if (globalThis.Notification.permission !== 'granted') return false;

  try {
    // This local notification gives immediate feedback even before full push setup.
    new globalThis.Notification(title, options);
    return true;
  } catch (error) {
    console.warn('Unable to show local notification.', error);
    return false;
  }
}

export async function publishServerNotification({
  title,
  body = '',
  payload = {},
  targetRole = 'all',
  targetUserId = null,
  branchId = null,
} = {}) {
  const safeTitle = String(title || '').trim();
  if (!safeTitle) {
    return { ok: false, message: 'Titre notification obligatoire.' };
  }

  if (!supabaseClient) {
    return { ok: false, message: 'Supabase non configure.' };
  }

  const eventPayload = {
    title: safeTitle,
    body: String(body || '').trim(),
    payload: payload && typeof payload === 'object' ? payload : {},
    target_role: normalizeRole(targetRole, 'all'),
    target_user_id: targetUserId || null,
    branch_id: branchId || null,
  };

  const { data, error } = await supabaseClient
    .from(NOTIFICATION_EVENTS_TABLE)
    .insert(eventPayload)
    .select('*')
    .single();

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    event: normalizeNotificationEvent(data),
    message: 'Notification server creee.',
  };
}

export function subscribeToServerNotifications({
  role = 'guest',
  userId = null,
  branchId = null,
  onNotification,
} = {}) {
  if (!supabaseClient) {
    return {
      ok: false,
      message: 'Supabase non configure.',
      unsubscribe: () => {},
    };
  }

  const channelName = `erp-notification-events-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const channel = supabaseClient
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: NOTIFICATION_EVENTS_TABLE },
      (payload) => {
        const event = normalizeNotificationEvent(payload?.new || {});
        const shouldDeliver = shouldDeliverNotification(event, {
          role,
          userId,
          branchId,
        });

        if (!shouldDeliver) return;

        if (typeof onNotification === 'function') {
          onNotification(event);
        }
      },
    )
    .subscribe();

  return {
    ok: true,
    unsubscribe: () => {
      void supabaseClient.removeChannel(channel);
    },
  };
}
