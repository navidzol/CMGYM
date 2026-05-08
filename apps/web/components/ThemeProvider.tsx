'use client';

import { useEffect } from 'react';
import { getToken } from '../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

export default function ThemeProvider() {
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Check localStorage cache first for instant paint
    const cached = localStorage.getItem('cmgym_palette');
    if (cached) {
      document.documentElement.setAttribute('data-palette', cached);
    }

    // Then fetch from server and update
    fetch(`${API_URL}/users/me/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        const palette = json?.data?.color_palette || 'default';
        document.documentElement.setAttribute('data-palette', palette);
        localStorage.setItem('cmgym_palette', palette);
      })
      .catch(() => {});
  }, []);

  return null;
}
