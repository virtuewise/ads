import { useState } from 'react';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
  >
    <title>Icon</title>
    <path d={d} />
  </svg>
);

const ICONS = {
  select: 'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
  text: 'M4 7V4h16v3M9 20h6M12 4v16',
  shape: 'M12 2l9 4.9V17.1L12 22 3 17.1V6.9L12 2z',
  node: 'M12 2a3 3 0 0 0-3 3v1H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h3v1a3 3 0 0 0 6 0v-1h3a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3z',
  pen: 'M12 19l7-7 3 3-7 7-3 0 0-3zM18 13l-1.5-1.5M5 5h.01',
  hand: 'M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  zoom: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
};

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
  const [selectedMode, setSelectedMode] = useState<CreativeMode | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [selectedGrammar, setSelectedGrammar] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [leftTab, setLeftTab] = useState<'assets' | 'layers' | 'templates' | 'ai'>('assets');
  const [rightTab, setRightTab] = useState<
    'properties' | 'effects' | 'fonts' | 'transitions' | 'threed'
  >('properties');
  const [quickApply, setQuickApply] = useState('');
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [selectedTool, setSelectedTool] = useState('select');
  const [activeView, setActiveView] = useState<'canvas' | 'nodes'>('canvas');
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
    { id: 'select', icon: ICONS.select, title: 'Select' },
    { id: 'text', icon: ICONS.text, title: 'Text' },
    { id: 'shape', icon: ICONS.shape, title: 'Shape' },
    { id: 'node', icon: ICONS.node, title: 'Node' },
    { id: 'pen', icon: ICONS.pen, title: 'Pen' },
    { id: 'hand', icon: ICONS.hand, title: 'Hand' },
    { id: 'zoom', icon: ICONS.zoom, title: 'Zoom' },
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

      {/* ── Top Menu Bar ── */}
      <header className="menubar">
        <div className="menubar__brand">
          <span className="menubar__logo">V</span>
          <span className="menubar__name">Virtue Studio</span>
        </div>
        <nav className="menubar__menus">
          {['File', 'Edit', 'View', 'Layer', 'Window', 'Help'].map((m) => (
            <button key={m} type="button" className="menubar__menu">
              {m}
            </button>
          ))}
        </nav>
        <div className="menubar__right">
          {stats && (
            <span className="menubar__stat">
              {stats.modeCount} modes · {stats.territoryCount} territories
            </span>
          )}
          <button type="button" className="menubar__qa" onClick={() => setShowQuickApply(true)}>
            <Icon d={ICONS.zoom} size={14} />
            <span>Quick Apply</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      {/* ── Quick Apply Palette ── */}
      {showQuickApply && (
        <button
          type="button"
          className="qa-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQuickApply(false);
          }}
        >
          <div className="qa-panel">
            <input
              placeholder="Search effects, fonts, modes, grammars…"
              value={quickApply}
              onChange={(e) => setQuickApply(e.target.value)}
            />
            <ul className="qa-list">
              {quickApplyItems.slice(0, 18).map((x) => (
                <li key={x.type + x.id}>
                  <span className="qa-type">{x.type}</span>
                  <span className="qa-name">{x.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </button>
      )}

      {/* ── Main Workspace ── */}
      <div className="workspace">
        {/* Left: Tool Palette + Panels */}
        <aside className="rail rail--left">
          <div className="rail__tools">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.title}
                className={`rail__tool ${selectedTool === t.id ? 'active' : ''}`}
                onClick={() => setSelectedTool(t.id)}
              >
                <Icon d={t.icon} size={18} />
              </button>
            ))}
          </div>
          <div className="rail__tabs">
            {(['assets', 'layers', 'templates', 'ai'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={leftTab === t ? 'active' : ''}
                onClick={() => setLeftTab(t)}
                title={t}
              >
                {t[0].toUpperCase()}
              </button>
            ))}
          </div>
          <div className="rail__body">
            {leftTab === 'assets' && (
              <>
                <div className="rail__section">
                  <div className="rail__section-title">Visual Grammars</div>
                  {grammars.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      className={`rail__item ${selectedGrammar === g.name ? 'active' : ''}`}
                      onClick={() => setSelectedGrammar(g.name)}
                    >
                      <span className="rail__item-title">{g.name}</span>
                      <span className="rail__item-sub">{g.sequence.length} beats</span>
                    </button>
                  ))}
                </div>
                <div className="rail__section">
                  <div className="rail__section-title">Territories</div>
                  <div className="chip-row">
                    {territories.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            {leftTab === 'templates' && (
              <div className="rail__section">
                <div className="rail__section-title">Templates</div>
                {[
                  {
                    name: 'Case File Reveal',
                    desc: 'Suspenseful investigative flow',
                    bg: 'linear-gradient(135deg,#1a1a2e,#16213e)',
                  },
                  {
                    name: 'Evidence Board',
                    desc: 'Pin clues on a corkboard',
                    bg: 'linear-gradient(135deg,#0f2027,#203a43)',
                  },
                  {
                    name: 'Interrogation Room',
                    desc: 'Dramatic single-subject interview',
                    bg: 'linear-gradient(135deg,#2c3e50,#4ca1af)',
                  },
                  {
                    name: 'Data Reveal',
                    desc: 'Animated chart with kinetic numbers',
                    bg: 'linear-gradient(135deg,#134e5e,#71b280)',
                  },
                  {
                    name: 'Process Flow',
                    desc: 'Step-by-step node animation',
                    bg: 'linear-gradient(135deg,#4b1248,#f09819)',
                  },
                ].map((t) => (
                  <div key={t.name} className="template-card">
                    <div className="template-card__preview" style={{ background: t.bg }} />
                    <div className="template-card__name">{t.name}</div>
                    <div className="template-card__desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            )}
            {leftTab === 'ai' && (
              <div className="rail__section">
                <div className="rail__section-title">AI Tools</div>
                {[
                  {
                    icon: '✂',
                    name: 'Object Matte',
                    desc: 'AI subject isolation & tracking masks',
                  },
                  {
                    icon: '⟳',
                    name: 'Generative Extend',
                    desc: 'Extend clip duration with AI frames',
                  },
                  { icon: '⊘', name: 'Unmult', desc: 'Remove black/white matted backgrounds' },
                  { icon: '≋', name: 'Curl Noise', desc: 'Procedural fluid dynamics & particles' },
                ].map((t) => (
                  <div key={t.name} className="ai-tool">
                    <div className="ai-tool__icon">{t.icon}</div>
                    <div className="ai-tool__body">
                      <div className="ai-tool__name">{t.name}</div>
                      <div className="ai-tool__desc">{t.desc}</div>
                    </div>
                    <button type="button" className="btn btn--sm">
                      Run
                    </button>
                  </div>
                ))}
              </div>
            )}
            {leftTab === 'layers' && (
              <div className="rail__section">
                <div className="rail__section-title">Layers</div>
                {['Background', 'Title Text', 'Subtitle', 'Logo', 'VFX: Glow', 'Audio Track'].map(
                  (l, i) => (
                    <div key={l} className="layer-row">
                      <span className="layer__eye">◉</span>
                      <span className="layer__name">{l}</span>
                      <span className="layer__type">
                        {i < 3 ? 'text' : i === 3 ? 'img' : i === 4 ? 'fx' : 'aud'}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="canvas-column">
          <div className="canvas__toolbar">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.title}
                className={`toolbar__btn ${selectedTool === t.id ? 'active' : ''}`}
                onClick={() => setSelectedTool(t.id)}
              >
                <Icon d={t.icon} size={16} />
              </button>
            ))}
            <div className="toolbar__sep" />
            <button type="button" className="toolbar__btn" onClick={() => setZoom((z) => z + 0.1)}>
              +
            </button>
            <button
              type="button"
              className="toolbar__btn"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            >
              −
            </button>
            <span className="toolbar__zoom">{Math.round(zoom * 100)}%</span>
            <div className="toolbar__sep" />
            <button type="button" className="toolbar__btn" onClick={() => setActiveView('canvas')}>
              Canvas
            </button>
            <button type="button" className="toolbar__btn" onClick={() => setActiveView('nodes')}>
              Nodes
            </button>
          </div>

          {activeView === 'canvas' && (
            <div className="canvas">
              <div className="canvas__surface">
                <div className="canvas__grid" />
                <div className="canvas__frame">
                  <div className="canvas__frame-title">Composition Preview</div>
                  <div className="canvas__frame-sub">1920 × 1080 · 30fps · {duration}s</div>
                </div>
              </div>
            </div>
          )}
          {activeView === 'nodes' && (
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
                  { x: 40, y: 60, title: 'Data Source', sub: 'values: number[]' },
                  { x: 230, y: 60, title: 'Transform', sub: 'scale · offset · ease' },
                  { x: 420, y: 60, title: 'Kinetic Type', sub: 'font · weight · stagger' },
                  { x: 610, y: 60, title: 'Render', sub: 'motion frame', accent: true },
                ].map((n, i, arr) => (
                  <g key={n.title} transform={`translate(${n.x},${n.y})`}>
                    <rect
                      width="160"
                      height="70"
                      rx="8"
                      fill="#171b24"
                      stroke={n.accent ? '#ff5a2c' : '#232836'}
                      strokeWidth="1.5"
                    />
                    <rect width="160" height="3" rx="1.5" fill="url(#nodeGrad)" />
                    <text x="14" y="28" fill="#e8eaef" fontSize="12" fontWeight="600">
                      {n.title}
                    </text>
                    <text x="14" y="48" fill="#8a90a0" fontSize="10">
                      {n.sub}
                    </text>
                    {i < arr.length - 1 && (
                      <path
                        d="M160 35 C 195 35, 195 35, 230 35"
                        stroke="#5eead4"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrow)"
                      />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>

        <aside className="rail rail--right">
          <div className="rail__tabs">
            {(['properties', 'effects', 'fonts', 'transitions', 'threed'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={rightTab === t ? 'active' : ''}
                onClick={() => setRightTab(t)}
              >
                {t === 'threed' ? '3D' : t}
              </button>
            ))}
          </div>
          <div className="rail__body">
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
                <p className="muted">Select a mode to inspect.</p>
              ))}
            {rightTab === 'effects' && (
              <>
                <h4>Effects Stack</h4>
                <div className="preset-list">
                  {effects.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={`preset-item ${selectedEffect === e.id ? 'active' : ''}`}
                      onClick={() => setSelectedEffect(e.id)}
                    >
                      <span>{e.name}</span>
                      <small>{e.category}</small>
                    </button>
                  ))}
                </div>
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
                <div className="preset-list">
                  {typography.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`preset-item ${selectedPreset === p.id ? 'active' : ''}`}
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
                </div>
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
                <div className="preset-list">
                  {effects
                    .filter((e) => e.category === 'TRANSITION')
                    .map((e) => (
                      <button key={e.id} type="button" className="preset-item">
                        <span>{e.name}</span>
                        <small>{JSON.stringify(e.parameters)}</small>
                      </button>
                    ))}
                </div>
                <h4>Quick Offset</h4>
                <p className="muted">
                  Hold Ctrl+Alt / Cmd+Opt and drag to stagger layers & keyframes.
                </p>
              </>
            )}
            {rightTab === 'threed' && (
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

      {/* ── Bottom: Timeline (full width) ── */}
      <div className="timeline">
        <div className="timeline__transport">
          <button type="button" onClick={() => setPlaying(!playing)}>
            {playing ? '⏸' : '▶'}
          </button>
          <button type="button" onClick={() => setPlayhead(0)}>
            ⏹
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
          <div className="timeline__spacer" />
          <span className="timeline__info">30fps · 1920×1080</span>
        </div>
        <div className="timeline__tracks">
          {['Video', 'Audio', 'Captions', 'Effects', 'Transitions'].map((track) => (
            <div key={track} className="track">
              <div className="track__label">{track}</div>
              <div className="track__lane">
                <div className="track__keyframe" style={{ left: '8%' }} />
                <div className="track__keyframe" style={{ left: '35%' }} />
                <div className="track__keyframe" style={{ left: '68%' }} />
                <div className="track__keyframe track__keyframe--diamond" style={{ left: '90%' }} />
              </div>
            </div>
          ))}
          <div className="timeline__playhead" style={{ left: `${(playhead / duration) * 100}%` }} />
        </div>
      </div>

      {/* ── Bottom Panel: Concept Generation ── */}
      <div className="bottom-panel">
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
      </div>

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
