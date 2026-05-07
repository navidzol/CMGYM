import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const noteSchema = z.object({
  exercise_id: z.string().uuid(),
  body: z.string().max(2000),
}).strict();

export async function noteRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /notes?exercise_id=
  app.get('/', async (request) => {
    const { exercise_id } = request.query as { exercise_id?: string };
    const conditions = ['user_id = $1'];
    const values: unknown[] = [request.userId];

    if (exercise_id) {
      conditions.push('exercise_id = $2');
      values.push(exercise_id);
    }

    const result = await query(
      `SELECT * FROM exercise_notes WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`,
      values
    );
    return { data: result.rows };
  });

  // POST /notes — upsert
  app.post('/', async (request, reply) => {
    const body = noteSchema.parse(request.body);
    const result = await query(
      `INSERT INTO exercise_notes (user_id, exercise_id, body)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET body = $3
       RETURNING *`,
      [request.userId, body.exercise_id, body.body]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // PATCH /notes/:id
  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { body } = z.object({ body: z.string().max(2000) }).parse(request.body);
    const result = await query(
      'UPDATE exercise_notes SET body = $3 WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, request.userId, body]
    );
    return { data: result.rows[0] };
  });

  // DELETE /notes/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await query('DELETE FROM exercise_notes WHERE id = $1 AND user_id = $2', [id, request.userId]);
    return reply.status(204).send();
  });
}
