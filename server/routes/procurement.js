import { Router } from 'express';
import { requireAuth, requireScopedPermission, resolveBranchTable, resolveInventoryBranchIds } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import {
  calculateDateDifferenceInDays,
  generateNumber,
  hasBranchAccess,
  mapInventoryErrorMessage,
  parseBooleanFlag,
  PROCUREMENT_PERMISSION_KEYS,
  toIsoDate,
  toNumber,
  toObject,
  toPositiveInteger,
  toText,
  writeAuditLog,
} from '../lib/utils.js';

const router = Router();

router.get('/suppliers', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.SUPPLIERS_VIEW);
    if (!access) return;

    const includeInactive = parseBooleanFlag(req.query?.includeInactive || req.query?.include_inactive, false);

    let suppliersQuery = adminClient
      .from('suppliers')
      .select('id, code, name, tax_id, payment_terms_days, default_currency, is_active, created_at, updated_at')
      .order('name', { ascending: true });

    if (!includeInactive) {
      suppliersQuery = suppliersQuery.eq('is_active', true);
    }

    const { data: suppliers, error: suppliersError } = await suppliersQuery;
    if (suppliersError) {
      throw new Error(`Unable to read suppliers: ${suppliersError.message}`);
    }

    const supplierIds = (suppliers || []).map((row) => row.id).filter(Boolean);
    if (supplierIds.length === 0) {
      return res.json({ ok: true, count: 0, suppliers: [] });
    }

    let contactsQuery = adminClient
      .from('supplier_contacts')
      .select('id, supplier_id, full_name, email, phone, role, is_primary, is_active')
      .in('supplier_id', supplierIds)
      .order('is_primary', { ascending: false })
      .order('full_name', { ascending: true });

    if (!includeInactive) {
      contactsQuery = contactsQuery.eq('is_active', true);
    }

    const { data: contacts, error: contactsError } = await contactsQuery;
    if (contactsError) {
      throw new Error(`Unable to read supplier contacts: ${contactsError.message}`);
    }

    const { data: historyRows, error: historyError } = await adminClient
      .from('supplier_price_history')
      .select('supplier_id, price, lead_time_days, effective_at')
      .in('supplier_id', supplierIds)
      .order('effective_at', { ascending: false });

    if (historyError) {
      throw new Error(`Unable to read supplier price history summary: ${historyError.message}`);
    }

    const contactsBySupplier = new Map();
    for (const contact of contacts || []) {
      const supplierId = toText(contact.supplier_id);
      if (!contactsBySupplier.has(supplierId)) contactsBySupplier.set(supplierId, []);
      contactsBySupplier.get(supplierId).push({
        id: contact.id,
        fullName: toText(contact.full_name),
        email: toText(contact.email) || null,
        phone: toText(contact.phone) || null,
        role: toText(contact.role) || null,
        isPrimary: Boolean(contact.is_primary),
        isActive: Boolean(contact.is_active),
      });
    }

    const historySummaryMap = new Map();
    for (const row of historyRows || []) {
      const supplierId = toText(row.supplier_id);
      const price = toNumber(row.price, Number.NaN);
      const leadTime = toNumber(row.lead_time_days, 0);

      if (!historySummaryMap.has(supplierId)) {
        historySummaryMap.set(supplierId, {
          sampleCount: 0,
          minPrice: Number.NaN,
          maxPrice: Number.NaN,
          totalLeadTime: 0,
          lastEffectiveAt: null,
        });
      }

      const summary = historySummaryMap.get(supplierId);
      summary.sampleCount += 1;
      summary.totalLeadTime += Math.max(0, leadTime);

      if (Number.isFinite(price)) {
        summary.minPrice = Number.isFinite(summary.minPrice) ? Math.min(summary.minPrice, price) : price;
        summary.maxPrice = Number.isFinite(summary.maxPrice) ? Math.max(summary.maxPrice, price) : price;
      }

      if (!summary.lastEffectiveAt && row.effective_at) {
        summary.lastEffectiveAt = row.effective_at;
      }
    }

    const payload = (suppliers || []).map((supplier) => {
      const supplierId = toText(supplier.id);
      const summary = historySummaryMap.get(supplierId) || null;

      return {
        id: supplierId,
        code: toText(supplier.code),
        name: toText(supplier.name),
        taxId: toText(supplier.tax_id) || null,
        paymentTermsDays: Math.max(0, Math.trunc(toNumber(supplier.payment_terms_days, 0))),
        defaultCurrency: toText(supplier.default_currency) || 'MAD',
        isActive: Boolean(supplier.is_active),
        contacts: contactsBySupplier.get(supplierId) || [],
        priceSnapshot: {
          sampleCount: summary?.sampleCount || 0,
          minPrice: Number.isFinite(summary?.minPrice) ? summary.minPrice : null,
          maxPrice: Number.isFinite(summary?.maxPrice) ? summary.maxPrice : null,
          averageLeadTimeDays: summary?.sampleCount ? Number((summary.totalLeadTime / summary.sampleCount).toFixed(2)) : null,
          lastEffectiveAt: summary?.lastEffectiveAt || null,
        },
      };
    });

    return res.json({
      ok: true,
      role: access.roleKey,
      count: payload.length,
      suppliers: payload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load suppliers.' });
  }
});


