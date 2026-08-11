import { Router } from 'express';
import { requireAuth, requireScopedPermission, resolveBranchTable } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import {
  buildCsv,
  FINANCE_PERMISSION_KEYS,
  generateNumber,
  getApprovedRefundTotalForPayment,
  getOpenCashSessionForBranch,
  getTodayIsoDate,
  hasBranchAccess,
  resolveInventoryBranchIds,
  toEndOfDayIso,
  toIsoDate,
  toNumber,
  toPositiveInteger,
  toStartOfDayIso,
  toText,
  writeAuditLog,
} from '../lib/utils.js';

const router = Router();

router.post('/cash-sessions/open', requireAuth, async (req, res) => {
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


router.post('/cash-sessions/:id/close', requireAuth, async (req, res) => {
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


router.post('/expenses', requireAuth, async (req, res) => {
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


router.post('/refunds/request', requireAuth, async (req, res) => {
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


router.post('/refunds/:id/approve', requireAuth, async (req, res) => {
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


router.get('/finance/daily-summary', requireAuth, async (req, res) => {
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


router.get('/finance/export', requireAuth, async (req, res) => {
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


export default router;
