/**
 * Shared Package Tests
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLDS } from './schemas/creative.js';

describe('Shared Schemas', () => {
  it('has correct default thresholds', () => {
    expect(DEFAULT_THRESHOLDS.reject).toBe(70);
    expect(DEFAULT_THRESHOLDS.rework).toBe(80);
    expect(DEFAULT_THRESHOLDS.approve).toBe(90);
    expect(DEFAULT_THRESHOLDS.signature).toBe(95);
  });
});
