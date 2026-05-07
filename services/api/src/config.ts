import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  EXERCISEDB_API_KEY: z.string().optional(),
  EXERCISEDB_API_HOST: z.string().default('exercisedb.p.rapidapi.com'),
  EXERCISEDB_CACHE_TTL_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
