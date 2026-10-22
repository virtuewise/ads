import { describe, expect, it } from 'vitest';
import {
  addKeyframe,
  applyTextMotion,
  createEmptyTimeline,
  createTextClip,
  sampleProperty,
  setKeyframeValue,
  splitClip,
} from './timeline';

describe('text timeline layers', () => {
  it('creates a bounded text clip linked to its graph node', () => {
    const timeline = createEmptyTimeline(8);
    const clip = createTextClip(timeline, {
      textNodeId: 'text-1',
      name: 'Opening headline',
      start: 2,
      duration: 4,
    });

    expect(clip).toMatchObject({
      trackId: 'captions',
      start: 2,
      end: 6,
      textNodeId: 'text-1',
    });
  });

  it('builds independent channels for a moving title', () => {
    const empty = createEmptyTimeline(8);
    const clip = createTextClip(empty, {
      textNodeId: 'text-1',
      name: 'Headline',
      start: 1,
      duration: 3,
    });
    if (!clip) throw new Error('Expected a title clip');
    const timeline = { ...empty, clips: [clip] };
    const animated = applyTextMotion(
      timeline,
      clip.id,
      'fade-rise',
      { x: 0.5, y: 0.4, scale: 1, opacity: 1, rotation: 0 },
      0.6,
    );
    const keyframes = animated.clips[0].keyframes;

    expect(keyframes).toHaveLength(6);
    expect(sampleProperty(keyframes, 1, 'opacity', 1)).toBe(0);
    expect(sampleProperty(keyframes, 1.6, 'opacity', 0)).toBe(1);
    expect(sampleProperty(keyframes, 1, 'y', 0.4)).toBeCloseTo(0.465);
    expect(sampleProperty(keyframes, 1.6, 'y', 0.4)).toBeCloseTo(0.4);
  });

  it('updates a matching keyframe instead of silently keeping the old value', () => {
    const clip = {
      id: 'c1',
      trackId: 'captions',
      start: 0,
      end: 3,
      name: 'Headline',
      keyframes: [],
    };
    const timeline = { duration: 3, clips: [clip] };
    const withKey = addKeyframe(timeline, clip.id, 1, 'opacity', 0.2, 'linear');
    const updated = addKeyframe(withKey, clip.id, 1.01, 'opacity', 0.8, 'easeOut');

    expect(updated.clips[0].keyframes).toHaveLength(1);
    expect(updated.clips[0].keyframes[0]).toMatchObject({ value: 0.8, easing: 'easeOut' });
    const changed = setKeyframeValue(updated, clip.id, updated.clips[0].keyframes[0].id, 0.65);
    expect(changed.clips[0].keyframes[0].value).toBe(0.65);
  });

  it('advances the source in-point when splitting imported footage', () => {
    const timeline = {
      duration: 12,
      clips: [
        {
          id: 'media-1',
          trackId: 'video',
          start: 2,
          end: 8,
          name: 'B-roll',
          keyframes: [],
          mediaId: 'asset-1',
          sourceStart: 3,
        },
      ],
    };
    const split = splitClip(timeline, 'media-1', 5);
    const right = split.clips.find((clip) => clip.start === 5);

    expect(right).toMatchObject({ start: 5, end: 8, sourceStart: 6, mediaId: 'asset-1' });
  });
});
