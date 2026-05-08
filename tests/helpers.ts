// Shared test helpers
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return env;
}

export const ENV = parseEnv(envContent);

export const API_URL = ENV.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
export const WEB_URL = 'http://localhost:3000';

let authToken: string | null = null;
let testUserId: string | null = null;

// Unique test user for each run
const testId = Date.now().toString(36);
export const TEST_USER = {
  email: `test-${testId}@cmgym-test.dev`,
  password: 'TestPass123!',
  display_name: `Test User ${testId}`,
};

export async function apiCall<T = any>(
  path: string,
  opts: { method?: string; body?: any; token?: string | null } = {}
): Promise<{ status: number; data: T; raw: any }> {
  const headers: Record<string, string> = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  const token = opts.token !== undefined ? opts.token : authToken;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}

  return {
    status: res.status,
    data: json?.data ?? json,
    raw: json,
  };
}

export async function registerTestUser() {
  const res = await apiCall('/auth/register', {
    method: 'POST',
    body: TEST_USER,
    token: null,
  });
  if (res.status === 201) {
    authToken = res.data.token;
    testUserId = res.data.user.id;
  }
  return res;
}

export async function loginTestUser() {
  const res = await apiCall('/auth/login', {
    method: 'POST',
    body: { email: TEST_USER.email, password: TEST_USER.password },
    token: null,
  });
  if (res.status === 200) {
    authToken = res.data.token;
    testUserId = res.data.user.id;
  }
  return res;
}

export function getAuthToken() { return authToken; }
export function getTestUserId() { return testUserId; }

export async function cleanupTestUser() {
  if (authToken) {
    await apiCall('/users/me', { method: 'DELETE' });
    authToken = null;
    testUserId = null;
  }
}
