import { Router } from 'express';
import { requireAuth, requireInventoryPermission, resolveBranchTable, resolveInventoryBranchIds } from '../lib/auth.js';
import { adminClient } from '../lib/supabase.js';
import {
  extractSingleResult,
  INVENTORY_PERMISSION_KEYS,
  mapInventoryErrorMessage,
  normalizeMovementType,
  parseBooleanFlag,
  toNumber,
  toObject,
  toText,
  writeAuditLog,
} from '../lib/utils.js';

const router = Router();

router.get('/inventory/levels', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.LEVELS_VIEW);
    if (!access) return;

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const includeInactive = parseBooleanFlag(req.query?.includeInactive || req.query?.include_inactive, false);
    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, role: access.roleKey, branches: [], levels: [] });
    }

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name, is_active')
      .in('id', branchIds)
      .order('name', { ascending: true });

    if (branchError) {
      throw new Error(`Unable to read branch metadata: ${branchError.message}`);
    }

    let ingredientsQuery = adminClient
      .from('ingredients')
      .select('id, code, name, default_unit_id, is_active')
      .order('name', { ascending: true });

    if (!includeInactive) {
      ingredientsQuery = ingredientsQuery.eq('is_active', true);
    }

    const { data: ingredients, error: ingredientsError } = await ingredientsQuery;
    if (ingredientsError) {
      throw new Error(`Unable to read ingredients: ${ingredientsError.message}`);
    }

    const ingredientIds = (ingredients || []).map((item) => item.id).filter(Boolean);
    const safeBranchRows = branchRows || [];

    let levelRows = [];
    if (ingredientIds.length > 0) {
      const { data, error } = await adminClient
        .from('inventory_levels')
        .select('ingredient_id, branch_id, on_hand_qty, reserved_qty, updated_at')
        .in('ingredient_id', ingredientIds)
        .in('branch_id', branchIds);

      if (error) {
        throw new Error(`Unable to read inventory levels: ${error.message}`);
      }

      levelRows = data || [];
    }

    const unitIds = [...new Set((ingredients || []).map((item) => toText(item.default_unit_id)).filter(Boolean))];
    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);

      if (error) {
        throw new Error(`Unable to read ingredient units: ${error.message}`);
      }

      unitRows = data || [];
    }

    const levelMap = new Map();
    for (const row of levelRows) {
      const key = `${toText(row.branch_id)}::${toText(row.ingredient_id)}`;
      levelMap.set(key, row);
    }

    const unitMap = new Map();
    for (const unit of unitRows) {
      unitMap.set(toText(unit.id), {
        id: toText(unit.id),
        name: toText(unit.name),
        symbol: toText(unit.symbol),
      });
    }

    const levels = [];
    for (const branch of safeBranchRows) {
      for (const ingredient of ingredients || []) {
        const key = `${toText(branch.id)}::${toText(ingredient.id)}`;
        const existingLevel = levelMap.get(key);
        const unit = unitMap.get(toText(ingredient.default_unit_id)) || null;

        levels.push({
          branchId: toText(branch.id),
          branchCode: toText(branch.code),
          branchName: toText(branch.name),
          ingredientId: toText(ingredient.id),
          ingredientCode: toText(ingredient.code),
          ingredientName: toText(ingredient.name),
          unit,
          onHandQty: toNumber(existingLevel?.on_hand_qty, 0),
          reservedQty: toNumber(existingLevel?.reserved_qty, 0),
          availableQty: toNumber(existingLevel?.on_hand_qty, 0) - toNumber(existingLevel?.reserved_qty, 0),
          updatedAt: existingLevel?.updated_at || null,
          ingredientActive: Boolean(ingredient.is_active),
          branchActive: Boolean(branch.is_active),
        });
      }
    }

    return res.json({
      ok: true,
      role: access.roleKey,
      branches: safeBranchRows,
      levels,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load inventory levels.' });
  }
});


