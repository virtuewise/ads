import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandLUTPanel } from './components/BrandLUTPanel';
import { ExportPanel } from './components/ExportPanel';
import { GenrePanel, GenreSelector } from './components/GenreSelector';
import { Icon, type IconName } from './components/Icon';
import { NodeEditor } from './components/NodeEditor';
import { SafeZoneControls, SafeZones } from './components/SafeZones';
import { ScriptEditor } from './components/ScriptEditor';
import { WebGPUCanvas } from './components/WebGPUCanvas';
import type { GenreId, SafeZoneRatio } from './engine/types';
import { useDAG } from './engine/useDAG';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { useEngineData } from './hooks/useEngineData';

const DURATION = 12;
const FPS = 30;
const RULER_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const fmtTC = (seconds: number): string => {
  const total = Math.max(0, seconds);
  const mm = Math.floor(total / 60);
  const ss = Math.floor(total % 60);
  const ff = Math.floor((total % 1) * FPS);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
};

// ── Menu definitions ─────────────────────────────────────────────────────────
interface MenuSep {
  sep: true;
  id: string;
}
interface MenuItemDef {
  sep?: false;
  id: string;
  label: string;
  hint?: string;
}
type MenuEntry = MenuSep | MenuItemDef;

const MENUS: Array<{ label: string; items: MenuEntry[] }> = [
  {
    label: 'File',
    items: [
      { id: 'new', label: 'New Project', hint: 'Ctrl+N' },
      { id: 'open', label: 'Open Project…', hint: 'Ctrl+O' },
      { id: 'import', label: 'Import Media…', hint: 'Ctrl+I' },
      { id: 'sep1', sep: true },
      { id: 'save', label: 'Save', hint: 'Ctrl+S' },
      { id: 'saveas', label: 'Save As…', hint: 'Ctrl+Shift+S' },
      { id: 'sep2', sep: true },
      { id: 'export', label: 'Export…', hint: 'Ctrl+E' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo', hint: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', hint: 'Ctrl+Y' },
      { id: 'sep1', sep: true },
      { id: 'cut', label: 'Cut', hint: 'Ctrl+X' },
      { id: 'copy', label: 'Copy', hint: 'Ctrl+C' },
      { id: 'paste', label: 'Paste', hint: 'Ctrl+V' },
      { id: 'del', label: 'Delete', hint: 'Del' },
      { id: 'sep2', sep: true },
      { id: 'prefs', label: 'Preferences…', hint: 'Ctrl+,' },
    ],
  },
  {
    label: 'Composition',
    items: [
      { id: 'newc', label: 'New Composition', hint: 'Ctrl+N' },
      { id: 'settings', label: 'Composition Settings…', hint: 'Ctrl+K' },
      { id: 'queue', label: 'Add to Render Queue', hint: 'Ctrl+M' },
    ],
  },
  {
    label: 'Layer',
    items: [
      { id: 'lt', label: 'New Text Layer', hint: 'Ctrl+T' },
      { id: 'ls', label: 'New Shape Layer', hint: 'Ctrl+Y' },
      { id: 'ln', label: 'New Null Object' },
      { id: 'lc', label: 'New Camera' },
      { id: 'sep1', sep: true },
      { id: 'pre', label: 'Pre-compose…', hint: 'Ctrl+Shift+C' },
    ],
  },
  {
    label: 'Effect',
    items: [
      { id: 'browse', label: 'Browse Effects…' },
      { id: 'remove', label: 'Remove All Effects' },
    ],
  },
  {
    label: 'Animation',
    items: [
      { id: 'kf', label: 'Add Keyframe', hint: 'S' },
      { id: 'graph', label: 'Graph Editor', hint: 'G' },
      { id: 'ease', label: 'Easy Ease', hint: 'F9' },
    ],
  },
  {
    label: 'View',
    items: [
      { id: 'zi', label: 'Zoom In', hint: '+' },
      { id: 'zo', label: 'Zoom Out', hint: '-' },
      { id: 'fit', label: 'Fit to Screen', hint: 'Shift+1' },
      { id: 'sep1', sep: true },
      { id: 'sz', label: 'Toggle Safe Zones', hint: 'Ctrl+;' },
    ],
  },
  {
    label: 'Window',
    items: [
      { id: 'tl', label: 'Timeline', hint: 'Ctrl+4' },
      { id: 'ins', label: 'Inspector', hint: 'Ctrl+5' },
      { id: 'ng', label: 'Node Graph', hint: 'Ctrl+6' },
    ],
  },
  {
    label: 'Help',
    items: [
      { id: 'keys', label: 'Keyboard Shortcuts', hint: '?' },
      { id: 'about', label: 'About Virtue Studio' },
    ],
  },
];

