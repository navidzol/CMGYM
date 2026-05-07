import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const addPoolSchema = z.object({
  exercise_id: z.string().uuid(),
  muscle_family_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().default(0),
}).strict();

export async function poolRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /pools?family_id=
  app.get('/', async (request) => {
    const { family_id } = request.query as { family_id?: string };
    const conditions = ['owner_type = $1', 'owner_id = $2'];
    const values: unknown[] = ['user', request.userId];

    if (family_id) {
      conditions.push('muscle_family_id = $3');
      values.push(family_id);
    }

    const result = await query(
      `SELECT ep.*, e.name as exercise_name, e.gif_url, e.type
       FROM exercise_pools ep
       JOIN exercises e ON ep.exercise_id = e.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ep.sort_order`,
      values
    );
    return { data: result.rows };
  });

  // POST /pools
  app.post('/', async (request, reply) => {
    const body = addPoolSchema.parse(request.body);
    const result = await query(
      `INSERT INTO exercise_pools (owner_type, owner_id, muscle_family_id, exercise_id, sort_order)
       VALUES ('user', $1, $2, $3, $4) RETURNING *`,
      [request.userId, body.muscle_family_id, body.exercise_id, body.sort_order]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // DELETE /pools/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await query(
      'DELETE FROM exercise_pools WHERE id = $1 AND owner_type = $2 AND owner_id = $3',
      [id, 'user', request.userId]
    );
    return reply.status(204).send();
  });
}
