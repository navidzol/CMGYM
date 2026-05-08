import { describe, it, expect, afterAll } from 'vitest';
import { apiCall, TEST_USER, cleanupTestUser } from '../helpers';

describe('Auth API', () => {
  let token: string;
  let userId: string;

  afterAll(async () => {
    if (token) {
      await apiCall('/users/me', { method: 'DELETE', token });
    }
  });

  it('POST /auth/register — creates a new user', async () => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: TEST_USER,
      token: null,
    });
    expect(res.status).toBe(201);
    expect(res.data.user.email).toBe(TEST_USER.email);
    expect(res.data.user.display_name).toBe(TEST_USER.display_name);
    expect(res.data.token).toBeTruthy();
    token = res.data.token;
    userId = res.data.user.id;
  });

  it('POST /auth/register — rejects duplicate email', async () => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: TEST_USER,
      token: null,
    });
    expect(res.status).toBe(409);
  });

  it('POST /auth/register — rejects invalid email', async () => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', password: 'TestPass123!', display_name: 'Bad' },
      token: null,
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register — rejects short password', async () => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: { email: 'short@test.dev', password: '123', display_name: 'Short' },
      token: null,
    });
    expect(res.status).toBe(400);
  });

  it('POST /auth/login — logs in with valid credentials', async () => {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: TEST_USER.email, password: TEST_USER.password },
      token: null,
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user.email).toBe(TEST_USER.email);
  });

  it('POST /auth/login — rejects wrong password', async () => {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: TEST_USER.email, password: 'WrongPassword99' },
      token: null,
    });
    expect(res.status).toBe(401);
  });

  it('POST /auth/login — rejects non-existent email', async () => {
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nowhere.dev', password: 'whatever1' },
      token: null,
    });
    expect(res.status).toBe(401);
  });

  it('POST /auth/refresh — refreshes token', async () => {
    const res = await apiCall('/auth/refresh', {
      method: 'POST',
      token,
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
  });

  it('POST /auth/refresh — rejects missing token', async () => {
    const res = await apiCall('/auth/refresh', {
      method: 'POST',
      token: null,
    });
    expect(res.status).toBe(401);
  });
});