const TOOLS: Array<{ id: string; icon: IconName; label: string; key: string }> = [
  { id: 'select', icon: 'pointer', label: 'Select', key: 'V' },
  { id: 'move', icon: 'move', label: 'Move', key: 'W' },
  { id: 'text', icon: 'text', label: 'Text', key: 'T' },
  { id: 'shape', icon: 'square', label: 'Shape', key: 'U' },
  { id: 'pen', icon: 'pen', label: 'Pen', key: 'P' },
  { id: 'hand', icon: 'hand', label: 'Hand', key: 'H' },
  { id: 'zoom', icon: 'zoom', label: 'Zoom', key: 'Z' },
];

const LEFT_TABS: Array<{ id: string; icon: IconName; label: string }> = [
  { id: 'project', icon: 'folder', label: 'Project' },
  { id: 'effects', icon: 'wand', label: 'Effects' },
  { id: 'text', icon: 'text', label: 'Text' },
  { id: 'modes', icon: 'layers', label: 'Modes' },
  { id: 'ai', icon: 'sparkle', label: 'AI' },
];

const INS_TABS: Array<{ id: string; icon: IconName; label: string }> = [
  { id: 'props', icon: 'sliders', label: 'Props' },
  { id: 'fx', icon: 'zap', label: 'FX' },
  { id: 'color', icon: 'palette', label: 'Color' },
  { id: 'export', icon: 'download', label: 'Export' },
];

const STAGE_TABS: Array<{ id: 'comp' | 'nodes' | 'script'; icon: IconName; label: string }> = [
  { id: 'comp', icon: 'monitor', label: 'Compositing' },
  { id: 'nodes', icon: 'nodes', label: 'Node Graph' },
  { id: 'script', icon: 'code', label: 'Script' },
];

const FX_ICONS: Record<string, IconName> = {
  GLOW: 'zap',
  BLUR: 'wind',
  COLOR: 'palette',
  TRANSITION: 'shuffle',
  DISTORT: 'droplet',
  STYLIZE: 'wand',
};
const fxIcon = (category: string): IconName => FX_ICONS[category] ?? 'sparkle';

const AI_TOOLS: Array<{ icon: IconName; name: string; desc: string }> = [
  { icon: 'scissors', name: 'Object Matte', desc: 'AI subject isolation & tracking masks' },
  { icon: 'refresh', name: 'Generative Extend', desc: 'Extend clip duration with AI frames' },
  { icon: 'contrast', name: 'Unmult', desc: 'Remove black/white matted backgrounds' },
  { icon: 'wind', name: 'Curl Noise', desc: 'Procedural fluid dynamics & particles' },
];

