/**
 * Shared Package Tests
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLDS, getScoreStatus } from './schemas/creative.js';

describe('Shared Schemas', () => {
  it('exposes the canonical scoring rubric', () => {
    // REJECT < 70 · REWORK 70–79 · APPROVE 80–89 · SIGNATURE 90–100
    expect(DEFAULT_THRESHOLDS.reject).toBe(70);
    expect(DEFAULT_THRESHOLDS.rework).toBe(70);
    expect(DEFAULT_THRESHOLDS.approve).toBe(80);
    expect(DEFAULT_THRESHOLDS.signature).toBe(90);
  });

  describe('getScoreStatus', () => {
    it.each([
      [0, 'REJECT'],
      [69, 'REJECT'],
      [70, 'REWORK'],
      [79, 'REWORK'],
      [80, 'APPROVE'],
      [89, 'APPROVE'],
      [90, 'SIGNATURE'],
      [100, 'SIGNATURE'],
    ] as const)('maps %i to %s', (score, expected) => {
      expect(getScoreStatus(score)).toBe(expected);
    });

    it('honours custom thresholds', () => {
      const thresholds = { reject: 50, rework: 50, approve: 60, signature: 70 };
      expect(getScoreStatus(55, thresholds)).toBe('REWORK');
      expect(getScoreStatus(65, thresholds)).toBe('APPROVE');
      expect(getScoreStatus(75, thresholds)).toBe('SIGNATURE');
    });
  });
});
