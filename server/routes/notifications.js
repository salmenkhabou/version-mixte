import { Router } from 'express';
import { getRoleKey, requireAuth } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import { ensureAppUser, toText, writeAuditLog } from '../lib/utils.js';

const router = Router();

router.post('/notifications/register-device', requireAuth, async (req, res) => {
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


export default router;