const TEMPLATES = [
  {
    name: 'Case File Reveal',
    desc: 'Suspenseful investigative flow',
    bg: 'linear-gradient(135deg,#1a1a2e,#16213e)',
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
  {
    name: 'Interrogation Room',
    desc: 'Dramatic single-subject interview',
    bg: 'linear-gradient(135deg,#2c3e50,#4ca1af)',
  },
];

type TrackState = Record<string, { visible: boolean; locked: boolean }>;
const DEFAULT_TRACK_STATE: TrackState = {
  video: { visible: true, locked: false },
  audio: { visible: true, locked: false },
  captions: { visible: true, locked: false },
  effects: { visible: true, locked: false },
  transitions: { visible: true, locked: false },
};

export function App() {
  const { modes, typography, effects, grammars, stats } = useEngineData();

  // ── Shell state ───────────────────────────────────────────────────────────
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<'comp' | 'nodes' | 'script'>('comp');
  const [tool, setTool] = useState('select');
  const [leftTab, setLeftTab] = useState('project');
  const [insTab, setInsTab] = useState('props');
  const [snap, setSnap] = useState(true);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedMode, setSelectedMode] = useState<CreativeMode | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [fxQuery, setFxQuery] = useState('');

  // ── Playback ──────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(1.6);
  const [stageZoom, setStageZoom] = useState(1);
  const [tlZoom, setTlZoom] = useState(1);
  const [trackState, setTrackState] = useState<TrackState>(DEFAULT_TRACK_STATE);

  // ── Quick Apply ───────────────────────────────────────────────────────────
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [quickApply, setQuickApply] = useState('');

  // ── Genre-aware editing ───────────────────────────────────────────────────
  const [genre, setGenre] = useState<GenreId>('corporate');
  const [safeZonesActive, setSafeZonesActive] = useState(false);
  const [safeZoneRatio, setSafeZoneRatio] = useState<SafeZoneRatio>('16:9');
  const [brandLUT, setBrandLUT] = useState('none');

  // ── Concept generation (engine-driven) ────────────────────────────────────
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

  // ── DAG engine ────────────────────────────────────────────────────────────
  const dag = useDAG();

  const territories = useMemo(
    () => Array.from(new Set(modes.flatMap((m) => m.territories))),
    [modes],
  );

  const filteredEffects = useMemo(
    () =>
      effects.filter((e) => fxQuery === '' || e.name.toLowerCase().includes(fxQuery.toLowerCase())),
    [effects, fxQuery],
  );

  // ── Timeline tracks (clips driven by engine data) ─────────────────────────
  const tracks = useMemo(() => {
    const capClips =
      typography.length > 0
        ? typography.slice(0, 2).map((p, i) => ({
            start: i === 0 ? 0.8 : 7,
            end: i === 0 ? 4.2 : 10.5,
            name: p.name,
          }))
        : [
            { start: 0.8, end: 4.2, name: 'Opening Title' },
            { start: 7, end: 10.5, name: 'Closing Tagline' },
          ];
    const fxClips =
      effects.length > 0
        ? effects.slice(0, 3).map((e, i) => ({
            start: 0.5 + i * 4,
            end: 3.3 + i * 4,
            name: e.name,
          }))
        : [
            { start: 0.5, end: 3.3, name: 'Glow' },
            { start: 4.5, end: 7.3, name: 'Chromatic Blur' },
          ];
    return [
      {
        id: 'video',
        name: 'Video',
        icon: 'film' as IconName,
        color: '#ff5a2c',
        clips: [
          { start: 0, end: 6.4, name: 'Main Comp' },
          { start: 6.9, end: DURATION, name: 'B-Roll 02' },
        ],
      },
      {
        id: 'audio',
        name: 'Audio',
        icon: 'music' as IconName,
        color: '#5eead4',
        clips: [{ start: 0, end: DURATION, name: 'Score: Main Theme' }],
      },
      {
        id: 'captions',
        name: 'Captions',
        icon: 'captions' as IconName,
        color: '#ffb347',
        clips: capClips,
      },
      {
        id: 'effects',
        name: 'Effects',
        icon: 'wand' as IconName,
        color: '#a78bfa',
        clips: fxClips,
      },
      {
        id: 'transitions',
        name: 'Transitions',
        icon: 'shuffle' as IconName,
        color: '#f472b6',
        clips: [{ start: 6.3, end: 7, name: 'Cross Dissolve' }],
      },
    ];
  }, [typography, effects]);

  // ── Playback loop (rAF) ───────────────────────────────────────────────────
  const rafRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPlayhead((p) => (p + dt) % DURATION);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickApply((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setShowQuickApply(false);
        setOpenMenu(null);
        return;
      }
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const keymap: Record<string, string> = {
        v: 'select',
        w: 'move',
        t: 'text',
        u: 'shape',
        p: 'pen',
        h: 'hand',
        z: 'zoom',
      };
      const nextTool = keymap[e.key.toLowerCase()];
      if (nextTool) setTool(nextTool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const runMenuAction = (label: string) => {
    setOpenMenu(null);
    if (label === 'Export…') {
      setInsTab('export');
      setActiveStage('comp');
    } else if (label === 'Toggle Safe Zones') {
      setSafeZonesActive((v) => !v);
    } else if (label === 'Node Graph') {
      setActiveStage('nodes');
    } else if (label === 'Browse Effects…') {
      setLeftTab('effects');
    } else if (label === 'New Text Layer') {
      setTool('text');
    }
  };

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

  const quickApplyItems = useMemo(
    () =>
      [
        ...effects.map((e) => ({ kind: 'Effect', name: e.name, id: e.id })),
        ...typography.map((p) => ({ kind: 'Font', name: p.name, id: p.id })),
        ...modes.map((m) => ({ kind: 'Mode', name: m.name, id: m.id })),
        ...grammars.map((g) => ({ kind: 'Grammar', name: g.name, id: g.name })),
      ].filter((x) => quickApply === '' || x.name.toLowerCase().includes(quickApply.toLowerCase())),
    [effects, typography, modes, grammars, quickApply],
  );

  const applyQAItem = (x: { kind: string; name: string; id: string }) => {
    setShowQuickApply(false);
    setQuickApply('');
    if (x.kind === 'Effect') {
      setSelectedEffect(x.id);
      setInsTab('fx');
    } else if (x.kind === 'Mode') {
      setSelectedMode(modes.find((m) => m.id === x.id) ?? null);
      setInsTab('props');
    } else if (x.kind === 'Font') {
      setSelectedPreset(x.id);
      setLeftTab('text');
    } else {
      setLeftTab('project');
    }
  };

  const toggleTrack = (id: string, key: 'visible' | 'locked') => {
    setTrackState((s) => {
      const cur = s[id] ?? { visible: true, locked: false };
      return { ...s, [id]: { ...cur, [key]: !cur[key] } };
    });
  };

  const activeTool = TOOLS.find((t) => t.id === tool);

  return (
    <div className="app">
      <div className="noise" aria-hidden="true" />

      {/* ── Menu bar ──────────────────────────────────────────────────── */}
      <header className="menubar">
        <div className="menubar__brand">
          <span className="menubar__logo">V</span>
          <span className="menubar__name">Virtue Studio</span>
        </div>
        <nav aria-label="Main menu" className="flex items-center gap-0.5">
          {MENUS.map((menu) => (
            <div key={menu.label} className="menubar__menu">
              <button
                type="button"
                className="menubar__btn"
                aria-expanded={openMenu === menu.label}
                onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              >
                {menu.label}
              </button>
              {openMenu === menu.label && (
                <div className="dropdown">
                  {menu.items.map((it) =>
                    it.sep === true ? (
                      <div key={it.id} className="dropdown__sep" />
                    ) : (
                      <button
                        key={it.id}
                        type="button"
                        className="dropdown__item"
                        onClick={() => runMenuAction(it.label)}
                      >
                        {it.label}
                        {it.hint && <kbd>{it.hint}</kbd>}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="menubar__center">
          <strong>Untitled Composition</strong>
          <span>1920 × 1080 · 30 fps · {fmtTC(playhead)}</span>
        </div>
        <div className="menubar__right">
          {stats && (
            <span className="chip">
              {stats.modeCount} modes · {stats.territoryCount} territories
            </span>
          )}
          <button
            type="button"
            className="iconbtn"
            onClick={() => setShowQuickApply(true)}
            title="Quick Apply"
          >
            <Icon name="search" size={13} />
            Quick Apply
            <kbd className="kbd">Ctrl K</kbd>
          </button>
          <button
            type="button"
            className="iconbtn iconbtn--primary"
            onClick={() => setInsTab('export')}
          >
            <Icon name="download" size={13} />
            Export
          </button>
          <button type="button" className="iconbtn" title="Settings" aria-label="Settings">
            <Icon name="settings" size={14} />
          </button>
        </div>
      </header>
      {openMenu && (
        <button
          type="button"
          className="fixed inset-0 z-50 cursor-default"
          aria-label="Close menu"
          onClick={() => setOpenMenu(null)}
        />
      )}

      {/* ── Context toolbar ───────────────────────────────────────────── */}
      <div className="ctxbar">
        <div className="ctxbar__group">
          <span className="ctxbar__label">Tool</span>
          {activeTool && (
            <span className="chip chip--accent">
              <Icon name={activeTool.icon} size={12} />
              {activeTool.label}
              <kbd className="kbd">{activeTool.key}</kbd>
            </span>
          )}
        </div>
        <span className="ctxbar__sep" aria-hidden="true" />
        <div className="ctxbar__group">
          <button type="button" className="iconbtn" title="Undo (Ctrl+Z)">
            <Icon name="undo" size={14} />
          </button>
          <button type="button" className="iconbtn" title="Redo (Ctrl+Y)">
            <Icon name="redo" size={14} />
          </button>
          <span className="ctxbar__sep" aria-hidden="true" />
          <button type="button" className="iconbtn" title="Split at playhead (S)">
            <Icon name="split" size={14} />
          </button>
          <button type="button" className="iconbtn" title="Duplicate (Ctrl+D)">
            <Icon name="copy" size={14} />
          </button>
          <button type="button" className="iconbtn" title="Delete (Del)">
            <Icon name="trash" size={14} />
          </button>
          <span className="ctxbar__sep" aria-hidden="true" />
          <button
            type="button"
            className={`iconbtn ${snap ? 'iconbtn--active' : ''}`}
            title="Snapping"
            aria-pressed={snap}
            onClick={() => setSnap((s) => !s)}
          >
            <Icon name="magnet" size={14} />
          </button>
          <button type="button" className="iconbtn" title="Add keyframe (S)">
            <Icon name="keyframe" size={14} />
          </button>
        </div>
        <div className="ml-auto ctxbar__group">
          <span className="ctxbar__label">Renderer</span>
          <span className="chip chip--cool">
            <Icon name="zap" size={11} />
            WebGPU
          </span>
          <span className="ctxbar__label">Pipeline</span>
          <span className="chip">DAG → WGSL</span>
        </div>
      </div>

      {/* ── Workspace ──────────────────────────────────────────────────── */}
      <div className="workspace">
        {/* Tool rail */}
        <nav className="rail" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rail__btn ${tool === t.id ? 'rail__btn--active' : ''}`}
              title={`${t.label} (${t.key})`}
              aria-label={t.label}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              <Icon name={t.icon} size={16} />
              <kbd>{t.key}</kbd>
            </button>
          ))}
          <span className="rail__div" aria-hidden="true" />
          <button
            type="button"
            className="rail__btn"
            title="Node Graph"
            aria-label="Node graph"
            onClick={() => setActiveStage('nodes')}
          >
            <Icon name="nodes" size={16} />
          </button>
          <button
            type="button"
            className="rail__btn"
            title="Script"
            aria-label="Script editor"
            onClick={() => setActiveStage('script')}
          >
            <Icon name="code" size={16} />
          </button>
          <div className="mt-auto flex flex-col gap-1">
            <button type="button" className="rail__btn" title="Fit view" aria-label="Fit view">
              <Icon name="maximize" size={16} />
            </button>
            <button type="button" className="rail__btn" title="Settings" aria-label="Settings">
              <Icon name="settings" size={16} />
            </button>
          </div>
        </nav>

        {/* Left panel */}
        <aside className="panel panel--left" aria-label="Project panel">
          <div className="panel__tabs">
            {LEFT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                className={`panel__tab ${leftTab === t.id ? 'panel__tab--active' : ''}`}
                onClick={() => setLeftTab(t.id)}
              >
                <Icon name={t.icon} size={13} />
              </button>
            ))}
          </div>
          <div className="panel__body scroll-thin">
            {leftTab === 'project' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Genre Workflow</span>
                  </div>
                  <GenreSelector active={genre} onChange={setGenre} />
                </div>
                <GenrePanel active={genre} />
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Visual Grammars</span>
                    <span className="sect__meta">{grammars.length}</span>
                  </div>
                  {grammars.map((g) => (
                    <button key={g.name} type="button" className="row">
                      <span className="row__icon">
                        <Icon name="nodes" size={13} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{g.name}</span>
                        <span className="row__sub">{g.sequence.length} beats</span>
                      </span>
                      <Icon name="chevronRight" size={12} />
                    </button>
                  ))}
                  {grammars.length === 0 && <p className="muted">Loading engine data…</p>}
                </div>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Territories</span>
                    <span className="sect__meta">{territories.length}</span>
                  </div>
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

            {leftTab === 'effects' && (
              <>
                <div className="panel__search">
                  <Icon name="search" size={13} />
                  <input
                    placeholder="Search effects…"
                    aria-label="Search effects"
                    value={fxQuery}
                    onChange={(e) => setFxQuery(e.target.value)}
                  />
                </div>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Effect Library</span>
                    <span className="sect__meta">{filteredEffects.length}</span>
                  </div>
                  {filteredEffects.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={`row ${selectedEffect === e.id ? 'row--active' : ''}`}
                      onClick={() => {
                        setSelectedEffect(e.id);
                        setInsTab('fx');
                      }}
                    >
                      <span className="row__icon">
                        <Icon name={fxIcon(e.category)} size={13} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{e.name}</span>
                        <span className="row__sub">{e.compatiblePurposes[0] ?? e.category}</span>
                      </span>
                      <span className="row__tag">{e.category}</span>
                    </button>
                  ))}
                  {filteredEffects.length === 0 && (
                    <p className="muted">No effects match the search.</p>
                  )}
                </div>
              </>
            )}

            {leftTab === 'text' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Typography Presets</span>
                    <span className="sect__meta">{typography.length}</span>
                  </div>
                  {typography.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`row ${selectedPreset === p.id ? 'row--active' : ''}`}
                      onClick={() => setSelectedPreset(p.id)}
                    >
                      <span className="row__icon">
                        <Icon name="text" size={13} />
                      </span>
                      <span className="row__body">
                        <span
                          className="row__title"
                          style={{
                            fontFamily: p.fontFamily,
                            fontWeight: p.fontWeight,
                            color: p.color,
                          }}
                        >
                          {p.name}
                        </span>
                        <span className="row__sub">
                          {p.animation} · {p.animationDuration}s · stagger {p.stagger}
                        </span>
                      </span>
                    </button>
                  ))}
                  {typography.length === 0 && <p className="muted">Loading engine data…</p>}
                </div>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Variable Font Axes</span>
                  </div>
                  {[
                    ['Weight', '100–900'],
                    ['Slant', '-15° to 0°'],
                    ['Width', '75–125'],
                    ['Wiggle', '0–1'],
                  ].map(([k, v]) => (
                    <label key={k} className="field">
                      <span className="field__label">{k}</span>
                      <input className="field__input" defaultValue={v} aria-label={`${k} axis`} />
                    </label>
                  ))}
                </div>
              </>
            )}

            {leftTab === 'modes' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Creative Modes</span>
                    <span className="sect__meta">{modes.length}</span>
                  </div>
                  <div className="cardgrid">
                    {modes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`modecard ${selectedMode?.id === m.id ? 'modecard--active' : ''}`}
                        onClick={() => {
                          setSelectedMode(m);
                          setInsTab('props');
                        }}
                      >
                        <span className="modecard__stripe" style={{ background: '#ff5a2c' }} />
                        <span className="modecard__name">{m.name}</span>
                        <span className="modecard__meta">
                          {m.mood} · {m.pace} · {m.duration}s
                        </span>
                      </button>
                    ))}
                  </div>
                  {modes.length === 0 && <p className="muted">Loading engine data…</p>}
                </div>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Templates</span>
                    <span className="sect__meta">{TEMPLATES.length}</span>
                  </div>
                  <div className="cardgrid">
                    {TEMPLATES.map((t) => (
                      <button key={t.name} type="button" className="tplcard">
                        <span className="tplcard__preview" style={{ background: t.bg }} />
                        <span className="tplcard__meta">
                          <span className="tplcard__name">{t.name}</span>
                          <span className="tplcard__desc">{t.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {leftTab === 'ai' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Generate Concepts</span>
                  </div>
                  <div className="formrow">
                    <label htmlFor="brief-obj">Objective</label>
                    <input
                      id="brief-obj"
                      value={brief.objective}
                      onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
                    />
                  </div>
                  <div className="formrow">
                    <label htmlFor="brief-svc">Service</label>
                    <select
                      id="brief-svc"
                      value={brief.service}
                      onChange={(e) => setBrief({ ...brief, service: e.target.value })}
                    >
                      <option value="branding">Branding</option>
                      <option value="signage">Signage</option>
                      <option value="large-format-printing">Large Format</option>
                      <option value="digital-printing">Digital Printing</option>
                    </select>
                  </div>
                  <div className="formrow">
                    <label htmlFor="brief-aud">Audience</label>
                    <input
                      id="brief-aud"
                      value={brief.audience}
                      onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
                    />
                  </div>
                  <div className="formrow">
                    <label htmlFor="brief-emo">Emotional Goal</label>
                    <input
                      id="brief-emo"
                      value={brief.emotional_objective}
                      onChange={(e) => setBrief({ ...brief, emotional_objective: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary btn--block"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    <Icon name="sparkle" size={13} />
                    {generating ? 'Generating…' : 'Generate Concepts'}
                  </button>
                  {genError && (
                    <div className="err" role="alert">
                      {genError}
                    </div>
                  )}
                </div>
                {generated.length > 0 && (
                  <div className="sect">
                    <div className="sect__head">
                      <span className="sect__title">Concepts</span>
                      <span className="sect__meta">{generated.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {generated.map((c) => {
                        const s = scoreOf(c);
                        return (
                          <div key={c.title} className="conceptcard">
                            <ScoreRing value={s} />
                            <div className="flex-1 min-w-0">
                              <div className="conceptcard__title">{c.title}</div>
                              <div className="conceptcard__log">{c.logline}</div>
                              <div className="chip-row" style={{ marginTop: 6 }}>
                                {c.territory && (
                                  <span className="chip chip--cool">{c.territory}</span>
                                )}
                                {c.mood && <span className="chip">{c.mood}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">AI Tools</span>
                  </div>
                  <div className="cardgrid">
                    {AI_TOOLS.map((t) => (
                      <button key={t.name} type="button" className="card">
                        <span className="card__icon">
                          <Icon name={t.icon} size={14} />
                        </span>
                        <span className="card__title">{t.name}</span>
                        <span className="card__desc">{t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Stage */}
        <div className="stagecol">
          <div className="stagebar">
            {STAGE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`stagetab ${activeStage === t.id ? 'stagetab--active' : ''}`}
                onClick={() => setActiveStage(t.id)}
              >
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
            <div className="flex-1" />
            <div className="seg">
              {[0.5, 1, 1.5].map((z) => (
                <button
                  key={z}
                  type="button"
                  className={`seg__btn ${stageZoom === z ? 'seg__btn--active' : ''}`}
                  onClick={() => setStageZoom(z)}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
            <SafeZoneControls
              active={safeZonesActive}
              ratio={safeZoneRatio}
              onToggle={() => setSafeZonesActive(!safeZonesActive)}
              onRatioChange={setSafeZoneRatio}
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {activeStage === 'comp' && (
              <div className="viewport">
                <div className="viewport__frame" style={{ transform: `scale(${stageZoom})` }}>
                  <WebGPUCanvas />
                  <SafeZones
                    active={safeZonesActive}
                    ratio={safeZoneRatio}
                    onToggle={() => setSafeZonesActive(!safeZonesActive)}
                    onRatioChange={setSafeZoneRatio}
                  />
                </div>
                <div className="viewport__hud">
                  <span className="hud-chip">
                    <Icon name="monitor" size={11} />
                    1920 × 1080
                  </span>
                  <span className="hud-chip">
                    <Icon name="film" size={11} />
                    30 fps
                  </span>
                  <span className="hud-chip">
                    <Icon name="gauge" size={11} />
                    {Math.round(stageZoom * 100)}%
                  </span>
                </div>
                <div className="viewport__tc">
                  {fmtTC(playhead)}
                  <span className="muted"> / {fmtTC(DURATION)}</span>
                </div>
              </div>
            )}
            {activeStage === 'nodes' && (
              <div className="flex-1 min-h-0 overflow-hidden">
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
            {activeStage === 'script' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScriptEditor
                  code={dag.code}
                  onSync={dag.syncFromCode}
                  compiledWGSL={dag.compiled.wgsl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right inspector */}
        <aside className="panel panel--right" aria-label="Inspector">
          <div className="panel__tabs">
            {INS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                className={`panel__tab ${insTab === t.id ? 'panel__tab--active' : ''}`}
                onClick={() => setInsTab(t.id)}
              >
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>
          <div className="panel__body scroll-thin">
            {insTab === 'props' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Composition</span>
                    <span className="sect__meta">Comp 1</span>
                  </div>
                  <label className="field">
                    <span className="field__label">Name</span>
                    <input
                      className="field__input"
                      defaultValue="Untitled Composition"
                      aria-label="Composition name"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Resolution</span>
                    <input
                      className="field__input"
                      defaultValue="1920"
                      aria-label="Width"
                      inputMode="numeric"
                    />
                    <span className="muted">×</span>
                    <input
                      className="field__input"
                      defaultValue="1080"
                      aria-label="Height"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Frame Rate</span>
                    <input className="field__input" defaultValue="30 fps" aria-label="Frame rate" />
                  </label>
                  <label className="field">
                    <span className="field__label">Duration</span>
                    <input
                      className="field__input"
                      defaultValue={`${DURATION}.00 s`}
                      aria-label="Duration"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Background</span>
                    <input
                      className="field__input"
                      defaultValue="#07090D"
                      aria-label="Background color"
                    />
                  </label>
                </div>

                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Transform</span>
                    <span className="sect__meta">px</span>
                  </div>
                  <label className="field">
                    <span className="field__label">Position X</span>
                    <input
                      className="field__input"
                      defaultValue="960.0"
                      aria-label="Position X"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Position Y</span>
                    <input
                      className="field__input"
                      defaultValue="540.0"
                      aria-label="Position Y"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Scale</span>
                    <input
                      className="field__input"
                      defaultValue="100.0 %"
                      aria-label="Scale"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Rotation</span>
                    <input
                      className="field__input"
                      defaultValue="0.0°"
                      aria-label="Rotation"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Opacity</span>
                    <input
                      className="field__input"
                      defaultValue="100 %"
                      aria-label="Opacity"
                      inputMode="decimal"
                    />
                  </label>
                </div>

                {selectedMode && (
                  <div className="sect">
                    <div className="sect__head">
                      <span className="sect__title">Selected Mode</span>
                      <span className="sect__meta">{selectedMode.id}</span>
                    </div>
                    <div className="row" style={{ cursor: 'default' }}>
                      <span className="row__icon">
                        <Icon name="layers" size={13} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{selectedMode.name}</span>
                        <span className="row__sub">{selectedMode.description}</span>
                      </span>
                    </div>
                    <div className="chip-row" style={{ marginTop: 8 }}>
                      <span className="chip chip--accent">{selectedMode.mood}</span>
                      <span className="chip">{selectedMode.pace}</span>
                      <span className="chip chip--cool">{selectedMode.duration}s</span>
                      <span className="chip">{selectedMode.voice}</span>
                      {selectedMode.requires3d && <span className="chip">3D</span>}
                      {selectedMode.requiresVfx && <span className="chip">VFX</span>}
                    </div>
                  </div>
                )}

                {selectedClip && (
                  <div className="sect">
                    <div className="sect__head">
                      <span className="sect__title">Selected Clip</span>
                    </div>
                    <label className="field">
                      <span className="field__label">Layer</span>
                      <input
                        className="field__input"
                        defaultValue={selectedClip}
                        aria-label="Clip name"
                      />
                    </label>
                  </div>
                )}
              </>
            )}

            {insTab === 'fx' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Effects Stack</span>
                    <span className="sect__meta">{effects.length}</span>
                  </div>
                  {effects.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={`row ${selectedEffect === e.id ? 'row--active' : ''}`}
                      onClick={() => setSelectedEffect(e.id)}
                    >
                      <span className="row__icon">
                        <Icon name={fxIcon(e.category)} size={13} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{e.name}</span>
                        <span className="row__sub">{e.category}</span>
                      </span>
                      <Icon name="more" size={13} />
                    </button>
                  ))}
                  {effects.length === 0 && <p className="muted">Loading engine data…</p>}
                </div>
                {selectedEffect && (
                  <div className="sect">
                    <div className="sect__head">
                      <span className="sect__title">Parameters</span>
                    </div>
                    {Object.entries(
                      effects.find((e) => e.id === selectedEffect)?.parameters ?? {},
                    ).map(([k, v]) => (
                      <label key={k} className="field">
                        <span className="field__label">{k}</span>
                        <input className="field__input" defaultValue={String(v)} aria-label={k} />
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            {insTab === 'color' && <BrandLUTPanel active={brandLUT} onChange={setBrandLUT} />}
            {insTab === 'export' && <ExportPanel />}
          </div>
        </aside>
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      <section className="timeline" aria-label="Timeline">
        <div className="timeline__bar">
          <div className="timeline__transport">
            <button
              type="button"
              className="tbtn"
              title="Go to start"
              onClick={() => setPlayhead(0)}
            >
              <Icon name="skipBack" size={15} />
            </button>
            <button
              type="button"
              className="tbtn tbtn--play"
              title={playing ? 'Pause (Space)' : 'Play (Space)'}
              onClick={() => setPlaying((p) => !p)}
            >
              <Icon name={playing ? 'pause' : 'play'} size={15} />
            </button>
            <button
              type="button"
              className="tbtn"
              title="Go to end"
              onClick={() => setPlayhead(DURATION)}
            >
              <Icon name="skipFwd" size={15} />
            </button>
            <button type="button" className="tbtn tbtn--rec" title="Record">
              <Icon name="record" size={13} />
            </button>
          </div>
          <div className="timeline__tc">
            <span className="timeline__tc-time">{fmtTC(playhead)}</span>
            <span className="timeline__tc-dur">/ {fmtTC(DURATION)}</span>
          </div>
          <span className="ctxbar__sep" aria-hidden="true" />
          <span className="ctxbar__label">
            1920×1080 · {FPS} fps · {DURATION}s
          </span>
          <div className="timeline__zoom">
            <Icon name="zoom" size={13} />
            <input
              type="range"
              min={50}
              max={300}
              step={10}
              value={Math.round(tlZoom * 100)}
              onChange={(e) => setTlZoom(Number(e.target.value) / 100)}
              aria-label="Timeline zoom"
            />
            <span className="sect__meta">{Math.round(tlZoom * 100)}%</span>
          </div>
        </div>
        <div className="timeline__scroll">
          <div className="trackhead">
            <div className="trackhead__ruler-spacer">Tracks</div>
            {tracks.map((t) => {
              const st = trackState[t.id] ?? { visible: true, locked: false };
              return (
                <div key={t.id} className="trackhead__row">
                  <span className="trackhead__dot" style={{ background: t.color }} />
                  <span className="trackhead__name">{t.name}</span>
                  <button
                    type="button"
                    className={`trackhead__btn ${st.visible ? 'trackhead__btn--on' : ''}`}
                    title={st.visible ? 'Hide track' : 'Show track'}
                    aria-label={`${st.visible ? 'Hide' : 'Show'} ${t.name} track`}
                    aria-pressed={st.visible}
                    onClick={() => toggleTrack(t.id, 'visible')}
                  >
                    <Icon name={st.visible ? 'eye' : 'eyeOff'} size={12} />
                  </button>
                  <button
                    type="button"
                    className={`trackhead__btn ${st.locked ? 'trackhead__btn--locked' : ''}`}
                    title={st.locked ? 'Unlock track' : 'Lock track'}
                    aria-label={`${st.locked ? 'Unlock' : 'Lock'} ${t.name} track`}
                    aria-pressed={st.locked}
                    onClick={() => toggleTrack(t.id, 'locked')}
                  >
                    <Icon name={st.locked ? 'lock' : 'unlock'} size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="tracks scroll-thin">
            <div className="relative" style={{ width: `${tlZoom * 100}%` }}>
              <button
                type="button"
                className="ruler w-full"
                aria-label="Seek timeline"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  setPlayhead(Math.max(0, Math.min(DURATION, pct * DURATION)));
                }}
              >
                {RULER_TICKS.map((s) => (
                  <span
                    key={s}
                    className="ruler__tick"
                    style={{ left: `${(s / DURATION) * 100}%` }}
                  >
                    0:{String(s).padStart(2, '0')}
                  </span>
                ))}
              </button>
              {tracks.map((t) => {
                const st = trackState[t.id] ?? { visible: true, locked: false };
                return (
                  <div key={t.id} className="lane">
                    {st.visible &&
                      t.clips.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          className="clip"
                          title={c.name}
                          onClick={() => setSelectedClip(c.name)}
                          style={{
                            left: `${(c.start / DURATION) * 100}%`,
                            width: `${((c.end - c.start) / DURATION) * 100}%`,
                            background: `linear-gradient(180deg, ${t.color}55, ${t.color}33)`,
                            borderColor: `${t.color}aa`,
                            opacity: st.locked ? 0.55 : 1,
                          }}
                        >
                          <Icon name={t.icon} size={11} />
                          <span className="clip__name">{c.name}</span>
                        </button>
                      ))}
                  </div>
                );
              })}
              <div className="playhead" style={{ left: `${(playhead / DURATION) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Apply palette ────────────────────────────────────────── */}
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
              <div className="qa-panel__input">
                <Icon name="search" size={15} />
                <input
                  placeholder="Search effects, fonts, modes, grammars…"
                  aria-label="Search commands"
                  value={quickApply}
                  onChange={(e) => setQuickApply(e.target.value)}
                />
                <span className="kbd">Esc</span>
              </div>
              <ul className="qa-list scroll-thin">
                {quickApplyItems.slice(0, 18).map((x) => (
                  <li key={x.kind + x.id}>
                    <button type="button" onClick={() => applyQAItem(x)}>
                      <span className="qa-list__kind">{x.kind}</span>
                      <span>{x.name}</span>
                    </button>
                  </li>
                ))}
                {quickApplyItems.length === 0 && (
                  <li className="muted px-4 py-6 text-center text-xs">No matches</li>
                )}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" role="img" aria-label="Concept score">
      <title>Score</title>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#1b2230" strokeWidth="3" />
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
        fill="#e9ecf3"
        fontFamily="ui-monospace, monospace"
      >
        {(value * 100).toFixed(0)}
      </text>
    </svg>
  );
}
