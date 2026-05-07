import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { generateWeekSchedule } from '@fitflow/core';

const createProgrammeSchema = z.object({
  weeks: z.number().int().min(1).max(52).default(1),
  sessions_per_week: z.number().int().min(1).max(7),
  session_duration_min: z.number().int().min(15).max(120),
  cardio_duration_min: z.number().int().min(0).max(60).default(10),
}).strict();

export async function programmeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /programmes
  app.get('/', async (request) => {
    const result = await query(
      'SELECT * FROM generated_programmes WHERE owner_type = $1 AND owner_id = $2 ORDER BY created_at DESC',
      ['user', request.userId]
    );
    return { data: result.rows };
  });

  // POST /programmes
  app.post('/', async (request, reply) => {
    const body = createProgrammeSchema.parse(request.body);

    // Deactivate previous programmes
    await query(
      `UPDATE generated_programmes SET is_active = false WHERE owner_type = 'user' AND owner_id = $1`,
      [request.userId]
    );

    const result = await query(
      `INSERT INTO generated_programmes (owner_type, owner_id, weeks, sessions_per_week, session_duration_min, cardio_duration_min)
       VALUES ('user', $1, $2, $3, $4, $5) RETURNING *`,
      [request.userId, body.weeks, body.sessions_per_week, body.session_duration_min, body.cardio_duration_min]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // GET /programmes/:id
  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const result = await query(
      `SELECT gp.*, json_agg(gs.* ORDER BY gs.day_number) as sessions
       FROM generated_programmes gp
       LEFT JOIN generated_sessions gs ON gs.programme_id = gp.id
       WHERE gp.id = $1 AND gp.owner_type = 'user' AND gp.owner_id = $2
       GROUP BY gp.id`,
      [id, request.userId]
    );
    return { data: result.rows[0] || null };
  });

  // POST /programmes/:id/generate — generate sessions for the programme
  app.post('/:id/generate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const prog = await query(
      'SELECT * FROM generated_programmes WHERE id = $1 AND owner_type = $2 AND owner_id = $3',
      [id, 'user', request.userId]
    );
    if (prog.rows.length === 0) {
      return reply.status(404).send({ error: 'Programme not found' });
    }

    const programme = prog.rows[0];

    // Fetch user's exercise pools
    const pools = await query(
      `SELECT ep.*, e.avg_duration_s, e.name, e.type, mf.code as family_code
       FROM exercise_pools ep
       JOIN exercises e ON ep.exercise_id = e.id
       LEFT JOIN muscle_families mf ON ep.muscle_family_id = mf.id
       WHERE ep.owner_type = 'user' AND ep.owner_id = $1`,
      [request.userId]
    );

    // Fetch user settings for rest time
    const settings = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [request.userId]
    );

    const schedule = generateWeekSchedule({
      sessionsPerWeek: programme.sessions_per_week,
      sessionDurationMin: programme.session_duration_min,
      cardioDurationMin: programme.cardio_duration_min,
      restBetweenSetsS: settings.rows[0]?.rest_between_sets_s ?? 90,
      exercisePools: pools.rows,
    });

    // Insert generated sessions
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1); // next Monday

    for (let day = 0; day < schedule.length; day++) {
      const sessionDate = new Date(monday);
      sessionDate.setDate(monday.getDate() + day);

      await query(
        `INSERT INTO generated_sessions (programme_id, week_number, day_number, session_date, schedule_json)
         VALUES ($1, 1, $2, $3, $4)`,
        [id, day + 1, sessionDate.toISOString().split('T')[0], JSON.stringify(schedule[day])]
      );
    }

    return reply.status(201).send({ data: { sessions_generated: schedule.length } });
  });

  // DELETE /programmes/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await query(
      'DELETE FROM generated_programmes WHERE id = $1 AND owner_type = $2 AND owner_id = $3',
      [id, 'user', request.userId]
    );
    return reply.status(204).send();
  });
}
