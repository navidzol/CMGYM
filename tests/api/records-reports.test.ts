import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Records & Reports API', () => {
  let token: string;
  const testId = Date.now().toString(36) + 'rr';
  const user = {
    email: `records-test-${testId}@cmgym-test.dev`,
    password: 'RecTest123!',
    display_name: `Records Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
  });
  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('GET /records — returns records list', async () => {
    const res = await apiCall('/records', { token });
    expect(res.status).toBe(200);
  });

  it('GET /reports — generates weekly report', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await apiCall(`/reports?type=weekly&date=${today}`, { token });
    expect(res.status).toBe(200);
    expect(res.data.type).toBe('weekly');
    expect(res.data).toHaveProperty('total_volume_kg');
    expect(res.data).toHaveProperty('sessions_completed');
  });

  it('GET /reports — generates daily report', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await apiCall(`/reports?type=daily&date=${today}`, { token });
    expect(res.status).toBe(200);
    expect(res.data.type).toBe('daily');
  });

  it('GET /reports — generates monthly report', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await apiCall(`/reports?type=monthly&date=${today}`, { token });
    expect(res.status).toBe(200);
    expect(res.data.type).toBe('monthly');
  });

  it('POST /reports/custom — generates custom range report', async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const res = await apiCall('/reports/custom', {
      method: 'POST',
      body: { start_date: weekAgo, end_date: today },
      token,
    });
    expect(res.status).toBe(200);
    expect(res.data.type).toBe('custom');
  });
});
