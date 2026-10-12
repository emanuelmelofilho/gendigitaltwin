import express from 'express';
import { authRouter, requireAuth } from './auth.js';
import { errorHandler, notFound, requireJsonOnWrite } from './http.js';
import { decisionsRouter } from './routes/decisions.js';
import { goalsRouter } from './routes/goals.js';
import { informationsRouter } from './routes/informations.js';
import { personRouter } from './routes/person.js';
import { scenariosRouter } from './routes/scenarios.js';
import { sourcesRouter } from './routes/sources.js';
import { timelineRouter } from './routes/timeline.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', requireJsonOnWrite);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api', requireAuth);
  app.use('/api/person', personRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/informations', informationsRouter);
  app.use('/api/sources', sourcesRouter);
  app.use('/api/scenarios', scenariosRouter);
  app.use('/api/decisions', decisionsRouter);
  app.use('/api/timeline', timelineRouter);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
