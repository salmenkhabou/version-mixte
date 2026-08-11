import { Router } from 'express';
import { getOwnBranchAccess, requireAuth } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import { ensureAppUser, getPermissionKeys, getRoleKey } from '../lib/utils.js';

const router = Router();

router.get('/me/profile', requireAuth, async (req, res) => {
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

router.get('/me/permissions', requireAuth, async (req, res) => {
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


export default router;
