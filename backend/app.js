import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { frontendDistPath } from './config/paths.js';
import { translateResponseMiddleware } from './middleware/translateResponse.js';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '256kb' }));
  app.use(translateResponseMiddleware);
  app.use('/api', apiRouter);

  app.use(express.static(frontendDistPath));
  app.use((_, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });

  return app;
}
