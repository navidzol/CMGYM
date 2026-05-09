'use client';

import { usePathname } from 'next/navigation';
import { clearToken } from '../lib/api';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CMGYM';

const links = [
  { href: '/dashboard', label: 'Home', icon: '\u2302' },
  { href: '/programme', label: 'Programme', icon: '\u2630' },
  { href: '/exercises', label: 'Exercises', icon: '\u2605' },
  { href: '/progress', label: 'Progress', icon: '\u2197' },
  { href: '/family', label: 'Family', icon: '\u2764' },
  { href: '/settings', label: 'Settings', icon: '\u2699' },
];

export default function Nav() {
  const pathname = usePathname() || '';

  if (pathname === '/' || pathname === '/login') return null;
  // Hide nav during active workout for focus
  const isWorkout = pathname.startsWith('/workout');

  return (
    <>
      {/* Desktop top nav */}
      <nav style={{
        display: isWorkout ? 'none' : 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.625rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--nav-bg)',
      }} className="desktop-nav">
        <a href="/dashboard" style={{
          color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem',
          textDecoration: 'none', marginRight: '1.25rem',
        }}>
          {APP_NAME}
        </a>
        {links.map(l => {
          const active = pathname.startsWith(l.href);
          return (
            <a key={l.href} href={l.href} style={{
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: '0.825rem',
              padding: '0.375rem 0.625rem',
              borderRadius: '6px',
              backgroundColor: active ? 'var(--nav-active-bg)' : 'transparent',
              fontWeight: active ? 600 : 400,
              transition: 'background-color 0.15s',
            }}>
              {l.label}
            </a>
          );
        })}
        <button
          onClick={() => { clearToken(); window.location.href = '/login'; }}
          style={{
            marginLeft: 'auto', background: 'none',
            border: '1px solid var(--border)', color: 'var(--text-muted)',
            padding: '0.3rem 0.625rem', borderRadius: '6px',
            cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          Sign Out
        </button>
      </nav>

      {/* Mobile bottom tab bar */}
      {!isWorkout && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'none', // shown via CSS media query
          backgroundColor: 'var(--nav-bg)',
          borderTop: '1px solid var(--border)',
          padding: '0.375rem 0',
          zIndex: 1000,
        }} className="mobile-nav">
          {links.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <a key={l.href} href={l.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                textDecoration: 'none', gap: '0.125rem', padding: '0.25rem 0',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{l.icon}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: active ? 600 : 400 }}>{l.label}</span>
              </a>
            );
          })}
        </nav>
      )}

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
          main { padding-bottom: 4.5rem !important; }
        }
        @media (min-width: 641px) {
          .desktop-nav { display: flex !important; }
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
