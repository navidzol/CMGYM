import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { query } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';

const createFamilySchema = z.object({
  name: z.string().min(1).max(100),
}).strict();

const joinFamilySchema = z.object({
  invite_code: z.string().length(8),
}).strict();

function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 8);
}

export async function familyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);

  // POST /families — create
  app.post('/', async (request, reply) => {
    const body = createFamilySchema.parse(request.body);
    const inviteCode = generateInviteCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    const result = await query(
      `INSERT INTO families (name, created_by, invite_code, invite_expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.name, request.userId, inviteCode, expiresAt]
    );

    // Add creator as admin member
    await query(
      `INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [result.rows[0].id, request.userId]
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  // GET /families/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify membership
    const member = await query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [id, request.userId]
    );
    if (member.rows.length === 0) {
      return reply.status(403).send({ error: 'Not a family member' });
    }

    const family = await query('SELECT * FROM families WHERE id = $1', [id]);
    const members = await query(
      `SELECT fm.*, u.display_name, u.avatar_url
       FROM family_members fm
       JOIN users u ON fm.user_id = u.id
       WHERE fm.family_id = $1`,
      [id]
    );

    return { data: { ...family.rows[0], members: members.rows } };
  });

  // POST /families/:id/join
  app.post('/:id/join', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = joinFamilySchema.parse(request.body);

    const family = await query(
      `SELECT * FROM families WHERE id = $1 AND invite_code = $2 AND (invite_expires_at IS NULL OR invite_expires_at > now())`,
      [id, body.invite_code]
    );
    if (family.rows.length === 0) {
      return reply.status(400).send({ error: 'Invalid or expired invite code' });
    }

    await query(
      `INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (family_id, user_id) DO NOTHING`,
      [id, request.userId]
    );

    return reply.status(201).send({ data: { joined: true } });
  });

  // DELETE /families/:id/members/:uid — remove member (admin only)
  app.delete('/:id/members/:uid', async (request, reply) => {
    const { id, uid } = request.params as { id: string; uid: string };

    const admin = await query(
      `SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2 AND role = 'admin'`,
      [id, request.userId]
    );
    if (admin.rows.length === 0) {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    await query('DELETE FROM family_members WHERE family_id = $1 AND user_id = $2', [id, uid]);
    return reply.status(204).send();
  });

  // GET /families/:id/ledger
  app.get('/:id/ledger', async (request) => {
    const { id } = request.params as { id: string };
    const { member_id, exercise_id, from, to } = request.query as Record<string, string | undefined>;

    const conditions = ['fl.family_id = $1'];
    const values: unknown[] = [id];
    let idx = 2;

    if (member_id) { conditions.push(`fl.user_id = $${idx}`); values.push(member_id); idx++; }
    if (exercise_id) { conditions.push(`fl.exercise_id = $${idx}`); values.push(exercise_id); idx++; }
    if (from) { conditions.push(`fl.logged_at >= $${idx}`); values.push(from); idx++; }
    if (to) { conditions.push(`fl.logged_at <= $${idx}`); values.push(to); idx++; }

    const result = await query(
      `SELECT fl.*, u.display_name, e.name as exercise_name
       FROM family_ledger fl
       JOIN users u ON fl.user_id = u.id
       JOIN exercises e ON fl.exercise_id = e.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY fl.logged_at DESC
       LIMIT 100`,
      values
    );
    return { data: result.rows };
  });

  // GET /families/:id/leaderboard
  app.get('/:id/leaderboard', async (request) => {
    const { id } = request.params as { id: string };
    const { period = 'weekly' } = request.query as { period?: string };

    const dateFilter = period === 'monthly'
      ? `fl.logged_at >= DATE_TRUNC('month', now())`
      : `fl.logged_at >= DATE_TRUNC('week', now())`;

    const result = await query(
      `SELECT fl.user_id, u.display_name, u.avatar_url,
         SUM(fl.reps * fl.weight_kg) as total_volume,
         COUNT(DISTINCT DATE(fl.logged_at)) as session_days
       FROM family_ledger fl
       JOIN users u ON fl.user_id = u.id
       WHERE fl.family_id = $1 AND ${dateFilter}
       GROUP BY fl.user_id, u.display_name, u.avatar_url
       ORDER BY total_volume DESC`,
      [id]
    );
    return { data: result.rows };
  });
}
