import { FastifyInstance } from 'fastify';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

export async function recordRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /records?exercise_id=
  app.get('/', async (request) => {
    const { exercise_id } = request.query as { exercise_id?: string };
    const conditions = ['pr.user_id = $1'];
    const values: unknown[] = [request.userId];

    if (exercise_id) {
      conditions.push('pr.exercise_id = $2');
      values.push(exercise_id);
    }

    const result = await query(
      `SELECT pr.*, e.name as exercise_name
       FROM personal_records pr
       JOIN exercises e ON pr.exercise_id = e.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pr.achieved_at DESC`,
      values
    );
    return { data: result.rows };
  });
}
