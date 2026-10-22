import { easeValue } from './easing';
import { nextId } from './timeline';
import type {
  KeyframeEasing,
  TimelineClip,
  TimelineDoc,
  TransitionDefinition,
  TransitionType,
} from './types';

const MIN_TRANSITION_DURATION = 0.2;
const MAX_TRANSITION_DURATION = 1.2;
const CUT_TOLERANCE = 0.001;

export interface TransitionOverlay {
  color: string;
  opacity: number;
}

interface TransitionPair {
  from: TimelineClip;
  to: TimelineClip;
  cut: number;
}

function pairFor(doc: TimelineDoc, clipId: string): TransitionPair | null {
  const clips = doc.clips
    .filter((clip) => clip.trackId === 'video' && !clip.transition)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const index = clips.findIndex((clip) => clip.id === clipId);
  if (index < 0) return null;

  const candidates: TransitionPair[] = [];
  const addPair = (from: TimelineClip | undefined, to: TimelineClip | undefined) => {
    if (!from || !to) return;
    const gap = to.start - from.end;
    if (Math.abs(gap) > CUT_TOLERANCE) return;
    candidates.push({ from, to, cut: (from.end + to.start) / 2 });
  };

  addPair(clips[index - 1], clips[index]);
  addPair(clips[index], clips[index + 1]);
  return (
    candidates.sort(
      (a, b) =>
        Math.abs(a.to.start - a.from.end) - Math.abs(b.to.start - b.from.end) || a.cut - b.cut,
    )[0] ?? null
  );
}

export function canAddDipTransition(doc: TimelineDoc, clipId: string | null): boolean {
  if (!clipId) return false;
  const pair = pairFor(doc, clipId);
  if (!pair) return false;
  if (
    doc.clips.some(
      (clip) =>
        clip.transition?.fromClipId === pair.from.id && clip.transition.toClipId === pair.to.id,
    )
  ) {
    return false;
  }
  return (
    Math.min(pair.from.end - pair.from.start, pair.to.end - pair.to.start) >=
    MIN_TRANSITION_DURATION
  );
}

/** Build a dip-to-color transition centered on the cut next to a selected video clip. */
export function createDipTransition(
  doc: TimelineDoc,
  clipId: string,
  type: TransitionType = 'dip-black',
): TimelineClip | null {
  const pair = pairFor(doc, clipId);
  if (!pair || !canAddDipTransition(doc, clipId)) return null;

  const roomAroundCut = Math.min(pair.cut * 2, (doc.duration - pair.cut) * 2);
  const adjacentClipLength = Math.min(pair.from.end - pair.from.start, pair.to.end - pair.to.start);
  const duration = Math.min(MAX_TRANSITION_DURATION, adjacentClipLength * 0.8, roomAroundCut);
  if (duration < MIN_TRANSITION_DURATION) return null;

  const start = pair.cut - duration / 2;
  const end = pair.cut + duration / 2;
  const transition: TransitionDefinition = {
    type,
    fromClipId: pair.from.id,
    toClipId: pair.to.id,
    color: type === 'dip-white' ? '#ffffff' : '#000000',
    easing: 'easeInOut',
  };
  return {
    id: nextId('transition'),
    trackId: 'transitions',
    start,
    end,
    name: type === 'dip-white' ? 'Dip to white' : 'Dip to black',
    keyframes: [],
    transition,
  };
}

export function setTransitionDefinition(
  doc: TimelineDoc,
  clipId: string,
  patch: Partial<TransitionDefinition>,
): TimelineDoc {
  return {
    ...doc,
    clips: doc.clips.map((clip) => {
      if (clip.id !== clipId || !clip.transition) return clip;
      const transition = { ...clip.transition, ...patch };
      const name =
        transition.type === 'dip-black'
          ? 'Dip to black'
          : transition.type === 'dip-white'
            ? 'Dip to white'
            : 'Dip to color';
      return { ...clip, name, transition };
    }),
  };
}

