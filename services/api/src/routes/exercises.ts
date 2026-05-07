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

// Map our muscle family codes to ExerciseDB targetMuscles values
const FAMILY_TO_MUSCLES: Record<string, string[]> = {
  F1: ['pectorals', 'delts', 'biceps'],
  F2: ['lats', 'traps', 'upper back'],
  F3: ['abs', 'obliques'],
  F4: ['spine', 'glutes'],
  F5: ['quads', 'hip flexors'],
  F6: ['hamstrings', 'glutes', 'calves'],
};

export async function exerciseRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /exercises — search local cached exercises
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

  // POST /exercises/fetch-external — fetch from ExerciseDB (AscendAPI) and cache
  // No API key needed. Free tier at https://oss.exercisedb.dev/api/v1
  app.post('/fetch-external', async (request, reply) => {
    const body = z.object({
      name: z.string().optional(),
      muscle: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }).refine(d => d.name || d.muscle, { message: 'Provide name or muscle' })
      .parse(request.body);

    // Check cache first
    if (body.name) {
      const cached = await query(
        `SELECT * FROM exercises WHERE name ILIKE $1 AND cached_at > now() - interval '${config.EXERCISEDB_CACHE_TTL_DAYS} days'`,
        [`%${body.name}%`]
      );
      if (cached.rows.length > 0) {
        return { data: cached.rows, source: 'cache' };
      }
    }

    // Build ExerciseDB request URL
    const params = new URLSearchParams();
    if (body.name) params.set('name', body.name);
    if (body.muscle) params.set('targetMuscles', body.muscle);
    params.set('limit', String(body.limit));

    const res = await fetch(
      `${config.EXERCISEDB_BASE_URL}/exercises?${params.toString()}`
    );

    if (!res.ok) {
      return reply.status(502).send({ error: `ExerciseDB request failed: ${res.status}` });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const exercises: any[] = json.data || [];

    // Cache results in our DB
    for (const ex of exercises) {
      // Try to match to our muscle family based on targetMuscles
      let familyCode: string | null = null;
      for (const [code, muscles] of Object.entries(FAMILY_TO_MUSCLES)) {
        if (ex.targetMuscles?.some((m: string) => muscles.includes(m.toLowerCase()))) {
          familyCode = code;
          break;
        }
      }

      const familyId = familyCode
        ? (await query('SELECT id FROM muscle_families WHERE code = $1', [familyCode])).rows[0]?.id
        : null;

      await query(
        `INSERT INTO exercises (name, external_id, muscle_family_id, gif_url, instructions_json, type, cached_at)
         VALUES ($1, $2, $3, $4, $5, 'strength', now())
         ON CONFLICT (external_id) DO UPDATE SET
           name = EXCLUDED.name,
           gif_url = EXCLUDED.gif_url,
           instructions_json = EXCLUDED.instructions_json,
           cached_at = now()`,
        [
          ex.name,
          ex.exerciseId,
          familyId,
          ex.gifUrl,
          JSON.stringify(ex.instructions || []),
        ]
      );
    }

    return { data: exercises, source: 'exercisedb' };
  });

  // POST /exercises/seed — bulk-fetch all exercises from ExerciseDB by muscle group
  // Useful for initial DB population. Fetches all families.
  app.post('/seed', async (request, reply) => {
    const allMuscles = [...new Set(Object.values(FAMILY_TO_MUSCLES).flat())];
    let totalCached = 0;

    for (const muscle of allMuscles) {
      const params = new URLSearchParams({ targetMuscles: muscle, limit: '100' });
      const res = await fetch(`${config.EXERCISEDB_BASE_URL}/exercises?${params.toString()}`);
      if (!res.ok) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      const exercises: any[] = json.data || [];

      // Find which family this muscle belongs to
      let familyCode: string | null = null;
      for (const [code, muscles] of Object.entries(FAMILY_TO_MUSCLES)) {
        if (muscles.includes(muscle)) {
          familyCode = code;
          break;
        }
      }

      const familyId = familyCode
        ? (await query('SELECT id FROM muscle_families WHERE code = $1', [familyCode])).rows[0]?.id
        : null;

      for (const ex of exercises) {
        await query(
          `INSERT INTO exercises (name, external_id, muscle_family_id, gif_url, instructions_json, type, cached_at)
           VALUES ($1, $2, $3, $4, $5, 'strength', now())
           ON CONFLICT (external_id) DO UPDATE SET
             name = EXCLUDED.name,
             gif_url = EXCLUDED.gif_url,
             cached_at = now()`,
          [ex.name, ex.exerciseId, familyId, ex.gifUrl, JSON.stringify(ex.instructions || [])]
        );
        totalCached++;
      }
    }

    return reply.status(201).send({ data: { exercises_cached: totalCached } });
  });
}
