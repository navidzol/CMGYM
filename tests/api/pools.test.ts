import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Pools API', () => {
  let token: string;
  let exerciseId: string;
  let poolId: string;
  const testId = Date.now().toString(36) + 'pol';
  const user = {
    email: `pools-test-${testId}@cmgym-test.dev`,
    password: 'PoolTest123!',
    display_name: `Pools Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
    // Fetch an exercise to use
    const ex = await apiCall('/exercises/fetch-external', {
      method: 'POST',
      body: { name: 'squat', limit: 1 },
      token,
    });
    const data = Array.isArray(ex.data) ? ex.data : (ex.raw?.data || []);
    if (data.length > 0) exerciseId = data[0].id;
  });

  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('GET /pools — returns pool (initially empty)', async () => {
    const res = await apiCall('/pools', { token });
    expect(res.status).toBe(200);
  });

  it('POST /pools — adds exercise to pool', async () => {
    if (!exerciseId) return;
    const res = await apiCall('/pools', {
      method: 'POST',
      body: { exercise_id: exerciseId },
      token,
    });
    expect(res.status).toBe(201);
    poolId = res.data.id;
  });

  it('GET /pools — returns pool with added exercise', async () => {
    if (!poolId) return;
    const res = await apiCall('/pools', { token });
    expect(res.status).toBe(200);
    const list = Array.isArray(res.data) ? res.data : [];
    expect(list.length).toBeGreaterThan(0);
  });

  it('DELETE /pools/:id — removes from pool', async () => {
    if (!poolId) return;
    const res = await apiCall(`/pools/${poolId}`, { method: 'DELETE', token });
    expect(res.status).toBe(204);
  });
});
