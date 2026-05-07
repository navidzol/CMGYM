const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
  return match ? match[1] : null;
}

export function setToken(token: string) {
  document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Strict`;
}

export function clearToken() {
  document.cookie = 'token=; path=/; max-age=0';
}

export function requireAuth(): string {
  const token = getToken();
  if (!token) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }
  return token;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: any; token?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = opts.token || getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return null as T;

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data !== undefined ? json.data : json;
}
