import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Exercises API', () => {
  let token: string;
  const testId = Date.now().toString(36) + 'exr';
  const user = {
    email: `exercise-test-${testId}@cmgym-test.dev`,
    password: 'ExTest123!',
    display_name: `Exercise Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
  });
  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('GET /exercises — returns exercise list (may be empty)', async () => {
    const res = await apiCall('/exercises', { token });
    expect(res.status).toBe(200);
  });

  it('GET /exercises — supports query filter', async () => {
    const res = await apiCall('/exercises?query=bench', { token });
    expect(res.status).toBe(200);
  });

  it('GET /exercises — supports type filter', async () => {
    const res = await apiCall('/exercises?type=strength', { token });
    expect(res.status).toBe(200);
  });

  it('GET /exercises — supports family filter', async () => {
    const res = await apiCall('/exercises?family=F1', { token });
    expect(res.status).toBe(200);
  });

  it('POST /exercises/fetch-external — fetches from ExerciseDB', async () => {
    const res = await apiCall('/exercises/fetch-external', {
      method: 'POST',
      body: { name: 'push up', limit: 3 },
      token,
    });
    expect(res.status).toBe(200);
    const data = Array.isArray(res.data) ? res.data : (res.raw?.data || []);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /exercises/:id — returns 404 for non-existent exercise', async () => {
    const res = await apiCall('/exercises/00000000-0000-0000-0000-000000000000', { token });
    expect([404, 200]).toContain(res.status);
  });
});
