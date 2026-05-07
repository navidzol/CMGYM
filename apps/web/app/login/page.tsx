'use client';

import { useState, useEffect } from 'react';
import { api, getToken, setToken } from '../../lib/api';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CMGYM';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (getToken()) window.location.href = '/dashboard';
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body: Record<string, string> = { email: email.trim(), password };
      if (isRegister) body.display_name = displayName.trim();

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Something went wrong');
        return;
      }

      setToken(json.data.token);
      window.location.href = '/dashboard';
    } catch {
      setError('Network error — is the API running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', marginTop: '4rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        <span style={{ color: '#5B4FE8' }}>{APP_NAME}</span>
      </h1>
      <h2 style={{ fontSize: '1.2rem', color: '#6B6B8A', marginBottom: '2rem' }}>
        {isRegister ? 'Create your account' : 'Sign in to your account'}
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isRegister && (
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: '#F97316', fontSize: '0.875rem' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.875rem',
            backgroundColor: '#5B4FE8',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', color: '#6B6B8A', textAlign: 'center', fontSize: '0.875rem' }}>
        {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
          style={{
            background: 'none',
            border: 'none',
            color: '#5B4FE8',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {isRegister ? 'Sign In' : 'Create one'}
        </button>
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.875rem',
  backgroundColor: '#1A1A2E',
  color: '#fff',
  border: '1px solid #2D2D44',
  borderRadius: '8px',
  fontSize: '1rem',
  outline: 'none',
};
