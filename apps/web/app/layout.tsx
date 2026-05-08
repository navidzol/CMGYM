import type { Metadata, Viewport } from 'next';
import './globals.css';
import Nav from '../components/Nav';
import ThemeProvider from '../components/ThemeProvider';

export const metadata: Metadata = {
  title: 'CMGYM — Workout Planner & Tracker',
  description: 'Auto-generated workout sessions, family training, and progress tracking.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CMGYM',
  },
};

export const viewport: Viewport = {
  themeColor: '#5B4FE8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <ThemeProvider />
        <Nav />
        {children}
        <footer style={{ textAlign: 'center', padding: '2rem 1rem 1rem', fontSize: '0.7rem', color: '#6B6B8A' }}>
          Exercise data powered by <a href="https://exercisedb.io" style={{ color: 'inherit' }}>ExerciseDB</a> / <a href="https://ascendapi.com" style={{ color: 'inherit' }}>AscendAPI</a>
        </footer>
      </body>
    </html>
  );
}
