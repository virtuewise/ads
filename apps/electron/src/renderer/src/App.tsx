import { useEngineData } from './hooks/useEngineData';

export function App() {
  const { modes, concepts, loading, error } = useEngineData();

  return (
    <div className="app">
      <header>
        <h1>Virtue Studio</h1>
        <p>Engine-driven creative production</p>
      </header>
      <main>
        {loading && <p>Loading engines…</p>}
        {error && <p className="error">{error}</p>}
        <section>
          <h2>Creative Modes ({modes.length})</h2>
          <ul className="modes">
            {modes.map((m) => (
              <li key={m.id}>
                {m.name} — {m.territory}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Concepts ({concepts.length})</h2>
          <ul className="concepts">
            {concepts.map((c) => (
              <li key={c.title}>
                {c.title} — score {c.score?.toFixed?.(2) ?? 'n/a'}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
