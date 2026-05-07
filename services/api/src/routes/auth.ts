import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { query } from '../db/index.js';
import { config } from '../config.js';

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  display_name: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string(),
});

function signJWT(payload: { sub: string; email: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = createHmac('sha256', config.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt).update(password).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = createHmac('sha256', salt).update(password).digest('hex');
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = hashPassword(body.password);
    const result = await query(
      `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name`,
      [body.email, passwordHash, body.display_name]
    );
    const user = result.rows[0];

    // Create default settings
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);

    const token = signJWT({ sub: user.id, email: user.email });
    return reply.status(201).send({
      data: { user: { id: user.id, email: user.email, display_name: user.display_name }, token },
    });
  });

  // POST /auth/login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const result = await query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [body.email]
    );
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!verifyPassword(body.password, user.password_hash)) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = signJWT({ sub: user.id, email: user.email });
    return reply.send({
      data: { user: { id: user.id, email: user.email, display_name: user.display_name }, token },
    });
  });

  // POST /auth/refresh
  app.post('/refresh', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing token' });
    }
    const payload = JSON.parse(
      Buffer.from(authHeader.slice(7).split('.')[1], 'base64url').toString()
    );
    const token = signJWT({ sub: payload.sub, email: payload.email });
    return reply.send({ data: { token } });
  });
}
