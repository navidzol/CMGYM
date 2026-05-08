import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Sessions API', () => {
  let token: string;
  let sessionId: string;
  const testId = Date.now().toString(36) + 'ses';
  const user = {
    email: `sessions-test-${testId}@cmgym-test.dev`,
    password: 'SesTest123!',
    display_name: `Sessions Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
  });
  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('GET /sessions — returns session list', async () => {
    const res = await apiCall('/sessions', { token });
    expect(res.status).toBe(200);
  });

  it('POST /sessions — starts a new workout session', async () => {
    const res = await apiCall('/sessions', {
      method: 'POST',
      body: { mode: 'custom' },
      token,
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeTruthy();
    expect(res.data.mode).toBe('custom');
    sessionId = res.data.id;
  });

  it('GET /sessions/:id — returns session details', async () => {
    if (!sessionId) return;
    const res = await apiCall(`/sessions/${sessionId}`, { token });
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(sessionId);
  });

  it('PATCH /sessions/:id — finishes session', async () => {
    if (!sessionId) return;
    const res = await apiCall(`/sessions/${sessionId}`, {
      method: 'PATCH',
      body: { notes: 'Great workout!' },
      token,
    });
    expect(res.status).toBe(200);
    expect(res.data.finished_at).toBeTruthy();
  });

  it('DELETE /sessions/:id — deletes session', async () => {
    if (!sessionId) return;
    const res = await apiCall(`/sessions/${sessionId}`, { method: 'DELETE', token });
    expect(res.status).toBe(204);
  });
});
