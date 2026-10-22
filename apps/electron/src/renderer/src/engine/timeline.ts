// ── Timeline Model ───────────────────────────────────────────────────────────
// Pure document transforms for clips and keyframes. All functions return a new
// TimelineDoc so React state updates stay immutable and undo-friendly.

import type { IconName } from '../components/Icon';
import { easeValue } from './easing';
import type { TextMotion, TextStyle } from './text';
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

/** A new composition starts clean; real clips are added from media or tools. */
export function createEmptyTimeline(duration: number): TimelineDoc {
  return { duration: Math.max(0.1, duration), clips: [] };
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
    ...(clip.mediaId ? { sourceStart: (clip.sourceStart ?? 0) + (t - clip.start) } : {}),
    keyframes: clip.keyframes.filter((k) => k.time >= t).map((k) => ({ ...k, id: nextId('kf') })),
  };
  return {
    ...doc,
    clips: [...doc.clips.filter((c) => c.id !== id), left, right].sort((a, b) => a.start - b.start),
  };
}

/** Set a clip's name and range in one go. */
export function setClipFields(
  doc: TimelineDoc,
  id: string,
  name: string,
  start: number,
  end: number,
): TimelineDoc {
  return {
    ...doc,
    clips: doc.clips.map((c) => (c.id === id ? { ...c, name, start, end } : c)),
  };
}

/** Rename a clip. */
export function renameClip(doc: TimelineDoc, id: string, name: string): TimelineDoc {
  return { ...doc, clips: doc.clips.map((c) => (c.id === id ? { ...c, name } : c)) };
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

/** Create a timeline clip that owns one editor-authored text graph node. */
export function createTextClip(
  doc: TimelineDoc,
  opts: { textNodeId: string; name: string; start: number; duration: number },
): TimelineClip | null {
  const start = clamp(opts.start, 0, Math.max(0, doc.duration - 0.05));
  const end = Math.min(doc.duration, start + Math.max(0.2, opts.duration));
  if (end - start < 0.2) return null;
  return {
    id: nextId('text'),
    trackId: 'captions',
    start,
    end,
    name: opts.name,
    keyframes: [],
    textNodeId: opts.textNodeId,
  };
}

/** Add a named motion treatment to a title's independent property channels. */
export function applyTextMotion(
  doc: TimelineDoc,
  clipId: string,
  motion: TextMotion,
  style: Pick<TextStyle, 'x' | 'y' | 'opacity' | 'scale' | 'rotation'>,
  duration = 0.7,
): TimelineDoc {
  const clip = findClip(doc, clipId);
  if (!clip) return doc;
  const start = clip.start;
  const end = Math.min(clip.end, start + Math.max(0.05, duration));
  const span = Math.max(0.05, end - start);
  const properties =
    motion === 'fade-rise'
      ? ['opacity', 'y', 'scale']
      : motion === 'slide-in'
        ? ['opacity', 'x']
        : motion === 'pop'
          ? ['opacity', 'scale']
          : motion === 'caption-fade'
            ? ['opacity', 'y']
            : ['reveal'];
  let next: TimelineDoc = {
    ...doc,
    clips: doc.clips.map((item) =>
      item.id === clipId
        ? {
            ...item,
            keyframes: item.keyframes.filter((keyframe) => !properties.includes(keyframe.property)),
          }
        : item,
    ),
  };
  const key = (time: number, property: string, value: number) => {
    next = addKeyframe(next, clipId, time, property, value, 'easeOut');
  };
  const alpha = style.opacity ?? 1;
  const scale = style.scale ?? 1;

  if (motion === 'fade-rise') {
    key(start, 'opacity', 0);
    key(end, 'opacity', alpha);
    key(start, 'y', Math.min(1, style.y + 0.065));
    key(end, 'y', style.y);
    key(start, 'scale', scale * 0.94);
    key(end, 'scale', scale);
  } else if (motion === 'slide-in') {
    key(start, 'opacity', 0);
    key(end, 'opacity', alpha);
    key(start, 'x', Math.max(0, style.x - 0.12));
    key(end, 'x', style.x);
  } else if (motion === 'pop') {
    key(start, 'opacity', 0);
    key(end, 'opacity', alpha);
    key(start, 'scale', scale * 0.82);
    key(start + span * 0.72, 'scale', scale * 1.055);
    key(end, 'scale', scale);
  } else if (motion === 'caption-fade') {
    key(start, 'opacity', 0);
    key(end, 'opacity', alpha);
    key(start, 'y', Math.min(1, style.y + 0.025));
    key(end, 'y', style.y);
  } else {
    key(start, 'reveal', 0);
    key(end, 'reveal', 1);
  }
  return next;
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
  const kf: Keyframe = existing
    ? { ...existing, value, easing }
    : { id: nextId('kf'), time: t, property, value, easing };
  const keyframes = existing
    ? clip.keyframes.map((keyframe) => (keyframe.id === existing.id ? kf : keyframe))
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

/** Set a keyframe's scalar value without changing its time or easing. */
export function setKeyframeValue(
  doc: TimelineDoc,
  clipId: string,
  kfId: string,
  value: number,
): TimelineDoc {
  if (!Number.isFinite(value)) return doc;
  return {
    ...doc,
    clips: doc.clips.map((clip) =>
      clip.id === clipId
        ? {
            ...clip,
            keyframes: clip.keyframes.map((keyframe) =>
              keyframe.id === kfId ? { ...keyframe, value } : keyframe,
            ),
          }
        : clip,
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
