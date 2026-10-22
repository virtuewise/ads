// biome-ignore-all lint/a11y/noStaticElementInteractions: timeline clips, trim handles and drop targets are pointer-driven editing surfaces.
// biome-ignore-all lint/a11y/useKeyWithClickEvents: pointer-driven timeline affordances mirror keyboard shortcuts handled globally.

import type { ProductionPlan } from '@printsync/common';
import { compilePlan } from '@printsync/creative-graph';
import { AnimatePresence, motion } from 'motion/react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrandLUTPanel } from './components/BrandLUTPanel';
import { ExportPanel } from './components/ExportPanel';
import { GenrePanel, GenreSelector } from './components/GenreSelector';
import { Icon, type IconName } from './components/Icon';
import { MediaThumb } from './components/MediaThumb';
import { NodeEditor } from './components/NodeEditor';
import { SafeZoneControls, SafeZones } from './components/SafeZones';
import { ScopesPanel } from './components/ScopesPanel';
import { ScriptEditor } from './components/ScriptEditor';
import { WebGPUCanvas, type WebGPUCanvasHandle } from './components/WebGPUCanvas';
import { analyseFrame, type FrameStats, gradeToMatch, isMeasurable } from './engine/balance';
import { bridgeDAGToComposite } from './engine/bridge';
import { EASING_LABELS, EASING_ORDER } from './engine/easing';
import { appendEffectNodesToGraph } from './engine/effects';
import { allTemplates, type GenreTemplate, type KeyframePreset } from './engine/genre-workflows';
import type { Command, DocumentStore } from './engine/history';
import {
  canRedo,
  canUndo,
  createDocumentStore,
  dispatch,
  dispatchMerged,
  makeTimelineDragCommand,
  redo,
  replaceDoc,
  undo,
} from './engine/history';
import {
  decodeFrameAt,
  decodeVideoBuffer,
  disposeMediaSource,
  type MediaSource,
} from './engine/media';
import { graphToDAG, timelineToDoc } from './engine/plan';
import { buildProject, createDefaultComposition, normalizeProject } from './engine/project';
import {
  animatedTextStyle,
  appendTextNodesToGraph,
  DEFAULT_TEXT_STYLE,
  rasteriseText,
  removeTextNodesFromGraph,
  TEXT_LAYER_PRESETS,
  type TextLayerPreset,
  type TextMotion,
  type TextStyle,
  textStyleFrom,
} from './engine/text';
import {
  addKeyframe,
  addMediaClip,
  applyTextMotion,
  clipsFor,
  createEmptyTimeline,
  createTextClip,
  moveKeyframe,
  nextId,
  removeKeyframe,
  renameClip,
  setClipFields,
  setClipRange,
  setKeyframeEasing,
  setKeyframeValue,
  splitClip,
  TRACKS,
} from './engine/timeline';
import type {
  CompositionState,
  DAG,
  GenreId,
  KeyframeEasing,
  MediaAsset,
  ProjectFormat,
  SafeZoneRatio,
  TimelineClip,
  TimelineDoc,
  TransformState,
} from './engine/types';
import { BRAND_LUTS } from './engine/types';
import { createDefaultDAG, useDAG } from './engine/useDAG';
import type { Brief, Concept, CreativeMode } from './hooks/useEngineData';
import { studioApi, useEngineData } from './hooks/useEngineData';

const toNum = (v: string, fallback: number): number => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const fmtTC = (seconds: number, fps = 30): string => {
  const total = Math.max(0, seconds);
  const mm = Math.floor(total / 60);
  const ss = Math.floor(total % 60);
  const ff = Math.floor((total % 1) * fps);
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
      { id: 'scopes', label: 'Scopes', hint: 'Ctrl+7' },
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
  { id: 'media', icon: 'film', label: 'Media' },
  { id: 'effects', icon: 'wand', label: 'Effects' },
  { id: 'text', icon: 'text', label: 'Text' },
  { id: 'modes', icon: 'layers', label: 'Modes' },
  { id: 'ai', icon: 'sparkle', label: 'AI' },
];

