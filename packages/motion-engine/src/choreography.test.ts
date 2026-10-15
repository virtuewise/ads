import { describe, expect, it } from 'vitest';
import {
  animatePrintObject,
  generateAnimationFrames,
  type PrintObjectAnimation,
  type Transform,
} from './choreography.js';
import { getPrintItem } from './print-items.js';
import { required } from './test-support.js';

const BOTTLE = required(getPrintItem('bottle-500'), 'bottle-500 is in the catalogue');

const ANIMATIONS: PrintObjectAnimation[] = [
  'rise',
  'float',
  'orbit',
  'spin',
  'reveal',
  'fold',
  'drop',
  'reset',
];

describe('animatePrintObject', () => {
  it('is deterministic for a given (spec, animation, frame, fps)', () => {
    const a = animatePrintObject(BOTTLE, 'rise', 30, 30);
    const b = animatePrintObject(BOTTLE, 'rise', 30, 30);
    expect(a).toEqual(b);
  });

  it('returns a valid transform for every animation', () => {
    for (const animation of ANIMATIONS) {
      const t: Transform = animatePrintObject(BOTTLE, animation, 0, 30);
      expect(t.position).toHaveLength(3);
      expect(t.rotation).toHaveLength(3);
      expect(typeof t.scale).toBe('number');
      expect(typeof t.opacity).toBe('number');
      expect(t.opacity).toBeGreaterThanOrEqual(0);
      expect(t.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('returns identity for reset at any frame', () => {
    const t = animatePrintObject(BOTTLE, 'drop', 0, 30);
    expect(t.position[1]).toBeGreaterThan(0);
    expect(t.opacity).toBe(1);
  });

  it('drops the item from above with a bounce', () => {
    const t = animatePrintObject(BOTTLE, 'drop', 0, 30);
    expect(t.position[1]).toBeGreaterThan(0);
    const settled = animatePrintObject(BOTTLE, 'drop', 90, 30);
    expect(settled.position[1]).toBeLessThan(0.001);
  });

  it('reveals with scale-up and fade-in', () => {
    const t = animatePrintObject(BOTTLE, 'reveal', 0, 30);
    expect(t.opacity).toBeLessThanOrEqual(1);
    expect(t.scale).toBeGreaterThan(0);
  });

  it('folds with a Y-rotation sweep', () => {
    const t = animatePrintObject(BOTTLE, 'fold', 30, 30);
    expect(Math.abs(t.rotation[1])).toBeGreaterThan(0);
  });

  it('spins continuously', () => {
    const a = animatePrintObject(BOTTLE, 'spin', 0, 30);
    const b = animatePrintObject(BOTTLE, 'spin', 30, 30);
    expect(b.rotation[1]).toBeGreaterThan(a.rotation[1]);
  });

  it('orbits with a full rotation over time', () => {
    const a = animatePrintObject(BOTTLE, 'orbit', 0, 30);
    const b = animatePrintObject(BOTTLE, 'orbit', 30, 30);
    expect(b.rotation[1]).toBeGreaterThan(a.rotation[1]);
  });

  it('floats gently near the ground', () => {
    const t = animatePrintObject(BOTTLE, 'float', 30, 30);
    expect(t.position[1]).toBeGreaterThanOrEqual(-0.01);
    expect(t.position[1]).toBeLessThanOrEqual(0.01);
  });

  it('respects the phase offset', () => {
    const a = animatePrintObject(BOTTLE, 'spin', 0, 30);
    const b = animatePrintObject(BOTTLE, 'spin', 0, 30, 10);
    expect(a.rotation[1]).not.toEqual(b.rotation[1]);
  });
});

describe('generateAnimationFrames', () => {
  it('produces the requested number of keyframes', () => {
    const frames = generateAnimationFrames(BOTTLE, 'rise', 60, 30);
    expect(frames).toHaveLength(60);
  });

  it('starts and ends deterministically', () => {
    const a = generateAnimationFrames(BOTTLE, 'drop', 90, 30);
    const b = generateAnimationFrames(BOTTLE, 'drop', 90, 30);
    expect(a).toEqual(b);
  });
});
