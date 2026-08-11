import client from 'prom-client';
import process from 'node:process';

const METRICS_ENABLED = process.env.API_METRICS_ENABLED !== 'false';

const metricsRegistry = new client.Registry();
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

metricsRegistry.registerMetric(httpRequestDurationSeconds);
metricsRegistry.registerMetric(httpRequestTotal);

if (METRICS_ENABLED) {
  client.collectDefaultMetrics({ register: metricsRegistry });
}

export function metricsMiddleware(req, res, next) {
  if (!METRICS_ENABLED) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - start;
    const durationSeconds = Number(durationNs) / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const status = String(res.statusCode || 0);

    httpRequestDurationSeconds.labels(req.method, route, status).observe(durationSeconds);
    httpRequestTotal.labels(req.method, route, status).inc();
  });

  return next();
}

export async function getMetrics() {
  return metricsRegistry.metrics();
}

export function getMetricsContentType() {
  return metricsRegistry.contentType;
}

export function isMetricsEnabled() {
  return METRICS_ENABLED;
}