const INS_TABS: Array<{ id: string; icon: IconName; label: string }> = [
  { id: 'props', icon: 'sliders', label: 'Props' },
  { id: 'fx', icon: 'zap', label: 'FX' },
  { id: 'color', icon: 'palette', label: 'Color' },
  { id: 'scopes', icon: 'wave', label: 'Scopes' },
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

const TEMPLATES = allTemplates();

type TrackState = Record<string, { visible: boolean; locked: boolean }>;
const DEFAULT_TRACK_STATE: TrackState = {
  video: { visible: true, locked: false },
  audio: { visible: true, locked: false },
  captions: { visible: true, locked: false },
  effects: { visible: true, locked: false },
  transitions: { visible: true, locked: false },
};

interface GraphEditCommand extends Command {
  fromGraph: DAG;
  toGraph: DAG;
  mergeKey?: string;
}

function makeGraphEditCommand(
  label: string,
  fromGraph: DAG,
  toGraph: DAG,
  mergeKey?: string,
): GraphEditCommand {
  return {
    id: `graph-${Date.now().toString(36)}`,
    label,
    fromGraph,
    toGraph,
    ...(mergeKey ? { mergeKey } : {}),
    do: (doc) => ({ ...doc, graph: toGraph }),
    undo: (doc) => ({ ...doc, graph: fromGraph }),
    mergeWith: (previous) => {
      const previousGraphCommand = previous as Partial<GraphEditCommand>;
      if (
        !mergeKey ||
        previousGraphCommand.mergeKey !== mergeKey ||
        !previousGraphCommand.fromGraph
      ) {
        return null;
      }
      return makeGraphEditCommand(label, previousGraphCommand.fromGraph, toGraph, mergeKey);
    },
  };
}

export function App() {
  const { modes, typography, grammars, stats } = useEngineData();

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
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [animationProperty, setAnimationProperty] = useState('opacity');
  const [fxQuery, setFxQuery] = useState('');

  // ── Media bin (imported clips) ────────────────────────────────────────────
  const [mediaBin, setMediaBin] = useState<MediaSource[]>([]);
  const [importing, setImporting] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  /** The production plan the graph was built from, if it came from one. */
  const [plan, setPlan] = useState<ProductionPlan | null>(null);

  // ── History (undo/redo) ───────────────────────────────────────────────────
  const [historyStore, setHistoryStore] = useState<DocumentStore>(() =>
    createDocumentStore(
      buildProject({
        composition: createDefaultComposition(),
        genre: 'corporate',
        safeZones: { active: false, ratio: '16:9' },
        brandLUT: 'none',
        timeline: { duration: createDefaultComposition().duration, clips: [] },
        graph: createDefaultDAG(),
        effectsStack: [],
      }),
    ),
  );

  /**
   * The graph loader, held in a ref so the history can restore the graph
   * without the history itself depending on the graph store.
   */
  const loadDAGRef = useRef<((graph: DAG) => void) | null>(null);

  /**
   * Apply a history transition and mirror it back into the state the UI
   * renders. Without this, undo/redo would move an invisible store while the
   * timeline kept showing the pre-undo document.
   *
   * The graph is restored too: a command that replaces the whole production —
   * a loaded plan, say — has to be undone as a whole.
   */
  const applyHistory = useCallback((next: DocumentStore) => {
    setHistoryStore(next);
    setTimelineDoc(next.doc.timeline);
    setEffectsStack(next.doc.effectsStack);
    loadDAGRef.current?.(next.doc.graph);
  }, []);

  // ── Playback ──────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(1.6);
  const [stageZoom, setStageZoom] = useState(1);
  const [tlZoom, setTlZoom] = useState(1);
  const [trackState, setTrackState] = useState<TrackState>(DEFAULT_TRACK_STATE);

  // ── Quick Apply ───────────────────────────────────────────────────────────
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quickApply, setQuickApply] = useState('');

  // ── Genre-aware editing ───────────────────────────────────────────────────
  const [genre, setGenre] = useState<GenreId>('corporate');
  const [safeZonesActive, setSafeZonesActive] = useState(false);
  const [safeZoneRatio, setSafeZoneRatio] = useState<SafeZoneRatio>('16:9');
  const [brandLUT, setBrandLUT] = useState('none');

  // ── Composition & project document ────────────────────────────────────────
  const [composition, setComposition] = useState<CompositionState>(createDefaultComposition);
  const [timelineDoc, setTimelineDoc] = useState<TimelineDoc>(() => ({
    duration: createDefaultComposition().duration,
    clips: [],
  }));
  const [effectsStack, setEffectsStack] = useState<string[]>([]);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docFormat, setDocFormat] = useState<ProjectFormat>('json');
  const [dirty, setDirty] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const DURATION = composition.duration;
  const FPS = composition.fps;
  const rulerTicks = useMemo(
    () => Array.from({ length: Math.floor(DURATION) + 1 }, (_, i) => i),
    [DURATION],
  );

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
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── DAG engine ────────────────────────────────────────────────────────────
  const dag = useDAG();
  loadDAGRef.current = dag.loadDAG;

  const selectedTimelineClip = useMemo(
    () => timelineDoc.clips.find((clip) => clip.id === selectedClip),
    [timelineDoc.clips, selectedClip],
  );
  const selectedTextNode = useMemo(() => {
    const linkedId = selectedTimelineClip?.textNodeId;
    const nodeId = linkedId ?? dag.selectedNode;
    return dag.dag.nodes.find((node) => node.id === nodeId && node.type === 'text');
  }, [dag.dag.nodes, dag.selectedNode, selectedTimelineClip?.textNodeId]);
  const selectedTextStyle = useMemo(
    () => (selectedTextNode ? textStyleFrom(selectedTextNode.inputs) : null),
    [selectedTextNode],
  );

  /**
   * Keep the document's graph current as the user edits it.
   *
   * The graph is not in the undo stack yet, but the document that gets saved
   * has to be the graph on screen.
   */
  useEffect(() => {
    setHistoryStore((s) =>
      s.doc.graph === dag.dag ? s : { ...s, doc: { ...s.doc, graph: dag.dag } },
    );
  }, [dag.dag]);
  const viewportRef = useRef<WebGPUCanvasHandle>(null);

  /**
   * The look of the clip under the playhead.
   *
   * A film's shots share one graph; each clip switches its effects on or off.
   * Scrubbing the timeline therefore changes what the viewport shows.
   */
  const activeLook = useMemo(() => {
    for (const c of timelineDoc.clips) {
      if (!c.look) continue;
      if (playhead >= c.start && playhead < c.end) return c.look;
    }
    return undefined;
  }, [timelineDoc.clips, playhead]);

  // Bridge the DAG output into the composite shader pipeline.
  const bridgeResult = useMemo(
    () => bridgeDAGToComposite(dag.dag, activeLook),
    [dag.dag, activeLook],
  );
  const bridgedShader = bridgeResult.ok ? bridgeResult.wgsl : undefined;

  /**
   * The titles in the graph, and the texture each one owns.
   *
   * The GPU has no font, so the editor draws every title and hands it over.
   */
  const appTextures = bridgeResult.compiled?.appTextures ?? {};
  const appTextureSlots = useMemo(
    () => Object.values(appTextures).map((b) => b.texture),
    [appTextures],
  );
  useEffect(() => {
    const slots = appTextures;
    const nodes = dag.dag.nodes;
    if (Object.keys(slots).length === 0) return;
    for (const [nodeId, binding] of Object.entries(slots)) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      const style = textStyleFrom(node.inputs);
      const textClips = timelineDoc.clips.filter((clip) => clip.textNodeId === nodeId);
      const clip = textClips.find((item) => playhead >= item.start && playhead < item.end);
      const step = plan?.script?.steps?.find(
        (item) => item.text && playhead >= item.start && playhead < item.end,
      );
      const isEditorLayer = node.inputs.editorLayer === true;
      const visible = textClips.length > 0 ? !!clip : !isEditorLayer;
      const animated = clip ? animatedTextStyle(style, clip, playhead) : style;
      const copy = clip ? style.text : (step?.text ?? style.text);
      const image = rasteriseText({ ...animated, text: visible ? copy : '' });
      if (image) viewportRef.current?.writeAppTexture(binding.texture, image);
    }
  }, [appTextures, dag.dag.nodes, plan, playhead, timelineDoc.clips]);

  // The decoded frame the graph's media source samples. It comes from the
  // The frame the compositor samples. It is decoded on demand around the
  // playhead, so scrubbing the timeline scrubs the footage — and a long clip
  // only ever holds a window of decoded frames, not the whole thing.
  const [mediaFrame, setMediaFrame] = useState<VideoFrame | null>(null);
  useEffect(() => {
    // The topmost media clip under the playhead.
    let clip: TimelineClip | undefined;
    for (const c of timelineDoc.clips) {
      if (!c.mediaId) continue;
      if (playhead >= c.start && playhead < c.end) clip = c;
    }
    if (!clip?.mediaId) {
      setMediaFrame(null);
      return;
    }
    const source = mediaBin.find((m) => m.id === clip.mediaId);
    if (!source) {
      setMediaFrame(null);
      return;
    }
    const sourceTime = playhead - clip.start + (clip.sourceStart ?? 0);
    let cancelled = false;
    void (async () => {
      const frame = await decodeFrameAt(source, sourceTime);
      if (!cancelled) setMediaFrame(frame?.frame ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [timelineDoc.clips, mediaBin, playhead]);

  const exportPrograms = useMemo(
    () => ({
      graph: dag.dag,
      variants: new Map<string, ReturnType<typeof bridgeDAGToComposite>>(),
    }),
    [dag.dag],
  );
  const exportMediaSourcesRef = useRef(new Map<MediaSource, MediaSource>());
  const programAtTime = useCallback(
    (time: number) => {
      const clip = timelineDoc.clips.find(
        (item) => item.trackId === 'video' && time >= item.start && time < item.end,
      );
      const look = clip?.look;
      const key = JSON.stringify(look ?? null);
      let program = exportPrograms.variants.get(key);
      if (!program) {
        program = bridgeDAGToComposite(exportPrograms.graph, look);
        exportPrograms.variants.set(key, program);
      }
      return program;
    },
    [exportPrograms, timelineDoc.clips],
  );
  const mediaFrameAtTime = useCallback(
    async (time: number) => {
      let clip: TimelineClip | undefined;
      for (const item of timelineDoc.clips) {
        if (item.mediaId && time >= item.start && time < item.end) clip = item;
      }
      if (!clip?.mediaId) return null;
      const source = mediaBin.find((item) => item.id === clip.mediaId);
      if (!source) return null;
      let exportSource = exportMediaSourcesRef.current.get(source);
      if (!exportSource) {
        // Export owns its decoded window so seeking cannot close a frame the
        // live viewport is currently presenting.
        exportSource = { ...source, frames: [], decodePosition: 0, complete: false };
        exportMediaSourcesRef.current.set(source, exportSource);
      }
      const sourceTime = time - clip.start + (clip.sourceStart ?? 0);
      const decoded = await decodeFrameAt(exportSource, sourceTime);
      return decoded?.frame ?? null;
    },
    [timelineDoc.clips, mediaBin],
  );
  const disposeExportMedia = useCallback(() => {
    for (const source of exportMediaSourcesRef.current.values()) {
      for (const decoded of source.frames) decoded.frame.close();
      source.frames = [];
      source.samples = [];
    }
    exportMediaSourcesRef.current.clear();
  }, []);
  const appTexturesAtTime = useCallback(
    (time: number) => {
      const images: Record<number, ImageData> = {};
      for (const [nodeId, binding] of Object.entries(appTextures)) {
        const node = dag.dag.nodes.find((item) => item.id === nodeId);
        if (!node) continue;
        const style = textStyleFrom(node.inputs ?? {});
        const textClips = timelineDoc.clips.filter((clip) => clip.textNodeId === nodeId);
        const clip = textClips.find((item) => time >= item.start && time < item.end);
        const step = plan?.script?.steps?.find(
          (item) => item.text && time >= item.start && time < item.end,
        );
        const isEditorLayer = node.inputs.editorLayer === true;
        const visible = textClips.length > 0 ? !!clip : !isEditorLayer;
        const animated = clip ? animatedTextStyle(style, clip, time) : style;
        const copy = clip ? style.text : (step?.text ?? style.text);
        const image = rasteriseText({ ...animated, text: visible ? copy : '' });
        if (image) images[binding.texture] = image;
      }
      return images;
    },
    [appTextures, dag.dag.nodes, plan, timelineDoc.clips],
  );

  /**
   * Match each shot to the first one, so a film reads as one film.
   *
   * Every shot is lit slightly differently. A colourist measures one shot and
   * grades the next to match; this does the same thing automatically: when the
   * playhead enters a shot, the frame is measured and the difference from the
   * reference shot becomes that shot's grade.
   *
   * The measurement is of the *ungraded* frame, so a shot is measured once
   * and then keeps its grade.
   */
  const shotStatsRef = useRef(new Map<string, FrameStats>());
  const balancingRef = useRef(false);
  useEffect(() => {
    // The clip under the playhead, whether it shows media or not: a shot's
    // light comes from the whole frame.
    const clip = timelineDoc.clips.find((c) => playhead >= c.start && playhead < c.end);
    if (!clip || balancingRef.current) return;
    // Already matched.
    if (clip.look?.oklabGrade) return;

    // Forget clips that are no longer in the timeline: a new document is a
    // different film, and its shots are not a reference for this one.
    const currentIds = new Set(timelineDoc.clips.map((c) => c.id));
    for (const id of [...shotStatsRef.current.keys()]) {
      if (!currentIds.has(id)) shotStatsRef.current.delete(id);
    }

    balancingRef.current = true;
    let cancelled = false;
    void (async () => {
      const pixels = await viewportRef.current?.readPixels();
      if (cancelled) {
        balancingRef.current = false;
        return;
      }
      if (pixels) {
        const stats = analyseFrame(pixels);
        // A frame with no light in it is not a measurement; it is a readback
        // taken before the picture was on screen. Grading against it would
        // push the whole film up by several stops.
        if (!isMeasurable(stats)) {
          balancingRef.current = false;
          return;
        }
        shotStatsRef.current.set(clip.id, stats);
        // The reference is the first shot of *this* timeline that has been
        // measured. A clip from a previous document must never be the
        // reference: it is a different piece of film.
        const referenceClip = timelineDoc.clips.find((c) => shotStatsRef.current.has(c.id));
        const reference = referenceClip ? shotStatsRef.current.get(referenceClip.id) : undefined;
        if (reference && referenceClip && referenceClip.id !== clip.id) {
          const grade = gradeToMatch(stats, reference);
          setTimelineDoc((doc) => ({
            ...doc,
            clips: doc.clips.map((c) =>
              c.id === clip.id
                ? {
                    ...c,
                    look: {
                      ...(c.look ?? {}),
                      oklabGrade: {
                        exposure: grade.exposure,
                        contrast: grade.contrast,
                        saturation: grade.saturation,
                        hue: 0,
                      },
                    },
                  }
                : c,
            ),
          }));
        }
      }
      balancingRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [timelineDoc.clips, playhead]);

  const territories = useMemo(
    () => Array.from(new Set(modes.flatMap((m) => m.territories))),
    [modes],
  );

  const renderEffects = useMemo(() => {
    const visualCategories = new Set([
      'effect',
      'blur',
      'color',
      'distort',
      'stylize',
      'keying',
      'temporal',
    ]);
    return dag.nodeTypes.filter((node) => {
      if (!visualCategories.has(node.category)) return false;
      return (
        node.ports.filter((port) => port.direction === 'input' && port.type === 'texture')
          .length === 1 &&
        node.ports.filter((port) => port.direction === 'output' && port.type === 'texture')
          .length === 1
      );
    });
  }, [dag.nodeTypes]);

  const filteredEffects = useMemo(
    () =>
      renderEffects.filter(
        (effect) => fxQuery === '' || effect.label.toLowerCase().includes(fxQuery.toLowerCase()),
      ),
    [renderEffects, fxQuery],
  );
  const selectedEffectDefinition = renderEffects.find((effect) => effect.type === selectedEffect);
  const selectedEffectNode = dag.dag.nodes.find(
    (node) => node.type === selectedEffect && node.inputs.editorEffectNode === true,
  );

  /** The imported media a timeline clip shows, if any. */
  const mediaFor = useCallback(
    (clip: TimelineClip) =>
      clip.mediaId ? mediaBin.find((m) => m.id === clip.mediaId) : undefined,
    [mediaBin],
  );

  /**
   * A clip's label, with the grade that was matched onto it.
   *
   * The colourist's readout: how far this shot was moved to match the
   * reference.
   */
  const clipTitle = useCallback((clip: TimelineClip) => {
    const base = `${clip.name} · ${clip.start.toFixed(2)}s–${clip.end.toFixed(2)}s`;
    const grade = clip.look?.oklabGrade;
    if (!grade) return base;
    const exposure = Number(grade.exposure ?? 0);
    const contrast = Number(grade.contrast ?? 1);
    const ev = `${exposure >= 0 ? '+' : ''}${exposure.toFixed(2)} EV`;
    const con = `${contrast.toFixed(2)}×`;
    return `${base} · ${ev} · ${con}`;
  }, []);

  // ── Playback loop (rAF) ───────────────────────────────────────────────────
  const rafRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (t: number) => {
      // Clamp the frame delta: a stalled frame (a backgrounded window, a long
      // GPU wait) would otherwise jump the playhead forward by the whole gap.
      const dt = Math.min(Math.max((t - last) / 1000, 0), 0.1);
      last = t;
      setPlayhead((p) => (p + dt) % DURATION);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, DURATION]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';

      if (e.key === 'Escape') {
        setShowQuickApply(false);
        setOpenMenu(null);
        setSaveAsOpen(false);
        return;
      }

      // While a field has focus the browser owns the keyboard: Ctrl+Z must
      // undo the text, not the timeline, and Ctrl+I must not open a file
      // dialog mid-sentence.
      if (typing) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickApply((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) actionsRef.current.saveAs();
        else actionsRef.current.save();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        actionsRef.current.open();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        actionsRef.current.fresh();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        actionsRef.current.importMedia();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        actionsRef.current.export();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          applyHistory(redo(historyStore));
        } else {
          applyHistory(undo(historyStore));
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        applyHistory(redo(historyStore));
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && actionsRef.current.canDelete()) {
        e.preventDefault();
        actionsRef.current.deleteClip();
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
  }, [historyStore, applyHistory]);

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
    } else if (label === 'Scopes') {
      setInsTab('scopes');
    } else if (label === 'Browse Effects…') {
      setLeftTab('effects');
    } else if (label === 'New Text Layer') {
      createTextLayer(TEXT_LAYER_PRESETS[0]);
    } else if (label === 'New Project') {
      newProject();
    } else if (label === 'Import Media…') {
      importMedia();
    } else if (label === 'Open Project…') {
      openProject();
    } else if (label === 'Save') {
      saveProject(docFormat, docPath == null);
    } else if (label === 'Save As…') {
      setSaveAsOpen(true);
    } else if (label === 'Add Keyframe') {
      addKeyframeAtPlayhead();
    } else if (label === 'Undo') {
      applyHistory(undo(historyStore));
    } else if (label === 'Redo') {
      applyHistory(redo(historyStore));
    } else if (label === 'Split at Playhead') {
      splitAtPlayhead();
    } else if (label === 'Remove All Effects') {
      applyEffectStack([]);
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
      setSelectedConcept(result?.[0] ?? null);
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Build a production from the brief and load it into the editor.
   *
   * This is the seam: the engines turn a brief into a plan, the plan compiles
   * into the shared graph IR, and the IR becomes the graph and the timeline the
   * viewport renders. Before this, a plan was data that nothing drew.
   */
  const handleBuildProduction = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const api = (
        window as unknown as {
          studio?: { buildPlan: (b: unknown) => Promise<ProductionPlan> };
        }
      ).studio;
      const concept = selectedConcept;
      const objective = concept?.logline || concept?.story_summary || brief.objective;
      const plan = await api?.buildPlan?.({
        title: concept?.title ?? brief.objective,
        duration: selectedMode?.duration ?? composition.duration,
        mode: selectedMode?.id ?? genre.toUpperCase(),
        service: brief.service,
        objective,
        voice: selectedMode?.voice ?? brief.emotional_objective,
        scenes: [concept?.story_summary, concept?.key_visual, objective].filter(
          (value): value is string => !!value,
        ),
      });
      if (!plan) {
        setGenError('The production planner is unavailable.');
        return;
      }
      const compiled = compilePlan(plan);
      const nextGraph = graphToDAG(compiled.graph);
      const nextTimeline = timelineToDoc(compiled.timeline, composition.duration);
      // The plan is kept: a title follows the script's timing.
      setPlan(plan);

      // Loading a plan replaces the production, so it goes through the
      // history: one Ctrl+Z puts the previous timeline and graph back.
      const fromTimeline = timelineDoc;
      const fromGraph = dag.dag;
      const fromEffectsStack = effectsStack;
      const cmd: Command = {
        id: `cmd-${Date.now().toString(36)}`,
        label: 'Load Production',
        do: (doc) => ({ ...doc, timeline: nextTimeline, graph: nextGraph, effectsStack: [] }),
        undo: (doc) => ({
          ...doc,
          timeline: fromTimeline,
          graph: fromGraph,
          effectsStack: fromEffectsStack,
        }),
      };
      setHistoryStore((s) => dispatch(s, cmd));
      setTimelineDoc(nextTimeline);
      dag.loadDAG(nextGraph);
      setEffectsStack([]);
      setActiveStage('comp');
      notify(
        compiled.warnings.length > 0
          ? `Plan loaded with ${compiled.warnings.length} note(s): ${compiled.warnings[0]}`
          : `Plan loaded: ${compiled.timeline.length} shots, ${compiled.graph.nodes.length} nodes`,
      );
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
        ...renderEffects.map((effect) => ({ kind: 'Effect', name: effect.label, id: effect.type })),
        ...typography.map((p) => ({ kind: 'Font', name: p.name, id: p.id })),
        ...modes.map((m) => ({ kind: 'Mode', name: m.name, id: m.id })),
        ...grammars.map((g) => ({ kind: 'Grammar', name: g.name, id: g.name })),
      ].filter((x) => quickApply === '' || x.name.toLowerCase().includes(quickApply.toLowerCase())),
    [renderEffects, typography, modes, grammars, quickApply],
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

  // ── Document helpers ──────────────────────────────────────────────────────
  const touch = () => setDirty(true);

  const notify = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg((m) => (m === msg ? null : m)), 3200);
  };

  /** Dispatch a timeline transform through the history stack. */
  const dispatchTimeline = (label: string, fn: (doc: TimelineDoc) => TimelineDoc) => {
    const fromDoc = timelineDoc;
    const toDoc = fn(fromDoc);
    if (fromDoc === toDoc) return;
    // A timeline-scoped command: both halves operate on the project document
    // but only swap its `timeline`, so undo/redo can never corrupt the store.
    const cmd: Command = {
      id: `cmd-${Date.now().toString(36)}`,
      label,
      do: (doc) => ({ ...doc, timeline: toDoc }),
      undo: (doc) => ({ ...doc, timeline: fromDoc }),
    };
    setHistoryStore((s) => dispatch(s, cmd));
    setTimelineDoc(toDoc);
    touch();
  };

  const commitTextStructure = (label: string, nextTimeline: TimelineDoc, nextGraph: DAG) => {
    const fromTimeline = timelineDoc;
    const fromGraph = dag.dag;
    const command: Command = {
      id: `text-${Date.now().toString(36)}`,
      label,
      do: (doc) => ({ ...doc, timeline: nextTimeline, graph: nextGraph }),
      undo: (doc) => ({ ...doc, timeline: fromTimeline, graph: fromGraph }),
    };
    setHistoryStore((store) => dispatch(store, command));
    setTimelineDoc(nextTimeline);
    dag.loadDAG(nextGraph);
    touch();
  };

  const updateTextNode = (
    nodeId: string,
    values: Record<string, unknown>,
    label = 'Edit Title',
  ) => {
    const node = dag.dag.nodes.find((item) => item.id === nodeId && item.type === 'text');
    if (!node) return;
    const fromGraph = dag.dag;
    const inputs = { ...node.inputs, ...values };
    const nextGraph: DAG = {
      ...fromGraph,
      nodes: fromGraph.nodes.map((item) => (item.id === nodeId ? { ...item, inputs } : item)),
    };
    const mergeKey = `${label}:${nodeId}:${Object.keys(values).sort().join(',')}`;
    setHistoryStore((store) =>
      dispatchMerged(store, makeGraphEditCommand(label, fromGraph, nextGraph, mergeKey)),
    );
    dag.updateNode(nodeId, { inputs });
    touch();
  };

  const createTextLayer = (
    preset: TextLayerPreset = TEXT_LAYER_PRESETS[0],
    position?: Pick<TextStyle, 'x' | 'y'>,
  ) => {
    const style = { ...preset.style, ...position };
    const duration = Math.min(4, DURATION);
    const start = Math.min(playhead, Math.max(0, DURATION - duration));
    try {
      const appended = appendTextNodesToGraph(dag.dag, [{ name: preset.label, style }]);
      const nodeId = appended.nodeIds[0];
      const clip = createTextClip(timelineDoc, {
        textNodeId: nodeId,
        name: preset.label,
        start,
        duration,
      });
      if (!clip) {
        notify('There is not enough room at the playhead for a title layer.');
        return;
      }
      const withClip = { ...timelineDoc, clips: [...timelineDoc.clips, clip] };
      const animated = applyTextMotion(
        withClip,
        clip.id,
        preset.motion,
        style,
        preset.motion === 'typewriter' ? 1.4 : 0.7,
      );
      commitTextStructure(`Add ${preset.label}`, animated, appended.graph);
      setSelectedClip(clip.id);
      dag.setSelectedNode(nodeId);
      setLeftTab('text');
      setActiveStage('comp');
      setTool('select');
      notify(`${preset.label} added to the timeline`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const applyTypographyPreset = (preset: (typeof typography)[number]) => {
    setSelectedPreset(preset.id);
    const motion: TextMotion =
      preset.animation === 'KINETIC_CTA' || preset.animation === 'KINETIC_DATA'
        ? 'pop'
        : preset.animation === 'SLIDE_IN'
          ? 'slide-in'
          : preset.animation === 'TYPEWRITER' || preset.animation === 'SCRAMBLE'
            ? 'typewriter'
            : preset.animation === 'FADE_UP'
              ? 'caption-fade'
              : 'fade-rise';
    const style: TextStyle = {
      ...(selectedTextStyle ?? DEFAULT_TEXT_STYLE),
      font: preset.fontFamily,
      weight: preset.fontWeight,
      size: Math.max(16, Math.min(220, 96 * preset.fontSize)),
      lineHeight: preset.lineHeight,
      colour: preset.color,
    };
    if (!selectedTextNode) {
      createTextLayer({
        ...TEXT_LAYER_PRESETS[0],
        label: preset.name,
        motion,
        style: { ...style, text: preset.name },
      });
      return;
    }
    updateTextNode(
      selectedTextNode.id,
      style as unknown as Record<string, unknown>,
      'Apply Typography',
    );
    if (selectedTimelineClip?.textNodeId === selectedTextNode.id) {
      dispatchTimeline('Apply Typography Motion', (doc) =>
        applyTextMotion(doc, selectedTimelineClip.id, motion, style, preset.animationDuration),
      );
    }
  };

  const animateSelectedText = (motion: TextMotion) => {
    if (
      !selectedTimelineClip?.textNodeId ||
      selectedTimelineClip.textNodeId !== selectedTextNode?.id ||
      !selectedTextStyle
    ) {
      notify('Select a title clip on the timeline first.');
      return;
    }
    dispatchTimeline('Animate Title', (doc) =>
      applyTextMotion(doc, selectedTimelineClip.id, motion, selectedTextStyle),
    );
    notify(`Applied ${motion.replace('-', ' ')} motion`);
  };

  /**
   * Commit an inspector edit to the history.
   *
   * The inspector edits the clip live, so a text field would otherwise record
   * one history entry per keystroke. The edit is captured when the field gains
   * focus and committed when it loses it: one undo for the whole edit.
   */
  const clipEditRef = useRef<{ clipId: string; name: string; start: number; end: number } | null>(
    null,
  );
  const beginClipEdit = (clip: TimelineClip) => {
    clipEditRef.current = {
      clipId: clip.id,
      name: clip.name,
      start: clip.start,
      end: clip.end,
    };
  };
  const endClipEdit = (clip: TimelineClip) => {
    const before = clipEditRef.current;
    clipEditRef.current = null;
    if (!before || before.clipId !== clip.id) return;
    if (before.name === clip.name && before.start === clip.start && before.end === clip.end) {
      return;
    }
    const cmd: Command = {
      id: `cmd-${Date.now().toString(36)}`,
      label: 'Edit Clip',
      do: (doc) => ({
        ...doc,
        timeline: setClipFields(doc.timeline, clip.id, clip.name, clip.start, clip.end),
      }),
      undo: (doc) => ({
        ...doc,
        timeline: setClipFields(doc.timeline, clip.id, before.name, before.start, before.end),
      }),
    };
    setHistoryStore((s) => dispatch(s, cmd));
    touch();
  };

  /** Split the selected clip at the playhead. */
  const splitAtPlayhead = () => {
    if (!selectedTimelineClip) {
      notify('Select a clip to split');
      return;
    }
    if (playhead < selectedTimelineClip.start + 0.2 || playhead > selectedTimelineClip.end - 0.2) {
      notify('Move the playhead inside the selected clip to split it');
      return;
    }
    dispatchTimeline('Split Clip', (doc) => splitClip(doc, selectedTimelineClip.id, playhead));
    notify('Clip split at playhead');
  };

  /**
   * Decode a set of containers and append them to the media bin.
   * Shared by the file dialog and the drag-and-drop target.
   */
  const ingestMedia = async (items: Array<{ name: string; data: ArrayBuffer; path?: string }>) => {
    setImporting(true);
    try {
      const decoded: MediaSource[] = [];
      for (const item of items) {
        try {
          const src = await decodeVideoBuffer(item.data, item.name, { path: item.path ?? '' });
          decoded.push(src);
        } catch (e) {
          notify(`${item.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (decoded.length > 0) {
        setMediaBin((prev) => [...prev, ...decoded]);
        const total = decoded.reduce((a, s) => a + s.frames.length, 0);
        notify(
          `Imported ${decoded.length} clip${decoded.length > 1 ? 's' : ''} · ${total} frames decoded`,
        );
        setLeftTab('media');
      }
    } finally {
      setImporting(false);
    }
  };

  /**
   * Import media: open the file dialog in the main process, demux each chosen
   * container with mp4box, and decode it through WebCodecs into the media bin.
   */
  const importMedia = async () => {
    const api = studioApi();
    if (!api?.pickMedia) {
      notify('Media import is unavailable outside the editor');
      return;
    }
    try {
      const res = await api.pickMedia();
      if (res.canceled || res.items.length === 0) return;
      await ingestMedia(
        res.items.map((item) => ({ name: item.name, data: item.data, path: item.path })),
      );
    } catch (e) {
      notify(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** Drag-and-drop import: the dropped files are read in the renderer. */
  const onMediaDrop = async (e: ReactDragEvent<HTMLElement>) => {
    e.preventDefault();
    setDropActive(false);
    const files = [...e.dataTransfer.files].filter((f) =>
      /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name),
    );
    if (files.length === 0) {
      notify('Drop a video file (MP4/MOV) to import it');
      return;
    }
    try {
      const items = await Promise.all(
        files.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() })),
      );
      await ingestMedia(items);
    } catch (err) {
      notify(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /**
   * Put an imported clip on the timeline at the playhead, and make sure the
   * graph has a media source for the compositor to sample.
   */
  const addMediaToTimeline = (source: MediaSource) => {
    const room = Math.max(0, composition.duration - playhead);
    const duration = Math.min(source.duration, room);
    if (duration <= 0) {
      notify('No room left on the timeline');
      return;
    }
    dispatchTimeline('Add Media Clip', (doc) =>
      addMediaClip(doc, {
        mediaId: source.id,
        name: source.name,
        start: playhead,
        duration,
      }),
    );
    dag.ensureMediaSource();
    notify(`Added ${source.name} at ${fmtTC(playhead, composition.fps)}`);
  };

  const updateTransform = (patch: Partial<TransformState>) => {
    setComposition((c) => ({ ...c, transform: { ...c.transform, ...patch } }));
    touch();
  };

  const updateComposition = (patch: Partial<CompositionState>) => {
    setComposition((c) => ({ ...c, ...patch }));
    touch();
  };

  const buildDoc = () =>
    buildProject({
      composition,
      genre,
      safeZones: { active: safeZonesActive, ratio: safeZoneRatio },
      brandLUT,
      timeline: timelineDoc,
      graph: dag.dag,
      effectsStack,
      assets: mediaBin.map((m) => ({
        id: m.id,
        path: m.path,
        name: m.name,
        duration: m.duration,
        width: m.width,
        height: m.height,
        fps: m.fps,
        codec: m.codec,
      })),
    });

  const applyDoc = (raw: unknown) => {
    const doc = normalizeProject(raw);
    const supportedEffects = doc.effectsStack.filter((id) =>
      renderEffects.some((effect) => effect.type === id),
    );
    const normalizedDoc = { ...doc, effectsStack: supportedEffects };
    mediaBin.forEach(disposeMediaSource);
    setMediaBin([]);
    setPlaying(false);
    setComposition(doc.composition);
    setTimelineDoc(doc.timeline);
    setGenre(doc.genre);
    setSafeZonesActive(doc.safeZones.active);
    setSafeZoneRatio(doc.safeZones.ratio);
    setBrandLUT(doc.brandLUT);
    setEffectsStack(supportedEffects);
    dag.loadDAG(doc.graph);
    setPlan(null);
    setSelectedClip(null);
    setSelectedClips(new Set());
    setSelectedEffect(null);
    setSelectedConcept(null);
    setPlayhead(0);
    // A new document starts a new history. Without this, Ctrl+Z after opening
    // a project would restore the *previous* project's timeline.
    setHistoryStore((s) => replaceDoc(s, normalizedDoc));
    // Re-import the project's footage from disk. The ids must match the ones
    // the timeline's clips reference, so they are restored verbatim rather
    // than regenerated.
    void restoreAssets(doc.assets ?? []);
  };

  /**
   * Re-import the media a project references.
   *
   * The bytes live on disk; the project only records where they are. An asset
   * whose file has moved or been deleted comes back as missing rather than
   * failing the whole load.
   */
  const restoreAssets = async (assets: MediaAsset[]) => {
    const api = studioApi();
    if (!api?.readMedia || assets.length === 0) return;
    const restored: MediaSource[] = [];
    for (const asset of assets) {
      if (!asset.path) {
        // Dropped files have no path; they cannot be re-imported.
        continue;
      }
      try {
        const res = await api.readMedia(asset.path);
        if (!res.ok || !res.data) continue;
        const src = await decodeVideoBuffer(res.data, asset.name, { path: asset.path });
        // Keep the id the project's clips reference.
        restored.push({ ...src, id: asset.id });
      } catch {
        // A missing or unreadable file must not break the load.
      }
    }
    if (restored.length > 0) {
      setMediaBin(restored);
      const missing = assets.length - restored.length;
      if (missing > 0) notify(`${missing} media file(s) could not be re-imported`);
    }
  };

  const newProject = () => {
    const comp = createDefaultComposition();
    const timeline = createEmptyTimeline(comp.duration);
    const graph = createDefaultDAG();
    setComposition(comp);
    setTimelineDoc(timeline);
    setPlan(null);
    setSelectedClip(null);
    setSelectedClips(new Set());
    mediaBin.forEach(disposeMediaSource);
    setMediaBin([]);
    setPlaying(false);
    setGenre('corporate');
    setSafeZonesActive(false);
    setSafeZoneRatio('16:9');
    setBrandLUT('none');
    setEffectsStack([]);
    dag.loadDAG(graph);
    setDocPath(null);
    setDocFormat('json');
    setPlayhead(0);
    setDirty(false);
    // A new project starts a new history, so Ctrl+Z cannot bring back the
    // previous project's edits.
    setHistoryStore((s) =>
      replaceDoc(
        s,
        buildProject({
          composition: comp,
          genre: 'corporate',
          safeZones: { active: false, ratio: '16:9' },
          brandLUT: 'none',
          timeline,
          graph,
          effectsStack: [],
        }),
      ),
    );
    notify('New project created');
  };

  const saveProject = async (format: ProjectFormat, asNew = false) => {
    const api = studioApi();
    if (!api) {
      notify('File access is unavailable outside the desktop app');
      return;
    }
    try {
      const res = await api.saveProject(buildDoc(), {
        path: asNew ? undefined : (docPath ?? undefined),
        format,
      });
      if (res.canceled) return;
      setDocPath(res.path ?? null);
      setDocFormat(res.format ?? format);
      setDirty(false);
      notify(
        `Saved ${res.format === 'binary' ? 'binary' : 'JSON'} project${res.bytes ? ` (${(res.bytes / 1024).toFixed(1)} kB)` : ''}`,
      );
    } catch (e) {
      notify(`Save failed: ${String(e)}`);
    }
  };

  const openProject = async () => {
    const api = studioApi();
    if (!api) {
      notify('File access is unavailable outside the desktop app');
      return;
    }
    try {
      const res = await api.openProject();
      if (res.canceled || !res.doc) return;
      applyDoc(res.doc);
      setDocPath(res.path ?? null);
      setDocFormat(res.format ?? 'json');
      setDirty(false);
      notify(`Opened ${res.format === 'binary' ? 'binary' : 'JSON'} project`);
    } catch (e) {
      notify(`Open failed: ${String(e)}`);
    }
  };

  /**
   * Open the project the app was launched with (`electron .vfxproj`).
   * Runs once, after the engine data has seeded the timeline.
   */
  const launchProjectRef = useRef(false);
  // The effect below runs once; these handlers only touch stable setters, so
  // a ref keeps the dependency list honest without re-running it.
  const applyDocRef = useRef(applyDoc);
  applyDocRef.current = applyDoc;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  useEffect(() => {
    if (launchProjectRef.current) return;
    const api = studioApi();
    const path = api?.initialProjectPath?.();
    if (!api?.readProject || !path) return;
    launchProjectRef.current = true;
    (async () => {
      try {
        const res = await api.readProject(path);
        if (res.canceled || !res.doc) return;
        applyDocRef.current(res.doc);
        setDocPath(path);
        setDocFormat(res.format ?? 'json');
        setDirty(false);
        notifyRef.current(`Opened ${path.split(/[\\/]/).pop() ?? path}`);
      } catch (e) {
        notifyRef.current(`Open failed: ${String(e)}`);
      }
    })();
  }, []);

  // ── Effects stack ─────────────────────────────────────────────────────────
  const applyEffectStack = (next: string[]) => {
    const supported = next.filter(
      (id, index) =>
        renderEffects.some((effect) => effect.type === id) && next.indexOf(id) === index,
    );
    const currentNodeTypes = dag.dag.nodes
      .filter((node) => node.inputs.editorEffectNode === true)
      .map((node) => node.type);
    if (
      JSON.stringify(supported) === JSON.stringify(effectsStack) &&
      JSON.stringify(supported) === JSON.stringify(currentNodeTypes)
    )
      return;
    try {
      const appended = appendEffectNodesToGraph(dag.dag, supported);
      const fromGraph = dag.dag;
      const fromEffectsStack = effectsStack;
      const command: Command = {
        id: `effects-${Date.now().toString(36)}`,
        label: 'Edit Effect Stack',
        do: (doc) => ({ ...doc, graph: appended.graph, effectsStack: supported }),
        undo: (doc) => ({ ...doc, graph: fromGraph, effectsStack: fromEffectsStack }),
      };
      setHistoryStore((store) => dispatch(store, command));
      dag.loadDAG(appended.graph);
      setEffectsStack(supported);
      touch();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };
  const updateEffectParameter = (key: string, value: unknown) => {
    if (!selectedEffectNode) return;
    const fromGraph = dag.dag;
    const nextGraph: DAG = {
      ...fromGraph,
      nodes: fromGraph.nodes.map((node) =>
        node.id === selectedEffectNode.id
          ? { ...node, inputs: { ...node.inputs, [key]: value } }
          : node,
      ),
    };
    const mergeKey = `effect-parameter:${selectedEffectNode.id}:${key}`;
    setHistoryStore((store) =>
      dispatchMerged(store, makeGraphEditCommand('Adjust Effect', fromGraph, nextGraph, mergeKey)),
    );
    dag.updateNode(selectedEffectNode.id, {
      inputs: { ...selectedEffectNode.inputs, [key]: value },
    });
    touch();
  };
  const pushEffect = (id: string) => {
    if (!renderEffects.some((effect) => effect.type === id)) return;
    if (effectsStack.includes(id)) {
      setSelectedEffect(id);
      return;
    }
    applyEffectStack([...effectsStack, id]);
  };
  const dropEffect = (id: string) => {
    applyEffectStack(effectsStack.filter((effect) => effect !== id));
    if (selectedEffect === id) setSelectedEffect(null);
  };
  const moveEffect = (id: string, dir: -1 | 1) => {
    const index = effectsStack.indexOf(id);
    const nextIndex = index + dir;
    if (index < 0 || nextIndex < 0 || nextIndex >= effectsStack.length) return;
    const next = [...effectsStack];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    applyEffectStack(next);
  };
  const reorderEffect = (from: number, to: number) => {
    if (
      from < 0 ||
      from >= effectsStack.length ||
      to < 0 ||
      to >= effectsStack.length ||
      from === to
    )
      return;
    const next = [...effectsStack];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    applyEffectStack(next);
  };

  // ── Timeline interaction ──────────────────────────────────────────────────
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'move' | 'trim-start' | 'trim-end' | 'keyframe';
    clipId: string;
    kfId?: string;
    startTime: number;
    origStart: number;
    origEnd: number;
    moved: boolean;
    fromDoc: TimelineDoc;
  } | null>(null);

  const timeFromClientX = (clientX: number): number => {
    const el = trackAreaRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(DURATION, pct * DURATION));
  };

  const snapTargets = useMemo(() => {
    const edges = timelineDoc.clips.flatMap((c) => [c.start, c.end]);
    return snap ? [playhead, ...edges] : [];
  }, [snap, playhead, timelineDoc]);

  const beginClipDrag = (
    e: ReactPointerEvent,
    mode: 'move' | 'trim-start' | 'trim-end',
    clipId: string,
  ) => {
    e.stopPropagation();
    const clip = timelineDoc.clips.find((c) => c.id === clipId);
    if (!clip) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      clipId,
      startTime: timeFromClientX(e.clientX),
      origStart: clip.start,
      origEnd: clip.end,
      moved: false,
      fromDoc: timelineDoc,
    };
    setSelectedClip(clipId);
  };

  const beginKeyframeDrag = (e: ReactPointerEvent, clipId: string, kfId: string, time: number) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: 'keyframe',
      clipId,
      kfId,
      startTime: time,
      origStart: time,
      origEnd: time,
      moved: false,
      fromDoc: timelineDoc,
    };
    setSelectedClip(clipId);
  };

  const onTimelinePointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const t = timeFromClientX(e.clientX);
    d.moved = true;
    if (d.mode === 'move') {
      const delta = t - d.startTime;
      setTimelineDoc((doc) =>
        setClipRange(doc, d.clipId, d.origStart + delta, d.origEnd + delta, snapTargets),
      );
    } else if (d.mode === 'trim-start') {
      setTimelineDoc((doc) => setClipRange(doc, d.clipId, t, d.origEnd, snapTargets));
    } else if (d.mode === 'trim-end') {
      setTimelineDoc((doc) => setClipRange(doc, d.clipId, d.origStart, t, snapTargets));
    } else if (d.mode === 'keyframe' && d.kfId) {
      setTimelineDoc((doc) => moveKeyframe(doc, d.clipId, d.kfId as string, t));
    }
    touch();
  };

  const onClipDoubleClick = (clipId: string) => {
    dispatchTimeline('Add Keyframe', (doc) => addKeyframe(doc, clipId, playhead));
  };

  const endTimelineDrag = () => {
    const d = dragRef.current;
    if (d?.moved) {
      const label =
        d.mode === 'move'
          ? 'Move Clip'
          : d.mode === 'trim-start' || d.mode === 'trim-end'
            ? 'Trim Clip'
            : 'Move Keyframe';
      const cmd = makeTimelineDragCommand(label, d.fromDoc, timelineDoc);
      setHistoryStore((s) => dispatchMerged(s, cmd));
      touch();
    }
    dragRef.current = null;
  };

  const onKeyframeClick = (e: ReactPointerEvent, clipId: string, kfId: string, time: number) => {
    e.stopPropagation();
    if (e.altKey) {
      dispatchTimeline('Remove Keyframe', (doc) => removeKeyframe(doc, clipId, kfId));
      return;
    }
    beginKeyframeDrag(e, clipId, kfId, time);
  };

  const addKeyframeAtPlayhead = () => {
    if (!selectedClip) {
      notify('Select a clip first');
      return;
    }
    const selectedTitle = selectedTimelineClip?.textNodeId === selectedTextNode?.id;
    const property = selectedTitle ? animationProperty : 'opacity';
    const value = selectedTitle
      ? Number((selectedTextStyle as unknown as Record<string, unknown> | null)?.[property] ?? 1)
      : 1;
    dispatchTimeline('Add Keyframe', (doc) =>
      addKeyframe(doc, selectedClip, playhead, property, Number.isFinite(value) ? value : 1),
    );
  };

  const deleteSelectedClip = () => {
    const targets =
      selectedClips.size > 0 ? selectedClips : selectedClip ? new Set([selectedClip]) : new Set();
    if (targets.size === 0) return;
    const removedTextNodes = new Set(
      timelineDoc.clips
        .filter((clip) => targets.has(clip.id) && clip.textNodeId)
        .filter(
          (clip) =>
            !timelineDoc.clips.some(
              (other) => !targets.has(other.id) && other.textNodeId === clip.textNodeId,
            ),
        )
        .map((clip) => clip.textNodeId as string),
    );
    const nextTimeline = {
      ...timelineDoc,
      clips: timelineDoc.clips.filter((clip) => !targets.has(clip.id)),
    };
    if (removedTextNodes.size > 0) {
      const nextGraph = removeTextNodesFromGraph(dag.dag, removedTextNodes);
      commitTextStructure('Delete Title Layer', nextTimeline, nextGraph);
    } else {
      dispatchTimeline('Delete Clips', (doc) => ({
        ...doc,
        clips: doc.clips.filter((clip) => !targets.has(clip.id)),
      }));
    }
    setSelectedClip(null);
    setSelectedClips(new Set());
  };

  const duplicateSelectedClip = () => {
    const source = selectedTimelineClip;
    if (!source) {
      notify('Select a clip to duplicate');
      return;
    }
    const duration = source.end - source.start;
    const gap = Math.min(0.1, duration * 0.05);
    const after = source.end + gap;
    const before = source.start - duration - gap;
    const start = after + duration <= DURATION ? after : before;
    if (start < 0 || start + duration > DURATION) {
      notify('There is no room to duplicate this clip in the composition');
      return;
    }
    const offset = start - source.start;
    const copyId = nextId('clip');
    const keyframes = source.keyframes.map((keyframe) => ({
      ...keyframe,
      id: nextId('kf'),
      time: keyframe.time + offset,
    }));
    const copy: TimelineClip = {
      ...source,
      id: copyId,
      name: `${source.name} Copy`,
      start,
      end: start + duration,
      keyframes,
    };

    if (source.textNodeId) {
      const sourceNode = dag.dag.nodes.find(
        (node) => node.id === source.textNodeId && node.type === 'text',
      );
      if (!sourceNode) {
        notify('The selected title layer is missing from the render graph');
        return;
      }
      try {
        const appended = appendTextNodesToGraph(dag.dag, [
          { name: copy.name, style: textStyleFrom(sourceNode.inputs) },
        ]);
        copy.textNodeId = appended.nodeIds[0];
        commitTextStructure(
          'Duplicate Title Layer',
          {
            ...timelineDoc,
            clips: [...timelineDoc.clips, copy].sort((a, b) => a.start - b.start),
          },
          appended.graph,
        );
      } catch (error) {
        notify(error instanceof Error ? error.message : String(error));
        return;
      }
    } else {
      dispatchTimeline('Duplicate Clip', (doc) => ({
        ...doc,
        clips: [...doc.clips, copy].sort((a, b) => a.start - b.start),
      }));
    }
    setSelectedClip(copyId);
    setSelectedClips(new Set([copyId]));
    notify(`Duplicated ${source.name}`);
  };

  // ── Genre workflow application ────────────────────────────────────────────
  const applyKeyframePreset = (preset: KeyframePreset) => {
    if (!selectedClip) {
      notify('Select a clip to apply the keyframe preset');
      return;
    }
    dispatchTimeline('Apply Keyframe Preset', (doc) => {
      let next = addKeyframe(doc, selectedClip, playhead, preset.property, 0);
      next = addKeyframe(next, selectedClip, playhead + preset.duration, preset.property, 1);
      return next;
    });
    notify(`Applied "${preset.label}" (${preset.easing})`);
  };

  const applyTemplate = (template: GenreTemplate, templateGenre: GenreId) => {
    setGenre(templateGenre);
    setBrandLUT(template.lut);
    setPlan(null);
    try {
      const editorTextNodes = new Set(
        dag.dag.nodes.filter((node) => node.type === 'text').map((node) => node.id),
      );
      const baseGraph = removeTextNodesFromGraph(dag.dag, editorTextNodes);
      const layers = template.beats.map((beat, index) => {
        const isFinalCta = templateGenre === 'corporate' && index === template.beats.length - 1;
        const preset =
          TEXT_LAYER_PRESETS.find((item) => item.id === (isFinalCta ? 'cta' : 'chapter')) ??
          TEXT_LAYER_PRESETS[0];
        return {
          name: beat,
          style: {
            ...preset.style,
            text: beat.toUpperCase(),
            size: beat.length > 22 ? 48 : beat.length > 14 ? 58 : 72,
            x: 0.5,
            y: 0.5,
            align: 'center' as const,
          },
          motion: preset.motion,
        };
      });
      const appended = appendTextNodesToGraph(baseGraph, layers);
      const nextTimeline = createEmptyTimeline(DURATION);
      const beatDuration = DURATION / Math.max(1, template.beats.length);
      let timeline = nextTimeline;
      for (const [index, layer] of layers.entries()) {
        const clip = createTextClip(timeline, {
          textNodeId: appended.nodeIds[index],
          name: template.beats[index],
          start: index * beatDuration,
          duration: beatDuration,
        });
        if (!clip) continue;
        timeline = { ...timeline, clips: [...timeline.clips, clip] };
        timeline = applyTextMotion(
          timeline,
          clip.id,
          layer.motion,
          layer.style,
          Math.min(0.65, beatDuration),
        );
      }
      commitTextStructure(`Apply ${template.name}`, timeline, appended.graph);
      setSelectedClip(timeline.clips[0]?.id ?? null);
      if (appended.nodeIds[0]) dag.setSelectedNode(appended.nodeIds[0]);
      setActiveStage('comp');
      setLeftTab('text');
      notify(`Built ${template.beats.length} animated title beats from “${template.name}”`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const applyVisualGrammar = (grammar: (typeof grammars)[number]) => {
    const beats = grammar.sequence.map((beat) => beat.trim()).filter(Boolean);
    if (beats.length === 0) {
      notify(`“${grammar.name}” does not contain any production beats`);
      return;
    }
    try {
      setPlan(null);
      const textNodes = new Set(
        dag.dag.nodes.filter((node) => node.type === 'text').map((node) => node.id),
      );
      const baseGraph = removeTextNodesFromGraph(dag.dag, textNodes);
      const preset =
        TEXT_LAYER_PRESETS.find((item) => item.id === 'chapter') ?? TEXT_LAYER_PRESETS[0];
      const layers = beats.map((beat, index) => ({
        name: `${grammar.name} · ${index + 1}`,
        style: {
          ...preset.style,
          text: beat.toUpperCase(),
          size: beat.length > 24 ? 44 : beat.length > 16 ? 54 : 64,
          x: 0.5,
          y: 0.5,
          align: 'center' as const,
        },
      }));
      const appended = appendTextNodesToGraph(baseGraph, layers);
      const beatDuration = DURATION / beats.length;
      let timeline = createEmptyTimeline(DURATION);
      for (const [index, layer] of layers.entries()) {
        const clip = createTextClip(timeline, {
          textNodeId: appended.nodeIds[index],
          name: layer.name,
          start: index * beatDuration,
          duration: beatDuration,
        });
        if (!clip) continue;
        timeline = { ...timeline, clips: [...timeline.clips, clip] };
        timeline = applyTextMotion(
          timeline,
          clip.id,
          preset.motion,
          layer.style,
          Math.min(0.65, beatDuration),
        );
      }
      commitTextStructure(`Apply ${grammar.name}`, timeline, appended.graph);
      setSelectedClip(timeline.clips[0]?.id ?? null);
      if (appended.nodeIds[0]) dag.setSelectedNode(appended.nodeIds[0]);
      setActiveStage('comp');
      setLeftTab('text');
      notify(`Applied “${grammar.name}” as ${timeline.clips.length} animated title beats`);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  };

  const applySmartCutRatio = (ratio: SafeZoneRatio) => {
    setSafeZoneRatio(ratio);
    setSafeZonesActive(true);
    touch();
    notify(`Smart cut delivery ratio set to ${ratio}`);
  };

  // Keyboard handler runs once; this ref always points at the latest closures.
  const actionsRef = useRef<{
    save: () => void;
    saveAs: () => void;
    open: () => void;
    fresh: () => void;
    addKeyframe: () => void;
    deleteClip: () => void;
    export: () => void;
    canDelete: () => boolean;
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    split: () => void;
    importMedia: () => void;
  }>({
    save: () => {},
    saveAs: () => {},
    open: () => {},
    fresh: () => {},
    addKeyframe: () => {},
    deleteClip: () => {},
    export: () => {},
    canDelete: () => false,
    undo: () => {},
    redo: () => {},
    canUndo: () => false,
    canRedo: () => false,
    split: () => {},
    importMedia: () => {},
  });
  actionsRef.current = {
    save: () => saveProject(docFormat, docPath == null),
    saveAs: () => setSaveAsOpen(true),
    open: openProject,
    fresh: newProject,
    addKeyframe: addKeyframeAtPlayhead,
    deleteClip: deleteSelectedClip,
    export: () => {
      setInsTab('export');
      setActiveStage('comp');
    },
    canDelete: () => selectedClip != null,
    undo: () => applyHistory(undo(historyStore)),
    redo: () => applyHistory(redo(historyStore)),
    canUndo: () => canUndo(historyStore),
    canRedo: () => canRedo(historyStore),
    split: splitAtPlayhead,
    importMedia: () => {
      void importMedia();
    },
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
          <strong>{composition.name}</strong>
          <span>
            {composition.width} × {composition.height} · {composition.fps} fps ·{' '}
            {fmtTC(playhead, composition.fps)}
          </span>
          <span className="chip" title={docPath ?? 'Unsaved project'}>
            {docFormat === 'binary' ? 'Binary' : 'JSON'}
            {dirty ? ' · edited' : ' · saved'}
          </span>
        </div>
        <div className="menubar__right">
          {statusMsg && <span className="chip chip--cool">{statusMsg}</span>}
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
          <button
            type="button"
            className="iconbtn"
            title="Settings"
            aria-label="Settings"
            onClick={() => setShowSettings(true)}
          >
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
          <button
            type="button"
            className="iconbtn"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo(historyStore)}
            onClick={() => applyHistory(undo(historyStore))}
          >
            <Icon name="undo" size={14} />
          </button>
          <button
            type="button"
            className="iconbtn"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo(historyStore)}
            onClick={() => applyHistory(redo(historyStore))}
          >
            <Icon name="redo" size={14} />
          </button>
          <span className="ctxbar__sep" aria-hidden="true" />
          <button
            type="button"
            className="iconbtn"
            title="Split at playhead (S)"
            disabled={!selectedTimelineClip}
            onClick={splitAtPlayhead}
          >
            <Icon name="split" size={14} />
          </button>
          <button
            type="button"
            className="iconbtn"
            title="Duplicate (Ctrl+D)"
            disabled={!selectedTimelineClip}
            onClick={duplicateSelectedClip}
          >
            <Icon name="copy" size={14} />
          </button>
          <button
            type="button"
            className="iconbtn"
            title="Delete (Del)"
            onClick={deleteSelectedClip}
          >
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
          <button
            type="button"
            className="iconbtn"
            title="Add keyframe at playhead"
            onClick={addKeyframeAtPlayhead}
          >
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
          {!bridgeResult.ok && (
            <span className="chip chip--accent" title={bridgeResult.errors.join('\n')}>
              fallback
            </span>
          )}
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
              onClick={() => {
                setTool(t.id);
                if (t.id === 'text') setLeftTab('text');
              }}
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
            <button
              type="button"
              className="rail__btn"
              title="Reset preview zoom"
              aria-label="Reset preview zoom"
              onClick={() => setStageZoom(1)}
            >
              <Icon name="maximize" size={16} />
            </button>
            <button
              type="button"
              className="rail__btn"
              title="Settings"
              aria-label="Settings"
              onClick={() => setShowSettings(true)}
            >
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
                <GenrePanel
                  active={genre}
                  onApplyKeyframe={applyKeyframePreset}
                  onApplyTemplate={applyTemplate}
                  onApplySmartCut={applySmartCutRatio}
                />
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Visual Grammars</span>
                    <span className="sect__meta">{grammars.length}</span>
                  </div>
                  {grammars.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      className="row"
                      onClick={() => applyVisualGrammar(g)}
                    >
                      <span className="row__icon">
                        <Icon name="nodes" size={13} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{g.name}</span>
                        <span className="row__sub">
                          Apply {g.sequence.length} animated title beats
                        </span>
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

            {leftTab === 'media' && (
              <>
                <div className="panel__search">
                  <button
                    type="button"
                    className="btn btn--block"
                    disabled={importing}
                    onClick={() => importMedia()}
                  >
                    <Icon name="upload" size={13} />
                    {importing ? 'Importing…' : 'Import Media…'}
                  </button>
                </div>
                <div
                  className={`dropzone ${dropActive ? 'dropzone--active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropActive(true);
                  }}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={onMediaDrop}
                >
                  <Icon name="film" size={16} />
                  <span>Drop a video file here</span>
                </div>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Media Bin</span>
                    <span className="sect__meta">{mediaBin.length}</span>
                  </div>
                  {mediaBin.map((m) => (
                    <div key={m.id} className="row" title={`${m.codec} · ${m.width}×${m.height}`}>
                      <MediaThumb frame={m.frames[0]?.frame ?? null} />
                      <span className="row__body">
                        <span className="row__title">{m.name}</span>
                        <span className="row__sub">
                          {m.width}×{m.height} · {m.fps.toFixed(1)}fps · {m.duration.toFixed(1)}s ·{' '}
                          {m.frames.length} frames
                        </span>
                      </span>
                      <button
                        type="button"
                        className="iconbtn"
                        title="Add to the timeline at the playhead"
                        aria-label={`Add ${m.name} to the timeline`}
                        onClick={() => addMediaToTimeline(m)}
                      >
                        <Icon name="plus" size={12} />
                      </button>
                    </div>
                  ))}
                  {mediaBin.length === 0 && !importing && (
                    <p className="muted">
                      No media yet. Import an MP4/MOV to decode it with WebCodecs.
                    </p>
                  )}
                  {importing && <p className="muted">Decoding…</p>}
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
                      key={e.type}
                      type="button"
                      className={`row ${selectedEffect === e.type ? 'row--active' : ''}`}
                      onClick={() => {
                        setSelectedEffect(e.type);
                        setInsTab('fx');
                        pushEffect(e.type);
                      }}
                    >
                      <span className="row__icon">
                        <Icon name={fxIcon(e.category)} size={13} />
                      </span>
                      <span className="row__body">
                        <span className="row__title">{e.label}</span>
                        <span className="row__sub">Live {e.category} shader</span>
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
                    <span className="sect__title">Create a Title Layer</span>
                    <span className="sect__meta">{TEXT_LAYER_PRESETS.length} styles</span>
                  </div>
                  <p className="muted">
                    Add editable headlines, captions, lower thirds, or calls to action.
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {TEXT_LAYER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="btn"
                        title={preset.description}
                        onClick={() => createTextLayer(preset)}
                      >
                        <Icon name="text" size={12} />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedTextNode && selectedTextStyle && (
                  <div className="sect">
                    <div className="sect__head">
                      <span className="sect__title">Selected Title</span>
                      <span className="sect__meta">
                        {selectedTimelineClip?.name ?? 'Graph layer'}
                      </span>
                    </div>
                    <label className="field">
                      <span className="field__label">On-screen copy</span>
                      <textarea
                        className="field__input"
                        rows={3}
                        value={selectedTextStyle.text}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, { text: event.target.value })
                        }
                        aria-label="Title text"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Font family</span>
                      <input
                        className="field__input"
                        value={selectedTextStyle.font}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, { font: event.target.value })
                        }
                        aria-label="Title font family"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Size</span>
                      <input
                        className="field__input"
                        type="number"
                        min={8}
                        max={360}
                        value={selectedTextStyle.size}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, {
                            size: toNum(event.target.value, selectedTextStyle.size),
                          })
                        }
                        aria-label="Title size"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Weight</span>
                      <input
                        className="field__input"
                        type="range"
                        min={100}
                        max={900}
                        step={50}
                        value={selectedTextStyle.weight}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, {
                            weight: Number(event.target.value),
                          })
                        }
                        aria-label="Title font weight"
                      />
                      <span className="field__value">{selectedTextStyle.weight}</span>
                    </label>
                    <label className="field">
                      <span className="field__label">Colour</span>
                      <input
                        className="field__input"
                        type="color"
                        value={selectedTextStyle.colour}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, { colour: event.target.value })
                        }
                        aria-label="Title colour"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Alignment</span>
                      <select
                        className="field__input"
                        value={selectedTextStyle.align ?? 'center'}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, { align: event.target.value })
                        }
                        aria-label="Title alignment"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <label className="field">
                        <span className="field__label">Horizontal position</span>
                        <input
                          className="field__input"
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedTextStyle.x}
                          onChange={(event) =>
                            updateTextNode(selectedTextNode.id, { x: Number(event.target.value) })
                          }
                          aria-label="Title horizontal position"
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Vertical position</span>
                        <input
                          className="field__input"
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedTextStyle.y}
                          onChange={(event) =>
                            updateTextNode(selectedTextNode.id, { y: Number(event.target.value) })
                          }
                          aria-label="Title vertical position"
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span className="field__label">Background box</span>
                      <input
                        className="field__input"
                        type="color"
                        value={selectedTextStyle.backgroundColor || '#101722'}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, {
                            backgroundColor: event.target.value,
                            backgroundOpacity: selectedTextStyle.backgroundOpacity || 0.84,
                          })
                        }
                        aria-label="Title background colour"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Box opacity</span>
                      <input
                        className="field__input"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedTextStyle.backgroundOpacity ?? 0}
                        onChange={(event) =>
                          updateTextNode(selectedTextNode.id, {
                            backgroundOpacity: Number(event.target.value),
                          })
                        }
                        aria-label="Title background opacity"
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Animation channel</span>
                      <select
                        className="field__input"
                        value={animationProperty}
                        onChange={(event) => setAnimationProperty(event.target.value)}
                        aria-label="Animation channel"
                      >
                        {['opacity', 'scale', 'x', 'y', 'rotation', 'reveal'].map((property) => (
                          <option key={property} value={property}>
                            {property}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          ['Fade + Rise', 'fade-rise'],
                          ['Slide In', 'slide-in'],
                          ['CTA Pop', 'pop'],
                          ['Typewriter', 'typewriter'],
                        ] as const
                      ).map(([label, motion]) => (
                        <button
                          key={motion}
                          type="button"
                          className="btn"
                          onClick={() => animateSelectedText(motion)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                      onClick={() => applyTypographyPreset(p)}
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
                    {TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="tplcard"
                        onClick={() => applyTemplate(template, template.genre)}
                      >
                        <span
                          className="tplcard__preview"
                          style={{
                            background: `linear-gradient(135deg, ${BRAND_LUTS.find((lut) => lut.id === template.lut)?.colors.shadow ?? '#151923'}, ${BRAND_LUTS.find((lut) => lut.id === template.lut)?.colors.midtone ?? '#59647a'})`,
                          }}
                        />
                        <span className="tplcard__meta">
                          <span className="tplcard__name">{template.name}</span>
                          <span className="tplcard__desc">
                            {template.beats.length} animated title beats · {template.genre}
                          </span>
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
                  <button
                    type="button"
                    className="btn btn--block"
                    onClick={handleBuildProduction}
                    disabled={generating}
                  >
                    <Icon name="nodes" size={13} />
                    Build Production
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
                          <button
                            key={c.id ?? c.title}
                            type="button"
                            className="conceptcard"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              borderColor:
                                selectedConcept?.title === c.title ? '#ff5a2c' : undefined,
                            }}
                            aria-pressed={selectedConcept?.title === c.title}
                            onClick={() => setSelectedConcept(c)}
                          >
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
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                <div
                  className="viewport__frame"
                  style={{
                    transform: `scale(${stageZoom})`,
                    cursor: tool === 'text' ? 'crosshair' : undefined,
                  }}
                  onClick={(event) => {
                    if (tool !== 'text') return;
                    const target = event.target as HTMLElement;
                    if (target.closest('button')) return;
                    const bounds = event.currentTarget.getBoundingClientRect();
                    if (bounds.width <= 0 || bounds.height <= 0) return;
                    createTextLayer(TEXT_LAYER_PRESETS[0], {
                      x: (event.clientX - bounds.left) / bounds.width,
                      y: (event.clientY - bounds.top) / bounds.height,
                    });
                  }}
                >
                  <WebGPUCanvas
                    ref={viewportRef}
                    time={playhead}
                    transform={composition.transform}
                    lut={BRAND_LUTS.find((l) => l.id === brandLUT) ?? null}
                    shaderCode={bridgedShader}
                    shaderSegments={bridgeResult.ok ? bridgeResult.segments : undefined}
                    outputSegment={bridgeResult.outputSegment}
                    compileError={bridgeResult.ok ? undefined : bridgeResult.errors.join('\n')}
                    mediaFrame={mediaFrame}
                    appTextureSlots={appTextureSlots}
                  />
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
                    {composition.width} × {composition.height}
                  </span>
                  <span className="hud-chip">
                    <Icon name="film" size={11} />
                    {composition.fps} fps
                  </span>
                  <span className="hud-chip">
                    <Icon name="gauge" size={11} />
                    {Math.round(stageZoom * 100)}%
                  </span>
                </div>
                <div className="viewport__tc">
                  {fmtTC(playhead, composition.fps)}
                  <span className="muted"> / {fmtTC(DURATION, composition.fps)}</span>
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
                    <span className="sect__meta">
                      {composition.width}×{composition.height}
                    </span>
                  </div>
                  <label className="field">
                    <span className="field__label">Name</span>
                    <input
                      className="field__input"
                      value={composition.name}
                      onChange={(e) => updateComposition({ name: e.target.value })}
                      aria-label="Composition name"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Resolution</span>
                    <input
                      className="field__input"
                      value={composition.width}
                      onChange={(e) =>
                        updateComposition({
                          width: Math.round(toNum(e.target.value, composition.width)),
                        })
                      }
                      aria-label="Width"
                      inputMode="numeric"
                    />
                    <span className="muted">×</span>
                    <input
                      className="field__input"
                      value={composition.height}
                      onChange={(e) =>
                        updateComposition({
                          height: Math.round(toNum(e.target.value, composition.height)),
                        })
                      }
                      aria-label="Height"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Frame Rate</span>
                    <input
                      className="field__input"
                      value={composition.fps}
                      onChange={(e) =>
                        updateComposition({ fps: toNum(e.target.value, composition.fps) })
                      }
                      aria-label="Frame rate"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Duration</span>
                    <input
                      className="field__input"
                      value={composition.duration}
                      onChange={(e) => {
                        const d = Math.max(0.1, toNum(e.target.value, composition.duration));
                        updateComposition({ duration: d });
                        setTimelineDoc((t) => ({ ...t, duration: d }));
                      }}
                      aria-label="Duration (seconds)"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Background</span>
                    <input
                      className="field__input"
                      value={composition.background}
                      onChange={(e) => updateComposition({ background: e.target.value })}
                      aria-label="Background color"
                    />
                  </label>
                </div>

                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Transform</span>
                    <span className="sect__meta">live</span>
                  </div>
                  <label className="field">
                    <span className="field__label">Position X</span>
                    <input
                      className="field__input"
                      value={Math.round(composition.transform.x)}
                      onChange={(e) =>
                        updateTransform({ x: toNum(e.target.value, composition.transform.x) })
                      }
                      aria-label="Position X"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Position Y</span>
                    <input
                      className="field__input"
                      value={Math.round(composition.transform.y)}
                      onChange={(e) =>
                        updateTransform({ y: toNum(e.target.value, composition.transform.y) })
                      }
                      aria-label="Position Y"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Scale</span>
                    <input
                      className="field__input"
                      value={Math.round(composition.transform.scale * 100)}
                      onChange={(e) =>
                        updateTransform({
                          scale: toNum(e.target.value, composition.transform.scale * 100) / 100,
                        })
                      }
                      aria-label="Scale percent"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Rotation</span>
                    <input
                      className="field__input"
                      value={Math.round(composition.transform.rotation)}
                      onChange={(e) =>
                        updateTransform({
                          rotation: toNum(e.target.value, composition.transform.rotation),
                        })
                      }
                      aria-label="Rotation degrees"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Opacity</span>
                    <input
                      className="field__input"
                      value={Math.round(composition.transform.opacity * 100)}
                      onChange={(e) =>
                        updateTransform({
                          opacity: toNum(e.target.value, composition.transform.opacity * 100) / 100,
                        })
                      }
                      aria-label="Opacity percent"
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

                {selectedClip &&
                  (() => {
                    const clip = timelineDoc.clips.find((c) => c.id === selectedClip);
                    if (!clip) return null;
                    const track = TRACKS.find((t) => t.id === clip.trackId);
                    return (
                      <div className="sect">
                        <div className="sect__head">
                          <span className="sect__title">Selected Clip</span>
                          <span className="sect__meta">{track?.name ?? clip.trackId}</span>
                        </div>
                        <label className="field">
                          <span className="field__label">Name</span>
                          <input
                            className="field__input"
                            value={clip.name}
                            onFocus={() => beginClipEdit(clip)}
                            onBlur={() => endClipEdit(clip)}
                            onChange={(e) => {
                              setTimelineDoc((doc) => renameClip(doc, clip.id, e.target.value));
                              touch();
                            }}
                            aria-label="Clip name"
                          />
                        </label>
                        <label className="field">
                          <span className="field__label">In / Out</span>
                          <input
                            className="field__input"
                            value={clip.start.toFixed(2)}
                            onFocus={() => beginClipEdit(clip)}
                            onBlur={() => endClipEdit(clip)}
                            onChange={(e) => {
                              setTimelineDoc((doc) =>
                                setClipRange(
                                  doc,
                                  clip.id,
                                  toNum(e.target.value, clip.start),
                                  clip.end,
                                  [],
                                ),
                              );
                              touch();
                            }}
                            aria-label="Clip in point"
                            inputMode="decimal"
                          />
                          <span className="muted">to</span>
                          <input
                            className="field__input"
                            value={clip.end.toFixed(2)}
                            onFocus={() => beginClipEdit(clip)}
                            onBlur={() => endClipEdit(clip)}
                            onChange={(e) => {
                              setTimelineDoc((doc) =>
                                setClipRange(
                                  doc,
                                  clip.id,
                                  clip.start,
                                  toNum(e.target.value, clip.end),
                                  [],
                                ),
                              );
                              touch();
                            }}
                            aria-label="Clip out point"
                            inputMode="decimal"
                          />
                        </label>
                        <div className="sect__head">
                          <span className="sect__title">Keyframes</span>
                          <span className="sect__meta">{clip.keyframes.length}</span>
                        </div>
                        {clip.keyframes.map((k) => (
                          <div key={k.id} className="row row--kf">
                            <span className="row__icon">
                              <Icon name="keyframe" size={12} />
                            </span>
                            <button
                              type="button"
                              className="rowbtn rowbtn--kf"
                              onClick={() => {
                                setPlayhead(k.time);
                                setAnimationProperty(k.property);
                              }}
                              title={`${k.time.toFixed(2)}s · ${k.property}`}
                            >
                              <span className="row__title">{k.time.toFixed(2)}s</span>
                              <span className="row__sub">{k.property}</span>
                            </button>
                            <input
                              className="field__input"
                              type="number"
                              step="any"
                              value={k.value}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value)) return;
                                dispatchTimeline('Set Keyframe Value', (doc) =>
                                  setKeyframeValue(doc, clip.id, k.id, value),
                                );
                              }}
                              aria-label={`Value for ${k.property} keyframe`}
                              style={{ maxWidth: 76 }}
                            />
                            <select
                              className="field__input kf__ease"
                              value={k.easing}
                              title="Interpolation into this keyframe"
                              aria-label={`Easing for ${k.property} keyframe at ${k.time.toFixed(2)}s`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const next = e.target.value as KeyframeEasing;
                                if (next === k.easing) return;
                                dispatchTimeline('Set Keyframe Easing', (doc) =>
                                  setKeyframeEasing(doc, clip.id, k.id, next),
                                );
                              }}
                            >
                              {EASING_ORDER.map((kind) => (
                                <option key={kind} value={kind}>
                                  {EASING_LABELS[kind]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="iconbtn"
                              title="Remove keyframe"
                              aria-label="Remove keyframe"
                              onClick={() => {
                                dispatchTimeline('Remove Keyframe', (doc) =>
                                  removeKeyframe(doc, clip.id, k.id),
                                );
                              }}
                            >
                              <Icon name="close" size={12} />
                            </button>
                          </div>
                        ))}
                        {clip.keyframes.length === 0 && (
                          <p className="muted">
                            No keyframes. Double-click the clip or use the button.
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn btn--block"
                          style={{ marginTop: 8 }}
                          onClick={addKeyframeAtPlayhead}
                        >
                          <Icon name="keyframe" size={12} />
                          Add at playhead
                        </button>
                      </div>
                    );
                  })()}
              </>
            )}

            {insTab === 'fx' && (
              <>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Effects Stack</span>
                    <span className="sect__meta">{effectsStack.length} active</span>
                  </div>
                  <div
                    className="flex flex-col gap-1 rounded-lg border border-dashed border-line p-1"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData('application/x-virtue-effect');
                      if (id) pushEffect(id);
                    }}
                  >
                    {effectsStack.map((id, index) => {
                      const e = renderEffects.find((effect) => effect.type === id);
                      return (
                        <div
                          key={id}
                          className={`row ${selectedEffect === id ? 'row--active' : ''}`}
                          draggable
                          onDragStart={(ev) => {
                            ev.dataTransfer.setData(
                              'application/x-virtue-stack-index',
                              String(index),
                            );
                          }}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            ev.preventDefault();
                            const from = Number(
                              ev.dataTransfer.getData('application/x-virtue-stack-index'),
                            );
                            if (Number.isFinite(from)) reorderEffect(from, index);
                          }}
                        >
                          <span className="row__icon">
                            <Icon name={fxIcon(e?.category ?? '')} size={13} />
                          </span>
                          <button
                            type="button"
                            className="rowbtn"
                            onClick={() => setSelectedEffect(id)}
                          >
                            <span className="row__title">{e?.label ?? id}</span>
                            <span className="row__sub">{e?.category ?? 'effect'}</span>
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            title="Move up"
                            aria-label="Move effect up"
                            onClick={() => moveEffect(id, -1)}
                          >
                            <Icon name="chevronUp" size={12} />
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            title="Move down"
                            aria-label="Move effect down"
                            onClick={() => moveEffect(id, 1)}
                          >
                            <Icon name="chevronDown" size={12} />
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            title="Remove effect"
                            aria-label="Remove effect"
                            onClick={() => dropEffect(id)}
                          >
                            <Icon name="close" size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {effectsStack.length === 0 && (
                      <p className="muted">Drag an effect here to add it to the layer stack.</p>
                    )}
                  </div>
                </div>
                <div className="sect">
                  <div className="sect__head">
                    <span className="sect__title">Effect Library</span>
                    <span className="sect__meta">{renderEffects.length}</span>
                  </div>
                  {renderEffects.map((e) => (
                    <div
                      key={e.type}
                      className={`row ${selectedEffect === e.type ? 'row--active' : ''}`}
                      draggable
                      onDragStart={(ev) =>
                        ev.dataTransfer.setData('application/x-virtue-effect', e.type)
                      }
                    >
                      <span className="row__icon">
                        <Icon name={fxIcon(e.category)} size={13} />
                      </span>
                      <button
                        type="button"
                        className="rowbtn"
                        onClick={() => setSelectedEffect(e.type)}
                      >
                        <span className="row__title">{e.label}</span>
                        <span className="row__sub">{e.category}</span>
                      </button>
                      <button
                        type="button"
                        className="iconbtn iconbtn--primary"
                        title="Add to stack"
                        aria-label={`Add ${e.label} to stack`}
                        onClick={() => {
                          setSelectedEffect(e.type);
                          pushEffect(e.type);
                        }}
                      >
                        <Icon name="plus" size={12} />
                      </button>
                    </div>
                  ))}
                  {renderEffects.length === 0 && (
                    <p className="muted">No compatible render effects are available.</p>
                  )}
                </div>
                {selectedEffect && (
                  <div className="sect">
                    <div className="sect__head">
                      <span className="sect__title">Parameters</span>
                      <span className="sect__meta">
                        {selectedEffectDefinition?.label ?? selectedEffect}
                      </span>
                    </div>
                    {!selectedEffectNode && (
                      <p className="muted">
                        Add this effect to the stack to edit its live shader parameters.
                      </p>
                    )}
                    {selectedEffectNode &&
                      selectedEffectDefinition?.ports
                        .filter((port) => port.direction === 'input' && port.type !== 'texture')
                        .map((port) => {
                          const value = selectedEffectNode.inputs[port.id] ?? port.default ?? '';
                          return (
                            <div key={port.id} className="field">
                              <span className="field__label">{port.name}</span>
                              {port.type === 'number' ? (
                                (() => {
                                  const number = Number(value) || 0;
                                  const min = port.id.toLowerCase().includes('exposure')
                                    ? -5
                                    : port.id.toLowerCase().includes('hue')
                                      ? -180
                                      : 0;
                                  const max = port.id.toLowerCase().includes('radius')
                                    ? 16
                                    : port.id.toLowerCase().includes('hue')
                                      ? 180
                                      : port.id.toLowerCase().includes('softness')
                                        ? 1
                                        : 2;
                                  const step = port.id.toLowerCase().includes('radius')
                                    ? 0.1
                                    : 0.01;
                                  return (
                                    <div className="flex items-center gap-2">
                                      <input
                                        className="field__input"
                                        type="range"
                                        min={min}
                                        max={max}
                                        step={step}
                                        value={Math.min(max, Math.max(min, number))}
                                        aria-label={port.name}
                                        onChange={(event) =>
                                          updateEffectParameter(
                                            port.id,
                                            toNum(event.target.value, number),
                                          )
                                        }
                                      />
                                      <span className="field__value">{number.toFixed(2)}</span>
                                    </div>
                                  );
                                })()
                              ) : port.type === 'color' ? (
                                <input
                                  className="field__input"
                                  type="color"
                                  value={
                                    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
                                      ? value
                                      : '#808080'
                                  }
                                  aria-label={port.name}
                                  onChange={(event) =>
                                    updateEffectParameter(port.id, event.target.value)
                                  }
                                />
                              ) : (
                                <input
                                  className="field__input"
                                  value={String(value)}
                                  aria-label={port.name}
                                  onChange={(event) =>
                                    updateEffectParameter(port.id, event.target.value)
                                  }
                                />
                              )}
                            </div>
                          );
                        })}
                  </div>
                )}
              </>
            )}

            {insTab === 'color' && <BrandLUTPanel active={brandLUT} onChange={setBrandLUT} />}
            {insTab === 'scopes' && (
              <ScopesPanel
                captureFrame={() => viewportRef.current?.readPixels() ?? Promise.resolve(null)}
              />
            )}
            {insTab === 'export' && (
              <ExportPanel
                composition={composition}
                lut={BRAND_LUTS.find((l) => l.id === brandLUT) ?? null}
                programAtTime={programAtTime}
                mediaFrameAtTime={mediaFrameAtTime}
                appTexturesAtTime={appTexturesAtTime}
                disposeExportMedia={disposeExportMedia}
              />
            )}
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
          </div>
          <div className="timeline__tc">
            <span className="timeline__tc-time">{fmtTC(playhead, composition.fps)}</span>
            <span className="timeline__tc-dur">/ {fmtTC(DURATION, composition.fps)}</span>
          </div>
          <span className="ctxbar__sep" aria-hidden="true" />
          <span className="ctxbar__label">
            {composition.width}×{composition.height} · {FPS} fps · {DURATION}s
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
            {TRACKS.map((t) => {
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
            <div
              ref={trackAreaRef}
              className="relative"
              style={{ width: `${tlZoom * 100}%` }}
              onPointerMove={onTimelinePointerMove}
              onPointerUp={endTimelineDrag}
              onPointerCancel={endTimelineDrag}
            >
              <button
                type="button"
                className="ruler w-full"
                aria-label="Seek timeline"
                title="Click to move playhead"
                onPointerDown={(e) => setPlayhead(timeFromClientX(e.clientX))}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') setPlayhead((p) => Math.min(DURATION, p + 1 / FPS));
                  if (e.key === 'ArrowLeft') setPlayhead((p) => Math.max(0, p - 1 / FPS));
                }}
              >
                {rulerTicks.map((s) => (
                  <span
                    key={s}
                    className="ruler__tick"
                    style={{ left: `${(s / DURATION) * 100}%` }}
                  >
                    0:{String(s).padStart(2, '0')}
                  </span>
                ))}
              </button>
              {TRACKS.map((t) => {
                const st = trackState[t.id] ?? { visible: true, locked: false };
                const clips = clipsFor(timelineDoc, t.id);
                return (
                  <div key={t.id} className="lane">
                    {st.visible &&
                      clips.map((c) => {
                        const span = Math.max(0.001, c.end - c.start);
                        return (
                          <div
                            key={c.id}
                            className={`clip ${selectedClips.has(c.id) ? 'clip--active' : selectedClip === c.id ? 'clip--active' : ''}`}
                            title={clipTitle(c)}
                            onPointerDown={(e) => {
                              if (st.locked) return;
                              if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                setSelectedClips((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(c.id)) next.delete(c.id);
                                  else next.add(c.id);
                                  return next;
                                });
                                if (!selectedClips.has(c.id)) setSelectedClip(c.id);
                                return;
                              }
                              setSelectedClips(new Set([c.id]));
                              setSelectedClip(c.id);
                              beginClipDrag(e, 'move', c.id);
                            }}
                            onDoubleClick={() => onClipDoubleClick(c.id)}
                            style={{
                              left: `${(c.start / DURATION) * 100}%`,
                              width: `${(span / DURATION) * 100}%`,
                              background: `linear-gradient(180deg, ${t.color}55, ${t.color}33)`,
                              borderColor:
                                selectedClips.has(c.id) || selectedClip === c.id
                                  ? t.color
                                  : `${t.color}aa`,
                              opacity: st.locked ? 0.55 : 1,
                            }}
                          >
                            <span
                              className="clip__handle clip__handle--start"
                              onPointerDown={(e) => {
                                if (!st.locked) beginClipDrag(e, 'trim-start', c.id);
                              }}
                            />
                            <Icon name={t.icon} size={11} />
                            {c.mediaId && (
                              <MediaThumb
                                frame={mediaFor(c)?.frames[0]?.frame ?? null}
                                width={40}
                              />
                            )}
                            <span className="clip__name">{c.name}</span>
                            <span
                              className="clip__handle clip__handle--end"
                              onPointerDown={(e) => {
                                if (!st.locked) beginClipDrag(e, 'trim-end', c.id);
                              }}
                            />
                            {c.keyframes.map((k) => (
                              <span
                                key={k.id}
                                className="keyframe"
                                title={`${k.time.toFixed(2)}s · ${k.easing} (alt-click removes)`}
                                style={{
                                  left: `${((k.time - c.start) / span) * 100}%`,
                                }}
                                onPointerDown={(e) => {
                                  if (!st.locked) onKeyframeClick(e, c.id, k.id, k.time);
                                }}
                              />
                            ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
              <div className="playhead" style={{ left: `${(playhead / DURATION) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Save As (format choice) ────────────────────────────────────── */}
      {saveAsOpen && (
        <div
          className="qa-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSaveAsOpen(false);
          }}
        >
          <div className="dialog" role="dialog" aria-label="Save project as">
            <div className="dialog__head">
              <span className="dialog__title">Save Project As</span>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close"
                onClick={() => setSaveAsOpen(false)}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
            <p className="muted" style={{ margin: '0 0 10px' }}>
              Choose a storage format. Both keep the full project; pick per your workflow.
            </p>
            <div className="cardgrid">
              <button
                type="button"
                className="card"
                onClick={() => {
                  setSaveAsOpen(false);
                  saveProject('json', true);
                }}
              >
                <span className="card__icon">
                  <Icon name="code" size={14} />
                </span>
                <span className="card__title">JSON · .vfxproj</span>
                <span className="card__desc">
                  Human-readable, diff-friendly, version with git. Larger on disk.
                </span>
              </button>
              <button
                type="button"
                className="card"
                onClick={() => {
                  setSaveAsOpen(false);
                  saveProject('binary', true);
                }}
              >
                <span className="card__icon">
                  <Icon name="box" size={14} />
                </span>
                <span className="card__title">Binary · .vfxproj.bin</span>
                <span className="card__desc">
                  Gzip-compressed JSON with a sha256 checksum. Compact, opaque to diffs.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="qa-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowSettings(false);
          }}
        >
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Editor preferences">
            <div className="dialog__head">
              <span className="dialog__title">Editor Preferences</span>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close preferences"
                onClick={() => setShowSettings(false)}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
            <label className="field">
              <span className="field__label">Timeline snapping</span>
              <input
                type="checkbox"
                checked={snap}
                onChange={(event) => setSnap(event.target.checked)}
              />
            </label>
            <label className="field">
              <span className="field__label">
                Preview zoom <span className="field__value">{Math.round(stageZoom * 100)}%</span>
              </span>
              <input
                className="field__input"
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={stageZoom}
                onChange={(event) => setStageZoom(toNum(event.target.value, 1))}
              />
            </label>
            <label className="field">
              <span className="field__label">
                Timeline zoom <span className="field__value">{Math.round(tlZoom * 100)}%</span>
              </span>
              <input
                className="field__input"
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={tlZoom}
                onChange={(event) => setTlZoom(toNum(event.target.value, 1))}
              />
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSnap(true);
                setStageZoom(1);
                setTlZoom(1);
              }}
            >
              Reset editor preferences
            </button>
          </div>
        </div>
      )}

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
