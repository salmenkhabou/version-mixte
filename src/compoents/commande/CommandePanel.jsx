import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BarChart3,
  BellRing,
  Clock3,
  Download,
  Maximize,
  Minimize2,
  RefreshCw,
  UtensilsCrossed,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient';
import { useAccess } from '../../contexts/AccessContext';
import { ERP_ACTIONS } from '../../erp/permissions';
import {
  assignOrder,
  clearCashClosures,
  createCashClosure,
  dedupeNumericOrderIds,
  formatOrderErrorMessage,
  getServerAccessProfile,
  loadCashClosures,
  loadStaffMembers,
  loadOrderEvents,
  loadOrders,
  provisionStaffAccount,
  recommendSmartDispatchOrder,
  removeStaffMember,
  resolveShortcutTargets,
  upsertStaffMember,
  updateOrderStatus,
} from '../../utils/orderService';

const REFRESH_INTERVAL_MS = 10000;
const KITCHEN_REFRESH_INTERVAL_MS = 5000;
const DELAY_MINUTES = 10;
const DEFAULT_SERVE_TARGET_MINUTES = 20;
const CRITICAL_DELAY_MINUTES = DELAY_MINUTES * 2;
const KANBAN_LABELS = {
  pending: 'En attente',
  preparing: 'En preparation',
  served: 'Servie',
  cancelled: 'Annulee',
};
const MANAGER_TAB_OPTIONS = [
  { id: 'finance', label: 'Finance' },
  { id: 'performance', label: 'Performance' },
  { id: 'staff', label: 'Staff' },
  { id: 'exports', label: 'Exports' },
];
const MANAGER_PERIOD_OPTIONS = [
  { id: 'today', label: 'Aujourdhui' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Mois en cours' },
  { id: 'custom', label: 'Personnalise' },
];
const CASH_CLOSURE_STORAGE_KEY = 'commande_manager_cash_closures';
const MAX_CASH_CLOSURES = 40;
const CASH_DIFF_ALERT_THRESHOLD = 0.01;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function statusStyle(status) {
  if (status === 'pending') return 'text-amber-400 border-amber-500/40';
  if (status === 'preparing') return 'text-sky-400 border-sky-500/40';
  if (status === 'served') return 'text-emerald-400 border-emerald-500/40';
  return 'text-rose-400 border-rose-500/40';
}

function normalizeRealtimeOrder(row) {
  return {
    id: row.id,
    orderNumber: String(row.order_number || '').trim(),
    tableNumber: String(row.table_number || '').trim(),
    customerName: String(row.customer_name || '').trim(),
    customerPhone: String(row.customer_phone || '').trim(),
    notes: String(row.notes || '').trim(),
    status: String(row.status || 'pending'),
    totalAmount: Number(row.total_amount || 0),
    items: Array.isArray(row.items) ? row.items : [],
    assignedTo: row.assigned_to || null,
    assignedAt: row.assigned_at || null,
    preparedAt: row.prepared_at || null,
    servedAt: row.served_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function minutesSince(dateValue) {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return 0;
  const diffMs = Date.now() - time;
  return Math.max(0, Math.floor(diffMs / 60000));
}

function toTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function diffMinutes(startValue, endValue) {
  const start = toTimestamp(startValue);
  const end = toTimestamp(endValue);
  if (!start || !end || end < start) return null;
  return Math.max(0, Math.floor((end - start) / 60000));
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes === null) return '-';
  return `${minutes} min`;
}

function buildTimeline(order) {
  return [
    { key: 'created', label: 'Creee', value: order.createdAt },
    { key: 'assigned', label: 'Assignee', value: order.assignedAt },
    { key: 'prepared', label: 'Preparing', value: order.preparedAt },
    { key: 'served', label: 'Servie', value: order.servedAt },
  ];
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

function getHourLabel(dateValue) {
  const date = new Date(dateValue || 0);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const h = String(date.getHours()).padStart(2, '0');
  return `${h}:00`;
}

function getServerDisplayName(serverKey) {
  const raw = String(serverKey || '').trim();
  if (!raw) return 'Serveur inconnu';
  if (raw.includes('@')) {
    return raw.split('@')[0] || raw;
  }
  if (raw.length <= 10) return raw;
  return `Serveur ${raw.slice(0, 6)}`;
}

function formatCurrency(value) {
  return `${Number(value || 0).toFixed(2)} DT`;
}

function playNewOrderTone() {
  try {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1174, ctx.currentTime + 0.11);
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.36);
  } catch (error) {
    console.warn('Unable to play order notification tone.', error);
  }
}

function toCsvValue(value) {
  const normalized = String(value ?? '').replaceAll(/\r?\n|\r/g, ' ').trim();
  return `"${normalized.replaceAll('"', '""')}"`;
}

function buildOrdersCsv(orders) {
  const header = [
    'order_number',
    'table_number',
    'customer_name',
    'customer_phone',
    'status',
    'total_amount',
    'created_at',
    'assigned_to',
    'assigned_at',
    'prepared_at',
    'served_at',
    'duration_total_min',
    'duration_preparation_min',
    'duration_service_min',
    'notes',
    'items',
  ];

  const lines = orders.map((order) => {
    const itemsText = (order.items || [])
      .map((item) => `${item.quantity || 0}x ${item.name || 'Item'}`)
      .join(' | ');

    const totalMinutes = diffMinutes(order.createdAt, order.servedAt);
    const preparationMinutes = diffMinutes(order.createdAt, order.preparedAt);
    const serviceMinutes = diffMinutes(order.preparedAt, order.servedAt);

    return [
      order.orderNumber || `#${order.id}`,
      order.tableNumber || '',
      order.customerName || '',
      order.customerPhone || '',
      order.status || '',
      Number(order.totalAmount || 0).toFixed(2),
      order.createdAt || '',
      order.assignedTo || '',
      order.assignedAt || '',
      order.preparedAt || '',
      order.servedAt || '',
      totalMinutes ?? '',
      preparationMinutes ?? '',
      serviceMinutes ?? '',
      order.notes || '',
      itemsText,
    ]
      .map(toCsvValue)
      .join(',');
  });

  return [header.join(','), ...lines].join('\n');
}

function buildPeriodRange(periodKey, customStart, customEnd) {
  const now = new Date();
  const nowMs = now.getTime();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (periodKey === '7d') {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    const end = new Date(nowMs);
    return {
      start,
      end,
      startMs: start.getTime(),
      endMs: nowMs,
      label: '7 derniers jours',
    };
  }

  if (periodKey === '30d') {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 29);
    const end = new Date(nowMs);
    return {
      start,
      end,
      startMs: start.getTime(),
      endMs: nowMs,
      label: '30 derniers jours',
    };
  }

  if (periodKey === 'custom') {
    const startRaw = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const endRaw = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    const startMsCandidate = startRaw && Number.isFinite(startRaw.getTime()) ? startRaw.getTime() : startOfToday.getTime();
    const endMsCandidate = endRaw && Number.isFinite(endRaw.getTime()) ? endRaw.getTime() : nowMs;

    const startMs = Math.min(startMsCandidate, endMsCandidate);
    const endMs = Math.max(startMsCandidate, endMsCandidate);
    const start = new Date(startMs);
    const end = new Date(endMs);

    const startLabel = customStart || 'debut';
    const endLabel = customEnd || 'maintenant';

    return {
      start,
      end,
      startMs,
      endMs,
      label: `${startLabel} -> ${endLabel}`,
    };
  }

  const start = new Date(startOfToday);
  const end = new Date(nowMs);
  return {
    start,
    end,
    startMs: startOfToday.getTime(),
    endMs: nowMs,
    label: 'Aujourd hui',
  };
}

function buildFinanceCsv({ periodLabel, metrics, orders }) {
  const summary = [
    ['period', periodLabel],
    ['orders_count', metrics.totalOrders],
    ['served_count', metrics.servedCount],
    ['cancelled_count', metrics.cancelledCount],
    ['revenue_served', Number(metrics.revenueServed || 0).toFixed(2)],
    ['cancelled_amount', Number(metrics.cancelledAmount || 0).toFixed(2)],
    ['average_ticket', Number(metrics.averageTicket || 0).toFixed(2)],
    ['avg_service_min', metrics.avgServeMinutes],
    ['median_service_min', metrics.medianServeMinutes],
  ];

  const detailsHeader = [
    'order_number',
    'status',
    'table_number',
    'total_amount',
    'created_at',
    'served_at',
    'assigned_to',
  ];

  const details = (orders || []).map((order) => (
    [
      order.orderNumber || `#${order.id}`,
      order.status || '',
      order.tableNumber || '',
      Number(order.totalAmount || 0).toFixed(2),
      order.createdAt || '',
      order.servedAt || '',
      order.assignedTo || '',
    ].map(toCsvValue).join(',')
  ));

  return [
    'metric,value',
    ...summary.map(([k, v]) => `${toCsvValue(k)},${toCsvValue(v)}`),
    '',
    detailsHeader.map(toCsvValue).join(','),
    ...details,
  ].join('\n');
}

function buildCashClosuresCsv(closures) {
  const header = [
    'closed_at',
    'closed_by',
    'period_label',
    'note',
    'orders_total',
    'orders_served',
    'orders_cancelled',
    'revenue_served',
    'amount_cancelled',
    'amount_active',
    'counted_cash',
    'expected_cash',
    'cash_difference',
    'difference_alert',
    'sla_rate',
  ];

  const lines = (closures || []).map((closure) => (
    [
      closure.closedAt || '',
      closure.closedBy || '',
      closure.periodLabel || '',
      closure.note || '',
      closure.totalOrders ?? 0,
      closure.servedCount ?? 0,
      closure.cancelledCount ?? 0,
      Number(closure.revenueServed || 0).toFixed(2),
      Number(closure.cancelledAmount || 0).toFixed(2),
      Number(closure.activeAmount || 0).toFixed(2),
      Number(closure.countedCash || 0).toFixed(2),
      Number(closure.expectedCash || 0).toFixed(2),
      Number(closure.cashDifference || 0).toFixed(2),
      closure.differenceAlert ? 'true' : 'false',
      Number(closure.servedWithinTargetRate || 0),
    ].map(toCsvValue).join(',')
  ));

  return [header.map(toCsvValue).join(','), ...lines].join('\n');
}

