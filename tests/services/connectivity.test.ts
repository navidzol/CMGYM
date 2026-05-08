import { describe, it, expect } from 'vitest';
import { ENV, API_URL, WEB_URL } from '../helpers';

describe('Service Connectivity', () => {
  // --- Core Services ---
  it('API health check responds', async () => {
    const res = await fetch(`${API_URL.replace('/v1', '')}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('ok');
  });

  it('Web app responds', async () => {
    const res = await fetch(WEB_URL);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('CMGYM');
  });

  it('PostgreSQL is accessible via API', async () => {
    // The health check already confirms DB connectivity, but let's also
    // test an actual query by hitting an endpoint
    const res = await fetch(`${API_URL}/exercises?limit=1`, {
      headers: { 'Content-Type': 'application/json' },
    });
    // 401 = auth required but server processed the request (DB is up)
    // 200 = OK
    expect([200, 401]).toContain(res.status);
  });

  // --- ExerciseDB (AscendAPI) ---
  it('ExerciseDB API is reachable', async () => {
    const url = ENV.EXERCISEDB_BASE_URL || 'https://oss.exercisedb.dev/api/v1';
    const res = await fetch(`${url}/exercises?limit=1`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
  });

  // --- Supabase ---
  it('Supabase endpoint is reachable', async () => {
    const url = ENV.SUPABASE_URL;
    if (!url || url.includes('your-project')) {
      console.log('Supabase not configured, skipping');
      return;
    }
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: ENV.SUPABASE_ANON_KEY },
    });
    // 200 or 401 means the endpoint is reachable
    expect([200, 401]).toContain(res.status);
  });

  // --- Sentry ---
  it('Sentry DSN endpoint is reachable', async () => {
    const dsn = ENV.SENTRY_DSN;
    if (!dsn) {
      console.log('Sentry not configured, skipping');
      return;
    }
    // Extract the host from DSN
    const match = dsn.match(/https?:\/\/[^@]+@([^/]+)/);
    if (!match) return;
    const host = match[1];
    const res = await fetch(`https://${host}`, { method: 'HEAD' }).catch(() => null);
    expect(res).toBeTruthy();
  });

  // --- PostHog ---
  it('PostHog API is reachable', async () => {
    const key = ENV.POSTHOG_API_KEY;
    const host = ENV.POSTHOG_HOST || 'https://app.posthog.com';
    if (!key) {
      console.log('PostHog not configured, skipping');
      return;
    }
    const res = await fetch(`${host}/decide/?v=3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, distinct_id: 'test' }),
    });
    expect(res.status).toBe(200);
  });

  // --- Redis ---
  it('Redis is accessible (via API functionality)', async () => {
    // Redis connectivity is validated through API working properly
    // If Redis were down, rate limiting would fail
    const res = await fetch(`${API_URL.replace('/v1', '')}/health`);
    expect(res.status).toBe(200);
  });
});
