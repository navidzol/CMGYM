import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const reportQuerySchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const customReportSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /reports?type=daily|weekly|monthly&date=
  app.get('/', async (request) => {
    const params = reportQuerySchema.parse(request.query);

    let dateFilter: string;
    if (params.type === 'daily') {
      dateFilter = `DATE(ws.started_at) = $2`;
    } else if (params.type === 'weekly') {
      dateFilter = `DATE(ws.started_at) BETWEEN DATE_TRUNC('week', $2::date) AND DATE_TRUNC('week', $2::date) + interval '6 days'`;
    } else {
      dateFilter = `DATE(ws.started_at) BETWEEN DATE_TRUNC('month', $2::date) AND (DATE_TRUNC('month', $2::date) + interval '1 month' - interval '1 day')`;
    }

    // Total volume
    const volume = await query(
      `SELECT COALESCE(SUM(ss.reps * ss.weight_kg), 0) as total_volume_kg
       FROM session_sets ss
       JOIN workout_sessions ws ON ss.workout_session_id = ws.id
       WHERE ws.user_id = $1 AND ${dateFilter} AND ss.completed_at IS NOT NULL`,
      [request.userId, params.date]
    );

    // Sessions completed
    const sessions = await query(
      `SELECT COUNT(*) as completed,
         (SELECT sessions_per_week FROM user_settings WHERE user_id = $1) as planned_per_week
       FROM workout_sessions ws
       WHERE ws.user_id = $1 AND ${dateFilter} AND ws.finished_at IS NOT NULL`,
      [request.userId, params.date]
    );

    // PRs in period
    const prs = await query(
      `SELECT pr.*, e.name as exercise_name
       FROM personal_records pr
       JOIN exercises e ON pr.exercise_id = e.id
       WHERE pr.user_id = $1 AND ${dateFilter.replace('ws.started_at', 'pr.achieved_at')}
       ORDER BY pr.achieved_at DESC`,
      [request.userId, params.date]
    );

    // Cardio minutes
    const cardio = await query(
      `SELECT COALESCE(SUM(ss.duration_s), 0) / 60.0 as cardio_minutes
       FROM session_sets ss
       JOIN exercises e ON ss.exercise_id = e.id
       JOIN workout_sessions ws ON ss.workout_session_id = ws.id
       WHERE ws.user_id = $1 AND e.type = 'cardio' AND ${dateFilter}`,
      [request.userId, params.date]
    );

    return {
      data: {
        type: params.type,
        date: params.date,
        total_volume_kg: parseFloat(volume.rows[0].total_volume_kg),
        sessions_completed: parseInt(sessions.rows[0].completed),
        planned_per_week: sessions.rows[0].planned_per_week,
        cardio_minutes: parseFloat(cardio.rows[0].cardio_minutes),
        prs: prs.rows,
      },
    };
  });

  // POST /reports/custom
  app.post('/custom', async (request) => {
    const body = customReportSchema.parse(request.body);

    const volume = await query(
      `SELECT COALESCE(SUM(ss.reps * ss.weight_kg), 0) as total_volume_kg
       FROM session_sets ss
       JOIN workout_sessions ws ON ss.workout_session_id = ws.id
       WHERE ws.user_id = $1 AND DATE(ws.started_at) BETWEEN $2 AND $3 AND ss.completed_at IS NOT NULL`,
      [request.userId, body.start_date, body.end_date]
    );

    const sessions = await query(
      `SELECT COUNT(*) as completed
       FROM workout_sessions ws
       WHERE ws.user_id = $1 AND DATE(ws.started_at) BETWEEN $2 AND $3 AND ws.finished_at IS NOT NULL`,
      [request.userId, body.start_date, body.end_date]
    );

    return {
      data: {
        type: 'custom',
        start_date: body.start_date,
        end_date: body.end_date,
        total_volume_kg: parseFloat(volume.rows[0].total_volume_kg),
        sessions_completed: parseInt(sessions.rows[0].completed),
      },
    };
  });
}
