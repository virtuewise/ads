import { describe, expect, it } from 'vitest';
import { moveClip, removeClips, setClipRange, splitClip } from './timeline';
import {
  canAddDipTransition,
  compositeTransitionOverlay,
  createDipTransition,
  setTransitionDefinition,
  setTransitionDuration,
  transitionOverlayAtTime,
} from './transitions';
import type { TimelineDoc } from './types';

const adjacentTimeline = (): TimelineDoc => ({
  duration: 8,
  clips: [
    { id: 'first', trackId: 'video', start: 0, end: 3, name: 'Opening', keyframes: [] },
    { id: 'second', trackId: 'video', start: 3, end: 6, name: 'Second shot', keyframes: [] },
  ],
});

describe('timeline transitions', () => {
  it('creates an editable transition centered on a real cut', () => {
    const timeline = adjacentTimeline();
    const transition = createDipTransition(timeline, 'first');

    expect(transition).toMatchObject({
      trackId: 'transitions',
      name: 'Dip to black',
      start: 2.4,
      end: 3.6,
      transition: {
        type: 'dip-black',
        fromClipId: 'first',
        toClipId: 'second',
        easing: 'easeInOut',
      },
    });
    if (!transition) throw new Error('Expected an adjacent transition');
    expect(
      canAddDipTransition({ ...timeline, clips: [...timeline.clips, transition] }, 'first'),
    ).toBe(false);
  });

  it('requires adjacent clips and rejects transitions without enough room', () => {
    const gap = adjacentTimeline();
    gap.clips[1].start = 3.1;
    expect(createDipTransition(gap, 'first')).toBeNull();

    const short: TimelineDoc = {
      duration: 1,
      clips: [
        { id: 'a', trackId: 'video', start: 0, end: 0.15, name: 'A', keyframes: [] },
        { id: 'b', trackId: 'video', start: 0.15, end: 0.3, name: 'B', keyframes: [] },
      ],
    };
    expect(canAddDipTransition(short, 'a')).toBe(false);
    expect(createDipTransition(short, 'a')).toBeNull();
  });

  it('evaluates the overlay at the edges and cut, and supports color dips', () => {
    const timeline = adjacentTimeline();
    const transition = createDipTransition(timeline, 'first', 'dip-color');
    if (!transition) throw new Error('Expected an adjacent transition');
    const clips = [...timeline.clips, transition];

    expect(transitionOverlayAtTime(clips, transition.start)).toMatchObject({
      color: '#000000',
      opacity: 0,
    });
    expect(transitionOverlayAtTime(clips, 3)?.opacity).toBe(1);
    expect(transitionOverlayAtTime(clips, transition.end)).toBeNull();

    const changed = setTransitionDefinition({ duration: 8, clips }, transition.id, {
      color: '#244466',
    });
    expect(transitionOverlayAtTime(changed.clips, 3)).toEqual({ color: '#244466', opacity: 1 });
  });

  it('changes duration without shifting the cut and stays within clip handles', () => {
    const timeline = adjacentTimeline();
    const transition = createDipTransition(timeline, 'first');
    if (!transition) throw new Error('Expected an adjacent transition');
    const changed = setTransitionDuration(
      { ...timeline, clips: [...timeline.clips, transition] },
      transition.id,
      0.6,
    );
    const result = changed.clips.find((clip) => clip.id === transition.id);

    expect(result?.start).toBeCloseTo(2.7);
    expect(result?.end).toBeCloseTo(3.3);
  });

  it('removes transitions when a cut is split, deleted, or trimmed apart', () => {
    const timeline = adjacentTimeline();
    const transition = createDipTransition(timeline, 'first');
    if (!transition) throw new Error('Expected an adjacent transition');
    const withTransition = { ...timeline, clips: [...timeline.clips, transition] };

    expect(splitClip(withTransition, 'first', 1).clips.some((clip) => clip.transition)).toBe(false);
    expect(removeClips(withTransition, new Set(['second'])).clips).toHaveLength(1);
    expect(
      setClipRange(withTransition, 'first', 0, 2.8).clips.some((clip) => clip.transition),
    ).toBe(false);
    expect(moveClip(withTransition, 'second', 0.5).clips.some((clip) => clip.transition)).toBe(
      false,
    );
  });

  it('composites the dip color into RGBA export frames', () => {
    const pixels = new Uint8Array([100, 120, 140, 20, 0, 0, 0, 255]);
    compositeTransitionOverlay(pixels, '#ffffff', 0.5);
    expect([...pixels]).toEqual([178, 188, 198, 255, 128, 128, 128, 255]);
  });
});