export function setTransitionDuration(
  doc: TimelineDoc,
  clipId: string,
  requestedDuration: number,
): TimelineDoc {
  const clip = doc.clips.find((item) => item.id === clipId && item.transition);
  if (!clip?.transition || !Number.isFinite(requestedDuration)) return doc;
  const from = doc.clips.find((item) => item.id === clip.transition?.fromClipId);
  const to = doc.clips.find((item) => item.id === clip.transition?.toClipId);
  if (!from || !to) return doc;
  const cut = (from.end + to.start) / 2;
  const maxDuration = Math.min(
    MAX_TRANSITION_DURATION,
    (from.end - from.start) * 0.8,
    (to.end - to.start) * 0.8,
    cut * 2,
    (doc.duration - cut) * 2,
  );
  if (maxDuration < MIN_TRANSITION_DURATION) return doc;
  const duration = Math.min(maxDuration, Math.max(MIN_TRANSITION_DURATION, requestedDuration));
  return {
    ...doc,
    clips: doc.clips.map((item) =>
      item.id === clipId ? { ...item, start: cut - duration / 2, end: cut + duration / 2 } : item,
    ),
  };
}

/** Resolve the full-frame color overlay used by both the live canvas and export. */
export function transitionOverlayAtTime(
  clips: TimelineClip[],
  time: number,
): TransitionOverlay | null {
  const clip = [...clips]
    .filter((item) => item.transition && time >= item.start && time < item.end)
    .sort((a, b) => a.start - b.start)
    .at(-1);
  if (!clip?.transition) return null;

  const duration = clip.end - clip.start;
  if (duration <= 0) return null;
  const progress = Math.min(1, Math.max(0, (time - clip.start) / duration));
  const halfProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
  const opacity = easeValue(Math.min(1, Math.max(0, halfProgress)), clip.transition.easing);
  const color =
    clip.transition.type === 'dip-white'
      ? '#ffffff'
      : clip.transition.type === 'dip-color'
        ? clip.transition.color
        : '#000000';
  return { color, opacity };
}

export function isTransitionType(value: unknown): value is TransitionType {
  return value === 'dip-black' || value === 'dip-white' || value === 'dip-color';
}

export function isKeyframeEasing(value: unknown): value is KeyframeEasing {
  return (
    value === 'linear' ||
    value === 'easeIn' ||
    value === 'easeOut' ||
    value === 'easeInOut' ||
    value === 'sineIn' ||
    value === 'sineOut' ||
    value === 'sineInOut' ||
    value === 'cubicIn' ||
    value === 'cubicOut' ||
    value === 'cubicInOut' ||
    value === 'quartIn' ||
    value === 'quartOut' ||
    value === 'quartInOut' ||
    value === 'expoIn' ||
    value === 'expoOut' ||
    value === 'expoInOut' ||
    value === 'backIn' ||
    value === 'backOut' ||
    value === 'backInOut' ||
    value === 'elasticIn' ||
    value === 'elasticOut' ||
    value === 'elasticInOut' ||
    value === 'bounceIn' ||
    value === 'bounceOut' ||
    value === 'bounceInOut'
  );
}

/** Apply a full-frame overlay to exported RGBA pixels. */
export function compositeTransitionOverlay(
  pixels: Uint8Array,
  color: string,
  opacity: number,
): void {
  const match = /^#?([\da-f]{6})$/i.exec(color);
  if (!match || !Number.isFinite(opacity) || pixels.length % 4 !== 0) return;
  const hex = match[1];
  const channels = [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
  const alpha = Math.min(1, Math.max(0, opacity));
  if (alpha <= 0) return;
  const sourceAlpha = 1 - alpha;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = Math.round(pixels[index] * sourceAlpha + channels[0] * alpha);
    pixels[index + 1] = Math.round(pixels[index + 1] * sourceAlpha + channels[1] * alpha);
    pixels[index + 2] = Math.round(pixels[index + 2] * sourceAlpha + channels[2] * alpha);
    pixels[index + 3] = 255;
  }
}
