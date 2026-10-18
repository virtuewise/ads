import { useEngineData } from './hooks/useEngineData';

export function App() {
  const { modes, concepts, metaphors, stats, loading, error } = useEngineData();

  const territories = Array.from(new Set(modes.flatMap((m) => m.territories)));

  return (
    <div className="app">
      <div className="noise" aria-hidden="true" />
      <header className="hero">
        <div className="hero__eyebrow">VIRTUE STUDIO · ENGINE-DRIVEN</div>
        <h1 className="hero__title">
          <span className="hero__title-line">Creative</span>
          <span className="hero__title-line hero__title-line--accent">Production</span>
          <span className="hero__title-line">Engine</span>
        </h1>
        <p className="hero__lede">
          Every surface below is rendered from the engines. No hardcoded content — modes,
          territories, metaphors and concepts are pulled live from
          <code>@printsync/creative-engine</code>.
        </p>
        {stats && (
          <div className="stats">
            <Stat label="Modes" value={stats.modeCount} />
            <Stat label="Territories" value={stats.territoryCount} />
            <Stat label="Metaphors" value={stats.metaphorCount} />
            <Stat label="3D-ready" value={stats.modesRequiring3d} />
            <Stat label="VFX-ready" value={stats.modesRequiringVfx} />
          </div>
        )}
      </header>

      {loading && <div className="loading">Booting engines…</div>}
      {error && <div className="error">{error}</div>}

      <main>
        <section className="panel panel--modes">
          <div className="panel__head">
            <h2>Creative Modes</h2>
            <span className="panel__count">{modes.length}</span>
          </div>
          <div className="mode-grid">
            {modes.map((m) => (
              <article key={m.id} className="mode-card" data-territory={m.territory}>
                <div className="mode-card__stripe" />
                <div className="mode-card__body">
                  <div className="mode-card__id">{m.id}</div>
                  <h3 className="mode-card__name">{m.name}</h3>
                  <p className="mode-card__desc">{m.description}</p>
                  <div className="mode-card__meta">
                    <span>{m.mood}</span>
                    <span>{m.pace}</span>
                    <span>{m.duration}s</span>
                  </div>
                  <div className="mode-card__tags">
                    {m.territories.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel panel--concepts">
          <div className="panel__head">
            <h2>Concepts</h2>
            <span className="panel__count">{concepts.length}</span>
          </div>
          <div className="concept-list">
            {concepts.map((c) => (
              <div key={c.title} className="concept-row">
                <div className="concept-row__score">
                  <ScoreRing value={c.score ?? 0} />
                </div>
                <div className="concept-row__body">
                  <h3>{c.title}</h3>
                  <div className="concept-row__meta">
                    {c.territory && <span className="tag">{c.territory}</span>}
                    {c.mood && <span className="tag tag--muted">{c.mood}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel--metaphors">
          <div className="panel__head">
            <h2>Visual Metaphors</h2>
            <span className="panel__count">{metaphors.length}</span>
          </div>
          <div className="metaphor-cloud">
            {metaphors.map((m) => (
              <div key={m.name} className="metaphor-chip" title={m.description}>
                <span className="metaphor-chip__name">{m.name}</span>
                <span className="metaphor-chip__territory">{m.territory}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel--territories">
          <div className="panel__head">
            <h2>Territories</h2>
            <span className="panel__count">{territories.length}</span>
          </div>
          <div className="territory-bar">
            {territories.map((t) => {
              const count = modes.filter((m) => m.territories.includes(t)).length;
              const pct = Math.round((count / modes.length) * 100);
              return (
                <div key={t} className="territory-seg">
                  <div className="territory-seg__fill" style={{ width: `${pct}%` }} />
                  <div className="territory-seg__label">
                    <span>{t}</span>
                    <span>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      className="score-ring"
      role="img"
      aria-label="Score ring"
    >
      <title>Score</title>
      <circle cx="28" cy="28" r={r} className="score-ring__track" />
      <circle
        cx="28"
        cy="28"
        r={r}
        className="score-ring__fill"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
      <text x="28" y="32" textAnchor="middle" className="score-ring__text">
        {(value * 100).toFixed(0)}
      </text>
    </svg>
  );
}
