import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import { ensureAppUser, toObject, toText, writeAuditLog } from '../lib/utils.js';

const router = Router();

router.post('/sync/queue', requireAuth, async (req, res) => {
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


export default router;
