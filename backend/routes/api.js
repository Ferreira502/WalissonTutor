import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { traceCode } from '../services/trace.js';

const traceCache = new Map();
const apiRouter = Router();

apiRouter.use(
  '/run',
  rateLimit({
    windowMs: 1000,
    limit: 2,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

apiRouter.post('/run', (req, res) => {
  try {
    const cacheKey = crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');

    if (traceCache.has(cacheKey)) {
      return res.json({
        ...traceCache.get(cacheKey),
        cached: true,
      });
    }

    const trace = traceCode(req.body.language, req.body.code);
    traceCache.set(cacheKey, trace);
    setTimeout(() => traceCache.delete(cacheKey), 600000);

    return res.json(trace);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get('/cached/:hash', (req, res) => {
  if (traceCache.has(req.params.hash)) {
    return res.json(traceCache.get(req.params.hash));
  }

  return res.status(404).json({ error: 'Trace not found' });
});

apiRouter.get('/languages', (_, res) => {
  res.json([
    { id: 'c', label: 'C' },
    { id: 'cpp', label: 'C++' },
    { id: 'java', label: 'Java' },
  ]);
});

apiRouter.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    sandbox: 'simulated',
    cache: 'memory',
  });
});

export { apiRouter };