router.post('/purchase-orders', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_CREATE);
    if (!access) return;

    const supplierId = toText(req.body?.supplierId || req.body?.supplier_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const linesInput = Array.isArray(req.body?.lines) ? req.body.lines : [];

    if (!supplierId) {
      return res.status(400).json({ ok: false, message: 'supplierId is required.' });
    }

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (linesInput.length === 0) {
      return res.status(400).json({ ok: false, message: 'At least one purchase order line is required.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single branch for this purchase order.' });
    }

    const branchId = branchIds[0];

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, is_active, default_currency')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierError) {
      throw new Error(`Unable to read supplier: ${supplierError.message}`);
    }

    if (!supplier?.id || !supplier?.is_active) {
      return res.status(400).json({ ok: false, message: 'Supplier not found or inactive.' });
    }

    const ingredientIds = [...new Set(linesInput
      .map((line) => toText(line?.ingredientId || line?.ingredient_id))
      .filter(Boolean))];

    if (ingredientIds.length !== linesInput.length) {
      return res.status(400).json({ ok: false, message: 'Each line must include a valid ingredientId.' });
    }

    const { data: ingredientRows, error: ingredientError } = await adminClient
      .from('ingredients')
      .select('id, name, default_unit_id, is_active')
      .in('id', ingredientIds);

    if (ingredientError) {
      throw new Error(`Unable to validate ingredients: ${ingredientError.message}`);
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows || []) {
      ingredientMap.set(toText(row.id), row);
    }

    if (ingredientMap.size !== ingredientIds.length) {
      return res.status(400).json({ ok: false, message: 'One or more ingredients were not found.' });
    }

    const normalizedLines = [];
    for (let index = 0; index < linesInput.length; index += 1) {
      const line = linesInput[index];
      const ingredientId = toText(line?.ingredientId || line?.ingredient_id);
      const ingredient = ingredientMap.get(ingredientId);

      if (!ingredient?.is_active) {
        return res.status(400).json({ ok: false, message: `Ingredient ${ingredientId} is inactive.` });
      }

      const orderedQty = toNumber(line?.orderedQty || line?.ordered_qty || line?.quantity, Number.NaN);
      const unitPrice = toNumber(line?.unitPrice || line?.unit_price, Number.NaN);
      const leadTimeDays = Math.max(0, Math.trunc(toNumber(line?.leadTimeDays || line?.lead_time_days, 0)));
      const unitId = toText(line?.unitId || line?.unit_id || ingredient.default_unit_id);

      if (!Number.isFinite(orderedQty) || orderedQty <= 0) {
        return res.status(400).json({ ok: false, message: `Line ${index + 1} has invalid orderedQty.` });
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ ok: false, message: `Line ${index + 1} has invalid unitPrice.` });
      }

      if (!unitId) {
        return res.status(400).json({ ok: false, message: `Line ${index + 1} has invalid unitId.` });
      }

      normalizedLines.push({
        lineNo: index + 1,
        ingredientId,
        unitId,
        description: toText(line?.description || ingredient.name),
        orderedQty,
        unitPrice,
        leadTimeDays,
        lineTotal: Number((orderedQty * unitPrice).toFixed(2)),
      });
    }

    const unitIds = [...new Set(normalizedLines.map((line) => line.unitId))];
    const { data: unitRows, error: unitError } = await adminClient
      .from('ingredient_units')
      .select('id')
      .in('id', unitIds);

    if (unitError) {
      throw new Error(`Unable to validate units: ${unitError.message}`);
    }

    if ((unitRows || []).length !== unitIds.length) {
      return res.status(400).json({ ok: false, message: 'One or more units are invalid.' });
    }

    const subtotalAmount = Number(normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const taxAmount = Number(toNumber(req.body?.taxAmount || req.body?.tax_amount, 0).toFixed(2));
    if (taxAmount < 0) {
      return res.status(400).json({ ok: false, message: 'taxAmount cannot be negative.' });
    }

    const approvalRequired = parseBooleanFlag(req.body?.approvalRequired ?? req.body?.approval_required, true);
    const nowIso = new Date().toISOString();

    const poNumber = toText(req.body?.poNumber || req.body?.po_number) || generateNumber('PO');
    const expectedDeliveryDate = toIsoDate(req.body?.expectedDeliveryDate || req.body?.expected_delivery_date);
    const currency = toText(req.body?.currency) || toText(supplier.default_currency) || 'MAD';
    const note = toText(req.body?.note) || null;
    const metadata = toObject(req.body?.metadata);

    const { data: purchaseOrder, error: purchaseOrderError } = await adminClient
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        supplier_id: supplierId,
        branch_id: branchId,
        status: approvalRequired ? 'pending_approval' : 'approved',
        approval_required: approvalRequired,
        approved_by_user_id: approvalRequired ? null : access.userId,
        approved_at: approvalRequired ? null : nowIso,
        created_by_user_id: access.userId,
        expected_delivery_date: expectedDeliveryDate,
        currency,
        subtotal_amount: subtotalAmount,
        tax_amount: taxAmount,
        total_amount: Number((subtotalAmount + taxAmount).toFixed(2)),
        note,
        metadata,
      })
      .select('*')
      .single();

    if (purchaseOrderError) {
      throw new Error(`Unable to create purchase order: ${purchaseOrderError.message}`);
    }

    const lineRowsToInsert = normalizedLines.map((line) => ({
      purchase_order_id: purchaseOrder.id,
      line_no: line.lineNo,
      ingredient_id: line.ingredientId,
      unit_id: line.unitId,
      description: line.description,
      ordered_qty: line.orderedQty,
      received_qty: 0,
      unit_price: line.unitPrice,
      lead_time_days: line.leadTimeDays,
      line_total: line.lineTotal,
      is_closed: false,
    }));

    const { data: insertedLines, error: linesError } = await adminClient
      .from('purchase_order_lines')
      .insert(lineRowsToInsert)
      .select('*');

    if (linesError) {
      await adminClient.from('purchase_orders').delete().eq('id', purchaseOrder.id);
      throw new Error(`Unable to create purchase order lines: ${linesError.message}`);
    }

    const priceHistoryRows = (insertedLines || []).map((line) => ({
      supplier_id: supplierId,
      ingredient_id: line.ingredient_id,
      unit_id: line.unit_id,
      price: line.unit_price,
      currency,
      lead_time_days: line.lead_time_days,
      source_type: 'purchase_order',
      source_reference: `po:${purchaseOrder.id}:line:${line.id}`,
      effective_at: nowIso,
      created_by_user_id: access.userId,
    }));

    let priceHistoryWarning = null;
    if (priceHistoryRows.length > 0) {
      const { error } = await adminClient
        .from('supplier_price_history')
        .insert(priceHistoryRows);
      if (error) {
        priceHistoryWarning = `Supplier price history insert failed: ${error.message}`;
      }
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'purchase_orders.create',
      entityType: 'purchase_orders',
      entityId: String(purchaseOrder.id),
      metadata: {
        supplierId,
        branchId,
        lineCount: insertedLines?.length || 0,
      },
    });

    return res.status(201).json({
      ok: true,
      purchaseOrder,
      lines: insertedLines || [],
      warning: priceHistoryWarning,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create purchase order.' });
  }
});


