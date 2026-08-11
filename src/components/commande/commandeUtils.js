export const REFRESH_INTERVAL_MS = 10000;
export const KITCHEN_REFRESH_INTERVAL_MS = 5000;
export const DELAY_MINUTES = 10;
export const DEFAULT_SERVE_TARGET_MINUTES = 20;
export const CRITICAL_DELAY_MINUTES = DELAY_MINUTES * 2;

export const KANBAN_LABELS = {
  pending: 'En attente',
  preparing: 'En preparation',
  served: 'Servie',
  cancelled: 'Annulee',
};

export const MANAGER_TAB_OPTIONS = [
  { id: 'finance', label: 'Finance' },
  { id: 'performance', label: 'Performance' },
  { id: 'staff', label: 'Staff' },
  { id: 'exports', label: 'Exports' },
];

export const MANAGER_PERIOD_OPTIONS = [
  { id: 'today', label: 'Aujourdhui' },
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Mois en cours' },
  { id: 'custom', label: 'Personnalise' },
];

export const CASH_CLOSURE_STORAGE_KEY = 'commande_manager_cash_closures';
export const MAX_CASH_CLOSURES = 40;
export const CASH_DIFF_ALERT_THRESHOLD = 0.01;

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function statusStyle(status) {
  if (status === 'pending') return 'text-amber-400 border-amber-500/40';
  if (status === 'preparing') return 'text-sky-400 border-sky-500/40';
  if (status === 'served') return 'text-emerald-400 border-emerald-500/40';
  return 'text-rose-400 border-rose-500/40';
}

export function normalizeRealtimeOrder(row) {
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

export function minutesSince(dateValue) {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return 0;
  const diffMs = Date.now() - time;
  return Math.max(0, Math.floor(diffMs / 60000));
}

export function toTimestamp(value) {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function diffMinutes(startValue, endValue) {
  const start = toTimestamp(startValue);
  const end = toTimestamp(endValue);
  if (!start || !end || end < start) return null;
  return Math.max(0, Math.floor((end - start) / 60000));
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes === null) return '-';
  return `${minutes} min`;
}

export function buildTimeline(order) {
  return [
    { key: 'created', label: 'Creee', value: order.createdAt },
    { key: 'assigned', label: 'Assignee', value: order.assignedAt },
    { key: 'prepared', label: 'Preparing', value: order.preparedAt },
    { key: 'served', label: 'Servie', value: order.servedAt },
  ];
}

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle];
}

export function getHourLabel(dateValue) {
  const date = new Date(dateValue || 0);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const h = String(date.getHours()).padStart(2, '0');
  return `${h}:00`;
}

export function getServerDisplayName(serverKey) {
  const raw = String(serverKey || '').trim();
  if (!raw) return 'Serveur inconnu';
  if (raw.includes('@')) {
    return raw.split('@')[0] || raw;
  }
  if (raw.length <= 10) return raw;
  return `Serveur ${raw.slice(0, 6)}`;
}

export function formatCurrency(value) {
  return `${Number(value || 0).toFixed(2)} DT`;
}

export function playNewOrderTone() {
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

export function toCsvValue(value) {
  const normalized = String(value ?? '').replaceAll(/\r?\n|\r/g, ' ').trim();
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildOrdersCsv(orders) {
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

export function buildPeriodRange(periodKey, customStart, customEnd) {
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

export function buildFinanceCsv({ periodLabel, metrics, orders }) {
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

export function buildCashClosuresCsv(closures) {
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
