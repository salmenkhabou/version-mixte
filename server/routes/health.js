import { Router } from 'express';
import { getMetrics, getMetricsContentType, isMetricsEnabled } from '../lib/metrics.js';

const APP_NAME = 'phase1-api';
const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: APP_NAME,
    timestamp: new Date().toISOString(),
  });
});

router.get('/metrics', async (_req, res) => {
  if (!isMetricsEnabled()) {
    return res.status(404).json({ ok: false, message: 'Metrics endpoint disabled.' });
  }

  res.set('Content-Type', getMetricsContentType());
  return res.send(await getMetrics());
});

export default router;
