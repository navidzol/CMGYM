import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FitFlow — Workout Planner & Tracker',
  description: 'Auto-generated workout sessions, family training, and progress tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#0D0D1A', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
