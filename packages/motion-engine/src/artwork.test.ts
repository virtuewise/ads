import { describe, it, expect } from 'vitest';
import { getPrintItem, PRINT_ITEMS } from './print-items.js';
import {
  buildArtworkSpec,
  DEFAULT_BRAND_TOKENS,
  resolveArtworkVariant,
  type BrandTokens,
} from './artwork.js';

const BOTTLE = getPrintItem('bottle-500')!;
const CARD = getPrintItem('business-card')!;
const CUSTOM_BRAND: BrandTokens = {
  wordmark: 'ACME',
  tagline: 'Built different',
  primary: '#FF0000',
  secondary: '#000000',
  accent: '#00FF00',
  paper: '#FFFFFF',
  ink: '#111111',
};

describe('resolveArtworkVariant', () => {
  it('returns one of the four known variants', () => {
    const variants = new Set(['editorial', 'banner', 'monogram', 'grid']);
    for (const item of PRINT_ITEMS) {
      expect(variants.has(resolveArtworkVariant(item.id))).toBe(true);
    }
  });

  it('is deterministic for the same id', () => {
    expect(resolveArtworkVariant('bottle-500')).toBe(
      resolveArtworkVariant('bottle-500'),
    );
  });

  it('varies across the catalogue', () => {
    const seen = new Set(PRINT_ITEMS.map((i) => resolveArtworkVariant(i.id)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('buildArtworkSpec', () => {
  it('uses wrap mode for revolve items and label mode for flat items', () => {
    expect(buildArtworkSpec(BOTTLE).mode).toBe('wrap');
    expect(buildArtworkSpec(CARD).mode).toBe('label');
  });

  it('inherits brand tokens', () => {
    const spec = buildArtworkSpec(BOTTLE, CUSTOM_BRAND);
    expect(spec.wordmark).toBe('ACME');
    expect(spec.tagline).toBe('Built different');
    expect(spec.primary).toBe('#FF0000');
    expect(spec.accent).toBe('#00FF00');
  });

  it('falls back to default brand tokens', () => {
    const spec = buildArtworkSpec(BOTTLE);
    expect(spec.wordmark).toBe(DEFAULT_BRAND_TOKENS.wordmark);
    expect(spec.primary).toBe(DEFAULT_BRAND_TOKENS.primary);
  });

  it('sets layout from the item aspect ratio', () => {
    expect(buildArtworkSpec(CARD).layout).toBe('landscape'); // 85 x 55
    expect(buildArtworkSpec(BOTTLE).layout).toBe('portrait'); // 65 x 220
  });

  it('produces a stable index in [1, 99]', () => {
    for (const item of PRINT_ITEMS) {
      const spec = buildArtworkSpec(item);
      expect(spec.index).toBeGreaterThanOrEqual(1);
      expect(spec.index).toBeLessThanOrEqual(99);
    }
  });

  it('is deterministic per item', () => {
    const a = buildArtworkSpec(BOTTLE);
    const b = buildArtworkSpec(BOTTLE);
    expect(a).toEqual(b);
  });

  it('produces a different seed per item', () => {
    const seeds = new Set(PRINT_ITEMS.map((i) => buildArtworkSpec(i).barcodeSeed));
    expect(seeds.size).toBe(PRINT_ITEMS.length);
  });
});
