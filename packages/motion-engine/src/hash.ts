/**
 * Deterministic hashing.
 *
 * A single FNV-1a implementation shared by the procedural generators, so the
 * city, its artwork and its signage all derive stable seeds the same way.
 */

/** FNV-1a hash of a string, as an unsigned 32-bit integer. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Combine any number of strings into one stable seed. */
export function hashSeedOf(...parts: readonly string[]): number {
  return hashSeed(parts.join('\u0000'));
}
