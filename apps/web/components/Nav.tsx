'use client';

import { usePathname } from 'next/navigation';
import { clearToken } from '../lib/api';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CMGYM';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/programme', label: 'Programme' },
  { href: '/exercises', label: 'Exercises' },
  { href: '/progress', label: 'Progress' },
  { href: '/family', label: 'Family' },
  { href: '/settings', label: 'Settings' },
];

export default function Nav() {
  const pathname = usePathname() || '';

  if (pathname === '/' || pathname === '/login') return null;

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--nav-bg)',
      flexWrap: 'wrap',
    }}>
      <a href="/dashboard" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none', marginRight: '1rem' }}>
        {APP_NAME}
      </a>
      {links.map(l => (
        <a
          key={l.href}
          href={l.href}
          style={{
            color: pathname.startsWith(l.href) ? 'var(--text-primary)' : 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '0.875rem',
            padding: '0.375rem 0.75rem',
            borderRadius: '6px',
            backgroundColor: pathname.startsWith(l.href) ? 'var(--nav-active-bg)' : 'transparent',
          }}
        >
          {l.label}
        </a>
      ))}
      <button
        onClick={() => { clearToken(); window.location.href = '/login'; }}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          padding: '0.375rem 0.75rem',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Sign Out
      </button>
    </nav>
  );
}
