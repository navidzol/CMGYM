export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>
        <span style={{ color: '#5B4FE8' }}>FitFlow</span>
      </h1>
      <p style={{ color: '#6B6B8A', marginTop: '0.5rem' }}>
        Workout Planner, Tracker & Family Training
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <a
          href="/login"
          style={{
            display: 'block',
            padding: '1rem',
            backgroundColor: '#5B4FE8',
            color: '#fff',
            borderRadius: '12px',
            textAlign: 'center',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '1.1rem',
          }}
        >
          Get Started
        </a>
      </div>
    </main>
  );
}
