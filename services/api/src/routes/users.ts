import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const updateUserSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
  unit_pref: z.enum(['kg', 'lb']).optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  date_of_birth: z.string().optional(),
  weight_kg: z.number().min(10).max(500).nullable().optional(),
  height_cm: z.number().min(50).max(300).nullable().optional(),
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
  color_palette: z.string().max(50).optional(),
}).strict();

export async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // GET /users/me
  app.get('/me', async (request) => {
    const result = await query(
      'SELECT id, email, display_name, avatar_url, unit_pref, gender, date_of_birth, weight_kg, height_cm, created_at FROM users WHERE id = $1',
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
      `UPDATE users SET ${sets} WHERE id = $1 RETURNING id, email, display_name, avatar_url, unit_pref, gender, date_of_birth, weight_kg, height_cm`,
      [request.userId, ...values]
    );
    return { data: result.rows[0] };
  });

  // DELETE /users/me
  app.delete('/me', async (request, reply) => {
    const uid = request.userId;
    await query('DELETE FROM family_ledger WHERE user_id = $1', [uid]);
    await query('DELETE FROM personal_records WHERE user_id = $1', [uid]);
    await query('DELETE FROM session_sets WHERE workout_session_id IN (SELECT id FROM workout_sessions WHERE user_id = $1)', [uid]);
    await query('DELETE FROM workout_sessions WHERE user_id = $1', [uid]);
    await query('DELETE FROM exercise_pools WHERE owner_type = $1 AND owner_id = $2', ['user', uid]);
    await query('DELETE FROM exercise_notes WHERE user_id = $1', [uid]);
    await query('DELETE FROM custom_sessions WHERE user_id = $1', [uid]);
    await query('DELETE FROM user_settings WHERE user_id = $1', [uid]);
    await query('DELETE FROM user_equipment WHERE user_id = $1', [uid]);
    await query('DELETE FROM user_injuries WHERE user_id = $1', [uid]);
    await query('DELETE FROM family_members WHERE user_id = $1', [uid]);
    await query('DELETE FROM families WHERE created_by = $1', [uid]);
    await query('DELETE FROM generated_programmes WHERE owner_type = $1 AND owner_id = $2', ['user', uid]);
    await query('DELETE FROM users WHERE id = $1', [uid]);
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

  // === Equipment Routes ===

  // GET /users/me/equipment
  app.get('/me/equipment', async (request) => {
    const result = await query(
      'SELECT * FROM user_equipment WHERE user_id = $1 ORDER BY equipment_name',
      [request.userId]
    );
    return { data: result.rows };
  });

  // PUT /users/me/equipment — replace entire equipment list
  app.put('/me/equipment', async (request) => {
    const body = z.object({
      equipment: z.array(z.string().min(1).max(100)),
    }).parse(request.body);

    await query('DELETE FROM user_equipment WHERE user_id = $1', [request.userId]);

    for (const name of body.equipment) {
      await query(
        'INSERT INTO user_equipment (user_id, equipment_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [request.userId, name]
      );
    }

    const result = await query(
      'SELECT * FROM user_equipment WHERE user_id = $1 ORDER BY equipment_name',
      [request.userId]
    );
    return { data: result.rows };
  });

  // === Injury Routes ===

  // GET /users/me/injuries
  app.get('/me/injuries', async (request) => {
    const result = await query(
      'SELECT * FROM user_injuries WHERE user_id = $1 ORDER BY body_region',
      [request.userId]
    );
    return { data: result.rows };
  });

  // POST /users/me/injuries
  app.post('/me/injuries', async (request, reply) => {
    const body = z.object({
      body_region: z.string().min(1).max(50),
      mode: z.enum(['avoid', 'warn']).default('warn'),
    }).parse(request.body);

    const result = await query(
      `INSERT INTO user_injuries (user_id, body_region, mode)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, body_region) DO UPDATE SET mode = EXCLUDED.mode
       RETURNING *`,
      [request.userId, body.body_region, body.mode]
    );
    return reply.status(201).send({ data: result.rows[0] });
  });

  // DELETE /users/me/injuries/:id
  app.delete('/me/injuries/:injuryId', async (request, reply) => {
    const { injuryId } = request.params as { injuryId: string };
    await query(
      'DELETE FROM user_injuries WHERE id = $1 AND user_id = $2',
      [injuryId, request.userId]
    );
    return reply.status(204).send();
  });

  // DELETE /users/me/injuries/region/:region — delete by body region name
  app.delete('/me/injuries/region/:region', async (request, reply) => {
    const { region } = request.params as { region: string };
    await query(
      'DELETE FROM user_injuries WHERE body_region = $1 AND user_id = $2',
      [region, request.userId]
    );
    return reply.status(204).send();
  });
}
