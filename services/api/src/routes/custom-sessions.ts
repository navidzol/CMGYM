import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateCustomSession } from '@fitflow/core';

const generateSchema = z.object({
  selected_families: z.array(z.enum(['F1','F2','F3','F4','F5','F6'])).min(1),
  duration_min: z.number().int().min(15).max(120),
  cardio_min: z.number().int().min(0).default(0),
  use_all_exercises: z.boolean().default(false),
}).strict();

export async function customSessionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // POST /custom-sessions/generate
  app.post('/generate', async (request, reply) => {
    const body = generateSchema.parse(request.body);

    // Fetch exercise pools for selected families
    const pools = await query(
      `SELECT ep.*, e.avg_duration_s, e.name, e.type, mf.code as family_code
       FROM exercise_pools ep
       JOIN exercises e ON ep.exercise_id = e.id
       LEFT JOIN muscle_families mf ON ep.muscle_family_id = mf.id
       WHERE ep.owner_type = 'user' AND ep.owner_id = $1
         AND (mf.code = ANY($2) OR e.type = 'cardio')`,
      [request.userId, body.selected_families]
    );

    const settings = await query(
      'SELECT rest_between_sets_s FROM user_settings WHERE user_id = $1',
      [request.userId]
    );

    const schedule = generateCustomSession({
      selectedFamilies: body.selected_families,
      durationMin: body.duration_min,
      cardioMin: body.cardio_min,
      restBetweenSetsS: settings.rows[0]?.rest_between_sets_s ?? 90,
      exercisePools: pools.rows,
    });

    const result = await query(
      `INSERT INTO custom_sessions (user_id, selected_families, duration_min, cardio_min, schedule_json)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request.userId, body.selected_families, body.duration_min, body.cardio_min, JSON.stringify(schedule)]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // POST /custom-sessions/start
  app.post('/start', async (request, reply) => {
    const { custom_session_id } = z.object({ custom_session_id: z.string().uuid() }).parse(request.body);

    const cs = await query(
      'SELECT * FROM custom_sessions WHERE id = $1 AND user_id = $2',
      [custom_session_id, request.userId]
    );
    if (cs.rows.length === 0) {
      return reply.status(404).send({ error: 'Custom session not found' });
    }

    const session = await query(
      `INSERT INTO workout_sessions (user_id, mode) VALUES ($1, 'custom') RETURNING *`,
      [request.userId]
    );

    return reply.status(201).send({ data: session.rows[0] });
  });

  // GET /custom-sessions/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(
      'SELECT * FROM custom_sessions WHERE id = $1 AND user_id = $2',
      [id, request.userId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Custom session not found' });
    }
    return { data: result.rows[0] };
  });
}
