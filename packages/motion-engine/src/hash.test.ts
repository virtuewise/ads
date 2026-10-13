import { describe, it, expect } from 'vitest';
import { hashSeed, hashSeedOf } from './hash.js';

describe('hashSeed', () => {
  it('is deterministic', () => {
    expect(hashSeed('printsync')).toBe(hashSeed('printsync'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'a', 'printsync-city-01']) {
      const h = hashSeed(input);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('separates similar inputs', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
    expect(hashSeed('abc')).not.toBe(hashSeed('acb'));
  });

  it('matches the canonical FNV-1a value', () => {
    // Offset basis with no input is unchanged by the loop.
    expect(hashSeed('')).toBe(2166136261);
  });
});

describe('hashSeedOf', () => {
  it('is deterministic and order-sensitive', () => {
    expect(hashSeedOf('a', 'b')).toBe(hashSeedOf('a', 'b'));
    expect(hashSeedOf('a', 'b')).not.toBe(hashSeedOf('b', 'a'));
  });

  it('distinguishes joined parts from a single string', () => {
    expect(hashSeedOf('a', 'b')).not.toBe(hashSeed('ab'));
  });
});
