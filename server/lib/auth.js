import { adminClient } from './supabase.js';
import {
  BRANCH_TABLE_CANDIDATES,
  hasPermission,
  isInventoryModuleEnabled,
  toText,
} from './utils.js';

let cachedBranchTable = null;

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

export async function resolveBranchTable() {
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

export async function getDefaultOrganizationId() {
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

export async function ensureAppUser(user) {
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

export async function getRoleKey(userId) {
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

export async function getPermissionKeys(roleKey) {
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

export async function getOwnBranchAccess(userId) {
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

export async function getAllowedBranches(userId, roleKey) {
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

export async function listAllBranchIds() {
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

export async function resolveInventoryBranchIds({ requestedBranchId, roleKey, branchAccess }) {
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

export async function requireAuth(req, res, next) {
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

export async function requireInventoryPermission(req, res, permissionKey) {
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

  return requireScopedPermission(req, res, permissionKey);
}

export async function requireScopedPermission(req, res, permissionKey) {
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

  return { userId, roleKey, permissionKeys, branchAccess };
}
