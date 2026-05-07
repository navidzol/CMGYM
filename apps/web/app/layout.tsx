import type { Metadata } from 'next';
import './globals.css';
import Nav from '../components/Nav';

export const metadata: Metadata = {
  title: 'CMGYM — Workout Planner & Tracker',
  description: 'Auto-generated workout sessions, family training, and progress tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
