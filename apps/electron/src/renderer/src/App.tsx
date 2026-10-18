import { useState } from 'react';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

type Tab = 'canvas' | 'nodes' | 'timeline' | 'ai' | '3d';

export function App() {
  const { modes, typography, effects, grammars, stats } = useEngineData();
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
  const [selectedMode, _setSelectedMode] = useState<CreativeMode | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedGrammar, setSelectedGrammar] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [leftTab, setLeftTab] = useState<'assets' | 'layers' | 'templates' | 'ai'>('assets');
  const [rightTab, setRightTab] = useState<
    'properties' | 'effects' | 'fonts' | 'transitions' | '3d'
  >('properties');
  const [quickApply, setQuickApply] = useState('');
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [selectedTool, setSelectedTool] = useState('select');
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

  const tools = [
    { id: 'select', label: 'V', title: 'Select' },
    { id: 'text', label: 'T', title: 'Text' },
    { id: 'shape', label: 'S', title: 'Shape' },
    { id: 'node', label: 'N', title: 'Node' },
    { id: 'pen', label: 'P', title: 'Pen' },
    { id: 'hand', label: 'H', title: 'Hand' },
    { id: 'zoom', label: 'Z', title: 'Zoom' },
  ];

  const quickApplyItems = [
    ...effects.map((e) => ({ type: 'Effect', name: e.name, id: e.id })),
    ...typography.map((p) => ({ type: 'Font', name: p.name, id: p.id })),
    ...modes.map((m) => ({ type: 'Mode', name: m.name, id: m.id })),
    ...grammars.map((g) => ({ type: 'Grammar', name: g.name, id: g.name })),
  ].filter((x) => quickApply === '' || x.name.toLowerCase().includes(quickApply.toLowerCase()));

  return (
    <div className="app">
      <div className="noise" aria-hidden="true" />

      {/* ── Menu Bar ── */}
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
          <button
            type="button"
            className={activeTab === 'ai' ? 'active' : ''}
            onClick={() => setActiveTab('ai')}
          >
            AI Tools
          </button>
          <button
            type="button"
            className={activeTab === '3d' ? 'active' : ''}
            onClick={() => setActiveTab('3d')}
          >
            3D
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
        <button
          type="button"
          className="menubar__quickapply"
          onClick={() => setShowQuickApply(!showQuickApply)}
        >
          ⌘K Quick Apply
        </button>
      </header>

      {/* ── Quick Apply Palette ── */}
      {showQuickApply && (
        <button
          type="button"
          className="quickapply-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQuickApply(false);
          }}
        >
          <div className="quickapply">
            <input
              placeholder="Search effects, fonts, modes, grammars…"
              value={quickApply}
              onChange={(e) => setQuickApply(e.target.value)}
            />
            <ul className="quickapply__list">
              {quickApplyItems.slice(0, 20).map((x) => (
                <li key={x.type + x.id}>
                  <span className="quickapply__type">{x.type}</span>
                  <span>{x.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </button>
      )}

      {/* ── Main Workspace ── */}
      <div className="workspace">
        {/* Left Sidebar */}
        <aside className="sidebar sidebar--left">
          <div className="sidebar__tabs">
            {(['assets', 'layers', 'templates', 'ai'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={leftTab === t ? 'active' : ''}
                onClick={() => setLeftTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="sidebar__body">
            {leftTab === 'assets' && (
              <>
                <h4>Visual Grammars</h4>
                <ul className="grammar-list">
                  {grammars.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      className={selectedGrammar === g.name ? 'active' : ''}
                      onClick={() => setSelectedGrammar(g.name)}
                    >
                      <strong>{g.name}</strong>
                      <small>{g.sequence.join(' → ')}</small>
                    </button>
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
              </>
            )}
            {leftTab === 'templates' && (
              <>
                <h4>Detective Documentary</h4>
                <div className="template-card">
                  <div
                    className="template-card__preview"
                    style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
                  />
                  <div className="template-card__name">Case File Reveal</div>
                  <div className="template-card__desc">
                    Suspenseful investigative flow with clue → evidence → discovery
                  </div>
                </div>
                <div className="template-card">
                  <div
                    className="template-card__preview"
                    style={{ background: 'linear-gradient(135deg,#0f2027,#203a43)' }}
                  />
                  <div className="template-card__name">Evidence Board</div>
                  <div className="template-card__desc">
                    Pin clues, photos, and connections on a corkboard
                  </div>
                </div>
                <div className="template-card">
                  <div
                    className="template-card__preview"
                    style={{ background: 'linear-gradient(135deg,#2c3e50,#4ca1af)' }}
                  />
                  <div className="template-card__name">Interrogation Room</div>
                  <div className="template-card__desc">Dramatic single-subject interview setup</div>
                </div>
                <h4>Infographic Motion</h4>
                <div className="template-card">
                  <div
                    className="template-card__preview"
                    style={{ background: 'linear-gradient(135deg,#134e5e,#71b280)' }}
                  />
                  <div className="template-card__name">Data Reveal</div>
                  <div className="template-card__desc">
                    Animated bar/line chart with kinetic numbers
                  </div>
                </div>
                <div className="template-card">
                  <div
                    className="template-card__preview"
                    style={{ background: 'linear-gradient(135deg,#4b1248,#f09819)' }}
                  />
                  <div className="template-card__name">Process Flow</div>
                  <div className="template-card__desc">Step-by-step node graph animation</div>
                </div>
              </>
            )}
            {leftTab === 'ai' && (
              <>
                <h4>AI Tools</h4>
                <div className="ai-tool">
                  <div className="ai-tool__icon">✂</div>
                  <div className="ai-tool__name">Object Matte</div>
                  <div className="ai-tool__desc">AI subject isolation & tracking masks</div>
                  <button type="button" className="btn btn--sm">
                    Run
                  </button>
                </div>
                <div className="ai-tool">
                  <div className="ai-tool__icon">⟳</div>
                  <div className="ai-tool__name">Generative Extend</div>
                  <div className="ai-tool__desc">Extend clip duration with AI frames</div>
                  <button type="button" className="btn btn--sm">
                    Run
                  </button>
                </div>
                <div className="ai-tool">
                  <div className="ai-tool__icon">⊘</div>
                  <div className="ai-tool__name">Unmult</div>
                  <div className="ai-tool__desc">Remove black/white matted backgrounds</div>
                  <button type="button" className="btn btn--sm">
                    Apply
                  </button>
                </div>
                <div className="ai-tool">
                  <div className="ai-tool__icon">≋</div>
                  <div className="ai-tool__name">Curl Noise</div>
                  <div className="ai-tool__desc">Procedural fluid dynamics & particles</div>
                  <button type="button" className="btn btn--sm">
                    Generate
                  </button>
                </div>
              </>
            )}
            {leftTab === 'layers' && (
              <>
                <h4>Layers</h4>
                <ul className="layer-list">
                  {['Background', 'Title Text', 'Subtitle', 'Logo', 'VFX: Glow', 'Audio Track'].map(
                    (l, i) => (
                      <li key={l}>
                        <span className="layer__eye">👁</span>
                        <span className="layer__name">{l}</span>
                        <span className="layer__type">
                          {i < 3 ? 'text' : i === 3 ? 'image' : i === 4 ? 'effect' : 'audio'}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </>
            )}
          </div>
        </aside>

        <main className="canvas-area">
          <div className="canvas__toolbar">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.title}
                className={selectedTool === t.id ? 'active' : ''}
                onClick={() => setSelectedTool(t.id)}
              >
                {t.label}
              </button>
            ))}
            <div className="canvas__toolbar-spacer" />
            <button type="button" onClick={() => setZoom((z) => z + 0.1)}>
              +
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
              −
            </button>
            <span className="canvas__zoom">{Math.round(zoom * 100)}%</span>
          </div>

          {activeTab === 'canvas' && (
            <div className="canvas">
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
                viewBox="0 0 900 420"
                role="img"
                aria-label="Node graph"
              >
                <title>Node graph</title>
                <defs>
                  <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ff5a2c" />
                    <stop offset="100%" stopColor="#5eead4" />
                  </linearGradient>
                  <marker
                    id="arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="#5eead4" />
                  </marker>
                </defs>
                {[
                  { x: 40, y: 60, title: 'Data Source', sub: 'values: number[]', color: '#232836' },
                  {
                    x: 230,
                    y: 60,
                    title: 'Transform',
                    sub: 'scale · offset · ease',
                    color: '#232836',
                  },
                  {
                    x: 420,
                    y: 60,
                    title: 'Kinetic Type',
                    sub: 'font · weight · stagger',
                    color: '#232836',
                  },
                  { x: 610, y: 60, title: 'Render', sub: 'motion frame', color: '#ff5a2c' },
                ].map((n, i, arr) => (
                  <g key={n.title} transform={`translate(${n.x},${n.y})`}>
                    <rect
                      width="160"
                      height="70"
                      rx="10"
                      fill="#171b24"
                      stroke={n.color}
                      strokeWidth="1.5"
                    />
                    <rect width="160" height="4" rx="2" fill="url(#nodeGrad)" />
                    <text x="14" y="28" fill="#e8eaef" fontSize="12" fontWeight="600">
                      {n.title}
                    </text>
                    <text x="14" y="48" fill="#8a90a0" fontSize="10">
                      {n.sub}
                    </text>
                    {i < arr.length - 1 && (
                      <path
                        d={`M160 35 C 195 35, 195 35, 230 35`}
                        stroke="#5eead4"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrow)"
                        transform="translate(0,0)"
                      />
                    )}
                  </g>
                ))}
              </svg>
              <div className="node-graph__footer">
                <span>Nodes: 4 · Connections: 3 · Status: valid</span>
              </div>
            </div>
          )}
          {activeTab === 'timeline' && (
            <div className="timeline-view">
              <div className="timeline__transport">
                <button type="button" onClick={() => setPlaying(!playing)}>
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <button type="button" onClick={() => setPlayhead(0)}>
                  ⏹ Stop
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
                      <div className="track__keyframe" style={{ left: '8%' }} />
                      <div className="track__keyframe" style={{ left: '35%' }} />
                      <div className="track__keyframe" style={{ left: '68%' }} />
                      <div
                        className="track__keyframe track__keyframe--diamond"
                        style={{ left: '90%' }}
                      />
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
          {activeTab === 'ai' && (
            <div className="ai-panel">
              <h3>AI & Next-Level Visual Effects</h3>
              <div className="ai-grid">
                <div className="ai-card">
                  <div className="ai-card__icon">✂</div>
                  <div className="ai-card__name">Object Matte</div>
                  <div className="ai-card__desc">
                    AI-driven subject isolation & tracking masks (Roto Brush successor)
                  </div>
                  <button type="button" className="btn btn--sm">
                    Run
                  </button>
                </div>
                <div className="ai-card">
                  <div className="ai-card__icon">⟳</div>
                  <div className="ai-card__name">Generative Extend</div>
                  <div className="ai-card__desc">Extend clip duration with AI-generated frames</div>
                  <button type="button" className="btn btn--sm">
                    Run
                  </button>
                </div>
                <div className="ai-card">
                  <div className="ai-card__icon">⊘</div>
                  <div className="ai-card__name">Unmult</div>
                  <div className="ai-card__desc">
                    Remove black/white matted backgrounds (fire, smoke, UI)
                  </div>
                  <button type="button" className="btn btn--sm">
                    Apply
                  </button>
                </div>
                <div className="ai-card">
                  <div className="ai-card__icon">≋</div>
                  <div className="ai-card__name">Curl Noise</div>
                  <div className="ai-card__desc">
                    Procedural fluid dynamics, particles, abstract textures
                  </div>
                  <button type="button" className="btn btn--sm">
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === '3d' && (
            <div className="panel-3d">
              <h3>Native 3D Design</h3>
              <div className="panel-3d__viewport">
                <div className="panel-3d__grid" />
                <div className="panel-3d__label">3D Viewport (GPU-accelerated)</div>
              </div>
              <div className="panel-3d__controls">
                <div className="prop-grid">
                  <div>
                    <span>Mesh</span>
                    <span>Parametric Cube</span>
                  </div>
                  <div>
                    <span>Material</span>
                    <span>Substance 3D (1,300+)</span>
                  </div>
                  <div>
                    <span>DOF</span>
                    <span>Aperture 2.8 · Focus 5m</span>
                  </div>
                  <div>
                    <span>Shadow</span>
                    <span>Spot · Diffusion 0.4</span>
                  </div>
                  <div>
                    <span>Lighting</span>
                    <span>Key + Fill + Rim</span>
                  </div>
                  <div>
                    <span>Shadow Catcher</span>
                    <span>Enabled</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <aside className="sidebar sidebar--right">
          <div className="sidebar__tabs">
            <button
              type="button"
              className={rightTab === 'properties' ? 'active' : ''}
              onClick={() => setRightTab('properties')}
            >
              Properties
            </button>
            <button
              type="button"
              className={rightTab === 'effects' ? 'active' : ''}
              onClick={() => setRightTab('effects')}
            >
              Effects
            </button>
            <button
              type="button"
              className={rightTab === 'fonts' ? 'active' : ''}
              onClick={() => setRightTab('fonts')}
            >
              Fonts
            </button>
            <button
              type="button"
              className={rightTab === 'transitions' ? 'active' : ''}
              onClick={() => setRightTab('transitions')}
            >
              Transitions
            </button>
            <button
              type="button"
              className={rightTab === '3d' ? 'active' : ''}
              onClick={() => setRightTab('3d')}
            >
              3D
            </button>
          </div>
          <div className="sidebar__body">
            {rightTab === 'properties' &&
              (selectedMode ? (
                <>
                  <h4>{selectedMode.name}</h4>
                  <p className="muted">{selectedMode.description}</p>
                  <div className="prop-grid">
                    <div>
                      <span>Mode</span>
                      <span>{selectedMode.id}</span>
                    </div>
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
                    <div>
                      <span>Formats</span>
                      <span>{selectedMode.formats.join(', ')}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="muted">Select a mode to inspect its properties.</p>
              ))}
            {rightTab === 'effects' && (
              <>
                <h4>Effects Stack</h4>
                <ul className="preset-list">
                  {effects.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={selectedEffect === e.id ? 'active' : ''}
                      onClick={() => setSelectedEffect(e.id)}
                    >
                      <span>{e.name}</span>
                      <small>{e.category}</small>
                    </button>
                  ))}
                </ul>
                {selectedEffect && (
                  <div className="effect-params">
                    <h4>Parameters</h4>
                    {Object.entries(
                      effects.find((e) => e.id === selectedEffect)?.parameters ?? {},
                    ).map(([k, v]) => (
                      <div key={k} className="prop-grid__row">
                        <span>{k}</span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {rightTab === 'fonts' && (
              <>
                <h4>Typography Presets</h4>
                <ul className="preset-list">
                  {typography.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={selectedPreset === p.id ? 'active' : ''}
                      onClick={() => setSelectedPreset(p.id)}
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
                        {p.animation} · {p.animationDuration}s · stagger {p.stagger}
                      </small>
                    </button>
                  ))}
                </ul>
                <h4>Variable Font Axes</h4>
                <div className="prop-grid">
                  <div>
                    <span>Weight</span>
                    <span>100–900</span>
                  </div>
                  <div>
                    <span>Slant</span>
                    <span>-15° to 0°</span>
                  </div>
                  <div>
                    <span>Width</span>
                    <span>75–125</span>
                  </div>
                  <div>
                    <span>Wiggle</span>
                    <span>0–1</span>
                  </div>
                </div>
              </>
            )}
            {rightTab === 'transitions' && (
              <>
                <h4>Transitions</h4>
                <ul className="preset-list">
                  {effects
                    .filter((e) => e.category === 'TRANSITION')
                    .map((e) => (
                      <li key={e.id}>
                        <span>{e.name}</span>
                        <small>{JSON.stringify(e.parameters)}</small>
                      </li>
                    ))}
                </ul>
                <h4>Quick Offset</h4>
                <p className="muted">
                  Hold Ctrl+Alt / Cmd+Opt and drag to stagger layers & keyframes.
                </p>
              </>
            )}
            {rightTab === '3d' && (
              <>
                <h4>3D Properties</h4>
                <div className="prop-grid">
                  <div>
                    <span>Mesh</span>
                    <span>Parametric Cube</span>
                  </div>
                  <div>
                    <span>Material</span>
                    <span>Substance 3D</span>
                  </div>
                  <div>
                    <span>Aperture</span>
                    <span>2.8</span>
                  </div>
                  <div>
                    <span>Focus Distance</span>
                    <span>5.0m</span>
                  </div>
                  <div>
                    <span>Blur</span>
                    <span>0.4</span>
                  </div>
                  <div>
                    <span>Shadow Catcher</span>
                    <span>On</span>
                  </div>
                </div>
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
