import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config.js';

const searchSchema = z.object({
  query: z.string().optional(),
  family: z.string().optional(),
  type: z.enum(['strength', 'cardio', 'mobility']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function exerciseRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /exercises — cached ExerciseDB proxy
  app.get('/', async (request) => {
    const params = searchSchema.parse(request.query);
    const offset = (params.page - 1) * params.limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.query) {
      conditions.push(`name ILIKE $${idx}`);
      values.push(`%${params.query}%`);
      idx++;
    }
    if (params.family) {
      conditions.push(`muscle_family_id = (SELECT id FROM muscle_families WHERE code = $${idx})`);
      values.push(params.family);
      idx++;
    }
    if (params.type) {
      conditions.push(`type = $${idx}`);
      values.push(params.type);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT e.*, mf.code as family_code, mf.name as family_name
       FROM exercises e
       LEFT JOIN muscle_families mf ON e.muscle_family_id = mf.id
       ${where}
       ORDER BY e.name
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, params.limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM exercises ${where}`,
      values
    );

    return {
      data: result.rows,
      meta: { page: params.page, total: parseInt(countResult.rows[0].total) },
    };
  });

  // GET /exercises/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT e.*, mf.code as family_code, mf.name as family_name
       FROM exercises e
       LEFT JOIN muscle_families mf ON e.muscle_family_id = mf.id
       WHERE e.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Exercise not found' });
    }
    return { data: result.rows[0] };
  });

  // POST /exercises/fetch-external — fetch from ExerciseDB and cache
  app.post('/fetch-external', async (request, reply) => {
    if (!config.EXERCISEDB_API_KEY) {
      return reply.status(503).send({ error: 'ExerciseDB API key not configured' });
    }

    const { name } = z.object({ name: z.string() }).parse(request.body);

    // Check cache first
    const cached = await query(
      `SELECT * FROM exercises WHERE name ILIKE $1 AND cached_at > now() - interval '${config.EXERCISEDB_CACHE_TTL_DAYS} days'`,
      [`%${name}%`]
    );
    if (cached.rows.length > 0) {
      return { data: cached.rows, source: 'cache' };
    }

    // Fetch from ExerciseDB
    const res = await fetch(
      `https://${config.EXERCISEDB_API_HOST}/exercises/name/${encodeURIComponent(name)}`,
      {
        headers: {
          'X-RapidAPI-Key': config.EXERCISEDB_API_KEY,
          'X-RapidAPI-Host': config.EXERCISEDB_API_HOST,
        },
      }
    );

    if (!res.ok) {
      return reply.status(502).send({ error: 'ExerciseDB request failed' });
    }

    const exercises = await res.json();
    // Cache results — insert or update
    for (const ex of exercises) {
      await query(
        `INSERT INTO exercises (name, external_id, gif_url, instructions_json, type, cached_at)
         VALUES ($1, $2, $3, $4, 'strength', now())
         ON CONFLICT (external_id) DO UPDATE SET cached_at = now()`,
        [ex.name, ex.id, ex.gifUrl, JSON.stringify(ex.instructions || [])]
      );
    }

    return { data: exercises, source: 'exercisedb' };
  });
}
