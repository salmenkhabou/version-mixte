import { Router } from 'express';
import { normalizeRole, requireAuth, requireScopedPermission, resolveBranchTable, resolveInventoryBranchIds } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import {
  getTodayIsoDate,
  hasBranchAccess,
  normalizeIncidentSeverity,
  toEndOfDayIso,
  toIsoDate,
  toIsoTimestamp,
  toNumber,
  toObject,
  toPositiveInteger,
  toStartOfDayIso,
  toText,
  upsertStaffKpiMetrics,
  WORKFORCE_PERMISSION_KEYS,
  writeAuditLog,
} from '../lib/utils.js';

const router = Router();

router.post('/shifts', requireAuth, async (req, res) => {
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


router.post('/attendance/check-in', requireAuth, async (req, res) => {
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


router.post('/attendance/check-out', requireAuth, async (req, res) => {
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


router.get('/attendance/today', requireAuth, async (req, res) => {
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


router.post('/checklists/:id/complete', requireAuth, async (req, res) => {
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


router.post('/incidents', requireAuth, async (req, res) => {
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


router.get('/staff/kpis', requireAuth, async (req, res) => {
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

export default router;