router.post('/purchase-orders/:id/approve', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_APPROVE);
    if (!access) return;

    const purchaseOrderId = toPositiveInteger(req.params?.id);
    if (!purchaseOrderId) {
      return res.status(400).json({ ok: false, message: 'Invalid purchase order id.' });
    }

    const { data: purchaseOrder, error: purchaseOrderError } = await adminClient
      .from('purchase_orders')
      .select('id, branch_id, status, approval_required, approved_at')
      .eq('id', purchaseOrderId)
      .maybeSingle();

    if (purchaseOrderError) {
      throw new Error(`Unable to read purchase order: ${purchaseOrderError.message}`);
    }

    if (!purchaseOrder?.id) {
      return res.status(404).json({ ok: false, message: 'Purchase order not found.' });
    }

    if (!hasBranchAccess(purchaseOrder.branch_id, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this purchase order.' });
    }

    const currentStatus = toText(purchaseOrder.status).toLowerCase();
    if (['approved', 'partially_received', 'received'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, message: 'Purchase order is already approved or received.' });
    }

    if (['cancelled', 'rejected'].includes(currentStatus)) {
      return res.status(400).json({ ok: false, message: 'Cancelled or rejected purchase orders cannot be approved.' });
    }

    const { data: updatedPurchaseOrder, error: updateError } = await adminClient
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_by_user_id: access.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', purchaseOrderId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Unable to approve purchase order: ${updateError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'purchase_orders.approve',
      entityType: 'purchase_orders',
      entityId: String(purchaseOrderId),
      metadata: { previousStatus: currentStatus },
    });

    return res.json({ ok: true, purchaseOrder: updatedPurchaseOrder });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to approve purchase order.' });
  }
});


