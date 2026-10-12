import { describe, it, expect } from 'vitest';
import { AudioEngine, analyzeFrequencyBands } from './index.js';

describe('AudioEngine', () => {
  it('can be instantiated', () => {
    const engine = new AudioEngine();
    expect(engine).toBeDefined();
  });
});

describe('analyzeFrequencyBands', () => {
  it('returns an empty array for a non-positive band count', () => {
    expect(analyzeFrequencyBands([0.1, 0.2, 0.3], 0)).toEqual([]);
    expect(analyzeFrequencyBands([0.1, 0.2, 0.3], -4)).toEqual([]);
  });

  it('returns an empty array for an empty spectrum', () => {
    expect(analyzeFrequencyBands([], 8)).toEqual([]);
  });

  it('returns exactly the requested number of bands', () => {
    const values = Array.from({ length: 256 }, (_, i) => i / 256);
    expect(analyzeFrequencyBands(values, 56)).toHaveLength(56);
    expect(analyzeFrequencyBands(values, 1)).toHaveLength(1);
  });

  it('averages each band', () => {
    // Two bands over four values: [0, 1] -> 0.5 and [1, 0] -> 0.5.
    expect(analyzeFrequencyBands([0, 1, 1, 0], 2)).toEqual([0.5, 0.5]);
  });

  it('clamps out-of-range input to [0, 1]', () => {
    expect(analyzeFrequencyBands([2, -1], 1)).toEqual([0.5]);
  });

  it('covers the whole spectrum when it does not divide evenly', () => {
    // 5 values into 2 bands: [0, 0.25] -> 0.125 and [0.5, 0.75, 1] -> 0.75.
    expect(analyzeFrequencyBands([0, 0.25, 0.5, 0.75, 1], 2)).toEqual([0.125, 0.75]);
  });
});
