import { describe, it, expect } from 'vitest';
import { WEB_URL } from '../helpers';

const pages = [
  { path: '/', expected: 'CMGYM', desc: 'Landing page' },
  { path: '/login', expected: 'Sign in', desc: 'Login page' },
  { path: '/dashboard', expected: 'Dashboard', desc: 'Dashboard page' },
  { path: '/exercises', expected: 'Exercises', desc: 'Exercises page' },
  { path: '/programme', expected: 'Programme', desc: 'Programme page' },
  { path: '/workout', expected: 'Workout', desc: 'Workout page' },
  { path: '/progress', expected: 'Progress', desc: 'Progress page' },
  { path: '/settings', expected: 'Settings', desc: 'Settings page' },
  { path: '/family', expected: 'Family', desc: 'Family page' },
];

describe('Web Pages Render', () => {
  for (const page of pages) {
    it(`${page.desc} (${page.path}) — returns 200 and contains expected content`, async () => {
      const res = await fetch(`${WEB_URL}${page.path}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html.toLowerCase()).toContain(page.expected.toLowerCase());
    });
  }

  it('Non-existent page returns 404', async () => {
    const res = await fetch(`${WEB_URL}/this-page-does-not-exist`);
    expect(res.status).toBe(404);
  });
});
