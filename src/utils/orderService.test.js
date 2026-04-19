import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_TRANSITIONS,
  canManageOrdersFromRoles,
  dedupeNumericOrderIds,
  formatOrderErrorMessage,
  isAllowedStatusTransition,
  recommendSmartDispatchOrder,
  resolveShortcutTargets,
} from './orderService';

describe('order status transitions', () => {
  it('supports pending to preparing to served flow', () => {
    expect(isAllowedStatusTransition('pending', 'preparing')).toBe(true);
    expect(isAllowedStatusTransition('preparing', 'served')).toBe(true);
    expect(isAllowedStatusTransition('served', 'pending')).toBe(false);
  });

  it('keeps transition map consistent for critical statuses', () => {
    expect(ORDER_STATUS_TRANSITIONS.pending).toEqual(['preparing', 'cancelled']);
    expect(ORDER_STATUS_TRANSITIONS.preparing).toEqual(['served', 'cancelled']);
  });
});

describe('bulk and shortcut helpers', () => {
  it('dedupes and normalizes numeric ids', () => {
    const result = dedupeNumericOrderIds(['12', 12, '27', null, undefined, 'foo']);
    expect(result).toEqual([12, 27]);
  });

  it('prioritizes selected orders for shortcut targets', () => {
    const targets = resolveShortcutTargets({
      selectedOrderIds: ['4', 9],
      focusedOrderId: 12,
      pagedOrders: [{ id: 99 }],
    });

    expect(targets).toEqual([4, 9]);
  });

  it('falls back to focused order then first page order', () => {
    const fromFocused = resolveShortcutTargets({
      selectedOrderIds: [],
      focusedOrderId: '18',
      pagedOrders: [{ id: 33 }],
    });
    const fromPage = resolveShortcutTargets({
      selectedOrderIds: [],
      focusedOrderId: null,
      pagedOrders: [{ id: '44' }],
    });

    expect(fromFocused).toEqual([18]);
    expect(fromPage).toEqual([44]);
  });
});

describe('role and error helpers', () => {
  it('allows staff and admin, rejects others', () => {
    expect(canManageOrdersFromRoles({ isStaff: true, isAdmin: false })).toBe(true);
    expect(canManageOrdersFromRoles({ isStaff: false, isAdmin: true })).toBe(true);
    expect(canManageOrdersFromRoles({ isStaff: false, isAdmin: false })).toBe(false);
  });

  it('maps backend error tokens to user-friendly messages', () => {
    expect(formatOrderErrorMessage('ORDER_ERR_INVALID_TRANSITION')).toContain('non autorisee');
    expect(formatOrderErrorMessage('ORDER_ERR_ACCESS_DENIED')).toContain('Acces refuse');
    expect(formatOrderErrorMessage('ORDER_ERR_CANCEL_REASON_REQUIRED')).toContain('Motif d annulation obligatoire');
  });
});

describe('smart dispatch recommendation', () => {
  it('recommends the oldest/highest-delay pending unassigned order', () => {
    const nowMs = new Date('2026-04-14T19:00:00.000Z').getTime();
    const orders = [
      { id: 1, orderNumber: 'CMD-1', status: 'pending', assignedTo: null, createdAt: '2026-04-14T18:55:00.000Z' },
      { id: 2, orderNumber: 'CMD-2', status: 'pending', assignedTo: null, createdAt: '2026-04-14T18:40:00.000Z' },
      { id: 3, orderNumber: 'CMD-3', status: 'preparing', assignedTo: 'user-b', createdAt: '2026-04-14T18:50:00.000Z' },
    ];

    const plan = recommendSmartDispatchOrder(orders, 'user-a', { nowMs, maxActiveLoad: 3 });
    expect(plan.blocked).toBe(false);
    expect(plan.orderId).toBe(2);
  });

  it('blocks recommendation when current load exceeds dynamic cap', () => {
    const orders = [
      { id: 1, status: 'pending', assignedTo: 'user-a', createdAt: '2026-04-14T18:00:00.000Z' },
      { id: 2, status: 'preparing', assignedTo: 'user-a', createdAt: '2026-04-14T18:10:00.000Z' },
      { id: 3, status: 'preparing', assignedTo: 'user-a', createdAt: '2026-04-14T18:20:00.000Z' },
      { id: 4, status: 'pending', assignedTo: null, createdAt: '2026-04-14T18:30:00.000Z' },
    ];

    const plan = recommendSmartDispatchOrder(orders, 'user-a', { maxActiveLoad: 2 });
    expect(plan.blocked).toBe(true);
    expect(plan.orderId).toBe(null);
  });
});
