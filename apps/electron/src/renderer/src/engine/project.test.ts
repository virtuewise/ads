// ── Project document tests ────────────────────────────────────────────────────
// `normalizeProject` is the forward-compatibility boundary: whatever a
// `.vfxproj` file contains, the editor must load it without losing anything
// it understands.

import { describe, expect, it } from 'vitest';
import { buildProject, createDefaultComposition, normalizeProject } from './project';

function docWith(timeline: unknown) {
  return normalizeProject({
    composition: createDefaultComposition(),
    timeline,
  });
}

describe('normalizeProject — timeline sanitising', () => {
  it('keeps a media binding through a round-trip', () => {
    const doc = docWith({
      duration: 12,
      clips: [
        {
          id: 'c1',
          trackId: 'video',
          start: 1,
          end: 3,
          name: 'footage.mp4',
          keyframes: [],
          mediaId: 'media-abc',
          sourceStart: 0.5,
        },
      ],
    });
    const clip = doc.timeline.clips[0];
    expect(clip.mediaId).toBe('media-abc');
    expect(clip.sourceStart).toBe(0.5);
  });

  it('does not invent a media binding', () => {
    const doc = docWith({
      duration: 12,
      clips: [{ id: 'c1', trackId: 'video', start: 0, end: 1, name: 'Title', keyframes: [] }],
    });
    expect(doc.timeline.clips[0].mediaId).toBeUndefined();
    expect(doc.timeline.clips[0].sourceStart).toBeUndefined();
  });

  it('keeps the full easing library, not just the original four', () => {
    const doc = docWith({
      duration: 12,
      clips: [
        {
          id: 'c1',
          trackId: 'video',
          start: 0,
          end: 1,
          name: 'Title',
          keyframes: [{ id: 'k1', time: 0.5, property: 'opacity', value: 1, easing: 'bounceOut' }],
        },
      ],
    });
    expect(doc.timeline.clips[0].keyframes[0].easing).toBe('bounceOut');
  });

  it('falls back on an unknown easing', () => {
    const doc = docWith({
      duration: 12,
      clips: [
        {
          id: 'c1',
          trackId: 'video',
          start: 0,
          end: 1,
          name: 'Title',
          keyframes: [{ id: 'k1', time: 0.5, property: 'opacity', value: 1, easing: 'wobble' }],
        },
      ],
    });
    expect(doc.timeline.clips[0].keyframes[0].easing).toBe('easeInOut');
  });

  it('survives a malformed timeline', () => {
    const doc = docWith({ duration: 'nope', clips: [null, 42, { name: 'ok' }] });
    expect(doc.timeline.duration).toBeGreaterThan(0);
    expect(doc.timeline.clips).toHaveLength(1);
    expect(doc.timeline.clips[0].name).toBe('ok');
  });
});

describe('buildProject', () => {
  it('round-trips a document through build and normalize', () => {
    const comp = createDefaultComposition();
    const built = buildProject({
      composition: comp,
      genre: 'corporate',
      safeZones: { active: false, ratio: '16:9' },
      brandLUT: 'none',
      timeline: {
        duration: comp.duration,
        clips: [
          {
            id: 'c1',
            trackId: 'video',
            start: 0,
            end: 2,
            name: 'clip.mp4',
            keyframes: [],
            mediaId: 'media-1',
            sourceStart: 0,
          },
        ],
      },
      graph: { nodes: [], edges: [] },
      effectsStack: [],
    });
    const round = normalizeProject(built);
    expect(round.timeline.clips[0].mediaId).toBe('media-1');
    expect(round.timeline.clips[0].name).toBe('clip.mp4');
  });
});
