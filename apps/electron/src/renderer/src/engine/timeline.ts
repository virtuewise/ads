// ── Timeline Model ───────────────────────────────────────────────────────────
// Pure document transforms for clips and keyframes. All functions return a new
// TimelineDoc so React state updates stay immutable and undo-friendly.

import type { IconName } from '../components/Icon';
import { easeValue } from './easing';
import type { Keyframe, KeyframeEasing, TimelineClip, TimelineDoc } from './types';

export interface TrackMeta {
  id: string;
  name: string;
  icon: IconName;
  color: string;
}

export const TRACKS: TrackMeta[] = [
  { id: 'video', name: 'Video', icon: 'film', color: '#ff5a2c' },
  { id: 'audio', name: 'Audio', icon: 'music', color: '#5eead4' },
  { id: 'captions', name: 'Captions', icon: 'captions', color: '#ffb347' },
  { id: 'effects', name: 'Effects', icon: 'wand', color: '#a78bfa' },
  { id: 'transitions', name: 'Transitions', icon: 'shuffle', color: '#f472b6' },
];

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export const SNAP_THRESHOLD = 0.09;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function snapTime(time: number, targets: number[], threshold = SNAP_THRESHOLD): number {
  let best = time;
  let bestDist = threshold;
  for (const t of targets) {
    const dist = Math.abs(t - time);
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return best;
}

/** Seed a default timeline from engine-provided caption/effect names. */
export function defaultTimeline(
  captionNames: string[],
  effectNames: string[],
  duration: number,
): TimelineDoc {
  const caps =
    captionNames.length > 0
      ? captionNames.slice(0, 2).map((name, i) => ({
          start: i === 0 ? 0.8 : 7,
          end: i === 0 ? 4.2 : Math.min(10.5, duration),
          name,
        }))
      : [
          { start: 0.8, end: 4.2, name: 'Opening Title' },
          { start: 7, end: Math.min(10.5, duration), name: 'Closing Tagline' },
        ];
  const fx =
    effectNames.length > 0
      ? effectNames.slice(0, 3).map((name, i) => ({
          start: 0.5 + i * 4,
          end: Math.min(3.3 + i * 4, duration),
          name,
        }))
      : [
          { start: 0.5, end: 3.3, name: 'Glow' },
          { start: 4.5, end: Math.min(7.3, duration), name: 'Chromatic Blur' },
        ];

  const clips: TimelineClip[] = [
    ...seed('video', [
      { start: 0, end: Math.min(6.4, duration), name: 'Main Comp' },
      { start: 6.9, end: duration, name: 'B-Roll 02' },
    ]),
    ...seed('audio', [{ start: 0, end: duration, name: 'Score: Main Theme' }]),
    ...seed('captions', caps),
    ...seed('effects', fx),
    ...seed('transitions', [
      { start: Math.max(0, 6.3), end: Math.min(7, duration), name: 'Cross Dissolve' },
    ]),
  ];
  return { duration, clips };
}

function seed(
  trackId: string,
  items: Array<{ start: number; end: number; name: string }>,
): TimelineClip[] {
  return items.map((it) => ({
    id: nextId('clip'),
    trackId,
    start: it.start,
    end: it.end,
    name: it.name,
    keyframes: [],
  }));
}

export function findClip(doc: TimelineDoc, id: string): TimelineClip | undefined {
  return doc.clips.find((c) => c.id === id);
}

/** Set a clip's absolute range with snapping and clamping. */
export function setClipRange(
  doc: TimelineDoc,
  id: string,
  start: number,
  end: number,
  snapTargets: number[] = [],
): TimelineDoc {
  const min = 0.2;
  let s = clamp(start, 0, doc.duration - min);
  let e = clamp(end, s + min, doc.duration);
  if (snapTargets.length > 0) {
    s = clamp(snapTime(s, snapTargets), 0, doc.duration - min);
    e = clamp(snapTime(e, snapTargets), s + min, doc.duration);
  }
  return { ...doc, clips: doc.clips.map((c) => (c.id === id ? { ...c, start: s, end: e } : c)) };
}

export function clipsFor(doc: TimelineDoc, trackId: string): TimelineClip[] {
  return doc.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

/** Move a clip by delta seconds, clamped to the doc and snapped to neighbours. */
export function moveClip(
  doc: TimelineDoc,
  id: string,
  delta: number,
  snapTargets: number[] = [],
): TimelineDoc {
  const clip = findClip(doc, id);
  if (!clip) return doc;
  const len = clip.end - clip.start;
  let start = clamp(clip.start + delta, 0, Math.max(0, doc.duration - len));
  start = clamp(snapTime(start, snapTargets), 0, Math.max(0, doc.duration - len));
  const end = start + len;
  return {
    ...doc,
    clips: doc.clips.map((c) => (c.id === id ? { ...c, start, end } : c)),
  };
}

/** Trim a clip edge to an absolute time, respecting the minimum clip length. */
export function trimClip(
  doc: TimelineDoc,
  id: string,
  edge: 'start' | 'end',
  time: number,
  snapTargets: number[] = [],
): TimelineDoc {
  const clip = findClip(doc, id);
  if (!clip) return doc;
  const t = clamp(snapTime(time, snapTargets), 0, doc.duration);
  const min = 0.2;
  const next =
    edge === 'start'
      ? { start: Math.min(t, clip.end - min), end: clip.end }
      : { start: clip.start, end: Math.max(t, clip.start + min) };
  return { ...doc, clips: doc.clips.map((c) => (c.id === id ? { ...c, ...next } : c)) };
}

/** Split a clip at a given time, returning two clips. */
export function splitClip(doc: TimelineDoc, id: string, time: number): TimelineDoc {
  const clip = findClip(doc, id);
  if (!clip) return doc;
  const t = clamp(time, clip.start + 0.2, clip.end - 0.2);
  if (t <= clip.start || t >= clip.end) return doc;
  const left: TimelineClip = {
    ...clip,
    id: nextId('clip'),
    start: clip.start,
    end: t,
    keyframes: clip.keyframes.filter((k) => k.time <= t),
  };
  const right: TimelineClip = {
    ...clip,
    id: nextId('clip'),
    start: t,
    end: clip.end,
    keyframes: clip.keyframes.filter((k) => k.time >= t).map((k) => ({ ...k, id: nextId('kf') })),
  };
  return {
    ...doc,
    clips: [...doc.clips.filter((c) => c.id !== id), left, right].sort((a, b) => a.start - b.start),
  };
}

/**
 * Append a clip that shows imported media.
 *
 * The clip is bounded by the composition's duration, and its in-point starts
 * at the beginning of the source.
 */
export function addMediaClip(
  doc: TimelineDoc,
  opts: {
    mediaId: string;
    name: string;
    start: number;
    duration: number;
    trackId?: string;
  },
): TimelineDoc {
  const start = clamp(opts.start, 0, Math.max(0, doc.duration - 0.05));
  const end = Math.min(doc.duration, start + Math.max(0.05, opts.duration));
  if (end <= start) return doc;
  const clip: TimelineClip = {
    id: nextId('clip'),
    trackId: opts.trackId ?? 'video',
    start,
    end,
    name: opts.name,
    keyframes: [],
    mediaId: opts.mediaId,
    sourceStart: 0,
  };
  return { ...doc, clips: [...doc.clips, clip] };
}

export function addKeyframe(
  doc: TimelineDoc,
  clipId: string,
  time: number,
  property = 'opacity',
  value = 1,
  easing: KeyframeEasing = 'easeInOut',
): TimelineDoc {
  const clip = findClip(doc, clipId);
  if (!clip) return doc;
  const t = clamp(time, clip.start, clip.end);
  const existing = clip.keyframes.find(
    (k) => Math.abs(k.time - t) < 0.02 && k.property === property,
  );
  const kf: Keyframe = existing ?? { id: nextId('kf'), time: t, property, value, easing };
  const keyframes = existing
    ? clip.keyframes
    : [...clip.keyframes, kf].sort((a, b) => a.time - b.time);
  return { ...doc, clips: doc.clips.map((c) => (c.id === clipId ? { ...c, keyframes } : c)) };
}

export function removeKeyframe(doc: TimelineDoc, clipId: string, kfId: string): TimelineDoc {
  return {
    ...doc,
    clips: doc.clips.map((c) =>
      c.id === clipId ? { ...c, keyframes: c.keyframes.filter((k) => k.id !== kfId) } : c,
    ),
  };
}

export function moveKeyframe(
  doc: TimelineDoc,
  clipId: string,
  kfId: string,
  time: number,
): TimelineDoc {
  const clip = findClip(doc, clipId);
  if (!clip) return doc;
  const t = clamp(time, clip.start, clip.end);
  return {
    ...doc,
    clips: doc.clips.map((c) =>
      c.id === clipId
        ? {
            ...c,
            keyframes: c.keyframes
              .map((k) => (k.id === kfId ? { ...k, time: t } : k))
              .sort((a, b) => a.time - b.time),
          }
        : c,
    ),
  };
}

export function setKeyframeEasing(
  doc: TimelineDoc,
  clipId: string,
  kfId: string,
  easing: KeyframeEasing,
): TimelineDoc {
  return {
    ...doc,
    clips: doc.clips.map((c) =>
      c.id === clipId
        ? { ...c, keyframes: c.keyframes.map((k) => (k.id === kfId ? { ...k, easing } : k)) }
        : c,
    ),
  };
}

/** Sample an eased value across a clip's keyframes at a given time.
 *  Pass `property` to filter to a single property channel (recommended).
 *  Without a property filter, keyframes of different properties may cross-contaminate. */
export function sampleKeyframes(
  keyframes: Keyframe[],
  time: number,
  fallback = 1,
  property?: string,
): number {
  const filtered = property ? keyframes.filter((k) => k.property === property) : keyframes;
  if (filtered.length === 0) return fallback;
  const sorted = [...filtered].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1;
      const t = ease((time - a.time) / span, b.easing);
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

/** Sample a specific property channel from a clip's keyframes. */
export function sampleProperty(
  keyframes: Keyframe[],
  time: number,
  property: string,
  fallback = 1,
): number {
  return sampleKeyframes(keyframes, time, fallback, property);
}

function ease(t: number, kind: KeyframeEasing): number {
  return easeValue(t, kind);
}
