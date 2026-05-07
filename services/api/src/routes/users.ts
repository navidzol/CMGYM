import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const updateUserSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
  unit_pref: z.enum(['kg', 'lb']).optional(),
}).strict();

const updateSettingsSchema = z.object({
  sessions_per_week: z.number().int().min(1).max(7).optional(),
  session_duration_min: z.number().int().min(15).max(120).optional(),
  cardio_duration_min: z.number().int().min(0).max(60).optional(),
  rest_between_sets_s: z.number().int().min(10).max(600).optional(),
  auto_rest: z.boolean().optional(),
  timer_sound: z.enum(['silent', 'beep', 'voice']).optional(),
  vibration: z.enum(['off', 'light', 'strong']).optional(),
  weight_unit: z.enum(['kg', 'lb']).optional(),
  distance_unit: z.enum(['km', 'mi']).optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
}).strict();

export async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /users/me
  app.get('/me', async (request) => {
    const result = await query(
      'SELECT id, email, display_name, avatar_url, unit_pref, created_at FROM users WHERE id = $1',
      [request.userId]
    );
    return { data: result.rows[0] };
  });

  // PATCH /users/me
  app.patch('/me', async (request) => {
    const body = updateUserSchema.parse(request.body);
    const sets = Object.entries(body)
      .map(([key], i) => `${key} = $${i + 2}`)
      .join(', ');
    const values = Object.values(body);
    if (values.length === 0) return { data: null };

    const result = await query(
      `UPDATE users SET ${sets} WHERE id = $1 RETURNING id, email, display_name, avatar_url, unit_pref`,
      [request.userId, ...values]
    );
    return { data: result.rows[0] };
  });

  // DELETE /users/me
  app.delete('/me', async (request, reply) => {
    await query('DELETE FROM users WHERE id = $1', [request.userId]);
    return reply.status(204).send();
  });

  // GET /users/me/settings
  app.get('/me/settings', async (request) => {
    const result = await query('SELECT * FROM user_settings WHERE user_id = $1', [request.userId]);
    return { data: result.rows[0] };
  });

  // PATCH /users/me/settings
  app.patch('/me/settings', async (request) => {
    const body = updateSettingsSchema.parse(request.body);
    const sets = Object.entries(body)
      .map(([key], i) => `${key} = $${i + 2}`)
      .join(', ');
    const values = Object.values(body);
    if (values.length === 0) return { data: null };

    const result = await query(
      `UPDATE user_settings SET ${sets} WHERE user_id = $1 RETURNING *`,
      [request.userId, ...values]
    );
    return { data: result.rows[0] };
  });
}