router.post('/inventory/adjustments', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.ADJUSTMENTS_WRITE);
    if (!access) return;

    const ingredientId = toText(req.body?.ingredientId || req.body?.ingredient_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const reasonCode = toText(req.body?.reasonCode || req.body?.reason_code) || null;
    const reasonNote = toText(req.body?.reasonNote || req.body?.reason_note) || null;
    const metadata = toObject(req.body?.metadata);

    if (!ingredientId) {
      return res.status(400).json({ ok: false, message: 'ingredientId is required.' });
    }

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single target branch for adjustment.' });
    }

    let quantityDelta = toNumber(req.body?.quantityDelta || req.body?.quantity_delta, Number.NaN);
    if (!Number.isFinite(quantityDelta)) {
      const quantity = toNumber(req.body?.quantity, Number.NaN);
      const adjustmentType = toText(req.body?.adjustmentType || req.body?.adjustment_type || req.body?.direction).toLowerCase();
      if (Number.isFinite(quantity) && quantity > 0) {
        quantityDelta = adjustmentType === 'decrease' || adjustmentType === 'out' || adjustmentType === 'remove'
          ? -quantity
          : quantity;
      }
    }

    if (!Number.isFinite(quantityDelta) || quantityDelta === 0) {
      return res.status(400).json({ ok: false, message: 'quantityDelta (or quantity + adjustmentType) is required and cannot be zero.' });
    }

    const movementType = normalizeMovementType(req.body?.movementType || req.body?.movement_type, quantityDelta);

    const { data, error } = await adminClient.rpc('inventory_apply_movement', {
      p_ingredient_id: ingredientId,
      p_branch_id: branchIds[0],
      p_quantity_delta: quantityDelta,
      p_movement_type: movementType,
      p_reason_code: reasonCode,
      p_reason_note: reasonNote,
      p_reference_order_id: null,
      p_actor_user_id: access.userId,
      p_metadata: {
        ...metadata,
        source: 'api.inventory.adjustments',
      },
      p_enforce_non_negative: quantityDelta < 0,
    });

    if (error) {
      const message = mapInventoryErrorMessage(error.message);
      const statusCode = String(error.message || '').includes('INV_ERR_') ? 400 : 500;
      return res.status(statusCode).json({ ok: false, message });
    }

    const movementResult = extractSingleResult(data);
    const movementId = toText(movementResult?.movement_id);
    if (!movementId) {
      throw new Error('Inventory movement did not return a movement id.');
    }

    const { data: movement, error: movementError } = await adminClient
      .from('inventory_movements')
      .select('*')
      .eq('id', movementId)
      .maybeSingle();

    if (movementError) {
      throw new Error(`Unable to load movement row: ${movementError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'inventory.adjustment.create',
      entityType: 'inventory_movements',
      entityId: movementId,
      metadata: {
        ingredientId,
        branchId: branchIds[0],
        quantityDelta,
        movementType,
        reasonCode,
      },
    });

    return res.status(201).json({
      ok: true,
      movement,
      balanceAfter: movementResult?.balance_after ?? null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to create inventory adjustment.' });
  }
});


router.post('/inventory/waste', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.WASTE_WRITE);
    if (!access) return;

    const ingredientId = toText(req.body?.ingredientId || req.body?.ingredient_id);
    const requestedBranchId = toText(req.body?.branchId || req.body?.branch_id);
    const reasonCode = toText(req.body?.reasonCode || req.body?.reason_code).toLowerCase();
    const note = toText(req.body?.note || req.body?.reasonNote || req.body?.reason_note) || null;
    const quantity = toNumber(req.body?.quantity, Number.NaN);

    if (!ingredientId) {
      return res.status(400).json({ ok: false, message: 'ingredientId is required.' });
    }

    if (!requestedBranchId) {
      return res.status(400).json({ ok: false, message: 'branchId is required.' });
    }

    if (!reasonCode) {
      return res.status(400).json({ ok: false, message: 'reasonCode is required.' });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ ok: false, message: 'quantity must be a positive number.' });
    }

    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'Unable to resolve a single target branch for waste logging.' });
    }

    const { data: reasonRow, error: reasonError } = await adminClient
      .from('wastage_reasons')
      .select('code, requires_note, is_active')
      .eq('code', reasonCode)
      .maybeSingle();

    if (reasonError) {
      throw new Error(`Unable to read wastage reason: ${reasonError.message}`);
    }

    if (!reasonRow?.code || !reasonRow?.is_active) {
      return res.status(400).json({ ok: false, message: 'Invalid or inactive wastage reason code.' });
    }

    if (reasonRow.requires_note && !note) {
      return res.status(400).json({ ok: false, message: 'This wastage reason requires a note.' });
    }

    const { data: ingredient, error: ingredientError } = await adminClient
      .from('ingredients')
      .select('id, default_unit_id, is_active')
      .eq('id', ingredientId)
      .maybeSingle();

    if (ingredientError) {
      throw new Error(`Unable to read ingredient: ${ingredientError.message}`);
    }

    if (!ingredient?.id || !ingredient?.is_active) {
      return res.status(400).json({ ok: false, message: 'Ingredient not found or inactive.' });
    }

    const { data, error } = await adminClient.rpc('inventory_apply_movement', {
      p_ingredient_id: ingredientId,
      p_branch_id: branchIds[0],
      p_quantity_delta: -quantity,
      p_movement_type: 'waste',
      p_reason_code: reasonCode,
      p_reason_note: note,
      p_reference_order_id: null,
      p_actor_user_id: access.userId,
      p_metadata: {
        source: 'api.inventory.waste',
      },
      p_enforce_non_negative: true,
    });

    if (error) {
      const message = mapInventoryErrorMessage(error.message);
      const statusCode = String(error.message || '').includes('INV_ERR_') ? 400 : 500;
      return res.status(statusCode).json({ ok: false, message });
    }

    const movementResult = extractSingleResult(data);
    const movementId = toText(movementResult?.movement_id);
    if (!movementId) {
      throw new Error('Inventory waste movement did not return a movement id.');
    }

    const { data: insertedLog, error: insertLogError } = await adminClient
      .from('wastage_logs')
      .insert({
        ingredient_id: ingredientId,
        branch_id: branchIds[0],
        unit_id: ingredient.default_unit_id,
        quantity,
        reason_code: reasonCode,
        note,
        actor_user_id: access.userId,
        movement_id: movementId,
      })
      .select('*')
      .single();

    if (insertLogError) {
      throw new Error(`Unable to insert wastage log: ${insertLogError.message}`);
    }

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'inventory.waste.create',
      entityType: 'wastage_logs',
      entityId: insertedLog.id,
      metadata: {
        ingredientId,
        branchId: branchIds[0],
        quantity,
        reasonCode,
      },
    });

    return res.status(201).json({
      ok: true,
      wasteLog: insertedLog,
      movementId,
      balanceAfter: movementResult?.balance_after ?? null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to log waste.' });
  }
});


router.get('/products/recipes', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.RECIPES_VIEW);
    if (!access) return;

    const includeInactive = parseBooleanFlag(req.query?.includeInactive || req.query?.include_inactive, false);

    let productsQuery = adminClient
      .from('products')
      .select('id, sku, name, external_key, is_active')
      .order('name', { ascending: true });

    if (!includeInactive) {
      productsQuery = productsQuery.eq('is_active', true);
    }

    const { data: products, error: productsError } = await productsQuery;
    if (productsError) {
      throw new Error(`Unable to read products: ${productsError.message}`);
    }

    const productIds = (products || []).map((row) => row.id).filter(Boolean);
    if (productIds.length === 0) {
      return res.json({ ok: true, products: [] });
    }

    let recipesQuery = adminClient
      .from('product_recipes')
      .select('product_id, ingredient_id, unit_id, qty_per_serving, waste_factor, is_active')
      .in('product_id', productIds);

    if (!includeInactive) {
      recipesQuery = recipesQuery.eq('is_active', true);
    }

    const { data: recipeRows, error: recipesError } = await recipesQuery;
    if (recipesError) {
      throw new Error(`Unable to read recipes: ${recipesError.message}`);
    }

    const ingredientIds = [...new Set((recipeRows || []).map((row) => toText(row.ingredient_id)).filter(Boolean))];
    const unitIds = [...new Set((recipeRows || []).map((row) => toText(row.unit_id)).filter(Boolean))];

    let ingredientRows = [];
    if (ingredientIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredients')
        .select('id, code, name, default_unit_id, is_active')
        .in('id', ingredientIds);

      if (error) {
        throw new Error(`Unable to read recipe ingredients: ${error.message}`);
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
        throw new Error(`Unable to read recipe units: ${error.message}`);
      }

      unitRows = data || [];
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows) {
      ingredientMap.set(toText(row.id), {
        id: toText(row.id),
        code: toText(row.code),
        name: toText(row.name),
        defaultUnitId: toText(row.default_unit_id),
        isActive: Boolean(row.is_active),
      });
    }

    const unitMap = new Map();
    for (const row of unitRows) {
      unitMap.set(toText(row.id), {
        id: toText(row.id),
        name: toText(row.name),
        symbol: toText(row.symbol),
      });
    }

    const recipesByProduct = new Map();
    for (const recipeRow of recipeRows || []) {
      const productId = toText(recipeRow.product_id);
      if (!recipesByProduct.has(productId)) recipesByProduct.set(productId, []);

      const ingredient = ingredientMap.get(toText(recipeRow.ingredient_id)) || null;
      const unit = unitMap.get(toText(recipeRow.unit_id)) || null;

      recipesByProduct.get(productId).push({
        ingredientId: toText(recipeRow.ingredient_id),
        ingredientCode: ingredient?.code || null,
        ingredientName: ingredient?.name || null,
        ingredientActive: ingredient?.isActive ?? null,
        qtyPerServing: toNumber(recipeRow.qty_per_serving, 0),
        wasteFactor: toNumber(recipeRow.waste_factor, 0),
        unit,
        recipeActive: Boolean(recipeRow.is_active),
      });
    }

    const payload = (products || []).map((product) => ({
      id: toText(product.id),
      sku: toText(product.sku),
      name: toText(product.name),
      externalKey: toText(product.external_key) || null,
      isActive: Boolean(product.is_active),
      recipes: recipesByProduct.get(toText(product.id)) || [],
    }));

    return res.json({ ok: true, products: payload });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load product recipes.' });
  }
});


router.post('/orders/consume-stock', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.CONSUME_STOCK);
    if (!access) return;

    const orderId = Math.trunc(toNumber(req.body?.orderId || req.body?.order_id, Number.NaN));
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ ok: false, message: 'orderId must be a positive integer.' });
    }

    const { data, error } = await adminClient.rpc('consume_stock_for_order', {
      p_order_id: orderId,
      p_actor_user_id: access.userId,
      p_source: 'api.consume-stock',
    });

    if (error) {
      const message = mapInventoryErrorMessage(error.message);
      const statusCode = String(error.message || '').includes('INV_ERR_') ? 400 : 500;
      return res.status(statusCode).json({ ok: false, message });
    }

    const summary = extractSingleResult(data) || {};

    await writeAuditLog({
      actorUserId: access.userId,
      action: 'inventory.consume_stock.order',
      entityType: 'cafe_orders',
      entityId: String(orderId),
      metadata: toObject(summary),
    });

    return res.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to consume stock for order.' });
  }
});


router.get('/inventory/alerts/low-stock', requireAuth, async (req, res) => {
  try {
    const access = await requireInventoryPermission(req, res, INVENTORY_PERMISSION_KEYS.ALERTS_VIEW);
    if (!access) return;

    const requestedBranchId = toText(req.query?.branchId || req.query?.branch_id) || null;
    const branchIds = await resolveInventoryBranchIds({
      requestedBranchId,
      roleKey: access.roleKey,
      branchAccess: access.branchAccess,
    });

    if (branchIds.length === 0) {
      return res.json({ ok: true, alerts: [] });
    }

    const { data: ruleRows, error: rulesError } = await adminClient
      .from('reorder_rules')
      .select('ingredient_id, branch_id, min_qty, reorder_qty, alert_enabled')
      .in('branch_id', branchIds)
      .eq('alert_enabled', true);

    if (rulesError) {
      throw new Error(`Unable to read reorder rules: ${rulesError.message}`);
    }

    if ((ruleRows || []).length === 0) {
      return res.json({ ok: true, alerts: [] });
    }

    const ingredientIds = [...new Set((ruleRows || []).map((row) => toText(row.ingredient_id)).filter(Boolean))];
    const { data: levelRows, error: levelsError } = await adminClient
      .from('inventory_levels')
      .select('ingredient_id, branch_id, on_hand_qty, reserved_qty')
      .in('branch_id', branchIds)
      .in('ingredient_id', ingredientIds);

    if (levelsError) {
      throw new Error(`Unable to read inventory levels for alerts: ${levelsError.message}`);
    }

    const { data: ingredientRows, error: ingredientError } = await adminClient
      .from('ingredients')
      .select('id, code, name, default_unit_id, is_active')
      .in('id', ingredientIds);

    if (ingredientError) {
      throw new Error(`Unable to read ingredients for alerts: ${ingredientError.message}`);
    }

    const unitIds = [...new Set((ingredientRows || []).map((row) => toText(row.default_unit_id)).filter(Boolean))];
    let unitRows = [];
    if (unitIds.length > 0) {
      const { data, error } = await adminClient
        .from('ingredient_units')
        .select('id, name, symbol')
        .in('id', unitIds);

      if (error) {
        throw new Error(`Unable to read units for alerts: ${error.message}`);
      }

      unitRows = data || [];
    }

    const branchTable = await resolveBranchTable();
    const { data: branchRows, error: branchError } = await adminClient
      .from(branchTable)
      .select('id, code, name')
      .in('id', branchIds);

    if (branchError) {
      throw new Error(`Unable to read branches for alerts: ${branchError.message}`);
    }

    const levelMap = new Map();
    for (const row of levelRows || []) {
      const key = `${toText(row.branch_id)}::${toText(row.ingredient_id)}`;
      levelMap.set(key, row);
    }

    const ingredientMap = new Map();
    for (const row of ingredientRows || []) {
      ingredientMap.set(toText(row.id), row);
    }

    const unitMap = new Map();
    for (const row of unitRows) {
      unitMap.set(toText(row.id), row);
    }

    const branchMap = new Map();
    for (const row of branchRows || []) {
      branchMap.set(toText(row.id), row);
    }

    const alerts = [];
    for (const rule of ruleRows || []) {
      const branchId = toText(rule.branch_id);
      const ingredientId = toText(rule.ingredient_id);
      const level = levelMap.get(`${branchId}::${ingredientId}`);

      const onHandQty = toNumber(level?.on_hand_qty, 0);
      const reservedQty = toNumber(level?.reserved_qty, 0);
      const availableQty = onHandQty - reservedQty;
      const minQty = toNumber(rule.min_qty, 0);

      if (onHandQty > minQty) continue;

      const ingredient = ingredientMap.get(ingredientId);
      const unit = unitMap.get(toText(ingredient?.default_unit_id)) || null;
      const branch = branchMap.get(branchId);

      alerts.push({
        branchId,
        branchCode: toText(branch?.code) || null,
        branchName: toText(branch?.name) || null,
        ingredientId,
        ingredientCode: toText(ingredient?.code) || null,
        ingredientName: toText(ingredient?.name) || null,
        ingredientActive: Boolean(ingredient?.is_active),
        onHandQty,
        reservedQty,
        availableQty,
        minQty,
        reorderQty: toNumber(rule.reorder_qty, 0),
        shortageQty: Math.max(0, minQty - onHandQty),
        unit,
      });
    }

    alerts.sort((a, b) => b.shortageQty - a.shortageQty);

    return res.json({
      ok: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Unable to load low-stock alerts.' });
  }
});


export default router;
