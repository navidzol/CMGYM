import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const startSessionSchema = z.object({
  generated_session_id: z.string().uuid().optional(),
  mode: z.enum(['standard', 'random', 'custom']).default('standard'),
}).strict();

const finishSessionSchema = z.object({
  notes: z.string().max(2000).optional(),
}).strict();

export async function sessionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /sessions
  app.get('/', async (request) => {
    const { page = '1', limit = '20' } = request.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const result = await query(
      `SELECT ws.*, gs.schedule_json, gs.session_date
       FROM workout_sessions ws
       LEFT JOIN generated_sessions gs ON ws.generated_session_id = gs.id
       WHERE ws.user_id = $1
       ORDER BY ws.started_at DESC
       LIMIT $2 OFFSET $3`,
      [request.userId, parseInt(limit), offset]
    );
    return { data: result.rows };
  });

  // GET /sessions/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT ws.*, gs.schedule_json,
         json_agg(ss.* ORDER BY ss.set_number) FILTER (WHERE ss.id IS NOT NULL) as sets
       FROM workout_sessions ws
       LEFT JOIN generated_sessions gs ON ws.generated_session_id = gs.id
       LEFT JOIN session_sets ss ON ss.workout_session_id = ws.id
       WHERE ws.id = $1 AND ws.user_id = $2
       GROUP BY ws.id, gs.schedule_json`,
      [id, request.userId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    return { data: result.rows[0] };
  });

  // POST /sessions — start a session
  app.post('/', async (request, reply) => {
    const body = startSessionSchema.parse(request.body);
    const result = await query(
      `INSERT INTO workout_sessions (user_id, generated_session_id, mode)
       VALUES ($1, $2, $3) RETURNING *`,
      [request.userId, body.generated_session_id, body.mode]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /sessions/:id — finish a session
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = finishSessionSchema.parse(request.body);
    const result = await query(
      `UPDATE workout_sessions SET finished_at = now(), notes = COALESCE($3, notes)
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, request.userId, body.notes]
    );
    return { data: result.rows[0] };
  });

  // DELETE /sessions/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await query('DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2', [id, request.userId]);
    return reply.status(204).send();
  });
}
