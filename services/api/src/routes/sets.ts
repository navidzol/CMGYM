import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const logSetSchema = z.object({
  exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1),
  reps: z.number().int().min(0).optional(),
  weight_kg: z.number().min(0).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  duration_s: z.number().int().min(0).optional(),
  distance_m: z.number().min(0).optional(),
}).strict();

const updateSetSchema = logSetSchema.partial().omit({ exercise_id: true });

export async function setRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /sessions/:id/sets
  app.get('/', async (request) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT ss.*, e.name as exercise_name, e.type as exercise_type
       FROM session_sets ss
       JOIN exercises e ON ss.exercise_id = e.id
       JOIN workout_sessions ws ON ss.workout_session_id = ws.id
       WHERE ss.workout_session_id = $1 AND ws.user_id = $2
       ORDER BY ss.set_number`,
      [id, request.userId]
    );
    return { data: result.rows };
  });

  // POST /sessions/:id/sets — log a set
  app.post('/', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = logSetSchema.parse(request.body);

    // Verify session ownership
    const session = await query(
      'SELECT id FROM workout_sessions WHERE id = $1 AND user_id = $2',
      [id, request.userId]
    );
    if (session.rows.length === 0) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const result = await query(
      `INSERT INTO session_sets (workout_session_id, exercise_id, set_number, reps, weight_kg, rpe, duration_s, distance_m, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
      [id, body.exercise_id, body.set_number, body.reps, body.weight_kg, body.rpe, body.duration_s, body.distance_m]
    );

    const set = result.rows[0];

    // PR detection (Epley 1RM = weight × (1 + reps/30))
    if (body.weight_kg && body.reps) {
      const estimated1rm = body.weight_kg * (1 + body.reps / 30);
      const existing = await query(
        'SELECT value FROM personal_records WHERE user_id = $1 AND exercise_id = $2 AND metric = $3',
        [request.userId, body.exercise_id, 'estimated_1rm']
      );

      if (existing.rows.length === 0 || parseFloat(existing.rows[0].value) < estimated1rm) {
        await query(
          `INSERT INTO personal_records (user_id, exercise_id, metric, value, session_set_id)
           VALUES ($1, $2, 'estimated_1rm', $3, $4)
           ON CONFLICT (user_id, exercise_id, metric)
           DO UPDATE SET value = $3, achieved_at = now(), session_set_id = $4`,
          [request.userId, body.exercise_id, estimated1rm, set.id]
        );
        set.pr_hit = true;
        set.estimated_1rm = estimated1rm;
      }
    }

    // Auto-write to family ledger
    const families = await query(
      'SELECT family_id FROM family_members WHERE user_id = $1',
      [request.userId]
    );
    for (const fam of families.rows) {
      await query(
        `INSERT INTO family_ledger (family_id, exercise_id, user_id, reps, weight_kg)
         VALUES ($1, $2, $3, $4, $5)`,
        [fam.family_id, body.exercise_id, request.userId, body.reps, body.weight_kg]
      );
    }

    return reply.status(201).send({ data: set });
  });

  // PATCH /sessions/:id/sets/:sid
  app.patch('/:sid', async (request) => {
    const { id, sid } = request.params as { id: string; sid: string };
    const body = updateSetSchema.parse(request.body);

    const sets = Object.entries(body)
      .map(([key], i) => `${key} = $${i + 3}`)
      .join(', ');
    const values = Object.values(body);
    if (values.length === 0) return { data: null };

    const result = await query(
      `UPDATE session_sets SET ${sets}
       WHERE id = $1 AND workout_session_id = $2 RETURNING *`,
      [sid, id, ...values]
    );
    return { data: result.rows[0] };
  });

  // DELETE /sessions/:id/sets/:sid
  app.delete('/:sid', async (request, reply) => {
    const { id, sid } = request.params as { id: string; sid: string };
    await query(
      'DELETE FROM session_sets WHERE id = $1 AND workout_session_id = $2',
      [sid, id]
    );
    return reply.status(204).send();
  });
}
