import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Users API', () => {
  let token: string;
  const testId = Date.now().toString(36) + 'usr';
  const user = {
    email: `user-test-${testId}@cmgym-test.dev`,
    password: 'UserTest123!',
    display_name: `User Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
  });
  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('GET /users/me — returns current user profile', async () => {
    const res = await apiCall('/users/me', { token });
    expect(res.status).toBe(200);
    expect(res.data.email).toBeTruthy();
    expect(res.data.display_name).toBeTruthy();
    expect(res.data.id).toBeTruthy();
  });

  it('PATCH /users/me — updates display name', async () => {
    const res = await apiCall('/users/me', { method: 'PATCH', body: { display_name: 'Updated Name' }, token });
    expect(res.status).toBe(200);
    expect(res.data.display_name).toBe('Updated Name');
  });

  it('PATCH /users/me — updates unit preference', async () => {
    const res = await apiCall('/users/me', { method: 'PATCH', body: { unit_pref: 'lb' }, token });
    expect(res.status).toBe(200);
    expect(res.data.unit_pref).toBe('lb');
  });

  it('GET /users/me/settings — returns user settings', async () => {
    const res = await apiCall('/users/me/settings', { token });
    expect(res.status).toBe(200);
    expect(res.data.sessions_per_week).toBeGreaterThanOrEqual(1);
    expect(res.data.session_duration_min).toBeGreaterThanOrEqual(15);
  });

  it('PATCH /users/me/settings — updates workout settings', async () => {
    const res = await apiCall('/users/me/settings', { method: 'PATCH', body: { sessions_per_week: 4, session_duration_min: 60 }, token });
    expect(res.status).toBe(200);
    expect(res.data.sessions_per_week).toBe(4);
    expect(res.data.session_duration_min).toBe(60);
  });

  it('PATCH /users/me/settings — rejects invalid values', async () => {
    const res = await apiCall('/users/me/settings', { method: 'PATCH', body: { sessions_per_week: 99 }, token });
    expect(res.status).toBe(400);
  });

  it('GET /users/me — rejects unauthenticated request', async () => {
    const res = await apiCall('/users/me', { token: null });
    expect(res.status).toBe(401);
  });
});
