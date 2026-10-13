import { describe, it, expect } from 'vitest';
import { getPrintItem, PRINT_ITEMS, PRINT_ITEMS_HERO_ANIMATIONS, PRINT_ITEMS_HERO_IDS, heroPrintItems, resolveChoreography } from './print-items.js';
import {
  buildArtworkSpec,
  DEFAULT_BRAND_TOKENS,
  resolveArtworkShape,
  resolveArtworkVariant,
  type BrandTokens,
} from './artwork.js';

const BOTTLE = getPrintItem('bottle-500')!;
const CARD = getPrintItem('business-card')!;
const STICKER = getPrintItem('sticker-round-60')!;
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
    expect(resolveArtworkVariant('bottle-500')).toBe(resolveArtworkVariant('bottle-500'));
  });

  it('varies across the catalogue', () => {
    const seen = new Set(PRINT_ITEMS.map((i) => resolveArtworkVariant(i.id)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('resolveArtworkShape', () => {
  it('maps each kind to a physical surface shape', () => {
    expect(resolveArtworkShape('revolve')).toBe('band');
    expect(resolveArtworkShape('disk')).toBe('circle');
    expect(resolveArtworkShape('slab')).toBe('rect');
    expect(resolveArtworkShape('carton')).toBe('rect');
    expect(resolveArtworkShape('pouch')).toBe('rect');
    expect(resolveArtworkShape('rollup')).toBe('rect');
  });
});

describe('buildArtworkSpec', () => {
  it('matches the printed surface to the item kind', () => {
    expect(buildArtworkSpec(BOTTLE).shape).toBe('band');
    expect(buildArtworkSpec(STICKER).shape).toBe('circle');
    expect(buildArtworkSpec(CARD).shape).toBe('rect');
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
    expect(buildArtworkSpec(BOTTLE)).toEqual(buildArtworkSpec(BOTTLE));
  });

  it('produces a different seed per item', () => {
    const seeds = new Set(PRINT_ITEMS.map((i) => buildArtworkSpec(i).barcodeSeed));
    expect(seeds.size).toBe(PRINT_ITEMS.length);
  });
});

describe('PRINT_ITEMS_HERO_IDS', () => {
  it('references only real catalogue items', () => {
    for (const id of PRINT_ITEMS_HERO_IDS) {
      expect(getPrintItem(id)).toBeDefined();
    }
  });

  it('has no duplicates', () => {
    expect(new Set(PRINT_ITEMS_HERO_IDS).size).toBe(PRINT_ITEMS_HERO_IDS.length);
  });

  it('spans every catalogue category', () => {
    const categories = new Set(
      PRINT_ITEMS_HERO_IDS.map((id) => getPrintItem(id)?.category).filter(
        (c) => c !== undefined,
      ),
    );
    expect([...categories].sort()).toEqual(['banner', 'box', 'container', 'flat']);
  });

  it('resolves to specs in curated order', () => {
    const items = heroPrintItems();
    expect(items.map((i) => i.id)).toEqual([...PRINT_ITEMS_HERO_IDS]);
  });

  it('matches the curated animation list length', () => {
    expect(PRINT_ITEMS_HERO_ANIMATIONS).toHaveLength(PRINT_ITEMS_HERO_IDS.length);
  });
});

describe('resolveChoreography', () => {
  it('uses the curated animation for each hero item', () => {
    const resolved = resolveChoreography(PRINT_ITEMS_HERO_IDS);
    expect(resolved.map((r) => r.id)).toEqual([...PRINT_ITEMS_HERO_IDS]);
    expect(resolved[0]?.animation).toBe(PRINT_ITEMS_HERO_ANIMATIONS[0]);
    expect(resolved[3]?.animation).toBe('orbit');
  });

  it('stagger phases by index by default', () => {
    const resolved = resolveChoreography(PRINT_ITEMS_HERO_IDS);
    resolved.forEach((entry, index) => {
      expect(entry.phase).toBe(index * 7);
    });
  });

  it('honours explicit animation and phase overrides', () => {
    const resolved = resolveChoreography(['can-330'], [
      { id: 'can-330', animation: 'spin', phase: 42 },
    ]);
    expect(resolved[0]?.animation).toBe('spin');
    expect(resolved[0]?.phase).toBe(42);
  });

  it('ignores unknown animation names and falls back to the default', () => {
    const resolved = resolveChoreography(['can-330'], [
      { id: 'can-330', animation: 'does-not-exist' },
    ]);
    // can-330 is index 0 out of context, so the curated first move applies.
    expect(resolved[0]?.animation).toBe(PRINT_ITEMS_HERO_ANIMATIONS[0]);
  });

  it('ignores negative phases', () => {
    const resolved = resolveChoreography(['tube-50'], [{ id: 'tube-50', phase: -5 }]);
    expect(resolved[0]?.phase).toBe(0);
  });

  it('drops unknown item ids and overrides for other items', () => {
    const resolved = resolveChoreography(
      ['business-card', 'not-a-real-item'],
      [{ id: 'not-a-real-item', animation: 'spin' }],
    );
    expect(resolved.map((r) => r.id)).toEqual(['business-card']);
  });

  it('maps ids outside the curated set onto the curated animations', () => {
    const resolved = resolveChoreography(['tumbler-350', 'sticker-round-60']);
    expect(resolved[0]?.animation).toBe(PRINT_ITEMS_HERO_ANIMATIONS[0]);
    expect(resolved[1]?.animation).toBe(PRINT_ITEMS_HERO_ANIMATIONS[1]);
  });
});
