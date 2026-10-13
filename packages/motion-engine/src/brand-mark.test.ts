import { describe, it, expect } from 'vitest';
import { PRINTSYNC_MARK, brandMarkTones } from './brand-mark.js';

describe('PRINTSYNC_MARK', () => {
  it('keeps the roundel in a square artboard', () => {
    expect(PRINTSYNC_MARK.viewBox).toBeGreaterThan(0);
    expect(PRINTSYNC_MARK.name).toBe('PrintSync');
  });

  it('carries at least one drawable layer', () => {
    expect(PRINTSYNC_MARK.layers.length).toBeGreaterThan(0);
  });

  it('draws every layer from real vector path data', () => {
    for (const layer of PRINTSYNC_MARK.layers) {
      expect(layer.d.startsWith('M')).toBe(true);
      expect(layer.d.length).toBeGreaterThan(100);
      // Only path grammar characters, so the data can never inject canvas calls.
      expect(layer.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/);
    }
  });

  it('labels every layer with a brand tone', () => {
    for (const tone of brandMarkTones()) {
      expect(['primary', 'secondary', 'ink']).toContain(tone);
    }
  });

  it('uses the two-tone PrintSync scheme', () => {
    const tones = brandMarkTones();
    expect(tones).toContain('primary');
    expect(tones).toContain('secondary');
  });

  it('preserves paint order, including the ring repainted over the mark', () => {
    // The source SVG draws the red ring, then the grey mark, then the red ring
    // again. Dropping that final repeat (as a "duplicate") paints the mark over
    // the ring instead of under it, which visibly changes the mark.
    const { layers } = PRINTSYNC_MARK;
    expect(layers.length).toBeGreaterThanOrEqual(3);
    const first = layers[0];
    const last = layers[layers.length - 1];
    expect(first?.d).toBe(last?.d);
    expect(first?.tone).toBe('primary');
    expect(last?.tone).toBe('primary');
  });
});
