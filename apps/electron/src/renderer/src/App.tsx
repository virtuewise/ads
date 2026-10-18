import { useState } from 'react';
import type { Brief, Concept } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

export function App() {
  const { modes, metaphors, stats, loading, error } = useEngineData();
  const [brief, setBrief] = useState<Brief>({
    objective: 'Build brand awareness for a new product launch',
    service: 'branding',
    audience: 'creative professionals',
    emotional_objective: 'inspire',
    platform: ['social', 'web'],
    formats: ['16:9', '9:16'],
  });
  const [generated, setGenerated] = useState<Concept[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const territories = Array.from(new Set(modes.flatMap((m) => m.territories)));

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const api = (
        window as unknown as { studio?: { generateConcepts: (b: Brief) => Promise<Concept[]> } }
      ).studio;
      const result = await api?.generateConcepts?.(brief);
      setGenerated(result ?? []);
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const scoreOf = (c: Concept): number | null => {
    if (typeof c.score === 'number') return c.score;
    if (c.score && typeof c.score === 'object') {
      const s = c.score as { originality: number; brand_fit: number; commercial_value: number };
      return (s.originality + s.brand_fit + s.commercial_value) / 30;
    }
    return null;
  };

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
          Every surface below is rendered from the engines. No hardcoded content — modes, metaphors
          and concepts are pulled live from
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
        <section className="panel panel--brief">
          <div className="panel__head">
            <h2>Generate Concepts</h2>
            <span className="panel__count">engine</span>
          </div>
          <div className="brief-form">
            <label>
              <span>Service</span>
              <select
                value={brief.service}
                onChange={(e) => setBrief({ ...brief, service: e.target.value })}
              >
                <option value="branding">Branding</option>
                <option value="signage">Signage</option>
                <option value="large-format-printing">Large Format</option>
                <option value="digital-printing">Digital Printing</option>
              </select>
            </label>
            <label>
              <span>Objective</span>
              <input
                value={brief.objective}
                onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
              />
            </label>
            <label>
              <span>Audience</span>
              <input
                value={brief.audience}
                onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
              />
            </label>
            <label>
              <span>Emotional objective</span>
              <input
                value={brief.emotional_objective}
                onChange={(e) => setBrief({ ...brief, emotional_objective: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Generating…' : 'Generate Concepts'}
            </button>
          </div>
          {genError && <div className="error">{genError}</div>}
          {generated.length > 0 && (
            <div className="concept-list">
              {generated.map((c) => {
                const s = scoreOf(c);
                return (
                  <div key={c.title} className="concept-row">
                    <div className="concept-row__score">
                      <ScoreRing value={s ?? 0} />
                    </div>
                    <div className="concept-row__body">
                      <h3>{c.title}</h3>
                      <p className="concept-row__logline">{c.logline}</p>
                      <div className="concept-row__meta">
                        {c.territory && <span className="tag">{c.territory}</span>}
                        {c.mood && <span className="tag tag--muted">{c.mood}</span>}
                        {c.creative_mode && (
                          <span className="tag tag--muted">{c.creative_mode}</span>
                        )}
                      </div>
                      {c.key_visual && <p className="concept-row__kv">{c.key_visual}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel panel--modes">
          <div className="panel__head">
            <h2>Creative Modes</h2>
            <span className="panel__count">{modes.length}</span>
          </div>
          <div className="mode-grid">
            {modes.map((m) => (
              <article key={m.id} className="mode-card">
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
              const pct = modes.length ? Math.round((count / modes.length) * 100) : 0;
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
