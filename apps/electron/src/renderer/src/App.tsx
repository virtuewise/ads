import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

type Tab = 'canvas' | 'nodes' | 'timeline' | 'ai' | 'threed';

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
  const [activeTab, setActiveTab] = useState<Tab>('canvas');
  const [selectedMode, setSelectedMode] = useState<CreativeMode | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedGrammar, setSelectedGrammar] = useState<string | null>(null);
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
    <div className="h-screen w-screen bg-ink text-text flex flex-col overflow-hidden font-sans">
      {/* ── Menu Bar ── */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-line bg-ink-2 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white font-bold text-sm">
            V
          </span>
          <span className="font-semibold tracking-tight">Virtue Studio</span>
        </div>
        <nav className="flex items-center gap-1">
          {(['canvas', 'nodes', 'timeline', 'ai', 'threed'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === t ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text hover:bg-white/5'}`}
            >
              {t === 'threed' ? '3D' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-xs text-muted font-mono">
              {stats.modeCount} modes · {stats.territoryCount} territories
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowQuickApply(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs transition-all"
          >
            <Icon d={ICONS.zoom} size={12} />
            <span>Quick Apply</span>
            <kbd className="px-1.5 py-0.5 bg-black/30 rounded text-[10px] font-mono">⌘K</kbd>
          </button>
        </div>
      </header>

      {/* ── Quick Apply Palette ── */}
      <AnimatePresence>
        {showQuickApply && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24"
            onClick={() => setShowQuickApply(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-[560px] bg-panel border border-line rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                placeholder="Search effects, fonts, modes, grammars…"
                value={quickApply}
                onChange={(e) => setQuickApply(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border-b border-line text-sm outline-none placeholder:text-muted"
              />
              <ul className="max-h-80 overflow-y-auto">
                {quickApplyItems.slice(0, 18).map((x) => (
                  <li
                    key={x.type + x.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer text-sm"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-accent font-mono w-16">
                      {x.type}
                    </span>
                    <span>{x.name}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Rail */}
        <aside className="w-16 border-r border-line bg-ink-2 flex flex-col shrink-0">
          <div className="flex flex-col items-center gap-1 py-3 border-b border-line">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.title}
                onClick={() => setSelectedTool(t.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${selectedTool === t.id ? 'bg-accent text-white' : 'text-muted hover:text-text hover:bg-white/5'}`}
              >
                <Icon d={t.icon} size={18} />
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center gap-1 py-3">
            {(['assets', 'layers', 'templates', 'ai'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLeftTab(t)}
                title={t}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-semibold uppercase transition-all ${leftTab === t ? 'bg-white/10 text-text' : 'text-muted hover:text-text hover:bg-white/5'}`}
              >
                {t[0]}
              </button>
            ))}
          </div>
        </aside>

        <div className="w-64 border-r border-line bg-ink-2 flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-line text-[11px] uppercase tracking-wider text-muted font-semibold">
            {leftTab}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {leftTab === 'assets' && (
              <>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                    Visual Grammars
                  </div>
                  <div className="space-y-1">
                    {grammars.map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => setSelectedGrammar(g.name)}
                        className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedGrammar === g.name ? 'bg-accent/10 border border-accent/30' : 'hover:bg-white/5 border border-transparent'}`}
                      >
                        <div className="text-xs font-medium">{g.name}</div>
                        <div className="text-[10px] text-muted font-mono mt-0.5">
                          {g.sequence.length} beats
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                    Territories
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {territories.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cool/10 text-cool border border-cool/20"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            {leftTab === 'templates' && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  Templates
                </div>
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
                  <div
                    key={t.name}
                    className="rounded-lg overflow-hidden border border-line cursor-pointer hover:border-accent/40 transition-colors"
                  >
                    <div className="h-16" style={{ background: t.bg }} />
                    <div className="p-2.5">
                      <div className="text-xs font-medium">{t.name}</div>
                      <div className="text-[10px] text-muted mt-0.5">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {leftTab === 'ai' && (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  AI Tools
                </div>
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
                  <div
                    key={t.name}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-line hover:border-accent/30 transition-colors cursor-pointer"
                  >
                    <span className="text-lg leading-none mt-0.5">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{t.name}</div>
                      <div className="text-[10px] text-muted mt-0.5">{t.desc}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] font-medium rounded bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                    >
                      Run
                    </button>
                  </div>
                ))}
              </div>
            )}
            {leftTab === 'layers' && (
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  Layers
                </div>
                {['Background', 'Title Text', 'Subtitle', 'Logo', 'VFX: Glow', 'Audio Track'].map(
                  (l, i) => (
                    <div
                      key={l}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/5 cursor-pointer text-xs"
                    >
                      <span className="text-muted">◉</span>
                      <span className="flex-1">{l}</span>
                      <span className="text-[10px] text-muted font-mono">
                        {i < 3 ? 'txt' : i === 3 ? 'img' : i === 4 ? 'fx' : 'aud'}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="h-9 flex items-center gap-1 px-3 border-b border-line bg-ink-2 shrink-0">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.title}
                onClick={() => setSelectedTool(t.id)}
                className={`w-8 h-8 rounded flex items-center justify-center transition-all ${selectedTool === t.id ? 'bg-accent text-white' : 'text-muted hover:text-text hover:bg-white/5'}`}
              >
                <Icon d={t.icon} size={15} />
              </button>
            ))}
            <div className="w-px h-5 bg-line mx-1" />
            <button
              type="button"
              className="px-2 h-8 rounded text-xs text-muted hover:text-text hover:bg-white/5"
              onClick={() => setZoom((z) => z + 0.1)}
            >
              +
            </button>
            <button
              type="button"
              className="px-2 h-8 rounded text-xs text-muted hover:text-text hover:bg-white/5"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            >
              −
            </button>
            <span className="text-xs text-muted font-mono ml-1">{Math.round(zoom * 100)}%</span>
            <div className="flex-1" />
            <button
              type="button"
              className={`px-3 h-7 rounded text-xs font-medium transition-all ${activeTab === 'canvas' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setActiveTab('canvas')}
            >
              Canvas
            </button>
            <button
              type="button"
              className={`px-3 h-7 rounded text-xs font-medium transition-all ${activeTab === 'nodes' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setActiveTab('nodes')}
            >
              Nodes
            </button>
            <button
              type="button"
              className={`px-3 h-7 rounded text-xs font-medium transition-all ${activeTab === 'timeline' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setActiveTab('timeline')}
            >
              Timeline
            </button>
          </div>

          {activeTab === 'canvas' && (
            <div className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#12151d_0%,#07090d_100%)]">
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(#1a1e28 1px, transparent 1px), linear-gradient(90deg, #1a1e28 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="relative w-[640px] h-[360px] rounded-xl border border-line bg-ink-2 shadow-2xl flex flex-col items-center justify-center gap-2"
                >
                  <div className="text-xs text-muted font-mono uppercase tracking-widest">
                    Composition Preview
                  </div>
                  <div className="text-2xl font-bold tracking-tight">1920 × 1080</div>
                  <div className="text-xs text-muted">30 fps · {duration}s · 16:9</div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-muted font-mono">
                    <span>Zoom {Math.round(zoom * 100)}%</span>
                    <span>Frame {Math.round(playhead * 30)}</span>
                  </div>
                </motion.div>
              </div>
            </div>
          )}
          {activeTab === 'nodes' && (
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Node Graph</h3>
                <p className="text-xs text-muted">
                  Structure your motion visuals as a node tree. Connect data → transform → render.
                </p>
              </div>
              <svg
                className="w-full max-w-[900px]"
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
          {activeTab === 'timeline' && (
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setPlaying(!playing)}
                  className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium"
                >
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  type="button"
                  onClick={() => setPlayhead(0)}
                  className="px-3 py-1.5 rounded-md bg-white/5 text-xs font-medium hover:bg-white/10"
                >
                  ⏹ Stop
                </button>
                <span className="text-xs text-muted font-mono">
                  {playhead.toFixed(2)}s / {duration.toFixed(2)}s
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={playhead}
                  onChange={(e) => setPlayhead(Number(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs text-muted font-mono">30fps · 1920×1080</span>
              </div>
              <div className="space-y-1">
                {['Video', 'Audio', 'Captions', 'Effects', 'Transitions'].map((track) => (
                  <div key={track} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-medium text-muted">{track}</div>
                    <div className="flex-1 relative h-8 rounded bg-ink-2 border border-line overflow-hidden">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent/80"
                        style={{ left: '8%' }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-cool/80"
                        style={{ left: '35%' }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent-2/80"
                        style={{ left: '68%' }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-sm bg-white/60 rotate-45"
                        style={{ left: '90%' }}
                      />
                    </div>
                  </div>
                ))}
                <div className="relative h-1 mt-1">
                  <div
                    className="absolute top-0 h-full w-0.5 bg-accent"
                    style={{ left: `${(playhead / duration) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {activeTab === 'ai' && (
            <div className="flex-1 overflow-auto p-6">
              <h3 className="text-lg font-semibold mb-4">AI & Next-Level Visual Effects</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    icon: '✂',
                    name: 'Object Matte',
                    desc: 'AI subject isolation & tracking masks (Roto Brush successor)',
                  },
                  {
                    icon: '⟳',
                    name: 'Generative Extend',
                    desc: 'Extend clip duration with AI-generated frames',
                  },
                  {
                    icon: '⊘',
                    name: 'Unmult',
                    desc: 'Remove black/white matted backgrounds (fire, smoke, UI)',
                  },
                  { icon: '≋', name: 'Curl Noise', desc: 'Procedural fluid dynamics & particles' },
                ].map((t) => (
                  <motion.div
                    key={t.name}
                    whileHover={{ y: -2 }}
                    className="p-4 rounded-xl border border-line bg-ink-2 hover:border-accent/40 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted mt-1">{t.desc}</div>
                    <button
                      type="button"
                      className="mt-3 px-3 py-1 text-xs font-medium rounded-md bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                    >
                      Run
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'threed' && (
            <div className="flex-1 overflow-auto p-6">
              <h3 className="text-lg font-semibold mb-4">Native 3D Design</h3>
              <div className="relative h-64 rounded-xl border border-line bg-ink-2 overflow-hidden mb-4">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(#1a1e28 1px, transparent 1px), linear-gradient(90deg, #1a1e28 1px, transparent 1px)',
                    backgroundSize: '30px 30px',
                    transform: 'perspective(400px) rotateX(60deg)',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-xs text-muted font-mono uppercase tracking-widest">
                    3D Viewport (GPU-accelerated)
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Mesh', 'Parametric Cube'],
                  ['Material', 'Substance 3D (1,300+)'],
                  ['Aperture', '2.8'],
                  ['Focus Distance', '5.0m'],
                  ['Blur', '0.4'],
                  ['Shadow Catcher', 'On'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between px-3 py-2 rounded-md bg-ink-2 border border-line text-xs"
                  >
                    <span className="text-muted">{k}</span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="w-72 border-l border-line bg-ink-2 flex flex-col shrink-0 overflow-hidden">
          <div className="flex border-b border-line">
            {(['properties', 'effects', 'fonts', 'transitions', 'threed'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRightTab(t)}
                className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${rightTab === t ? 'text-text border-b-2 border-accent' : 'text-muted hover:text-text'}`}
              >
                {t === 'threed' ? '3D' : t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {rightTab === 'properties' &&
              (selectedMode ? (
                <>
                  <div className="text-sm font-semibold">{selectedMode.name}</div>
                  <p className="text-xs text-muted mt-1">{selectedMode.description}</p>
                  <div className="mt-3 space-y-1.5">
                    {[
                      ['Mode', selectedMode.id],
                      ['Mood', selectedMode.mood],
                      ['Pace', selectedMode.pace],
                      ['Duration', `${selectedMode.duration}s`],
                      ['Voice', selectedMode.voice],
                      ['3D', selectedMode.requires3d ? 'yes' : 'no'],
                      ['VFX', selectedMode.requiresVfx ? 'yes' : 'no'],
                      ['Formats', selectedMode.formats.join(', ')],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between text-xs py-1 border-b border-line/50"
                      >
                        <span className="text-muted">{k}</span>
                        <span className="font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted">Select a mode to inspect.</p>
              ))}
            {rightTab === 'effects' && (
              <>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  Effects Stack
                </div>
                <div className="space-y-1">
                  {effects.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedEffect(e.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedEffect === e.id ? 'bg-accent/10 border border-accent/30' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      <div className="text-xs font-medium">{e.name}</div>
                      <div className="text-[10px] text-muted">{e.category}</div>
                    </button>
                  ))}
                </div>
                {selectedEffect && (
                  <div className="mt-3">
                    <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                      Parameters
                    </div>
                    <div className="space-y-1">
                      {Object.entries(
                        effects.find((e) => e.id === selectedEffect)?.parameters ?? {},
                      ).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex justify-between text-xs py-1 border-b border-line/50"
                        >
                          <span className="text-muted">{k}</span>
                          <span className="font-mono">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {rightTab === 'fonts' && (
              <>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  Typography Presets
                </div>
                <div className="space-y-1">
                  {typography.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPreset(p.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md transition-all ${selectedPreset === p.id ? 'bg-accent/10 border border-accent/30' : 'hover:bg-white/5 border border-transparent'}`}
                    >
                      <div
                        className="text-xs font-medium"
                        style={{
                          fontFamily: p.fontFamily,
                          fontWeight: p.fontWeight,
                          color: p.color,
                        }}
                      >
                        {p.name}
                      </div>
                      <div className="text-[10px] text-muted">
                        {p.animation} · {p.animationDuration}s · stagger {p.stagger}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                    Variable Font Axes
                  </div>
                  <div className="space-y-1">
                    {[
                      ['Weight', '100–900'],
                      ['Slant', '-15° to 0°'],
                      ['Width', '75–125'],
                      ['Wiggle', '0–1'],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between text-xs py-1 border-b border-line/50"
                      >
                        <span className="text-muted">{k}</span>
                        <span className="font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {rightTab === 'transitions' && (
              <>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  Transitions
                </div>
                <div className="space-y-1">
                  {effects
                    .filter((e) => e.category === 'TRANSITION')
                    .map((e) => (
                      <div
                        key={e.id}
                        className="px-2.5 py-2 rounded-md hover:bg-white/5 cursor-pointer"
                      >
                        <div className="text-xs font-medium">{e.name}</div>
                        <div className="text-[10px] text-muted font-mono">
                          {JSON.stringify(e.parameters)}
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-4 p-2.5 rounded-md bg-white/5 text-xs text-muted">
                  <strong className="text-text">Quick Offset:</strong> Hold Ctrl+Alt / Cmd+Opt and
                  drag to stagger layers & keyframes.
                </div>
              </>
            )}
            {rightTab === 'threed' && (
              <>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  3D Properties
                </div>
                <div className="space-y-1">
                  {[
                    ['Mesh', 'Parametric Cube'],
                    ['Material', 'Substance 3D (1,300+)'],
                    ['Aperture', '2.8'],
                    ['Focus Distance', '5.0m'],
                    ['Blur', '0.4'],
                    ['Shadow Catcher', 'On'],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between text-xs py-1 border-b border-line/50"
                    >
                      <span className="text-muted">{k}</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ── Timeline (full width, bottom) ── */}
      <div className="h-44 border-t border-line bg-ink-2 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 h-9 border-b border-line shrink-0">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="px-2.5 py-1 rounded bg-accent text-white text-xs font-medium"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={() => setPlayhead(0)}
            className="px-2.5 py-1 rounded bg-white/5 text-xs font-medium hover:bg-white/10"
          >
            ⏹
          </button>
          <span className="text-xs text-muted font-mono ml-1">
            {playhead.toFixed(2)}s / {duration.toFixed(2)}s
          </span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={playhead}
            onChange={(e) => setPlayhead(Number(e.target.value))}
            className="flex-1 accent-accent h-1"
          />
          <span className="text-xs text-muted font-mono">30fps · 1920×1080</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {['Video', 'Audio', 'Captions', 'Effects', 'Transitions'].map((track) => (
            <div key={track} className="flex items-center gap-3 h-7">
              <div className="w-24 text-xs font-medium text-muted shrink-0">{track}</div>
              <div className="flex-1 relative h-6 rounded bg-ink border border-line overflow-hidden">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent/80"
                  style={{ left: '8%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cool/80"
                  style={{ left: '35%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent-2/80"
                  style={{ left: '68%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-sm bg-white/60 rotate-45"
                  style={{ left: '90%' }}
                />
              </div>
            </div>
          ))}
          <div className="relative h-1">
            <div
              className="absolute top-0 h-full w-0.5 bg-accent"
              style={{ left: `${(playhead / duration) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom Panel: Concept Generation ── */}
      <div className="border-t border-line bg-ink-2 p-4 shrink-0 max-h-72 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Generate Concepts</h3>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          <select
            value={brief.service}
            onChange={(e) => setBrief({ ...brief, service: e.target.value })}
            className="px-2.5 py-1.5 rounded-md bg-ink border border-line text-xs"
          >
            <option value="branding">Branding</option>
            <option value="signage">Signage</option>
            <option value="large-format-printing">Large Format</option>
            <option value="digital-printing">Digital Printing</option>
          </select>
          <input
            value={brief.objective}
            onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
            placeholder="Objective"
            className="px-2.5 py-1.5 rounded-md bg-ink border border-line text-xs flex-1 min-w-[200px]"
          />
          <input
            value={brief.audience}
            onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
            placeholder="Audience"
            className="px-2.5 py-1.5 rounded-md bg-ink border border-line text-xs flex-1 min-w-[140px]"
          />
          <input
            value={brief.emotional_objective}
            onChange={(e) => setBrief({ ...brief, emotional_objective: e.target.value })}
            placeholder="Emotional objective"
            className="px-2.5 py-1.5 rounded-md bg-ink border border-line text-xs flex-1 min-w-[140px]"
          />
          <button
            type="button"
            className="px-4 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {genError && <div className="text-xs text-red-400 mb-2">{genError}</div>}
        {generated.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {generated.map((c) => {
              const s = scoreOf(c);
              return (
                <div
                  key={c.title}
                  className="shrink-0 w-72 p-3 rounded-lg bg-ink border border-line"
                >
                  <div className="flex items-start gap-3">
                    <ScoreRing value={s} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold truncate">{c.title}</h4>
                      <p className="text-[10px] text-muted mt-1 line-clamp-2">{c.logline}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {c.territory && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cool/10 text-cool">
                            {c.territory}
                          </span>
                        )}
                        {c.mood && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-muted">
                            {c.mood}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Panel: Creative Modes ── */}
      <div className="border-t border-line bg-ink-2 p-4 shrink-0 max-h-64 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Creative Modes</h3>
          <span className="text-xs text-muted font-mono">{modes.length} modes</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMode(m)}
              className={`p-2.5 rounded-lg border text-left transition-all ${selectedMode?.id === m.id ? 'border-accent/50 bg-accent/5' : 'border-line hover:border-white/20 bg-ink'}`}
            >
              <div className="text-xs font-medium truncate">{m.name}</div>
              <div className="text-[10px] text-muted mt-0.5 truncate">
                {m.mood} · {m.pace} · {m.duration}s
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function _Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-white/5 border border-line">
      <div className="text-lg font-bold tracking-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">{label}</div>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label="Score ring">
      <title>Score</title>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#232836" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="#ff5a2c"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text
        x="22"
        y="26"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#e8eaef"
        fontFamily="ui-monospace, monospace"
      >
        {(value * 100).toFixed(0)}
      </text>
    </svg>
  );
}