router.post('/purchase-orders/:id/receive', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_RECEIVE);
    if (!access) return;

    const purchaseOrderId = toPositiveInteger(req.params?.id);
    if (!purchaseOrderId) {
      return res.status(400).json({ ok: false, message: 'Invalid purchase order id.' });
    }

    let receiptLinesInput = [];
    if (Array.isArray(req.body?.receiptLines)) {
      receiptLinesInput = req.body.receiptLines;
    } else if (Array.isArray(req.body?.lines)) {
      receiptLinesInput = req.body.lines;
    }

    if (receiptLinesInput.length === 0) {
      return res.status(400).json({ ok: false, message: 'At least one receipt line is required.' });
    }

    const { data: purchaseOrder, error: purchaseOrderError } = await adminClient
      .from('purchase_orders')
      .select('id, po_number, supplier_id, branch_id, status, approved_at, created_at, currency')
      .eq('id', purchaseOrderId)
      .maybeSingle();

    if (purchaseOrderError) {
      throw new Error(`Unable to read purchase order: ${purchaseOrderError.message}`);
    }

    if (!purchaseOrder?.id) {
      return res.status(404).json({ ok: false, message: 'Purchase order not found.' });
    }

    if (!hasBranchAccess(purchaseOrder.branch_id, access.roleKey, access.branchAccess)) {
      return res.status(403).json({ ok: false, message: 'Branch access denied for this purchase order.' });
    }

    const purchaseOrderStatus = toText(purchaseOrder.status).toLowerCase();
    if (!['approved', 'partially_received'].includes(purchaseOrderStatus)) {
      return res.status(400).json({ ok: false, message: 'Only approved purchase orders can be received.' });
    }

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, payment_terms_days')
      .eq('id', purchaseOrder.supplier_id)
      .maybeSingle();

    if (supplierError) {
      throw new Error(`Unable to read supplier for receipt: ${supplierError.message}`);
    }

    const { data: poLines, error: poLinesError } = await adminClient
      .from('purchase_order_lines')
      .select('id, line_no, ingredient_id, unit_id, ordered_qty, received_qty, unit_price, lead_time_days')
      .eq('purchase_order_id', purchaseOrderId)
      .order('line_no', { ascending: true });

    if (poLinesError) {
      throw new Error(`Unable to read purchase order lines: ${poLinesError.message}`);
    }

    if ((poLines || []).length === 0) {
      return res.status(400).json({ ok: false, message: 'Purchase order has no lines to receive.' });
    }

    const lineById = new Map();
    const lineByNumber = new Map();
    for (const line of poLines || []) {
      lineById.set(toPositiveInteger(line.id), line);
      lineByNumber.set(toPositiveInteger(line.line_no), line);
    }

    const normalizedReceiptLines = [];
    const usedLineIds = new Set();

    for (let index = 0; index < receiptLinesInput.length; index += 1) {
      const lineInput = receiptLinesInput[index];
      const explicitLineId = toPositiveInteger(
        lineInput?.purchaseOrderLineId
        || lineInput?.purchase_order_line_id
        || lineInput?.lineId
        || lineInput?.line_id,
      );
      const lineNumber = toPositiveInteger(lineInput?.lineNo || lineInput?.line_no);

      const poLine = explicitLineId ? lineById.get(explicitLineId) : lineByNumber.get(lineNumber);
      if (!poLine) {
        return res.status(400).json({ ok: false, message: `Receipt line ${index + 1} does not reference a valid purchase order line.` });
      }

      const poLineId = toPositiveInteger(poLine.id);
      if (usedLineIds.has(poLineId)) {
        return res.status(400).json({ ok: false, message: `Duplicate purchase order line in receipt: ${poLineId}.` });
      }
      usedLineIds.add(poLineId);

      const receivedQty = toNumber(lineInput?.receivedQty || lineInput?.received_qty || lineInput?.quantity, Number.NaN);
      if (!Number.isFinite(receivedQty) || receivedQty <= 0) {
        return res.status(400).json({ ok: false, message: `Receipt line ${index + 1} has invalid receivedQty.` });
      }

      const orderedQty = toNumber(poLine.ordered_qty, 0);
      const currentReceivedQty = toNumber(poLine.received_qty, 0);
      const remainingQty = Math.max(0, orderedQty - currentReceivedQty);
      if (receivedQty - remainingQty > 0.0001) {
        return res.status(400).json({
          ok: false,
          message: `Receipt line ${index + 1} exceeds remaining quantity for line ${poLine.line_no}.`,
        });
      }

      const unitPriceCandidate = toNumber(lineInput?.unitPrice || lineInput?.unit_price, Number.NaN);
      const unitPrice = Number.isFinite(unitPriceCandidate)
        ? unitPriceCandidate
        : toNumber(poLine.unit_price, Number.NaN);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ ok: false, message: `Receipt line ${index + 1} has invalid unitPrice.` });
      }

      normalizedReceiptLines.push({
        poLineId,
        lineNo: toPositiveInteger(poLine.line_no),
        ingredientId: toText(poLine.ingredient_id),
        unitId: toText(poLine.unit_id),
        receivedQty,
        unitPrice,
        orderedQty,
        currentReceivedQty,
        leadTimeDays: Math.max(0, Math.trunc(toNumber(poLine.lead_time_days, 0))),
        lineTotal: Number((receivedQty * unitPrice).toFixed(2)),
      });
    }

    const computedTotal = Number(normalizedReceiptLines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const invoiceTotalCandidate = toNumber(req.body?.invoiceTotal || req.body?.invoice_total, Number.NaN);
    const invoiceTotal = Number.isFinite(invoiceTotalCandidate) && invoiceTotalCandidate >= 0
      ? Number(invoiceTotalCandidate.toFixed(2))
      : computedTotal;

    const receivedAtInput = toText(req.body?.receivedAt || req.body?.received_at);
    const receivedAt = (() => {
      if (!receivedAtInput) return new Date().toISOString();
      const parsed = new Date(receivedAtInput);
      if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
      return parsed.toISOString();
    })();

    const receiptNumber = toText(req.body?.receiptNumber || req.body?.receipt_number) || generateNumber('GR');
    const invoiceNumber = toText(req.body?.invoiceNumber || req.body?.invoice_number) || null;
    const invoiceDate = toIsoDate(req.body?.invoiceDate || req.body?.invoice_date);
    const matchStatus = Math.abs(invoiceTotal - computedTotal) <= 0.01 ? 'matched' : 'mismatch';

    const { data: receipt, error: receiptError } = await adminClient
      .from('goods_receipts')
      .insert({
        receipt_number: receiptNumber,
        purchase_order_id: purchaseOrderId,
        supplier_id: purchaseOrder.supplier_id,
        branch_id: purchaseOrder.branch_id,
        received_by_user_id: access.userId,
        received_at: receivedAt,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        invoice_total: invoiceTotal,
        currency: toText(purchaseOrder.currency) || 'MAD',
        match_status: matchStatus,
        note: toText(req.body?.note) || null,
        metadata: toObject(req.body?.metadata),
      })
      .select('*')
      .single();

    if (receiptError) {
      throw new Error(`Unable to create goods receipt: ${receiptError.message}`);
    }

    const receiptLineRows = normalizedReceiptLines.map((line) => ({
      goods_receipt_id: receipt.id,
      purchase_order_line_id: line.poLineId,
      ingredient_id: line.ingredientId,
      unit_id: line.unitId,
      quantity_received: line.receivedQty,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }));

    const { data: insertedReceiptLines, error: receiptLinesError } = await adminClient
      .from('goods_receipt_lines')
      .insert(receiptLineRows)
      .select('*');

    if (receiptLinesError) {
      await adminClient.from('goods_receipts').delete().eq('id', receipt.id);
      throw new Error(`Unable to create goods receipt lines: ${receiptLinesError.message}`);
    }

    for (const line of normalizedReceiptLines) {
      const nextReceivedQty = Number((line.currentReceivedQty + line.receivedQty).toFixed(3));
      const isClosed = nextReceivedQty + 0.0001 >= line.orderedQty;

      const { error: updateLineError } = await adminClient
        .from('purchase_order_lines')
        .update({
          received_qty: nextReceivedQty,
          is_closed: isClosed,
        })
        .eq('id', line.poLineId);

      if (updateLineError) {
        throw new Error(`Unable to update purchase order line ${line.poLineId}: ${updateLineError.message}`);
      }
    }

    const warnings = [];
    for (const line of normalizedReceiptLines) {
      const { error } = await adminClient.rpc('inventory_apply_movement', {
        p_ingredient_id: line.ingredientId,
        p_branch_id: purchaseOrder.branch_id,
        p_quantity_delta: line.receivedQty,
        p_movement_type: 'adjustment_in',
        p_reason_code: 'purchase_receive',
        p_reason_note: toText(req.body?.note) || null,
        p_reference_order_id: purchaseOrderId,
        p_actor_user_id: access.userId,
        p_metadata: {
          source: 'api.purchase-orders.receive',
          purchaseOrderId,
          receiptId: receipt.id,
        },
        p_enforce_non_negative: false,
      });

      if (error) {
        warnings.push(`Inventory movement failed for ingredient ${line.ingredientId}: ${mapInventoryErrorMessage(error.message)}`);
      }
    }

    const baseLeadTimeDate = purchaseOrder.approved_at || purchaseOrder.created_at || receivedAt;
    const priceHistoryRows = normalizedReceiptLines.map((line) => ({
      supplier_id: purchaseOrder.supplier_id,
      ingredient_id: line.ingredientId,
      unit_id: line.unitId,
      price: line.unitPrice,
      currency: toText(purchaseOrder.currency) || 'MAD',
      lead_time_days: line.leadTimeDays > 0
        ? line.leadTimeDays
        : calculateDateDifferenceInDays(baseLeadTimeDate, receivedAt),
      source_type: 'goods_receipt',
      source_reference: `gr:${receipt.id}:line:${line.poLineId}`,
      effective_at: receivedAt,
      created_by_user_id: access.userId,
    }));

    const { error: priceHistoryError } = await adminClient
      .from('supplier_price_history')
      .insert(priceHistoryRows);

    if (priceHistoryError) {
      warnings.push(`Price history tracking failed: ${priceHistoryError.message}`);
    }

    const providedDueDate = toIsoDate(req.body?.dueDate || req.body?.due_date);
    const paymentTermsDays = Math.max(0, Math.trunc(toNumber(supplier?.payment_terms_days, 0)));
    const dueDate = (() => {
      if (providedDueDate) return providedDueDate;
      const baseDateValue = invoiceDate || receivedAt;
      const baseDate = new Date(baseDateValue);
      if (Number.isNaN(baseDate.getTime())) return null;
      baseDate.setUTCDate(baseDate.getUTCDate() + paymentTermsDays);
      return baseDate.toISOString().slice(0, 10);
    })();

    const explicitBillNumber = toText(req.body?.billNumber || req.body?.bill_number);
    let insertedBill = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const candidateBillNumber = explicitBillNumber || generateNumber('BILL');
      const { data, error } = await adminClient
        .from('payable_bills')
        .insert({
          bill_number: candidateBillNumber,
          goods_receipt_id: receipt.id,
          supplier_id: purchaseOrder.supplier_id,
          branch_id: purchaseOrder.branch_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          amount_due: invoiceTotal,
          amount_paid: 0,
          due_date: dueDate,
          currency: toText(purchaseOrder.currency) || 'MAD',
          status: invoiceTotal > 0 ? 'open' : 'paid',
        })
        .select('*')
        .single();

      if (!error) {
        insertedBill = data;
        break;
      }

      if (explicitBillNumber || !String(error.message || '').toLowerCase().includes('duplicate')) {
        warnings.push(`Payable bill creation failed: ${error.message}`);
        break;
      }
    }

    const { data: refreshedPoLines, error: refreshedPoLinesError } = await adminClient
      .from('purchase_order_lines')
      .select('ordered_qty, received_qty')
      .eq('purchase_order_id', purchaseOrderId);

    if (refreshedPoLinesError) {
      throw new Error(`Unable to refresh purchase order status: ${refreshedPoLinesError.message}`);
    }

    const orderedTotal = (refreshedPoLines || []).reduce((sum, line) => sum + toNumber(line.ordered_qty, 0), 0);
    const receivedTotal = (refreshedPoLines || []).reduce((sum, line) => sum + toNumber(line.received_qty, 0), 0);
    const nextPoStatus = receivedTotal + 0.0001 >= orderedTotal ? 'received' : 'partially_received';

    const { data: updatedPurchaseOrder, error: statusUpdateError } = await adminClient
      .from('purchase_orders')
      .update({ status: nextPoStatus })
      .eq('id', purchaseOrderId)
      .select('*')
      .single();

    if (statusUpdateError) {
      throw new Error(`Unable to update purchase order status: ${statusUpdateError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'purchase_orders.receive',
      entityType: 'goods_receipts',
      entityId: String(receipt.id),
      metadata: {
        purchaseOrderId,
        receiptNumber,
        matchStatus,
        lineCount: insertedReceiptLines?.length || 0,
      },
    });

    return res.status(201).json({
      ok: true,
      purchaseOrder: updatedPurchaseOrder,
      receipt,
      receiptLines: insertedReceiptLines || [],
      payableBill: insertedBill,
      invoiceMatch: {
        computedTotal,
        invoiceTotal,
        matchStatus,
      },
      warnings,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to receive purchase order.' });
  }
});


router.get('/purchase-orders/status', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.PURCHASE_ORDERS_STATUS_VIEW);
    if (!access) return;

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const supplierFilter = toText(req.query?.supplierId || req.query?.supplier_id) || null;
    const statusFilter = toText(req.query?.status).toLowerCase() || null;
    const limit = Math.min(200, Math.max(1, toPositiveInteger(req.query?.limit) || 50));

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, count: 0, statusSummary: {}, orders: [] });
    }

    let ordersQuery = adminClient
      .from('purchase_orders')
      .select('id, po_number, supplier_id, branch_id, status, approval_required, approved_at, expected_delivery_date, total_amount, currency, created_at')
      .in('branch_id', branchIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (supplierFilter) {
      ordersQuery = ordersQuery.eq('supplier_id', supplierFilter);
    }

    if (statusFilter) {
      ordersQuery = ordersQuery.eq('status', statusFilter);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      throw new Error(`Unable to read purchase orders: ${ordersError.message}`);
    }

    let summaryQuery = adminClient
      .from('purchase_orders')
      .select('status')
      .in('branch_id', branchIds);

    if (supplierFilter) {
      summaryQuery = summaryQuery.eq('supplier_id', supplierFilter);
    }

    if (statusFilter) {
      summaryQuery = summaryQuery.eq('status', statusFilter);
    }

    const { data: summaryRows, error: summaryError } = await summaryQuery;
    if (summaryError) {
      throw new Error(`Unable to build purchase-order status summary: ${summaryError.message}`);
    }

    const supplierIds = [...new Set((orders || []).map((row) => toText(row.supplier_id)).filter(Boolean))];
    let supplierRows = [];
    if (supplierIds.length > 0) {
      const { data, error } = await adminClient
        .from('suppliers')
        .select('id, code, name')
        .in('id', supplierIds);
      if (error) {
        throw new Error(`Unable to read suppliers for status endpoint: ${error.message}`);
      }
      supplierRows = data || [];
    }

    const orderBranchIds = [...new Set((orders || []).map((row) => toText(row.branch_id)).filter(Boolean))];
    let branchRows = [];
    if (orderBranchIds.length > 0) {
      const branchTable = await resolveBranchTable();
      const { data, error } = await adminClient
        .from(branchTable)
        .select('id, code, name')
        .in('id', orderBranchIds);

      if (error) {
        throw new Error(`Unable to read branches for status endpoint: ${error.message}`);
      }
      branchRows = data || [];
    }

    const supplierMap = new Map();
    for (const row of supplierRows) {
      supplierMap.set(toText(row.id), row);
    }

    const branchMap = new Map();
    for (const row of branchRows) {
      branchMap.set(toText(row.id), row);
    }

    const statusSummary = {};
    for (const row of summaryRows || []) {
      const key = toText(row.status) || 'unknown';
      statusSummary[key] = (statusSummary[key] || 0) + 1;
    }

    const payload = (orders || []).map((order) => {
      const supplier = supplierMap.get(toText(order.supplier_id));
      const branch = branchMap.get(toText(order.branch_id));

      return {
        id: order.id,
        poNumber: toText(order.po_number),
        status: toText(order.status),
        approvalRequired: Boolean(order.approval_required),
        approvedAt: order.approved_at || null,
        expectedDeliveryDate: order.expected_delivery_date || null,
        totalAmount: toNumber(order.total_amount, 0),
        currency: toText(order.currency) || 'MAD',
        createdAt: order.created_at || null,
        supplier: supplier
          ? {
              id: toText(supplier.id),
              code: toText(supplier.code),
              name: toText(supplier.name),
            }
          : null,
        branch: branch
          ? {
              id: toText(branch.id),
              code: toText(branch.code),
              name: toText(branch.name),
            }
          : null,
      };
    });

    return res.json({
      ok: true,
      role: access.roleKey,
      count: payload.length,
      statusSummary,
      orders: payload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load purchase-order status.' });
  }
});


router.get('/suppliers/:id/price-history', requireAuth, async (req, res) => {
  try {
    const access = await requireScopedPermission(req, res, PROCUREMENT_PERMISSION_KEYS.SUPPLIERS_PRICE_HISTORY_VIEW);
    if (!access) return;

    const supplierId = toText(req.params?.id);
    if (!supplierId) {
      return res.status(400).json({ ok: false, message: 'Supplier id is required.' });
    }

    const ingredientFilter = toText(req.query?.ingredientId || req.query?.ingredient_id) || null;
    const limit = Math.min(500, Math.max(1, toPositiveInteger(req.query?.limit) || 100));

    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, code, name, is_active')
      .eq('id', supplierId)
      .maybeSingle();

    if (supplierError) {
      throw new Error(`Unable to read supplier: ${supplierError.message}`);
    }

    if (!supplier?.id) {
      return res.status(404).json({ ok: false, message: 'Supplier not found.' });
    }

    let historyQuery = adminClient
      .from('supplier_price_history')
      .select('id, supplier_id, ingredient_id, unit_id, price, currency, lead_time_days, source_type, source_reference, effective_at, created_at')
      .eq('supplier_id', supplierId)
      .order('effective_at', { ascending: false })
      .limit(limit);

    if (ingredientFilter) {
      historyQuery = historyQuery.eq('ingredient_id', ingredientFilter);
    }

    const { data: historyRows, error: historyError } = await historyQuery;
    if (historyError) {
      throw new Error(`Unable to read supplier price history: ${historyError.message}`);
    }

    const ingredientIds = [...new Set((historyRows || []).map((row) => toText(row.ingredient_id)).filter(Boolean))];
    const unitIds = [...new Set((historyRows || []).map((row) => toText(row.unit_id)).filter(Boolean))];

    let ingredientRows = [];
    if (ingredientIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredients')
        .select('id, code, name')
        .in('id', ingredientIds);
      if (error) {
        throw new Error(`Unable to read ingredients for price history: ${error.message}`);
      }
      ingredientRows = data || [];
    }

    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);
      if (error) {
        throw new Error(`Unable to read units for price history: ${error.message}`);
      }
      unitRows = data || [];
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows) {
      ingredientMap.set(toText(row.id), row);
    }

    const unitMap = new Map();
    for (const row of unitRows) {
      unitMap.set(toText(row.id), row);
    }

    const comparisonMap = new Map();
    const historyPayload = (historyRows || []).map((row) => {
      const ingredientId = toText(row.ingredient_id);
      const ingredient = ingredientMap.get(ingredientId);
      const unit = unitMap.get(toText(row.unit_id));
      const price = toNumber(row.price, 0);
      const leadTimeDays = Math.max(0, Math.trunc(toNumber(row.lead_time_days, 0)));

      if (!comparisonMap.has(ingredientId)) {
        comparisonMap.set(ingredientId, {
          ingredientId,
          ingredientCode: toText(ingredient?.code) || null,
          ingredientName: toText(ingredient?.name) || null,
          sampleCount: 0,
          minPrice: price,
          maxPrice: price,
          latestPrice: null,
          latestAt: null,
          totalLeadTime: 0,
        });
      }

      const summary = comparisonMap.get(ingredientId);
      summary.sampleCount += 1;
      summary.minPrice = Math.min(summary.minPrice, price);
      summary.maxPrice = Math.max(summary.maxPrice, price);
      summary.totalLeadTime += leadTimeDays;
      if (!summary.latestAt) {
        summary.latestAt = row.effective_at;
        summary.latestPrice = price;
      }

      return {
        id: row.id,
        ingredientId,
        ingredientCode: toText(ingredient?.code) || null,
        ingredientName: toText(ingredient?.name) || null,
        unit: unit
          ? {
              id: toText(unit.id),
              name: toText(unit.name),
              symbol: toText(unit.symbol),
            }
          : null,
        price,
        currency: toText(row.currency) || 'MAD',
        leadTimeDays,
        sourceType: toText(row.source_type),
        sourceReference: toText(row.source_reference) || null,
        effectiveAt: row.effective_at || null,
        createdAt: row.created_at || null,
      };
    });

    const comparison = [...comparisonMap.values()]
      .map((summary) => ({
        ingredientId: summary.ingredientId,
        ingredientCode: summary.ingredientCode,
        ingredientName: summary.ingredientName,
        sampleCount: summary.sampleCount,
        minPrice: summary.minPrice,
        maxPrice: summary.maxPrice,
        latestPrice: summary.latestPrice,
        latestAt: summary.latestAt,
        averageLeadTimeDays: summary.sampleCount
          ? Number((summary.totalLeadTime / summary.sampleCount).toFixed(2))
          : null,
      }))
      .sort((a, b) => String(a.ingredientName || '').localeCompare(String(b.ingredientName || '')));

    return res.json({
      ok: true,
      supplier: {
        id: toText(supplier.id),
        code: toText(supplier.code),
        name: toText(supplier.name),
        isActive: Boolean(supplier.is_active),
      },
      count: historyPayload.length,
      comparison,
      history: historyPayload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load supplier price history.' });
  }
});


export default router;
