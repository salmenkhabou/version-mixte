import { Router } from 'express';
import { ensureAppUser, getAllowedBranches, getOwnBranchAccess, getRoleKey, requireAuth } from '../lib/auth.js';

const router = Router();

router.get('/branches', requireAuth, async (req, res) => {
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


export default router;
