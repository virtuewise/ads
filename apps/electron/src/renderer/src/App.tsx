import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { BrandLUTPanel } from './components/BrandLUTPanel';
import { ExportPanel } from './components/ExportPanel';
import { GenrePanel, GenreSelector } from './components/GenreSelector';
import { NodeEditor } from './components/NodeEditor';
import { SafeZoneControls, SafeZones } from './components/SafeZones';
import { ScriptEditor } from './components/ScriptEditor';
import { Timeline } from './components/Timeline';
import { Toolbar } from './components/Toolbar';
import { WebGPUCanvas } from './components/WebGPUCanvas';
import type { GenreId, SafeZoneRatio } from './engine/types';
import { useDAG } from './engine/useDAG';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

const _Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
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
  const [activeTab, setActiveTab] = useState<'canvas' | 'nodes' | 'timeline' | 'ai' | 'threed'>(
    'canvas',
  );
  const [selectedMode, setSelectedMode] = useState<CreativeMode | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [_playhead, _setPlayhead] = useState(0);
  const [_playing, _setPlaying] = useState(false);
  const [_zoom, _setZoom] = useState(1);
  const [leftTab, setLeftTab] = useState<'assets' | 'layers' | 'templates' | 'ai'>('assets');
  const [rightTab, setRightTab] = useState<
    'properties' | 'effects' | 'fonts' | 'transitions' | 'threed' | 'code' | 'export' | 'brand'
  >('properties');
  const [quickApply, setQuickApply] = useState('');
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [selectedTool, setSelectedTool] = useState('select');
  const _duration = 5;

  // Genre-aware editing
  const [genre, setGenre] = useState<GenreId>('corporate');
  const [safeZonesActive, setSafeZonesActive] = useState(false);
  const [safeZoneRatio, setSafeZoneRatio] = useState<SafeZoneRatio>('16:9');
  const [brandLUT, setBrandLUT] = useState('none');

  // DAG engine
  const dag = useDAG();

  const _territories = Array.from(new Set(modes.flatMap((m) => m.territories)));

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
        <nav className="menubar__tabs">
          {(['canvas', 'nodes', 'timeline', 'ai', 'threed'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`menubar__tab ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'threed' ? '3D' : t.charAt(0).toUpperCase() + t.slice(1)}
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
            <span>Quick Apply</span>
            <kbd>⌘K</kbd>
          </button>
        </div>
      </header>

      {/* ── Genre Selector ── */}
      <div className="border-b border-line bg-ink-2">
        <GenreSelector active={genre} onChange={setGenre} />
      </div>

      {/* ── Quick Apply Palette ── */}
      <AnimatePresence>
        {showQuickApply && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                className="w-full px-4 py-3 bg-transparent border-b border-line text-sm outline-none placeholder:text-muted"
              />
              <ul className="qa-list">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Workspace ── */}
      <div className="workspace">
        <Toolbar active={selectedTool} onChange={setSelectedTool} />

        <aside className="rail--left-panel">
          <div className="rail--left-panel__tabs">
            {(['assets', 'layers', 'templates', 'ai'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={leftTab === t ? 'active' : ''}
                onClick={() => setLeftTab(t)}
              >
                {t[0].toUpperCase()}
              </button>
            ))}
          </div>
          <div className="rail--left-panel__body">
            <GenrePanel active={genre} />
            {leftTab === 'assets' && (
              <>
                <div className="rail__section">
                  <div className="rail__section-title">Visual Grammars</div>
                  {grammars.map((g) => (
                    <button key={g.name} type="button" className="rail__item" onClick={() => {}}>
                      <span className="rail__item-title">{g.name}</span>
                      <span className="rail__item-sub">{g.sequence.length} beats</span>
                    </button>
                  ))}
                </div>
                <div className="rail__section">
                  <div className="rail__section-title">Territories</div>
                  <div className="chip-row">
                    {Array.from(new Set(modes.flatMap((m) => m.territories))).map((t) => (
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
                        {i < 3 ? 'txt' : i === 3 ? 'img' : i === 4 ? 'fx' : 'aud'}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="h-9 flex items-center gap-1 px-3 border-b border-line bg-ink-2 shrink-0">
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
            <button
              type="button"
              className={`px-3 h-7 rounded text-xs font-medium transition-all ${activeTab === 'ai' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setActiveTab('ai')}
            >
              AI
            </button>
            <button
              type="button"
              className={`px-3 h-7 rounded text-xs font-medium transition-all ${activeTab === 'threed' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setActiveTab('threed')}
            >
              3D
            </button>
          </div>

          {activeTab === 'canvas' && (
            <div className="flex-1 relative overflow-hidden">
              <WebGPUCanvas />
              <SafeZones
                active={safeZonesActive}
                ratio={safeZoneRatio}
                onToggle={() => setSafeZonesActive(!safeZonesActive)}
                onRatioChange={setSafeZoneRatio}
              />
              <div className="absolute top-2 right-2">
                <SafeZoneControls
                  active={safeZonesActive}
                  ratio={safeZoneRatio}
                  onToggle={() => setSafeZonesActive(!safeZonesActive)}
                  onRatioChange={setSafeZoneRatio}
                />
              </div>
            </div>
          )}
          {activeTab === 'nodes' && (
            <div className="flex-1 overflow-hidden">
              <NodeEditor
                dag={dag.dag}
                selectedNode={dag.selectedNode}
                onSelectNode={dag.setSelectedNode}
                onAddNode={dag.addNode}
                onRemoveNode={dag.removeNode}
                onUpdateNode={dag.updateNode}
                onAddEdge={dag.addEdge}
                onRemoveEdge={dag.removeEdge}
              />
            </div>
          )}
          {activeTab === 'timeline' && (
            <div className="flex-1 overflow-hidden">
              <Timeline />
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
                  <div
                    key={t.name}
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
                  </div>
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
                    transform: 'perspective(400px) rotateX(50deg)',
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
            {(
              [
                'properties',
                'effects',
                'fonts',
                'transitions',
                'threed',
                'code',
                'export',
                'brand',
              ] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRightTab(t)}
                className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-semibold transition-colors ${rightTab === t ? 'text-text border-b-2 border-accent' : 'text-muted hover:text-text'}`}
              >
                {t === 'threed'
                  ? '3D'
                  : t === 'code'
                    ? 'Code'
                    : t === 'export'
                      ? 'Export'
                      : t === 'brand'
                        ? 'LUT'
                        : t}
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
            {rightTab === 'code' && (
              <div className="h-full">
                <ScriptEditor
                  code={dag.code}
                  onSync={dag.syncFromCode}
                  compiledWGSL={dag.compiled.wgsl}
                />
              </div>
            )}
            {rightTab === 'export' && <ExportPanel />}
            {rightTab === 'brand' && <BrandLUTPanel active={brandLUT} onChange={setBrandLUT} />}
          </div>
        </aside>
      </div>

      {/* ── Timeline (full width, bottom) ── */}
      <Timeline />

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
