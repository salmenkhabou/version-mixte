import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import process from 'node:process';
import { metricsMiddleware } from './lib/metrics.js';
import branchesRouter from './routes/branches.js';
import financeRouter from './routes/finance.js';
import healthRouter from './routes/health.js';
import inventoryRouter from './routes/inventory.js';
import meRouter from './routes/me.js';
import notificationsRouter from './routes/notifications.js';
import procurementRouter from './routes/procurement.js';
import syncRouter from './routes/sync.js';
import workforceRouter from './routes/workforce.js';

const APP_NAME = 'phase1-api';
const PORT = Number(process.env.API_PORT || 8787);
const RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX || 300);

const rateLimitWindowMs = Number.isFinite(RATE_LIMIT_WINDOW_MS) ? Math.max(1000, RATE_LIMIT_WINDOW_MS) : 15 * 60 * 1000;
const rateLimitMax = Number.isFinite(RATE_LIMIT_MAX) ? Math.max(1, RATE_LIMIT_MAX) : 300;
const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const corsOrigins = String(process.env.API_CORS_ORIGIN || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: true,
}));
app.use(apiLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(metricsMiddleware);

app.use(healthRouter);
app.use(meRouter);
app.use(branchesRouter);
app.use(syncRouter);
app.use(notificationsRouter);
app.use(inventoryRouter);
app.use(procurementRouter);
app.use(financeRouter);
app.use(workforceRouter);

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  console.error(`[${APP_NAME}] unhandled error`, error);
  return res.status(500).json({ ok: false, message: error?.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`[${APP_NAME}] Server running on port ${PORT}`);
});
