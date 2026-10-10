export default function StudioPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#C8001C' }}>PrintSync Creative Studio</h1>
      <p>Welcome to the PrintSync Creative Operating System.</p>
      <p>
        This studio will provide a visual interface for campaign management,
        concept review, creative scoring, and production oversight.
      </p>
      <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <Card title="Today's Campaign" description="Generate and review daily advertising concepts" />
        <Card title="Concepts" description="Browse and manage creative concepts" />
        <Card title="Campaigns" description="View and manage campaign families" />
        <Card title="Assets" description="Browse the asset library" />
        <Card title="QA" description="Review quality assurance results" />
        <Card title="Analytics" description="View campaign performance" />
      </div>
    </main>
  );
}

function Card({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      padding: '1.5rem',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      background: '#fafafa',
    }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>{description}</p>
    </div>
  );
}
