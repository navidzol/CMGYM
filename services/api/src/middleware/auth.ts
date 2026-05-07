import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';
import { config } from '../config.js';

interface JWTPayload {
  sub: string;
  email: string;
  exp: number;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Verify signature (HS256)
    const [header, payload, signature] = parts;
    const expected = createHmac('sha256', config.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (expected !== signature) return null;

    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString()
    ) as JWTPayload;

    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;

    return decoded;
  } catch {
    return null;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization token' });
  }

  const token = authHeader.slice(7);
  const payload = decodeJWT(token);

  if (!payload) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }

  request.userId = payload.sub;
  request.userEmail = payload.email;
}

// Augment Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}
