// ── Project Document ─────────────────────────────────────────────────────────
// The `.vfxproj` document is the unit of persistence. The renderer builds it
// from live state and the main process serializes it as deterministic JSON
// (git-friendly) or a compact checksummed binary blob.

import { EASING_ORDER } from './easing';
import { reconcileTransitions } from './timeline';
import type {
  CompositionState,
  DAG,
  GenreId,
  KeyframeEasing,
  MediaAsset,
  ProjectDocument,
  ProjectFormat,
  SafeZoneRatio,
  SafeZoneState,
  TimelineDoc,
  TransformState,
} from './types';

export const PROJECT_VERSION = 4;
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
  /** Imported media the timeline references. */
  assets?: MediaAsset[];
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
    ...(input.assets && input.assets.length > 0 ? { assets: input.assets } : {}),
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
      // The full easing library, not just the original four — a saved project
      // must not silently downgrade a bounceOut to easeInOut.
      easing: (EASING_ORDER as string[]).includes(k.easing as string)
        ? (k.easing as TimelineDoc['clips'][number]['keyframes'][number]['easing'])
        : 'easeInOut',
    }))
    .sort((a, b) => a.time - b.time);
}

function sanitizeAssets(raw: unknown): MediaAsset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a, i) => ({
      id: str(a.id, `asset-${i}`),
      path: str(a.path, ''),
      name: str(a.name, 'Media'),
      duration: num(a.duration, 0),
      width: num(a.width, 0),
      height: num(a.height, 0),
      fps: num(a.fps, 30),
      codec: str(a.codec, ''),
    }));
}

function sanitizeTimeline(raw: unknown, duration: number): TimelineDoc {
  const doc = (raw ?? {}) as { duration?: unknown; clips?: unknown };
  const clips = Array.isArray(doc.clips)
    ? doc.clips
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c, i) => {
          const mediaId = str(c.mediaId, '');
          const textNodeId = str(c.textNodeId, '');
          const rawTransition = c.transition;
          let transition: TimelineDoc['clips'][number]['transition'];
          if (rawTransition && typeof rawTransition === 'object' && !Array.isArray(rawTransition)) {
            const value = rawTransition as Record<string, unknown>;
            const type = value.type;
            const fromClipId = str(value.fromClipId, '');
            const toClipId = str(value.toClipId, '');
            const color = str(value.color, '#000000');
            if (
              (type === 'dip-black' || type === 'dip-white' || type === 'dip-color') &&
              fromClipId &&
              toClipId
            ) {
              transition = {
                type,
                fromClipId,
                toClipId,
                color: /^#[\da-f]{6}$/i.test(color) ? color : '#000000',
                easing: (EASING_ORDER as string[]).includes(value.easing as string)
                  ? (value.easing as KeyframeEasing)
                  : 'easeInOut',
              };
            }
          }
          const rawLook = c.look;
          const look: Record<string, Record<string, unknown>> | undefined =
            rawLook && typeof rawLook === 'object' && !Array.isArray(rawLook)
              ? (Object.fromEntries(
                  Object.entries(rawLook as Record<string, unknown>).filter(
                    ([, value]) => value && typeof value === 'object' && !Array.isArray(value),
                  ),
                ) as Record<string, Record<string, unknown>>)
              : undefined;
          return {
            id: str(c.id, `clip-${i}`),
            trackId: str(c.trackId, 'video'),
            start: num(c.start, 0),
            end: num(c.end, 1),
            name: str(c.name, 'Clip'),
            keyframes: sanitizeKeyframes(c.keyframes),
            // A media binding survives a save/load round-trip.
            ...(mediaId ? { mediaId } : {}),
            ...(mediaId ? { sourceStart: num(c.sourceStart, 0) } : {}),
            ...(textNodeId ? { textNodeId } : {}),
            ...(transition ? { transition } : {}),
            ...(look ? { look } : {}),
          };
        })
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
  const timeline = reconcileTransitions(sanitizeTimeline(doc.timeline, composition.duration));
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
    timeline,
    graph:
      graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)
        ? graph
        : { nodes: [], edges: [] },
    effectsStack: Array.isArray(doc.effectsStack)
      ? doc.effectsStack.filter((x): x is string => typeof x === 'string')
      : [],
    assets: sanitizeAssets(doc.assets),
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
