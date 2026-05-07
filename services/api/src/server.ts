import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { exerciseRoutes } from './routes/exercises.js';
import { poolRoutes } from './routes/pools.js';
import { programmeRoutes } from './routes/programmes.js';
import { sessionRoutes } from './routes/sessions.js';
import { setRoutes } from './routes/sets.js';
import { noteRoutes } from './routes/notes.js';
import { recordRoutes } from './routes/records.js';
import { reportRoutes } from './routes/reports.js';
import { familyRoutes } from './routes/families.js';
import { customSessionRoutes } from './routes/custom-sessions.js';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Plugins
await app.register(helmet);
await app.register(cors, {
  origin: config.CORS_ORIGINS.split(',').map(s => s.trim()),
  credentials: true,
});
await app.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute',
});

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Response envelope
app.addHook('onSend', async (_request, reply, payload) => {
  if (reply.statusCode >= 400 || typeof payload !== 'string') return payload;
  try {
    const parsed = JSON.parse(payload);
    if (parsed.data !== undefined) return payload; // already enveloped
    return JSON.stringify({ data: parsed, error: null });
  } catch {
    return payload;
  }
});

// API v1 routes
await app.register(authRoutes, { prefix: '/v1/auth' });
await app.register(userRoutes, { prefix: '/v1/users' });
await app.register(exerciseRoutes, { prefix: '/v1/exercises' });
await app.register(poolRoutes, { prefix: '/v1/pools' });
await app.register(programmeRoutes, { prefix: '/v1/programmes' });
await app.register(sessionRoutes, { prefix: '/v1/sessions' });
await app.register(customSessionRoutes, { prefix: '/v1/custom-sessions' });
await app.register(noteRoutes, { prefix: '/v1/notes' });
await app.register(recordRoutes, { prefix: '/v1/records' });
await app.register(reportRoutes, { prefix: '/v1/reports' });
await app.register(familyRoutes, { prefix: '/v1/families' });

// Nested set routes under sessions
await app.register(
  async (instance) => {
    await instance.register(setRoutes);
  },
  { prefix: '/v1/sessions/:id/sets' }
);

// Start
try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
  app.log.info(`FitFlow API running at http://${config.API_HOST}:${config.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
