import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Families API', () => {
  let familyId: string;
  let inviteCode: string;
  let token: string;

  const testId = Date.now().toString(36) + 'fam';
  const user = {
    email: `family-test-${testId}@cmgym-test.dev`,
    password: 'FamTest123!',
    display_name: `Family Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
  });

  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('POST /families — creates a family', async () => {
    const res = await apiCall('/families', {
      method: 'POST',
      body: { name: 'Test Family' },
      token,
    });
    expect(res.status).toBe(201);
    expect(res.data.name).toBe('Test Family');
    expect(res.data.invite_code).toBeTruthy();
    familyId = res.data.id;
    inviteCode = res.data.invite_code;
  });

  it('GET /families/:id — returns family details', async () => {
    if (!familyId) return;
    const res = await apiCall(`/families/${familyId}`, { token });
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('Test Family');
    expect(res.data.members).toBeTruthy();
    expect(res.data.members.length).toBeGreaterThan(0);
  });

  it('GET /families/:id/leaderboard — returns leaderboard', async () => {
    if (!familyId) return;
    const res = await apiCall(`/families/${familyId}/leaderboard`, { token });
    expect(res.status).toBe(200);
  });

  it('GET /families/:id/ledger — returns activity ledger', async () => {
    if (!familyId) return;
    const res = await apiCall(`/families/${familyId}/ledger`, { token });
    expect(res.status).toBe(200);
  });

  it('POST /families/:id/join — rejects invalid invite code', async () => {
    if (!familyId) return;
    const res = await apiCall(`/families/${familyId}/join`, {
      method: 'POST',
      body: { invite_code: 'WRONGCOD' },
      token,
    });
    expect([400, 403]).toContain(res.status);
  });
});
