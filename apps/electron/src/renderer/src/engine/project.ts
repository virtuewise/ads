// ── Project Document ─────────────────────────────────────────────────────────
// The `.vfxproj` document is the unit of persistence. The renderer builds it
// from live state and the main process serializes it as deterministic JSON
// (git-friendly) or a compact checksummed binary blob.

import type {
  CompositionState,
  DAG,
  GenreId,
  ProjectDocument,
  ProjectFormat,
  SafeZoneRatio,
  SafeZoneState,
  TimelineDoc,
  TransformState,
} from './types';

export const PROJECT_VERSION = 1;
export const APP_NAME = 'Virtue Studio';
export const APP_VERSION = '0.1.0';

export const JSON_EXT = '.vfxproj';
export const BINARY_EXT = '.vfxproj.bin';

export function createDefaultTransform(): TransformState {
  return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
}

export function createDefaultComposition(): CompositionState {
  return {
    name: 'Untitled Composition',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 12,
    background: '#07090d',
    transform: createDefaultTransform(),
  };
}

export interface BuildProjectInput {
  composition: CompositionState;
  genre: GenreId;
  safeZones: SafeZoneState;
  brandLUT: string;
  timeline: TimelineDoc;
  graph: DAG;
  effectsStack?: string[];
}

export function buildProject(input: BuildProjectInput): ProjectDocument {
  return {
    format: 'vfxproj',
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    app: { name: APP_NAME, version: APP_VERSION },
    composition: input.composition,
    genre: input.genre,
    safeZones: input.safeZones,
    brandLUT: input.brandLUT,
    timeline: input.timeline,
    graph: input.graph,
    effectsStack: input.effectsStack ?? [],
  };
}

const RATIOS: SafeZoneRatio[] = ['16:9', '9:16', '1:1', '4:5'];
const GENRE_IDS: GenreId[] = [
  '3d-animation',
  'narrative',
  'corporate',
  'explainer',
  'documentary',
  'detective',
];

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function sanitizeKeyframes(raw: unknown): TimelineDoc['clips'][number]['keyframes'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((k): k is Record<string, unknown> => !!k && typeof k === 'object')
    .map((k, i) => ({
      id: str(k.id, `kf-${i}`),
      time: num(k.time, 0),
      property: str(k.property, 'opacity'),
      value: num(k.value, 1),
      easing: (['linear', 'easeIn', 'easeOut', 'easeInOut'] as const).includes(k.easing as never)
        ? (k.easing as TimelineDoc['clips'][number]['keyframes'][number]['easing'])
        : 'easeInOut',
    }))
    .sort((a, b) => a.time - b.time);
}

function sanitizeTimeline(raw: unknown, duration: number): TimelineDoc {
  const doc = (raw ?? {}) as { duration?: unknown; clips?: unknown };
  const clips = Array.isArray(doc.clips)
    ? doc.clips
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c, i) => ({
          id: str(c.id, `clip-${i}`),
          trackId: str(c.trackId, 'video'),
          start: num(c.start, 0),
          end: num(c.end, 1),
          name: str(c.name, 'Clip'),
          keyframes: sanitizeKeyframes(c.keyframes),
        }))
    : [];
  return { duration: num(doc.duration, duration), clips };
}

/** Coerce arbitrary parsed data into a valid document (forward-compatible). */
export function normalizeProject(raw: unknown): ProjectDocument {
  const doc = (raw ?? {}) as Partial<ProjectDocument>;
  const base = createDefaultComposition();
  const comp = (doc.composition ?? {}) as Partial<CompositionState>;
  const tr = (comp.transform ?? {}) as Partial<TransformState>;
  const composition: CompositionState = {
    name: str(comp.name, base.name),
    width: Math.max(1, num(comp.width, base.width)),
    height: Math.max(1, num(comp.height, base.height)),
    fps: Math.max(1, num(comp.fps, base.fps)),
    duration: Math.max(0.1, num(comp.duration, base.duration)),
    background: str(comp.background, base.background),
    transform: {
      x: num(tr.x, 0),
      y: num(tr.y, 0),
      scale: num(tr.scale, 1),
      rotation: num(tr.rotation, 0),
      opacity: num(tr.opacity, 1),
    },
  };
  const safe = (doc.safeZones ?? {}) as Partial<SafeZoneState>;
  const graph = doc.graph as DAG | undefined;
  return {
    format: 'vfxproj',
    version: num(doc.version, PROJECT_VERSION),
    savedAt: str(doc.savedAt, new Date().toISOString()),
    app: doc.app ?? { name: APP_NAME, version: APP_VERSION },
    composition,
    genre: GENRE_IDS.includes(doc.genre as GenreId) ? (doc.genre as GenreId) : 'corporate',
    safeZones: {
      active: safe.active === true,
      ratio: RATIOS.includes(safe.ratio as SafeZoneRatio) ? (safe.ratio as SafeZoneRatio) : '16:9',
    },
    brandLUT: str(doc.brandLUT, 'none'),
    timeline: sanitizeTimeline(doc.timeline, composition.duration),
    graph:
      graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)
        ? graph
        : { nodes: [], edges: [] },
    effectsStack: Array.isArray(doc.effectsStack)
      ? doc.effectsStack.filter((x): x is string => typeof x === 'string')
      : [],
  };
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'composition'
  );
}

export function suggestedFileName(doc: ProjectDocument, format: ProjectFormat): string {
  return `${slugify(doc.composition.name)}${format === 'binary' ? BINARY_EXT : JSON_EXT}`;
}

// ── IPC result shapes (shared with the preload bridge) ───────────────────────

export interface SaveResult {
  canceled: boolean;
  path?: string;
  format?: ProjectFormat;
  bytes?: number;
}

export interface OpenResult {
  canceled: boolean;
  path?: string;
  format?: ProjectFormat;
  doc?: unknown;
}
