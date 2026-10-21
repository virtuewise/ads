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

  it('keeps media assets through a round-trip', () => {
    const doc = normalizeProject({
      composition: createDefaultComposition(),
      assets: [
        {
          id: 'media-1',
          path: 'C:/footage/hero.mp4',
          name: 'hero.mp4',
          duration: 12.5,
          width: 1920,
          height: 1080,
          fps: 30,
          codec: 'avc1.42c01e',
        },
      ],
    });
    expect(doc.assets).toHaveLength(1);
    expect(doc.assets?.[0].path).toBe('C:/footage/hero.mp4');
    expect(doc.assets?.[0].codec).toBe('avc1.42c01e');
  });

  it('drops a malformed asset rather than the whole document', () => {
    const doc = normalizeProject({
      composition: createDefaultComposition(),
      assets: [null, 7, { id: 'a', path: 'p', name: 'n' }],
    });
    expect(doc.assets).toHaveLength(1);
    expect(doc.assets?.[0].id).toBe('a');
    // Defaults fill in the rest.
    expect(doc.assets?.[0].duration).toBe(0);
    expect(doc.assets?.[0].fps).toBe(30);
  });

  it('has no assets when the document has none', () => {
    const doc = normalizeProject({ composition: createDefaultComposition() });
    expect(doc.assets).toEqual([]);
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
      assets: [
        {
          id: 'media-1',
          path: 'C:/footage/clip.mp4',
          name: 'clip.mp4',
          duration: 2,
          width: 320,
          height: 180,
          fps: 30,
          codec: 'avc1.42c01e',
        },
      ],
    });
    const round = normalizeProject(built);
    expect(round.timeline.clips[0].mediaId).toBe('media-1');
    expect(round.timeline.clips[0].name).toBe('clip.mp4');
    expect(round.assets?.[0].path).toBe('C:/footage/clip.mp4');
  });
});