export default function CommandePanel({ interfaceType = 'staff' }) { // eslint-disable-line react/prop-types
  const { can, isReady: accessReady, refreshAccess } = useAccess();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [accessProfile, setAccessProfile] = useState({
    role: 'guest',
    isManager: false,
    isAdmin: false,
  });
  const [authError, setAuthError] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [realtimeNotice, setRealtimeNotice] = useState('');
  const [unseenCount, setUnseenCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const [kitchenMode, setKitchenMode] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [focusedOrderId, setFocusedOrderId] = useState(null);
  const [eventsByOrder, setEventsByOrder] = useState({});
  const [openEventsOrderIds, setOpenEventsOrderIds] = useState([]);
  const [eventsLoadingOrderId, setEventsLoadingOrderId] = useState(null);
  const [serveTargetMinutes, setServeTargetMinutes] = useState(DEFAULT_SERVE_TARGET_MINUTES);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('staff');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMsg, setStaffMsg] = useState('');
  const [managerTab, setManagerTab] = useState('finance');
  const [managerPeriod, setManagerPeriod] = useState('today');
  const [managerCustomStart, setManagerCustomStart] = useState('');
  const [managerCustomEnd, setManagerCustomEnd] = useState('');
  const [staffSearchTerm, setStaffSearchTerm] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState('all');
  const [managerCountedCash, setManagerCountedCash] = useState('');
  const [managerClosureNote, setManagerClosureNote] = useState('');
  const [cashClosureSyncMsg, setCashClosureSyncMsg] = useState('');
  const [cashClosures, setCashClosures] = useState(() => {
    try {
      const raw = localStorage.getItem(CASH_CLOSURE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_CASH_CLOSURES) : [];
    } catch {
      return [];
    }
  });
  const [boardMode, setBoardMode] = useState(false);
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [lastCriticalAlertAt, setLastCriticalAlertAt] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('commande_sound_enabled') !== '0';
    } catch {
      return true;
    }
  });

  const isManagerInterface = interfaceType === 'manager';
  const currentUserId = session?.user?.id || null;
  const hasManagerRole = accessProfile.isManager || accessProfile.isAdmin;
  const canSeeStaffDashboard = allowed && (!accessReady || can(ERP_ACTIONS.ORDERS_STAFF_VIEW));
  const canUpdateOrders = allowed && (!accessReady || can(ERP_ACTIONS.ORDERS_STAFF_UPDATE));
  const canAssignOrders = allowed && (!accessReady || can(ERP_ACTIONS.ORDERS_STAFF_ASSIGN) || can(ERP_ACTIONS.ORDERS_STAFF_UPDATE));
  const canUseManagerAnalytics = hasManagerRole && (!accessReady || can(ERP_ACTIONS.ORDERS_MANAGER_ANALYTICS));
  const canUseManagerExports = hasManagerRole && (!accessReady || can(ERP_ACTIONS.ORDERS_MANAGER_EXPORT));
  const canManageManagerCashClosures = hasManagerRole && (!accessReady || can(ERP_ACTIONS.ORDERS_MANAGER_CASH_CLOSURE));
  const canManageManagerStaff = hasManagerRole && (!accessReady || can(ERP_ACTIONS.ORDERS_MANAGER_STAFF_MANAGE));
  const canViewManagerFinancials = isManagerInterface && canUseManagerAnalytics;
  const routeLabel = isManagerInterface ? '/commandes/manager' : '/commandes/staff';
  const dashboardTitle = isManagerInterface ? 'Interface Gerant' : 'Interface Staff';
  let accessRoleLabel = 'Staff';
  if (accessProfile.isAdmin) {
    accessRoleLabel = 'Admin';
  } else if (accessProfile.isManager) {
    accessRoleLabel = 'Gerant';
  }

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === 'pending').length,
    [orders]
  );

  const managerPeriodRange = useMemo(
    () => buildPeriodRange(managerPeriod, managerCustomStart, managerCustomEnd),
    [managerPeriod, managerCustomStart, managerCustomEnd],
  );

  const managerPeriodOrders = useMemo(() => {
    return orders.filter((order) => {
      const ts = new Date(order.createdAt || 0).getTime();
      if (!Number.isFinite(ts)) return false;
      return ts >= managerPeriodRange.startMs && ts <= managerPeriodRange.endMs;
    });
  }, [orders, managerPeriodRange.endMs, managerPeriodRange.startMs]);

  const managerMetrics = useMemo(() => {
    const periodOrders = managerPeriodOrders;
    const servedOrders = periodOrders.filter((order) => order.status === 'served');
    const cancelledOrders = periodOrders.filter((order) => order.status === 'cancelled');
    const activeOrders = periodOrders.filter((order) => order.status === 'pending' || order.status === 'preparing');

    const revenueServed = servedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const cancelledAmount = cancelledOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const activeAmount = activeOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const pendingCount = activeOrders.length;
    const averageTicket = servedOrders.length > 0 ? revenueServed / servedOrders.length : 0;

    const servedDurations = servedOrders
      .map((order) => diffMinutes(order.createdAt, order.servedAt))
      .filter((value) => Number.isFinite(value));

    const avgServeMinutes = servedDurations.length
      ? Math.round(servedDurations.reduce((sum, value) => sum + value, 0) / servedDurations.length)
      : 0;

    const medianServeMinutes = median(servedDurations);
    const servedWithinTarget = servedDurations.filter((value) => value <= serveTargetMinutes).length;
    const servedWithinTargetRate = servedDurations.length
      ? Math.round((servedWithinTarget / servedDurations.length) * 100)
      : 0;

    const preparationDurations = periodOrders
      .map((order) => diffMinutes(order.createdAt, order.preparedAt))
      .filter((value) => Number.isFinite(value));
    const avgPreparationMinutes = preparationDurations.length
      ? Math.round(preparationDurations.reduce((sum, value) => sum + value, 0) / preparationDurations.length)
      : 0;

    const servicePhaseDurations = periodOrders
      .map((order) => diffMinutes(order.preparedAt, order.servedAt))
      .filter((value) => Number.isFinite(value));
    const avgServicePhaseMinutes = servicePhaseDurations.length
      ? Math.round(servicePhaseDurations.reduce((sum, value) => sum + value, 0) / servicePhaseDurations.length)
      : 0;

    const delayedCount = activeOrders.filter((order) => minutesSince(order.createdAt) >= DELAY_MINUTES).length;

    const hoursCount = {};
    periodOrders.forEach((order) => {
      const label = getHourLabel(order.createdAt);
      hoursCount[label] = (hoursCount[label] || 0) + 1;
    });
    const topLoadHours = Object.entries(hoursCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour, count }));
    const topLoadMax = topLoadHours.reduce((max, slot) => Math.max(max, slot.count), 0);

    const perfMap = {};
    periodOrders.forEach((order) => {
      const serverKey = String(order.assignedTo || '').trim();
      if (!serverKey) return;

      if (!perfMap[serverKey]) {
        perfMap[serverKey] = {
          server: serverKey,
          count: 0,
          totalMinutes: 0,
          measuredCount: 0,
          servedWithinTarget: 0,
        };
      }

      perfMap[serverKey].count += 1;
      const totalMinutes = diffMinutes(order.createdAt, order.servedAt);
      if (Number.isFinite(totalMinutes)) {
        perfMap[serverKey].totalMinutes += totalMinutes;
        perfMap[serverKey].measuredCount += 1;
        if (totalMinutes <= serveTargetMinutes) {
          perfMap[serverKey].servedWithinTarget += 1;
        }
      }
    });

    const serverPerformance = Object.values(perfMap)
      .map((row) => ({
        server: row.server,
        displayName: getServerDisplayName(row.server),
        count: row.count,
        avgMinutes: row.measuredCount ? Math.round(row.totalMinutes / row.measuredCount) : 0,
        measuredCount: row.measuredCount,
        servedWithinTargetRate: row.measuredCount
          ? Math.round((row.servedWithinTarget / row.measuredCount) * 100)
          : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topServerVolume = serverPerformance.reduce((max, row) => Math.max(max, row.count), 0);

    const statusRevenue = periodOrders.reduce(
      (acc, order) => {
        const status = String(order.status || '').toLowerCase();
        const amount = Number(order.totalAmount || 0);
        if (!Number.isFinite(amount)) return acc;
        if (status === 'pending' || status === 'preparing' || status === 'served' || status === 'cancelled') {
          acc[status] += amount;
        }
        return acc;
      },
      {
        pending: 0,
        preparing: 0,
        served: 0,
        cancelled: 0,
      },
    );

    return {
      periodLabel: managerPeriodRange.label,
      periodOrders,
      totalOrders: periodOrders.length,
      servedCount: servedOrders.length,
      pendingCount,
      cancelledCount: cancelledOrders.length,
      delayedCount,
      revenueServed,
      cancelledAmount,
      activeAmount,
      averageTicket,
      statusRevenue,
      avgServeMinutes,
      medianServeMinutes,
      servedWithinTarget,
      servedWithinTargetRate,
      avgPreparationMinutes,
      avgServicePhaseMinutes,
      topLoadHours,
      topLoadMax,
      serverPerformance,
      topServerVolume,
    };
  }, [managerPeriodOrders, managerPeriodRange.label, serveTargetMinutes]);

  const latestCashClosure = useMemo(() => {
    if (!Array.isArray(cashClosures) || cashClosures.length === 0) return null;
    return cashClosures[0];
  }, [cashClosures]);

  const managerExpectedCash = useMemo(() => Number(managerMetrics.revenueServed || 0), [managerMetrics.revenueServed]);
  const managerCountedCashValue = useMemo(() => {
    const parsed = Number(managerCountedCash);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [managerCountedCash]);
  const managerCashDifference = useMemo(
    () => managerCountedCashValue - managerExpectedCash,
    [managerCountedCashValue, managerExpectedCash],
  );
  const managerCashDiffAlert = useMemo(
    () => Math.abs(managerCashDifference) >= CASH_DIFF_ALERT_THRESHOLD,
    [managerCashDifference],
  );

  const filteredStaffMembers = useMemo(() => {
    return staffMembers.filter((member) => {
      const email = String(member?.email || '').toLowerCase();
      const role = String(member?.role || 'staff').toLowerCase();
      const isPending = Boolean(member?.isPending);

      if (staffSearchTerm.trim()) {
        const search = staffSearchTerm.trim().toLowerCase();
        if (!email.includes(search)) return false;
      }

      if (staffRoleFilter !== 'all' && role !== staffRoleFilter) {
        return false;
      }

      if (staffStatusFilter === 'pending' && !isPending) {
        return false;
      }

      if (staffStatusFilter === 'active' && isPending) {
        return false;
      }

      return true;
    });
  }, [staffMembers, staffSearchTerm, staffRoleFilter, staffStatusFilter]);

  const displayedOrders = useMemo(() => {
    let next = [...orders];

    if (statusFilter !== 'all') {
      next = next.filter((order) => order.status === statusFilter);
    }

    if (assignmentFilter === 'mine' && currentUserId) {
      next = next.filter((order) => String(order.assignedTo || '') === String(currentUserId));
    }

    if (assignmentFilter === 'unassigned') {
      next = next.filter((order) => !order.assignedTo);
    }

    const search = searchTerm.trim().toLowerCase();
    if (search) {
      next = next.filter((order) => {
        const orderNumber = String(order.orderNumber || '').toLowerCase();
        const tableNumber = String(order.tableNumber || '').toLowerCase();
        return orderNumber.includes(search) || tableNumber.includes(search);
      });
    }

    if (kitchenMode) {
      next.sort((a, b) => {
        const aPriority = a.status === 'pending' ? 0 : a.status === 'preparing' ? 1 : 2;
        const bPriority = b.status === 'pending' ? 0 : b.status === 'preparing' ? 1 : 2;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const delayDiff = minutesSince(b.createdAt) - minutesSince(a.createdAt);
        if (delayDiff !== 0) return delayDiff;

        const aTs = new Date(a.createdAt || 0).getTime();
        const bTs = new Date(b.createdAt || 0).getTime();
        return aTs - bTs;
      });
    } else {
      next.sort((a, b) => {
        const aTs = new Date(a.createdAt || 0).getTime();
        const bTs = new Date(b.createdAt || 0).getTime();
        return sortMode === 'oldest' ? aTs - bTs : bTs - aTs;
      });
    }

    return next;
  }, [orders, sortMode, statusFilter, assignmentFilter, searchTerm, currentUserId, kitchenMode]);

  const visibleOrders = useMemo(() => {
    if (showArchive) {
      return displayedOrders.filter((order) => order.status === 'served' || order.status === 'cancelled');
    }
    return displayedOrders.filter((order) => order.status === 'pending' || order.status === 'preparing');
  }, [displayedOrders, showArchive]);

  const totalPages = useMemo(() => {
    const computed = Math.ceil(visibleOrders.length / Math.max(1, pageSize));
    return Math.max(1, computed);
  }, [visibleOrders.length, pageSize]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleOrders.slice(start, start + pageSize);
  }, [visibleOrders, page, pageSize]);

  const selectedIdsSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds]);
  const allPageSelected = useMemo(() => {
    if (pagedOrders.length === 0) return false;
    return pagedOrders.every((order) => selectedIdsSet.has(order.id));
  }, [pagedOrders, selectedIdsSet]);

  const criticalSlaOrders = useMemo(
    () =>
      visibleOrders.filter((order) => {
        if (order.status !== 'pending' && order.status !== 'preparing') return false;
        return minutesSince(order.createdAt) >= CRITICAL_DELAY_MINUTES;
      }),
    [visibleOrders],
  );

  const smartDispatchPlan = useMemo(
    () => recommendSmartDispatchOrder(orders, currentUserId, { maxActiveLoad: 3 }),
    [orders, currentUserId],
  );

  const kanbanStatuses = useMemo(
    () => (showArchive ? ['served', 'cancelled'] : ['pending', 'preparing', 'served']),
    [showArchive],
  );

  const kanbanByStatus = useMemo(() => {
    const buckets = Object.fromEntries(kanbanStatuses.map((status) => [status, []]));
    visibleOrders.forEach((order) => {
      const status = String(order.status || 'pending');
      if (!buckets[status]) return;
      buckets[status].push(order);
    });

    kanbanStatuses.forEach((status) => {
      buckets[status].sort((a, b) => {
        if (status === 'pending' || status === 'preparing') {
          const delayDiff = minutesSince(b.createdAt) - minutesSince(a.createdAt);
          if (delayDiff !== 0) return delayDiff;
        }
        const aTs = new Date(a.createdAt || 0).getTime();
        const bTs = new Date(b.createdAt || 0).getTime();
        return aTs - bTs;
      });
    });

    return buckets;
  }, [kanbanStatuses, visibleOrders]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, assignmentFilter, searchTerm, sortMode, showArchive, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('commande_sound_enabled', soundEnabled ? '1' : '0');
    } catch (error) {
      console.warn('Unable to persist sound preference.', error);
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(CASH_CLOSURE_STORAGE_KEY, JSON.stringify(cashClosures.slice(0, MAX_CASH_CLOSURES)));
    } catch (error) {
      console.warn('Unable to persist manager cash closures.', error);
    }
  }, [cashClosures]);

  useEffect(() => {
    if (!allowed) return;
    if (criticalSlaOrders.length === 0) return;

    const now = Date.now();
    if (now - lastCriticalAlertAt < 60_000) return;

    setLastCriticalAlertAt(now);
    setRealtimeNotice(`ALERTE MANAGER: ${criticalSlaOrders.length} commande(s) en retard critique (20m+).`);
    if (soundEnabled) {
      playNewOrderTone();
    }
  }, [allowed, criticalSlaOrders.length, lastCriticalAlertAt, soundEnabled]);

  useEffect(() => {
    if (!supabaseClient) {
      setAuthError('Supabase n est pas configure.');
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
    };

    void bootstrap();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAllowed(false);
      setOrders([]);
      setAccessProfile({ role: 'guest', isManager: false, isAdmin: false });
      setStaffMembers([]);
      setStaffMsg('');
      return;
    }

    let mounted = true;

    const verifyAndLoad = async () => {
      const profile = await getServerAccessProfile();
      if (!mounted) return;

      setAllowed(Boolean(profile.allowed));
      setAccessProfile({
        role: profile.role || 'guest',
        isManager: Boolean(profile.isManager),
        isAdmin: Boolean(profile.isAdmin),
      });

      if (!profile.allowed) {
        setStatusMsg('Compte connecte sans acces serveur. Ajoutez-le dans public.staff_users.');
        return;
      }

      setLoading(true);
      const result = await loadOrders({ status: 'all', sort: 'newest' });
      if (!mounted) return;
      setLoading(false);

      if (!result.ok) {
        setStatusMsg(`Erreur chargement commandes: ${result.message}`);
        return;
      }

      setOrders(result.orders);
      setStatusMsg('');
    };

    void verifyAndLoad();

    const refreshDelay = kitchenMode ? KITCHEN_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS;
    const timer = autoRefreshEnabled
      ? setInterval(() => {
          void verifyAndLoad();
        }, refreshDelay)
      : null;

    return () => {
      mounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [session, kitchenMode, autoRefreshEnabled]);

  useEffect(() => {
    if (!session) return;
    void refreshAccess();
  }, [session, refreshAccess]);

  useEffect(() => {
    if (!session || !allowed || !supabaseClient) return;

    const channel = supabaseClient
      .channel('cafe-orders-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cafe_orders' },
        (payload) => {
          const incoming = normalizeRealtimeOrder(payload.new || {});
          const orderRef = incoming.orderNumber || `#${incoming.id}`;
          const tableRef = incoming.tableNumber || '-';

          setOrders((prev) => {
            const exists = prev.some((order) => Number(order.id) === Number(incoming.id));
            if (exists) return prev;
            return [incoming, ...prev];
          });

          setUnseenCount((prev) => prev + 1);
          setRealtimeNotice(`Nouvelle commande ${orderRef} table ${tableRef}`);
          if (kitchenMode) {
            setShowArchive(false);
            setFocusedOrderId(incoming.id);
            setPage(1);
          }
          if (soundEnabled) {
            playNewOrderTone();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cafe_orders' },
        (payload) => {
          const incoming = normalizeRealtimeOrder(payload.new || {});
          setOrders((prev) => prev.map((order) => (Number(order.id) === Number(incoming.id) ? incoming : order)));
        }
      )
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [session, allowed, soundEnabled, kitchenMode]);

  useEffect(() => {
    if (!focusedOrderId) return;
    const node = document.getElementById(`order-card-${focusedOrderId}`);
    if (!node) return;

    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedOrderId, page, pagedOrders]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');

    if (!supabaseClient) {
      setAuthError('Supabase n est pas configure.');
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError('Identifiants invalides.');
      return;
    }

    setStatusMsg('Connexion serveur reussie.');
  };

  const handleLogout = async () => {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    setSession(null);
    setAllowed(false);
    setAccessProfile({ role: 'guest', isManager: false, isAdmin: false });
    setOrders([]);
    setStaffMembers([]);
    setStaffMsg('');
    setStaffEmail('');
    setStaffPassword('');
    setStaffRole('staff');
    setEmail('');
    setPassword('');
  };

  const refreshStaff = async () => {
    if (!canManageManagerStaff) {
      setStaffMsg('Action reservee au gerant autorise.');
      return;
    }

    setStaffLoading(true);
    const result = await loadStaffMembers();
    setStaffLoading(false);

    if (!result.ok) {
      setStaffMsg(`Erreur chargement staff: ${result.message}`);
      return;
    }

    setStaffMembers(result.members);
    setStaffMsg('Liste staff mise a jour.');
  };

  const handleAddOrUpdateStaff = async (event) => {
    event.preventDefault();
    if (!canManageManagerStaff) {
      setStaffMsg('Action reservee au gerant.');
      return;
    }

    setStaffMsg('');

    const hasPassword = String(staffPassword || '').trim().length > 0;
    const result = hasPassword
      ? await provisionStaffAccount(staffEmail, staffPassword, staffRole)
      : await upsertStaffMember(staffEmail, staffRole);

    if (!result.ok) {
      setStaffMsg(`Erreur staff: ${result.message}`);
      return;
    }

    setStaffEmail('');
    setStaffPassword('');
    setStaffRole('staff');

    await refreshStaff();

    if (hasPassword) {
      if (result.rateLimited) {
        setStaffMsg(
          result.message ||
            'Limite email Supabase atteinte: invitation staff sauvegardee. Reessayez la creation du compte Auth plus tard.'
        );
        return;
      }

      if (result.accountCreated && result.requiresEmailConfirmation) {
        setStaffMsg('Compte staff cree. Verification email requise avant connexion (selon config Auth).');
      } else if (result.member?.isPending) {
        setStaffMsg('Compte en attente de synchronisation/activation. Reessayez dans quelques secondes puis testez /commandes/staff.');
      } else if (result.accountCreated) {
        setStaffMsg('Compte staff cree et role applique. L utilisateur peut se connecter a /commandes/staff.');
      } else if (result.accountAlreadyExists) {
        setStaffMsg('Compte Auth deja existant. Role staff/manager mis a jour.');
      } else {
        setStaffMsg('Compte staff traite avec succes.');
      }
      return;
    }

    setStaffMsg('Membre staff ajoute/mis a jour (invitation en attente si compte non cree).');
  };

  const handleRemoveStaff = async (member) => {
    if (!canManageManagerStaff) {
      setStaffMsg('Action reservee au gerant.');
      return;
    }

    if (!globalThis.confirm('Supprimer ce membre du staff ?')) return;

    const result = await removeStaffMember({
      userId: member?.userId || null,
      email: member?.email || '',
    });
    if (!result.ok) {
      setStaffMsg(`Erreur suppression: ${result.message}`);
      return;
    }

    await refreshStaff();
    setStaffMsg('Membre staff supprime.');
  };

  useEffect(() => {
    if (!canManageManagerStaff) {
      setStaffMembers([]);
      setStaffMsg('');
      return;
    }

    let cancelled = false;

    const bootstrapStaff = async () => {
      setStaffLoading(true);
      const result = await loadStaffMembers();
      if (cancelled) return;
      setStaffLoading(false);

      if (!result.ok) {
        setStaffMsg(`Erreur chargement staff: ${result.message}`);
        return;
      }

      setStaffMembers(result.members);
      setStaffMsg('');
    };

    void bootstrapStaff();

    return () => {
      cancelled = true;
    };
  }, [canManageManagerStaff]);

  useEffect(() => {
    if (!canManageManagerCashClosures) {
      setCashClosureSyncMsg('');
      return;
    }

    let cancelled = false;

    const bootstrapCashClosures = async () => {
      const result = await loadCashClosures(MAX_CASH_CLOSURES);
      if (cancelled) return;

      if (!result.ok) {
        setCashClosureSyncMsg(`Mode local actif: sync Supabase indisponible (${result.message}).`);
        return;
      }

      setCashClosures(result.closures);
      setCashClosureSyncMsg('');
    };

    void bootstrapCashClosures();

    return () => {
      cancelled = true;
    };
  }, [canManageManagerCashClosures]);

  const refreshOrders = async () => {
    if (!canSeeStaffDashboard) {
      setStatusMsg('Permission refusee: consultation commandes non autorisee.');
      return;
    }

    setLoading(true);
    const result = await loadOrders({ status: 'all', sort: 'newest' });
    setLoading(false);

    if (!result.ok) {
      setStatusMsg(`Erreur chargement commandes: ${result.message}`);
      return;
    }

    setOrders(result.orders);
    setStatusMsg('Commandes rechargees.');
    setUnseenCount(0);
  };

  const applyStatusUpdate = async (targetIds, nextStatus, source = 'action', reason = '') => {
    if (!canUpdateOrders) {
      setStatusMsg('Permission refusee: mise a jour de statut non autorisee.');
      return;
    }

    const uniqueIds = dedupeNumericOrderIds(targetIds);
    if (uniqueIds.length === 0) {
      setStatusMsg('Aucune commande selectionnee.');
      return;
    }

    const updates = [];
    let failed = 0;

    for (const orderId of uniqueIds) {
      const result = await updateOrderStatus(orderId, nextStatus, {
        source,
        terminal: 'web',
        reason,
      });
      if (!result.ok) {
        setStatusMsg(`Erreur mise a jour #${orderId}: ${formatOrderErrorMessage(result.message)}`);
        failed += 1;
        continue;
      }
      updates.push(result.order);
    }

    if (updates.length > 0) {
      const byId = new Map(updates.map((order) => [Number(order.id), order]));
      setOrders((prev) => prev.map((order) => byId.get(Number(order.id)) || order));
    }

    if (source === 'bulk') {
      setSelectedOrderIds((prev) => prev.filter((id) => !uniqueIds.includes(Number(id))));
    }

    if (failed > 0 && updates.length > 0) {
      setStatusMsg(`${updates.length} commande(s) mises a jour, ${failed} echec(s).`);
      return;
    }

    if (failed > 0) {
      setStatusMsg('Echec mise a jour des commandes selectionnees.');
      return;
    }

    setStatusMsg(`${updates.length} commande(s) mises a jour (${nextStatus}).`);
  };

  const setOrderStatus = async (orderId, nextStatus) => {
    let reason = '';
    if (nextStatus === 'cancelled') {
      reason = globalThis.prompt('Motif d annulation (obligatoire):', '') || '';
      if (!reason.trim()) {
        setStatusMsg('Annulation stoppee: motif obligatoire.');
        return;
      }
    }

    await applyStatusUpdate([orderId], nextStatus, 'single', reason);
  };

  const handleTakeOrder = async (orderId) => {
    if (!canAssignOrders) {
      setStatusMsg('Permission refusee: prise en charge non autorisee.');
      return;
    }

    const result = await assignOrder(orderId);
    if (!result.ok) {
      setStatusMsg(`Erreur prise en charge: ${result.message}`);
      return;
    }

    const orderRef = result.order.orderNumber || `#${orderId}`;
    setOrders((prev) => prev.map((order) => (order.id === orderId ? result.order : order)));
    setStatusMsg(`Commande ${orderRef} prise en charge.`);
  };

  const handleExportCsv = () => {
    if (!canUseManagerExports) {
      setStatusMsg('Export CSV reserve au gerant.');
      return;
    }

    if (visibleOrders.length === 0) {
      setStatusMsg('Aucune commande a exporter.');
      return;
    }

    const csv = buildOrdersCsv(visibleOrders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    link.href = url;
    link.setAttribute('download', `commandes-${showArchive ? 'archive' : 'active'}-${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatusMsg('Export CSV genere.');
  };

  const handleExportFinanceCsv = () => {
    if (!canUseManagerExports) {
      setStatusMsg('Export finance reserve au gerant.');
      return;
    }

    if (managerMetrics.totalOrders === 0) {
      setStatusMsg('Aucune commande sur la periode selectionnee.');
      return;
    }

    const csv = buildFinanceCsv({
      periodLabel: managerMetrics.periodLabel,
      metrics: managerMetrics,
      orders: managerMetrics.periodOrders,
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    link.href = url;
    link.setAttribute('download', `finance-manager-${managerPeriod}-${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatusMsg('Export finance genere.');
  };

  const handleCreateCashClosure = async () => {
    if (!canManageManagerCashClosures) {
      setStatusMsg('Cloture reservee au gerant.');
      return;
    }

    if (managerMetrics.totalOrders === 0) {
      setStatusMsg('Impossible de cloturer: aucune commande sur cette periode.');
      return;
    }

    if (String(managerCountedCash || '').trim() === '') {
      setStatusMsg('Saisissez le montant caisse compte avant cloture.');
      return;
    }

    const closurePayload = {
      closedByUserId: session?.user?.id || null,
      closedBy: session?.user?.email || accessRoleLabel,
      periodLabel: managerMetrics.periodLabel,
      note: managerClosureNote.trim(),
      totalOrders: managerMetrics.totalOrders,
      servedCount: managerMetrics.servedCount,
      cancelledCount: managerMetrics.cancelledCount,
      revenueServed: managerMetrics.revenueServed,
      cancelledAmount: managerMetrics.cancelledAmount,
      activeAmount: managerMetrics.activeAmount,
      countedCash: managerCountedCashValue,
      expectedCash: managerExpectedCash,
      cashDifference: managerCashDifference,
      differenceAlert: managerCashDiffAlert,
      servedWithinTargetRate: managerMetrics.servedWithinTargetRate,
    };

    const remoteResult = await createCashClosure(closurePayload);
    if (remoteResult.ok && remoteResult.closure) {
      setCashClosures((prev) => [remoteResult.closure, ...prev].slice(0, MAX_CASH_CLOSURES));
      setCashClosureSyncMsg('');
      setManagerClosureNote('');
      setManagerCountedCash('');
      setStatusMsg(managerCashDiffAlert ? 'Cloture enregistree avec alerte ecart caisse.' : 'Cloture de caisse enregistree.');
      return;
    }

    const closedAt = new Date().toISOString();
    const localClosureEntry = {
      id: `local-closure-${closedAt}`,
      closedAt,
      ...closurePayload,
    };

    setCashClosures((prev) => [localClosureEntry, ...prev].slice(0, MAX_CASH_CLOSURES));
    setCashClosureSyncMsg(`Mode local actif: sync Supabase indisponible (${remoteResult.message}).`);
    setManagerClosureNote('');
    setManagerCountedCash('');
    setStatusMsg(managerCashDiffAlert ? 'Cloture locale avec alerte ecart caisse.' : 'Cloture enregistree localement.');
  };

  const handleExportCashClosuresCsv = () => {
    if (!canUseManagerExports) {
      setStatusMsg('Export cloture reserve au gerant.');
      return;
    }

    if (cashClosures.length === 0) {
      setStatusMsg('Aucune cloture disponible a exporter.');
      return;
    }

    const csv = buildCashClosuresCsv(cashClosures);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    link.href = url;
    link.setAttribute('download', `clotures-caisse-${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatusMsg('Export des clotures genere.');
  };

  const handleClearCashClosures = async () => {
    if (!canManageManagerCashClosures) {
      setStatusMsg('Action reservee au gerant.');
      return;
    }

    if (!globalThis.confirm('Supprimer tout l historique des clotures ?')) return;

    const result = await clearCashClosures();
    setCashClosures([]);

    if (!result.ok) {
      setCashClosureSyncMsg(`Historique local vide. Sync Supabase indisponible (${result.message}).`);
      setStatusMsg('Historique local des clotures supprime.');
      return;
    }

    setCashClosureSyncMsg('');
    setStatusMsg('Historique des clotures supprime.');
  };

  const handleSmartDispatchToMe = async () => {
    if (!canAssignOrders) {
      setStatusMsg('Permission refusee: dispatch intelligent non autorise.');
      return;
    }

    if (smartDispatchPlan.blocked) {
      setStatusMsg(`Dispatch intelligent bloque: ${smartDispatchPlan.reason}`);
      return;
    }

    if (!smartDispatchPlan.orderId) {
      setStatusMsg(smartDispatchPlan.reason || 'Aucune commande a dispatcher.');
      return;
    }

    await handleTakeOrder(Number(smartDispatchPlan.orderId));
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
    setFocusedOrderId(orderId);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = pagedOrders.map((order) => order.id);
    if (visibleIds.length === 0) return;

    if (allPageSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedOrderIds((prev) => [...new Set([...prev, ...visibleIds])]);
  };

  const handleBulkStatus = async (nextStatus) => {
    await applyStatusUpdate(selectedOrderIds, nextStatus, 'bulk');
  };

  const handleKanbanDrop = async (targetStatus) => {
    if (!canUpdateOrders) {
      setStatusMsg('Permission refusee: deplacement kanban non autorise.');
      return;
    }

    const draggedId = Number(draggingOrderId);
    setDraggingOrderId(null);

    if (!Number.isInteger(draggedId) || draggedId <= 0) return;
    const order = orders.find((item) => Number(item.id) === draggedId);
    if (!order) return;
    if (order.status === targetStatus) return;

    let reason = '';
    if (targetStatus === 'cancelled') {
      reason = globalThis.prompt('Motif d annulation (obligatoire):', '') || '';
      if (!reason.trim()) {
        setStatusMsg('Annulation stoppee: motif obligatoire.');
        return;
      }
    }

    await applyStatusUpdate([draggedId], targetStatus, 'kanban-dnd', reason);
  };

  const toggleEventsPanel = async (orderId) => {
    if (!canSeeStaffDashboard) {
      setStatusMsg('Permission refusee: lecture des events non autorisee.');
      return;
    }

    const isOpen = openEventsOrderIds.includes(orderId);
    if (isOpen) {
      setOpenEventsOrderIds((prev) => prev.filter((id) => id !== orderId));
      return;
    }

    setOpenEventsOrderIds((prev) => [...prev, orderId]);
    if (eventsByOrder[orderId]) return;

    setEventsLoadingOrderId(orderId);
    const result = await loadOrderEvents(orderId, 25);
    setEventsLoadingOrderId(null);

    if (!result.ok) {
      setStatusMsg(`Erreur chargement events: ${result.message}`);
      return;
    }

    setEventsByOrder((prev) => ({ ...prev, [orderId]: result.events }));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = String(event.key || '').toLowerCase();
      if (key !== 'p' && key !== 's') return;

      if (!canUpdateOrders) {
        setStatusMsg('Permission refusee: raccourci statut non autorise.');
        return;
      }

      event.preventDefault();
      const targets = resolveShortcutTargets({
        selectedOrderIds,
        focusedOrderId,
        pagedOrders,
      });

      if (targets.length === 0) {
        setStatusMsg('Aucune commande cible pour le raccourci clavier.');
        return;
      }

      const nextStatus = key === 'p' ? 'preparing' : 'served';
      void applyStatusUpdate(targets, nextStatus, selectedOrderIds.length ? 'bulk' : 'shortcut');
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [selectedOrderIds, focusedOrderId, pagedOrders, canUpdateOrders]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      setStatusMsg(`Impossible de changer le mode plein ecran: ${error.message}`);
    }
  };

  if (!session) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-md border border-amber-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500 mb-3'>Serveur Access</p>
          <h1 className='text-3xl font-light mb-2'>{routeLabel}</h1>
          <p className='text-white/60 text-sm mb-6'>
            {isManagerInterface
              ? 'Connexion reservee au gerant (finances + gestion staff).'
              : 'Connexion reservee au personnel du cafe.'}
          </p>

          <form onSubmit={handleLogin} className='space-y-4'>
            <input
              type='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder='Email serveur'
              className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
              autoComplete='email'
            />
            <input
              type='password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder='Mot de passe'
              className='w-full bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
              autoComplete='current-password'
            />

            {authError && <p className='text-red-400 text-sm'>{authError}</p>}

            <button
              type='submit'
              className='w-full bg-amber-500 text-black font-semibold py-3 hover:bg-amber-400 transition-colors'
            >
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3'>Access Refuse</p>
          <h1 className='text-2xl sm:text-3xl font-light mb-4'>Compte sans autorisation serveur</h1>
          <p className='text-white/65 text-sm sm:text-base'>
            Ajoutez cet utilisateur dans la table public.staff_users pour activer l acces a {routeLabel}.
          </p>
          <button
            onClick={handleLogout}
            className='mt-6 px-5 py-2 border border-white/30 hover:bg-white/10 transition-colors'
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (!canSeeStaffDashboard) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3'>Access Refuse</p>
          <h1 className='text-2xl sm:text-3xl font-light mb-4'>Permission insuffisante</h1>
          <p className='text-white/65 text-sm sm:text-base'>
            Votre session est active mais ne possede pas les permissions d action pour gerer les commandes.
          </p>
          <button
            onClick={handleLogout}
            className='mt-6 px-5 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (isManagerInterface && !hasManagerRole) {
    return (
      <div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
        <div className='w-full max-w-xl border border-red-500/30 bg-white/5 p-6 sm:p-8'>
          <p className='text-[10px] tracking-[0.35em] uppercase text-red-400 mb-3'>Access Refuse</p>
          <h1 className='text-2xl sm:text-3xl font-light mb-4'>Acces reserve au gerant</h1>
          <p className='text-white/65 text-sm sm:text-base'>
            Cette interface requiert le role manager (ou admin). Connectez-vous via /commandes/staff pour l interface staff.
          </p>
          <div className='mt-6 flex flex-wrap gap-3'>
            <a
              href='/commandes/staff'
              className='px-5 py-2 border border-white/30 hover:bg-white/10 transition-colors text-sm'
            >
              Ouvrir /commandes/staff
            </a>
            <button
              onClick={handleLogout}
              className='px-5 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-black text-white pb-14'>
      <header className='border-b border-white/10 bg-black/80 backdrop-blur sticky top-0 z-30'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3'>
          <div>
            <p className='text-[10px] tracking-[0.35em] uppercase text-amber-500'>Cafe Commandes</p>
            <h1 className='text-2xl sm:text-3xl font-light'>{dashboardTitle}</h1>
            <p className='text-xs text-white/50 mt-1'>{pendingCount} commande(s) en attente</p>
            <p className='text-[11px] text-white/45 mt-1'>Role actif: {accessRoleLabel}</p>
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-sm'
              title='Son des notifications'
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              onClick={() => setKitchenMode((prev) => !prev)}
              className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-xs'
            >
              {kitchenMode ? 'Mode normal' : 'Mode cuisine'}
            </button>
            {kitchenMode && (
              <button
                onClick={() => setAutoRefreshEnabled((prev) => !prev)}
                className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-xs'
                title='Auto-refresh cuisine'
              >
                {autoRefreshEnabled ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </button>
            )}
            {kitchenMode && (
              <button
                onClick={toggleFullscreen}
                className='px-3 py-2 border border-white/20 hover:bg-white/10 transition-colors text-xs'
                title='Plein ecran cuisine'
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize size={14} />}
              </button>
            )}
            <button
              onClick={refreshOrders}
              disabled={!canSeeStaffDashboard}
              className='px-4 py-2 border border-white/20 hover:bg-white/10 transition-colors text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              <RefreshCw size={14} /> Rafraichir
            </button>
            <button
              onClick={handleLogout}
              className='px-4 py-2 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors text-sm'
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {realtimeNotice && (
          <div className='mb-5 border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-3 text-amber-300'>
            <div className='flex items-center gap-2'>
              <BellRing size={16} />
              <p className='text-sm'>{realtimeNotice}</p>
            </div>
            <button onClick={() => setRealtimeNotice('')} className='text-xs border border-amber-500/40 px-2 py-1'>Fermer</button>
          </div>
        )}

        {!isManagerInterface && (
        <div className='mb-5 flex flex-wrap items-center gap-2'>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder='Recherche table / numero commande'
            className='bg-transparent border border-white/20 text-xs px-3 py-2 min-w-[220px]'
          />
          <button
            onClick={() => setUnseenCount(0)}
            className='px-3 py-2 border border-amber-500/40 text-amber-300 text-xs'
          >
            Nouvelles non vues: {unseenCount}
          </button>
          {[
            { value: 'all', label: 'Tous serveurs' },
            { value: 'mine', label: 'Mes commandes' },
            { value: 'unassigned', label: 'Non assignees' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setAssignmentFilter(item.value)}
              className={`px-3 py-2 text-xs border ${assignmentFilter === item.value ? 'border-amber-500 text-amber-400' : 'border-white/20 text-white/70'}`}
            >
              {item.label}
            </button>
          ))}
          {['all', 'pending', 'preparing', 'served', 'cancelled'].map((value) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-2 text-xs border ${statusFilter === value ? 'border-amber-500 text-amber-400' : 'border-white/20 text-white/70'}`}
            >
              {value}
            </button>
          ))}
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className='bg-transparent border border-white/20 text-xs px-2 py-2'
            disabled={kitchenMode}
          >
            <option value='newest'>Plus recentes</option>
            <option value='oldest'>Plus anciennes</option>
          </select>
          {kitchenMode && <p className='text-[11px] text-amber-300'>Tri urgence force</p>}
          <button
            onClick={() => setShowArchive((prev) => !prev)}
            className={`px-3 py-2 text-xs border flex items-center gap-1 ${showArchive ? 'border-amber-500 text-amber-400' : 'border-white/20 text-white/70'}`}
          >
            <Archive size={13} /> {showArchive ? 'Voir actifs' : 'Voir archives'}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!canUseManagerExports}
            className='px-3 py-2 text-xs border border-white/20 text-white/80 hover:bg-white/10 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed'
            title={canUseManagerExports ? 'Exporter les commandes en CSV' : 'Reserve au gerant'}
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() => setBoardMode((prev) => !prev)}
            className={`px-3 py-2 text-xs border ${boardMode ? 'border-amber-500 text-amber-400' : 'border-white/20 text-white/70'}`}
          >
            {boardMode ? 'Vue liste' : 'Vue Kanban'}
          </button>
          <button
            onClick={() => {
              void handleSmartDispatchToMe();
            }}
            disabled={!canAssignOrders}
            className={`px-3 py-2 text-xs border ${
              smartDispatchPlan.blocked
                ? 'border-rose-500/50 text-rose-300'
                : 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title='Prend automatiquement la meilleure commande pending non assignee'
          >
            Dispatch intelligent
          </button>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value) || 8)}
            className='bg-transparent border border-white/20 text-xs px-2 py-2'
          >
            <option value={6}>6 / page</option>
            <option value={8}>8 / page</option>
            <option value={12}>12 / page</option>
            <option value={20}>20 / page</option>
          </select>
          <button
            onClick={toggleSelectAllVisible}
            className='px-3 py-2 text-xs border border-white/20 text-white/80 hover:bg-white/10'
          >
            {allPageSelected ? 'Deselectionner page' : 'Selectionner page'}
          </button>
          <button
            onClick={() => {
              void handleBulkStatus('preparing');
            }}
            disabled={selectedOrderIds.length === 0 || !canUpdateOrders}
            className='px-3 py-2 text-xs border border-sky-500/40 text-sky-300 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Bulk Preparing
          </button>
          <button
            onClick={() => {
              void handleBulkStatus('served');
            }}
            disabled={selectedOrderIds.length === 0 || !canUpdateOrders}
            className='px-3 py-2 text-xs border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed'
          >
            Bulk Served
          </button>
          <p className='text-[11px] text-white/55'>Selection: {selectedOrderIds.length} | Raccourcis: P / S | Charge perso: {smartDispatchPlan.currentLoad}</p>
        </div>
        )}

        {canViewManagerFinancials ? (
          <>
            <section className='mb-5 border border-white/10 bg-white/5 px-4 py-4'>
              <div className='flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4'>
                <div className='flex flex-wrap gap-2'>
                  {MANAGER_TAB_OPTIONS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setManagerTab(tab.id)}
                      className={`px-3 py-2 text-xs border transition-colors ${
                        managerTab === tab.id
                          ? 'border-amber-500/70 bg-amber-500/20 text-amber-200'
                          : 'border-white/20 text-white/75 hover:bg-white/10'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-xs text-white/65'>Periode</p>
                  <select
                    value={managerPeriod}
                    onChange={(event) => setManagerPeriod(event.target.value)}
                    className='bg-transparent border border-white/20 text-xs px-2 py-2'
                  >
                    {MANAGER_PERIOD_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id} className='text-black'>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {managerPeriod === 'custom' && (
                    <>
                      <input
                        type='date'
                        value={managerCustomStart}
                        onChange={(event) => setManagerCustomStart(event.target.value)}
                        className='bg-transparent border border-white/20 text-xs px-2 py-2'
                      />
                      <input
                        type='date'
                        value={managerCustomEnd}
                        onChange={(event) => setManagerCustomEnd(event.target.value)}
                        className='bg-transparent border border-white/20 text-xs px-2 py-2'
                      />
                    </>
                  )}
                  <button
                    onClick={handleExportFinanceCsv}
                    disabled={!canUseManagerExports}
                    className='inline-flex items-center gap-2 px-3 py-2 text-xs border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/15'
                  >
                    <Download size={14} />
                    Export finance
                  </button>
                </div>
              </div>

              <p className='mt-3 text-[11px] text-white/55'>
                Fenetre analysee: {managerPeriodRange.start.toLocaleDateString('fr-FR')} - {managerPeriodRange.end.toLocaleDateString('fr-FR')} | {managerMetrics.totalOrders} commande(s)
              </p>
            </section>

            {managerTab === 'finance' && (
              <>
                <section className='mb-3 flex items-center gap-2'>
                  <p className='text-xs text-white/65'>Cible SLA service</p>
                  <select
                    value={serveTargetMinutes}
                    onChange={(event) => setServeTargetMinutes(Number(event.target.value) || DEFAULT_SERVE_TARGET_MINUTES)}
                    className='bg-transparent border border-white/20 text-xs px-2 py-2'
                  >
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                  </select>
                  <p className='text-xs text-white/70'>Taux respect: {managerMetrics.servedWithinTargetRate}% ({managerMetrics.servedWithinTarget})</p>
                </section>

                <section className='mb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
                  <article className='border border-emerald-500/35 bg-emerald-500/10 px-4 py-3'>
                    <p className='text-[11px] text-emerald-200/80 uppercase tracking-wider'>CA servi (periode)</p>
                    <p className='text-2xl font-light mt-1 text-emerald-200'>{formatCurrency(managerMetrics.revenueServed)}</p>
                  </article>
                  <article className='border border-amber-500/35 bg-amber-500/10 px-4 py-3'>
                    <p className='text-[11px] text-amber-200/80 uppercase tracking-wider'>Ticket moyen</p>
                    <p className='text-2xl font-light mt-1 text-amber-100'>{formatCurrency(managerMetrics.averageTicket)}</p>
                  </article>
                  <article className='border border-sky-500/35 bg-sky-500/10 px-4 py-3'>
                    <p className='text-[11px] text-sky-200/80 uppercase tracking-wider'>Montant en cours</p>
                    <p className='text-2xl font-light mt-1 text-sky-100'>{formatCurrency(managerMetrics.activeAmount)}</p>
                  </article>
                  <article className='border border-rose-500/35 bg-rose-500/10 px-4 py-3'>
                    <p className='text-[11px] text-rose-200/80 uppercase tracking-wider'>Montant annule</p>
                    <p className='text-2xl font-light mt-1 text-rose-100'>{formatCurrency(managerMetrics.cancelledAmount)}</p>
                  </article>
                </section>

                <section className='mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Pending</p>
                    <p className='text-xl font-light mt-1 text-amber-300'>{formatCurrency(managerMetrics.statusRevenue.pending)}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Preparing</p>
                    <p className='text-xl font-light mt-1 text-sky-300'>{formatCurrency(managerMetrics.statusRevenue.preparing)}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Served</p>
                    <p className='text-xl font-light mt-1 text-emerald-300'>{formatCurrency(managerMetrics.statusRevenue.served)}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Cancelled</p>
                    <p className='text-xl font-light mt-1 text-rose-300'>{formatCurrency(managerMetrics.statusRevenue.cancelled)}</p>
                  </article>
                </section>
              </>
            )}

            {managerTab === 'performance' && (
              <>
                <section className='mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3'>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Total commandes</p>
                    <p className='text-2xl font-light mt-1'>{managerMetrics.totalOrders}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Servies</p>
                    <p className='text-2xl font-light mt-1 text-emerald-400'>{managerMetrics.servedCount}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>En cours</p>
                    <p className='text-2xl font-light mt-1 text-sky-400'>{managerMetrics.pendingCount}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Retard actif</p>
                    <p className='text-2xl font-light mt-1 text-rose-400'>{managerMetrics.delayedCount}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Moyenne service</p>
                    <p className='text-2xl font-light mt-1 flex items-center gap-2'>
                      <BarChart3 size={16} className='text-amber-400' /> {managerMetrics.avgServeMinutes} min
                    </p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Mediane service</p>
                    <p className='text-2xl font-light mt-1 text-amber-300'>{managerMetrics.medianServeMinutes} min</p>
                  </article>
                </section>

                <section className='mb-6 grid grid-cols-1 xl:grid-cols-2 gap-3'>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider mb-2'>Top heures de charge</p>
                    {managerMetrics.topLoadHours.length === 0 ? (
                      <p className='text-xs text-white/55'>Aucune donnee pour cette periode.</p>
                    ) : (
                      <div className='space-y-2'>
                        {managerMetrics.topLoadHours.map((slot) => {
                          const width = managerMetrics.topLoadMax > 0
                            ? Math.max(10, Math.round((slot.count / managerMetrics.topLoadMax) * 100))
                            : 10;
                          const share = managerMetrics.totalOrders > 0
                            ? Math.round((slot.count / managerMetrics.totalOrders) * 100)
                            : 0;
                          return (
                            <div key={slot.hour} className='border border-white/10 px-2 py-2'>
                              <div className='flex items-center justify-between text-sm text-white/80'>
                                <p>{slot.hour}</p>
                                <p>{slot.count} commande(s) | {share}%</p>
                              </div>
                              <div className='mt-2 h-1.5 bg-white/10'>
                                <div className='h-1.5 bg-amber-400/80' style={{ width: `${width}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>

                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider mb-2'>Performance serveurs</p>
                    {managerMetrics.serverPerformance.length === 0 ? (
                      <p className='text-xs text-white/55'>Aucun serveur assigne pour cette periode.</p>
                    ) : (
                      <div className='space-y-2'>
                        {managerMetrics.serverPerformance.map((row, index) => {
                          const volumeWidth = managerMetrics.topServerVolume > 0
                            ? Math.max(10, Math.round((row.count / managerMetrics.topServerVolume) * 100))
                            : 10;

                          return (
                            <div key={row.server} className='border border-white/10 px-2 py-2'>
                              <div className='flex items-center justify-between text-sm text-white/80'>
                                <p>{index + 1}. {row.displayName}</p>
                                <p>Volume: {row.count}</p>
                              </div>
                              <div className='mt-1 flex flex-wrap gap-3 text-[12px] text-white/65'>
                                <p>Delai moyen: {row.avgMinutes} min</p>
                                <p>SLA: {row.servedWithinTargetRate}%</p>
                                <p>Servies mesurees: {row.measuredCount}</p>
                              </div>
                              <div className='mt-2 h-1.5 bg-white/10'>
                                <div className='h-1.5 bg-sky-400/80' style={{ width: `${volumeWidth}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                </section>
              </>
            )}

            {managerTab === 'staff' && (
              <section className='mb-6 border border-white/10 bg-white/5 p-5 sm:p-7'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5'>
                  <h2 className='text-xl sm:text-2xl font-light'>Gestion du staff</h2>
                  <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-xs text-white/60'>
                      {filteredStaffMembers.length}/{staffMembers.length} visible(s)
                    </p>
                    <button
                      onClick={() => {
                        void refreshStaff();
                      }}
                      disabled={!canManageManagerStaff}
                      className='px-4 py-2 text-xs border border-white/25 hover:bg-white/10 transition-colors'
                    >
                      Rafraichir
                    </button>
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-4 gap-3 mb-5'>
                  <input
                    type='text'
                    placeholder='Recherche email'
                    value={staffSearchTerm}
                    onChange={(event) => setStaffSearchTerm(event.target.value)}
                    className='md:col-span-2 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                  />
                  <select
                    value={staffRoleFilter}
                    onChange={(event) => setStaffRoleFilter(event.target.value)}
                    className='bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                  >
                    <option value='all' className='text-black'>Tous les roles</option>
                    <option value='manager' className='text-black'>Manager</option>
                    <option value='staff' className='text-black'>Staff</option>
                  </select>
                  <select
                    value={staffStatusFilter}
                    onChange={(event) => setStaffStatusFilter(event.target.value)}
                    className='bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                  >
                    <option value='all' className='text-black'>Tous les statuts</option>
                    <option value='active' className='text-black'>Actif</option>
                    <option value='pending' className='text-black'>Invitation en attente</option>
                  </select>
                </div>

                <form onSubmit={handleAddOrUpdateStaff} className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
                  <input
                    type='email'
                    placeholder='Email du staff'
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    disabled={!canManageManagerStaff}
                    className='md:col-span-2 bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                    required
                  />
                  <input
                    type='password'
                    placeholder='Mot de passe (optionnel pour creer le compte)'
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                    disabled={!canManageManagerStaff}
                    className='bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                  />
                  <select
                    value={staffRole}
                    onChange={(event) => setStaffRole(event.target.value)}
                    disabled={!canManageManagerStaff}
                    className='bg-transparent border border-white/20 px-4 py-3 text-sm outline-none focus:border-amber-500'
                  >
                    <option value='staff' className='text-black'>staff</option>
                    <option value='manager' className='text-black'>manager (gerant)</option>
                  </select>

                  <div className='md:col-span-3 flex flex-wrap gap-3'>
                    <button
                      type='submit'
                      disabled={!canManageManagerStaff}
                      className='px-6 py-3 bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors'
                    >
                      Ajouter / Mettre a jour
                    </button>
                  </div>
                </form>

                {staffLoading && <p className='text-sm text-white/60 mb-4'>Chargement du staff...</p>}

                <div className='space-y-3'>
                  {staffMembers.length === 0 ? (
                    <p className='text-white/60 text-sm'>Aucun staff configure.</p>
                  ) : filteredStaffMembers.length === 0 ? (
                    <p className='text-white/60 text-sm'>Aucun resultat avec les filtres actuels.</p>
                  ) : (
                    filteredStaffMembers.map((member) => (
                      <article key={`${member.userId || 'invite'}-${member.email}`} className='border border-white/10 p-4 sm:p-5'>
                        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
                          <div className='min-w-0'>
                            <h3 className='text-base sm:text-lg font-medium truncate'>{member.email}</h3>
                            <p className='text-xs text-white/55 mt-1'>{member.userId || 'Invite en attente de creation du compte'}</p>
                            <p className='text-xs mt-2'>
                              Role:{' '}
                              <span className={member.role === 'manager' ? 'text-amber-400' : 'text-sky-400'}>
                                {member.role}
                              </span>
                            </p>
                            {member.isPending && (
                              <p className='text-xs mt-1 text-amber-300'>Statut: invitation en attente</p>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              void handleRemoveStaff(member);
                            }}
                            disabled={!canManageManagerStaff}
                            className='px-4 py-2 text-xs border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-colors'
                          >
                            Supprimer
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <p className='text-[11px] text-white/45 mt-5'>
                  Note: si mot de passe renseigne, tentative de creation compte Auth + role staff. Sinon, invitation staff en attente.
                </p>
                {staffMsg && <p className='text-sm text-emerald-400 mt-3'>{staffMsg}</p>}
              </section>
            )}

            {managerTab === 'exports' && (
              <section className='mb-6 border border-white/10 bg-white/5 p-5 sm:p-7'>
                <h2 className='text-xl sm:text-2xl font-light'>Exports et rapports</h2>
                <p className='text-sm text-white/65 mt-2'>
                  Cette section centralise les exports manager sur la periode selectionnee.
                </p>

                <div className='mt-4 flex flex-wrap gap-3'>
                  <button
                    onClick={handleExportFinanceCsv}
                    disabled={!canUseManagerExports}
                    className='inline-flex items-center gap-2 px-4 py-2 text-xs border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/15'
                  >
                    <Download size={14} />
                    Export KPI finance
                  </button>
                  <button
                    onClick={handleExportCsv}
                    disabled={!canUseManagerExports}
                    className='inline-flex items-center gap-2 px-4 py-2 text-xs border border-sky-500/40 text-sky-300 hover:bg-sky-500/20'
                  >
                    <Download size={14} />
                    Export commandes visibles
                  </button>
                  <button
                    onClick={handleExportCashClosuresCsv}
                    disabled={!canUseManagerExports}
                    className='inline-flex items-center gap-2 px-4 py-2 text-xs border border-amber-500/50 text-amber-300 hover:bg-amber-500/15'
                  >
                    <Download size={14} />
                    Export historique clotures
                  </button>
                </div>

                <div className='mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Periode</p>
                    <p className='text-sm mt-1 text-white/85'>{managerMetrics.periodLabel}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>Total commandes</p>
                    <p className='text-xl font-light mt-1'>{managerMetrics.totalOrders}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>CA servi</p>
                    <p className='text-xl font-light mt-1 text-emerald-300'>{formatCurrency(managerMetrics.revenueServed)}</p>
                  </article>
                  <article className='border border-white/10 bg-white/5 px-4 py-3'>
                    <p className='text-[11px] text-white/55 uppercase tracking-wider'>SLA respecte</p>
                    <p className='text-xl font-light mt-1 text-amber-300'>{managerMetrics.servedWithinTargetRate}%</p>
                  </article>
                </div>

                <section className='mt-6 border border-white/10 bg-black/30 p-4 sm:p-5'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                    <h3 className='text-base sm:text-lg font-medium'>Cloture de caisse</h3>
                    <p className='text-xs text-white/55'>Historique: {cashClosures.length} cloture(s)</p>
                  </div>

                  {cashClosureSyncMsg && (
                    <p className='mt-2 text-xs text-amber-300'>{cashClosureSyncMsg}</p>
                  )}

                  <p className='text-xs text-white/60 mt-2'>
                    Enregistre un snapshot des chiffres manager sur la periode active pour la fin de service.
                  </p>

                  <div className='mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3'>
                    <article className='border border-white/10 bg-white/5 px-3 py-2'>
                      <p className='text-[10px] text-white/55 uppercase tracking-wider'>Caisse attendue</p>
                      <p className='text-sm text-emerald-300 mt-1'>{formatCurrency(managerExpectedCash)}</p>
                    </article>
                    <article className='border border-white/10 bg-white/5 px-3 py-2'>
                      <p className='text-[10px] text-white/55 uppercase tracking-wider'>Caisse comptee</p>
                      <p className='text-sm text-sky-300 mt-1'>{formatCurrency(managerCountedCashValue)}</p>
                    </article>
                    <article className='border border-white/10 bg-white/5 px-3 py-2'>
                      <p className='text-[10px] text-white/55 uppercase tracking-wider'>Ecart caisse</p>
                      <p className={`text-sm mt-1 ${managerCashDiffAlert ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {formatCurrency(managerCashDifference)}
                      </p>
                    </article>
                  </div>

                  <div className='mt-4 grid grid-cols-1 lg:grid-cols-4 gap-3'>
                    <input
                      type='number'
                      step='0.01'
                      min='0'
                      value={managerCountedCash}
                      onChange={(event) => setManagerCountedCash(event.target.value)}
                      placeholder='Montant caisse compte (DT)'
                      className='bg-transparent border border-white/20 px-4 py-2 text-sm outline-none focus:border-amber-500'
                    />
                    <input
                      type='text'
                      value={managerClosureNote}
                      onChange={(event) => setManagerClosureNote(event.target.value)}
                      placeholder='Note de cloture (ex: ecart caisse 2 DT)'
                      className='lg:col-span-2 bg-transparent border border-white/20 px-4 py-2 text-sm outline-none focus:border-amber-500'
                    />
                    <button
                      onClick={() => {
                        void handleCreateCashClosure();
                      }}
                      disabled={!canManageManagerCashClosures}
                      className='px-4 py-2 text-xs border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/15'
                    >
                      Cloturer cette periode
                    </button>
                  </div>

                  {managerCashDiffAlert && (
                    <p className='mt-2 text-xs text-rose-300'>
                      Alerte reconciliation: un ecart caisse sera enregistre a la cloture.
                    </p>
                  )}

                  {latestCashClosure && (
                    <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3'>
                      <article className='border border-white/10 bg-white/5 px-3 py-2'>
                        <p className='text-[10px] text-white/55 uppercase tracking-wider'>Derniere cloture</p>
                        <p className='text-xs text-white/85 mt-1'>{formatDate(latestCashClosure.closedAt)}</p>
                      </article>
                      <article className='border border-white/10 bg-white/5 px-3 py-2'>
                        <p className='text-[10px] text-white/55 uppercase tracking-wider'>CA servi snapshot</p>
                        <p className='text-sm text-emerald-300 mt-1'>{formatCurrency(latestCashClosure.revenueServed)}</p>
                      </article>
                      <article className='border border-white/10 bg-white/5 px-3 py-2'>
                        <p className='text-[10px] text-white/55 uppercase tracking-wider'>Annulations snapshot</p>
                        <p className='text-sm text-rose-300 mt-1'>{formatCurrency(latestCashClosure.cancelledAmount)}</p>
                      </article>
                      <article className='border border-white/10 bg-white/5 px-3 py-2'>
                        <p className='text-[10px] text-white/55 uppercase tracking-wider'>Caisse comptee</p>
                        <p className='text-sm text-sky-300 mt-1'>{formatCurrency(latestCashClosure.countedCash)}</p>
                      </article>
                      <article className='border border-white/10 bg-white/5 px-3 py-2'>
                        <p className='text-[10px] text-white/55 uppercase tracking-wider'>Ecart</p>
                        <p className={`text-sm mt-1 ${latestCashClosure.differenceAlert ? 'text-rose-300' : 'text-emerald-300'}`}>
                          {formatCurrency(latestCashClosure.cashDifference)}
                        </p>
                      </article>
                      <article className='border border-white/10 bg-white/5 px-3 py-2'>
                        <p className='text-[10px] text-white/55 uppercase tracking-wider'>SLA snapshot</p>
                        <p className='text-sm text-amber-300 mt-1'>{latestCashClosure.servedWithinTargetRate}%</p>
                      </article>
                    </div>
                  )}

                  <div className='mt-4 flex flex-wrap gap-2'>
                    <button
                      onClick={handleExportCashClosuresCsv}
                      disabled={!canUseManagerExports}
                      className='px-3 py-2 text-xs border border-white/20 text-white/80 hover:bg-white/10'
                    >
                      Export complet clotures
                    </button>
                    <button
                      onClick={() => {
                        void handleClearCashClosures();
                      }}
                      disabled={!canManageManagerCashClosures}
                      className='px-3 py-2 text-xs border border-rose-500/40 text-rose-300 hover:bg-rose-500/15'
                    >
                      Vider historique
                    </button>
                  </div>

                  <div className='mt-4 space-y-2'>
                    {cashClosures.length === 0 ? (
                      <p className='text-xs text-white/55'>Aucune cloture enregistree pour le moment.</p>
                    ) : (
                      cashClosures.slice(0, 8).map((closure) => (
                        <article key={closure.id} className='border border-white/10 px-3 py-2'>
                          <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2'>
                            <p className='text-xs text-white/80'>
                              {formatDate(closure.closedAt)} | {closure.closedBy || 'manager'} | {closure.periodLabel}
                            </p>
                            <p className='text-xs text-emerald-300'>CA: {formatCurrency(closure.revenueServed)}</p>
                          </div>
                          <div className='mt-1 flex flex-wrap gap-3 text-[11px] text-white/60'>
                            <p>Cmd: {closure.totalOrders}</p>
                            <p>Servies: {closure.servedCount}</p>
                            <p>Annulees: {closure.cancelledCount}</p>
                            <p>Comptee: {formatCurrency(closure.countedCash)}</p>
                            <p>Attendue: {formatCurrency(closure.expectedCash)}</p>
                            <p className={closure.differenceAlert ? 'text-rose-300' : 'text-emerald-300'}>
                              Ecart: {formatCurrency(closure.cashDifference)}
                            </p>
                            <p>SLA: {closure.servedWithinTargetRate}%</p>
                          </div>
                          {closure.note && <p className='mt-1 text-[11px] text-amber-200/90'>Note: {closure.note}</p>}
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </section>
            )}
          </>
        ) : null}

        {!canViewManagerFinancials && isManagerInterface && (
          <section className='mb-6 border border-amber-500/30 bg-amber-500/10 px-4 py-3'>
            <p className='text-sm text-amber-300'>Les blocs resume et argent sont reserves au gerant.</p>
          </section>
        )}

        {statusMsg && <p className='text-sm text-amber-300 mb-5'>{statusMsg}</p>}
        {loading && <p className='text-white/60 text-sm mb-5'>Chargement des commandes...</p>}

        {criticalSlaOrders.length > 0 && (
          <div className='mb-5 border border-rose-500/50 bg-rose-500/10 px-4 py-3'>
            <p className='text-sm text-rose-300'>
              Alerte SLA critique: {criticalSlaOrders.length} commande(s) depassent 20 minutes.
            </p>
          </div>
        )}

        {!loading && visibleOrders.length === 0 && (
          <div className='border border-white/10 bg-white/5 p-7 text-center'>
            <UtensilsCrossed size={28} className='mx-auto text-amber-500 mb-3' />
            <p className='text-white/70'>Aucune commande dans cette vue.</p>
          </div>
        )}

        {boardMode && !loading && visibleOrders.length > 0 && (
          <section className='mb-6 grid grid-cols-1 xl:grid-cols-3 gap-3'>
            {kanbanStatuses.map((status) => (
              <article
                key={status}
                className='border border-white/10 bg-white/5 p-3 min-h-[220px]'
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (canUpdateOrders) {
                    void handleKanbanDrop(status);
                  }
                }}
              >
                <div className='flex items-center justify-between mb-3'>
                  <p className={`text-xs uppercase tracking-wider px-2 py-1 border ${statusStyle(status)}`}>
                    {KANBAN_LABELS[status] || status}
                  </p>
                  <p className='text-xs text-white/55'>{kanbanByStatus[status]?.length || 0}</p>
                </div>

                <div className='space-y-2'>
                  {(kanbanByStatus[status] || []).map((order) => {
                    const delay = minutesSince(order.createdAt);
                    const critical = (order.status === 'pending' || order.status === 'preparing') && delay >= CRITICAL_DELAY_MINUTES;

                    return (
                      <div
                        key={`kanban-${order.id}`}
                        draggable={canUpdateOrders && order.status !== 'served' && order.status !== 'cancelled'}
                        onDragStart={() => setDraggingOrderId(order.id)}
                        onDragEnd={() => setDraggingOrderId(null)}
                        className={`border p-2 cursor-grab active:cursor-grabbing ${critical ? 'border-rose-500/50 bg-rose-500/10' : 'border-white/15 bg-black/40'}`}
                      >
                        <p className='text-sm font-medium text-white/85'>{order.orderNumber || `#${order.id}`}</p>
                        <p className='text-xs text-white/65'>
                          Table {order.tableNumber || '-'} | {canViewManagerFinancials ? formatCurrency(order.totalAmount) : 'Montant reserve gerant'}
                        </p>
                        <p className='text-xs text-white/55 mt-1'>Age: {delay} min</p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        )}

        {!boardMode && (
        <div className={kitchenMode ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'space-y-4'}>
          {pagedOrders.map((order) => {
            const delay = minutesSince(order.createdAt);
            const isDelayed = (order.status === 'pending' || order.status === 'preparing') && delay >= DELAY_MINUTES;
            const isMine = currentUserId && order.assignedTo && String(order.assignedTo) === String(currentUserId);
            let assignmentLabel = 'Non affectee';
            if (order.assignedTo) {
              assignmentLabel = isMine ? 'Moi' : 'Un serveur';
            }
            let slaTone = 'text-emerald-400 border-emerald-500/40';
            let slaText = 'SLA OK';
            if (order.status === 'pending' || order.status === 'preparing') {
              if (delay >= DELAY_MINUTES * 2) {
                slaTone = 'text-rose-400 border-rose-500/40';
                slaText = `SLA Critique (${delay}m)`;
              } else if (delay >= DELAY_MINUTES) {
                slaTone = 'text-amber-400 border-amber-500/40';
                slaText = `SLA Alerte (${delay}m)`;
              }
            }

            return (
              <article
                key={order.id}
                id={`order-card-${order.id}`}
                className={`border bg-white/5 p-5 ${
                  isDelayed ? 'border-rose-500/50' : 'border-white/10'
                } ${kitchenMode ? 'p-3' : 'p-5'}`}
                onClick={() => setFocusedOrderId(order.id)}
              >
                <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
                  <div>
                    <div className='flex flex-wrap items-center gap-3 mb-2'>
                      <input
                        type='checkbox'
                        checked={selectedIdsSet.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        onClick={(event) => event.stopPropagation()}
                        className='accent-amber-500'
                        title='Selectionner commande'
                      />
                      <p className={`${kitchenMode ? 'text-xl' : 'text-lg'} font-semibold`}>{order.orderNumber || `#${order.id}`}</p>
                      <span className={`px-2 py-1 text-xs border uppercase ${statusStyle(order.status)}`}>
                        {order.status}
                      </span>
                      {focusedOrderId === order.id && (
                        <span className='px-2 py-1 text-[10px] border border-amber-500/40 text-amber-300 uppercase'>Focus</span>
                      )}
                      <span className={`px-2 py-1 text-[10px] border uppercase ${slaTone}`}>
                        {slaText}
                      </span>
                      {isDelayed && <span className='text-xs text-rose-400'>Retard: {delay} min</span>}
                    </div>
                    <p className={`${kitchenMode ? 'text-base' : 'text-sm'} text-white/80`}>Table: {order.tableNumber || '-'}</p>
                    <p className={`${kitchenMode ? 'text-base' : 'text-sm'} text-white/70`}>Client: {order.customerName || '-'}</p>
                    <p className='text-sm text-white/70'>Telephone: {order.customerPhone || '-'}</p>
                    <p className='text-sm text-white/70 flex items-center gap-2'>
                      <Clock3 size={14} /> {formatDate(order.createdAt)}
                    </p>
                    <p className='text-xs text-white/50 mt-1'>
                      Affectation: {assignmentLabel}
                    </p>
                    {order.notes && <p className='text-sm text-white/60 mt-1'>Note: {order.notes}</p>}

                    <div className='mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2'>
                      {buildTimeline(order).map((item) => (
                        <div key={`${order.id}-${item.key}`} className='border border-white/10 px-2 py-1'>
                          <p className='text-[10px] uppercase tracking-wider text-white/45'>{item.label}</p>
                          <p className='text-[11px] text-white/75'>{formatDate(item.value)}</p>
                        </div>
                      ))}
                    </div>

                    <p className='mt-2 text-[11px] text-white/50'>
                      Duree prep: {formatDuration(diffMinutes(order.createdAt, order.preparedAt))} | Duree service: {formatDuration(diffMinutes(order.preparedAt, order.servedAt))}
                    </p>
                  </div>

                  <div className='flex flex-wrap gap-2'>
                    {!order.assignedTo && (
                      <button
                        onClick={() => handleTakeOrder(order.id)}
                        disabled={!canAssignOrders}
                        className='px-3 py-2 text-xs border border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                      >
                        Prendre en charge
                      </button>
                    )}
                    <button
                      onClick={() => setOrderStatus(order.id, 'preparing')}
                      disabled={!canUpdateOrders}
                      className='px-3 py-2 text-xs border border-sky-500/40 text-sky-300 hover:bg-sky-500/20'
                    >
                      Preparing
                    </button>
                    <button
                      onClick={() => setOrderStatus(order.id, 'served')}
                      disabled={!canUpdateOrders}
                      className='px-3 py-2 text-xs border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                    >
                      Served
                    </button>
                    <button
                      onClick={() => setOrderStatus(order.id, 'cancelled')}
                      disabled={!canUpdateOrders}
                      className='px-3 py-2 text-xs border border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        void toggleEventsPanel(order.id);
                      }}
                      className='px-3 py-2 text-xs border border-white/20 text-white/75 hover:bg-white/10'
                    >
                      {openEventsOrderIds.includes(order.id) ? 'Masquer events' : 'Voir events'}
                    </button>
                  </div>
                </div>

                <div className='mt-4 border-t border-white/10 pt-4'>
                  <p className='text-xs text-white/50 mb-2 uppercase tracking-widest'>Items</p>
                  <div className='space-y-1'>
                    {(order.items || []).map((item, index) => (
                      <p key={`${order.id}-${index}`} className='text-sm text-white/75'>
                        {item.quantity}x {item.name}
                        {canViewManagerFinancials
                          ? ` - ${formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}`
                          : ''}
                      </p>
                    ))}
                  </div>
                  <p className='text-sm text-amber-400 mt-3'>
                    {canViewManagerFinancials ? `Total: ${formatCurrency(order.totalAmount)}` : 'Total reserve gerant'}
                  </p>
                </div>

                {openEventsOrderIds.includes(order.id) && (
                  <div className='mt-3 border-t border-white/10 pt-3'>
                    <p className='text-xs text-white/50 mb-2 uppercase tracking-widest'>Audit events</p>
                    {eventsLoadingOrderId === order.id && (
                      <p className='text-xs text-white/60'>Chargement des events...</p>
                    )}
                    {eventsLoadingOrderId !== order.id && (!eventsByOrder[order.id] || eventsByOrder[order.id].length === 0) && (
                      <p className='text-xs text-white/50'>Aucun event disponible.</p>
                    )}
                    {eventsLoadingOrderId !== order.id && Array.isArray(eventsByOrder[order.id]) && eventsByOrder[order.id].length > 0 && (
                      <div className='space-y-1'>
                        {eventsByOrder[order.id].slice(0, 8).map((evt) => (
                          <p key={evt.id} className='text-xs text-white/70'>
                            [{formatDate(evt.createdAt)}] {evt.eventType}
                            {evt.fromStatus || evt.toStatus ? ` (${evt.fromStatus || '-'} -> ${evt.toStatus || '-'})` : ''}
                            {evt.actorId ? ` par ${evt.actorId}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        )}

        {!boardMode && visibleOrders.length > 0 && (
          <div className='mt-6 flex flex-wrap items-center justify-between gap-3'>
            <p className='text-xs text-white/60'>
              Page {page}/{totalPages} - {visibleOrders.length} commande(s)
            </p>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className='px-3 py-2 text-xs border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10'
              >
                Precedent
              </button>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className='px-3 py-2 text-xs border border-white/20 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10'
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
