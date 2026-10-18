import { useState } from 'react';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

type Tab = 'canvas' | 'nodes' | 'timeline';

export function App() {
  const { modes, metaphors, typography, effects, grammars, stats } = useEngineData();
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
  const [activeTab, setActiveTab] = useState<Tab>('canvas');
  const [selectedMode, setSelectedMode] = useState<CreativeMode | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const duration = 5;

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

  const scoreOf = (c: Concept): number => {
    if (typeof c.score === 'number') return c.score;
    if (c.score && typeof c.score === 'object') {
      const s = c.score as { originality: number; brand_fit: number; commercial_value: number };
      return (s.originality + s.brand_fit + s.commercial_value) / 30;
    }
    return 0;
  };

  return (
    <div className="app">
      <div className="noise" aria-hidden="true" />
      <header className="menubar">
        <div className="menubar__brand">
          <span className="menubar__logo">V</span>
          <span className="menubar__name">Virtue Studio</span>
        </div>
        <nav className="menubar__nav">
          <button
            type="button"
            className={activeTab === 'canvas' ? 'active' : ''}
            onClick={() => setActiveTab('canvas')}
          >
            Canvas
          </button>
          <button
            type="button"
            className={activeTab === 'nodes' ? 'active' : ''}
            onClick={() => setActiveTab('nodes')}
          >
            Node Graph
          </button>
          <button
            type="button"
            className={activeTab === 'timeline' ? 'active' : ''}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </button>
        </nav>
        <div className="menubar__stats">
          {stats && (
            <span>
              {stats.modeCount} modes · {stats.territoryCount} territories · {stats.metaphorCount}{' '}
              metaphors
            </span>
          )}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar sidebar--left">
          <div className="sidebar__tabs">
            <button type="button" className="active">
              Assets
            </button>
            <button type="button">Layers</button>
            <button type="button">Templates</button>
          </div>
          <div className="sidebar__body">
            <h4>Visual Grammars</h4>
            <ul className="grammar-list">
              {grammars.map((g) => (
                <li key={g.name}>
                  <strong>{g.name}</strong>
                  <small>{g.sequence.join(' → ')}</small>
                </li>
              ))}
            </ul>
            <h4>Territories</h4>
            <div className="territory-chips">
              {territories.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main className="canvas-area">
          {activeTab === 'canvas' && (
            <div className="canvas">
              <div className="canvas__toolbar">
                <button type="button">Select</button>
                <button type="button">Text</button>
                <button type="button">Shape</button>
                <button type="button">Node</button>
                <button type="button">Hand</button>
                <div className="canvas__toolbar-spacer" />
                <button type="button" onClick={() => setZoom((z) => z + 0.1)}>
                  +
                </button>
                <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
                  −
                </button>
              </div>
              <div className="canvas__surface">
                <div className="canvas__grid" />
                <div className="canvas__content">
                  <div className="canvas__title">Motion Canvas</div>
                  <div className="canvas__subtitle">
                    Drag to pan · Scroll to zoom · {Math.round(zoom * 100)}%
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'nodes' && (
            <div className="node-graph">
              <div className="node-graph__header">
                <h3>Node Graph — Infographic Motion</h3>
                <p>
                  Structure your motion visuals as a node tree. Connect data → transform → render.
                </p>
              </div>
              <svg
                className="node-graph__svg"
                viewBox="0 0 800 400"
                role="img"
                aria-label="Node graph"
              >
                <title>Node graph</title>
                <defs>
                  <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ff5a2c" />
                    <stop offset="100%" stopColor="#5eead4" />
                  </linearGradient>
                </defs>
                <g transform="translate(60,60)">
                  <rect width="140" height="60" rx="8" fill="#171b24" stroke="#232836" />
                  <text x="12" y="22" fill="#e8eaef" fontSize="12" fontWeight="600">
                    Data Source
                  </text>
                  <text x="12" y="42" fill="#8a90a0" fontSize="10">
                    values: number[]
                  </text>
                </g>
                <path
                  d="M200 90 C 260 90, 260 90, 320 90"
                  stroke="#5eead4"
                  strokeWidth="2"
                  fill="none"
                />
                <g transform="translate(320,60)">
                  <rect width="140" height="60" rx="8" fill="#171b24" stroke="#232836" />
                  <text x="12" y="22" fill="#e8eaef" fontSize="12" fontWeight="600">
                    Transform
                  </text>
                  <text x="12" y="42" fill="#8a90a0" fontSize="10">
                    scale · offset
                  </text>
                </g>
                <path
                  d="M460 90 C 520 90, 520 90, 580 90"
                  stroke="#5eead4"
                  strokeWidth="2"
                  fill="none"
                />
                <g transform="translate(580,60)">
                  <rect width="140" height="60" rx="8" fill="#171b24" stroke="#ff5a2c" />
                  <text x="12" y="22" fill="#e8eaef" fontSize="12" fontWeight="600">
                    Render
                  </text>
                  <text x="12" y="42" fill="#8a90a0" fontSize="10">
                    motion frame
                  </text>
                </g>
              </svg>
            </div>
          )}
          {activeTab === 'timeline' && (
            <div className="timeline-view">
              <div className="timeline__transport">
                <button type="button" onClick={() => setPlaying(!playing)}>
                  {playing ? 'Pause' : 'Play'}
                </button>
                <button type="button" onClick={() => setPlayhead(0)}>
                  Stop
                </button>
                <span className="timeline__time">
                  {playhead.toFixed(2)}s / {duration.toFixed(2)}s
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={playhead}
                  onChange={(e) => setPlayhead(Number(e.target.value))}
                />
              </div>
              <div className="timeline__tracks">
                {['Camera', 'Typography', 'Effects', 'Audio'].map((track) => (
                  <div key={track} className="track">
                    <div className="track__label">{track}</div>
                    <div className="track__lane">
                      <div className="track__keyframe" style={{ left: '10%' }} />
                      <div className="track__keyframe" style={{ left: '40%' }} />
                      <div className="track__keyframe" style={{ left: '75%' }} />
                    </div>
                  </div>
                ))}
                <div
                  className="timeline__playhead"
                  style={{ left: `${(playhead / duration) * 100}%` }}
                />
              </div>
            </div>
          )}
        </main>

        <aside className="sidebar sidebar--right">
          <div className="sidebar__tabs">
            <button type="button" className="active">
              Properties
            </button>
            <button type="button">Effects</button>
            <button type="button">Fonts</button>
            <button type="button">Transitions</button>
          </div>
          <div className="sidebar__body">
            {selectedMode ? (
              <>
                <h4>{selectedMode.name}</h4>
                <p className="muted">{selectedMode.description}</p>
                <div className="prop-grid">
                  <div>
                    <span>Mood</span>
                    <span>{selectedMode.mood}</span>
                  </div>
                  <div>
                    <span>Pace</span>
                    <span>{selectedMode.pace}</span>
                  </div>
                  <div>
                    <span>Duration</span>
                    <span>{selectedMode.duration}s</span>
                  </div>
                  <div>
                    <span>Voice</span>
                    <span>{selectedMode.voice}</span>
                  </div>
                  <div>
                    <span>3D</span>
                    <span>{selectedMode.requires3d ? 'yes' : 'no'}</span>
                  </div>
                  <div>
                    <span>VFX</span>
                    <span>{selectedMode.requiresVfx ? 'yes' : 'no'}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h4>Typography Presets</h4>
                <ul className="preset-list">
                  {typography.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => setSelectedPreset(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedPreset(p.id);
                      }}
                      className={selectedPreset === p.id ? 'active' : ''}
                    >
                      <span
                        style={{
                          fontFamily: p.fontFamily,
                          fontWeight: p.fontWeight,
                          color: p.color,
                        }}
                      >
                        {p.name}
                      </span>
                      <small>
                        {p.animation} · {p.animationDuration}s
                      </small>
                    </li>
                  ))}
                </ul>
                <h4>VFX Effects</h4>
                <ul className="preset-list">
                  {effects.map((e) => (
                    <li
                      key={e.id}
                      onClick={() => setSelectedEffect(e.id)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') setSelectedEffect(e.id);
                      }}
                      className={selectedEffect === e.id ? 'active' : ''}
                    >
                      <span>{e.name}</span>
                      <small>{e.category}</small>
                    </li>
                  ))}
                </ul>
                <h4>Visual Grammars</h4>
                <ul className="preset-list">
                  {grammars.map((g) => (
                    <li key={g.name}>
                      <span>{g.name}</span>
                      <small>{g.sequence.join(' → ')}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>

      <section className="bottom-panel">
        <div className="bottom-panel__head">
          <h3>Generate Concepts</h3>
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
                    <ScoreRing value={s} />
                  </div>
                  <div className="concept-row__body">
                    <h3>{c.title}</h3>
                    <p className="concept-row__logline">{c.logline}</p>
                    <div className="concept-row__meta">
                      {c.territory && <span className="tag">{c.territory}</span>}
                      {c.mood && <span className="tag tag--muted">{c.mood}</span>}
                      {c.creative_mode && <span className="tag tag--muted">{c.creative_mode}</span>}
                    </div>
                    {c.key_visual && <p className="concept-row__kv">{c.key_visual}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bottom-panel bottom-panel--modes">
        <div className="bottom-panel__head">
          <h3>Creative Modes</h3>
          <span className="panel__count">{modes.length}</span>
        </div>
        <div className="mode-grid">
          {modes.map((m) => (
            <article
              key={m.id}
              className="mode-card"
              onClick={() => setSelectedMode(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedMode(m);
              }}
            >
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

      <section className="bottom-panel bottom-panel--metaphors">
        <div className="bottom-panel__head">
          <h3>Visual Metaphors</h3>
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
    </div>
  );
}

function _Stat({ label, value }: { label: string; value: number }) {
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
