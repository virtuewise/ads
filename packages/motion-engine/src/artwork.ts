import type { PrintItemSpec } from './print-items.js';

export interface BrandTokens {
  wordmark: string;
  tagline: string;
  primary: string;
  secondary: string;
  accent: string;
  paper: string;
  ink: string;
}

export type ArtworkVariant = 'editorial' | 'banner' | 'monogram' | 'grid';
/** Physical shape of the printed surface the artwork is mapped onto. */
export type ArtworkShape = 'rect' | 'circle' | 'band';

export interface ArtworkSpec {
  variant: ArtworkVariant;
  shape: ArtworkShape;
  wordmark: string;
  tagline: string;
  primary: string;
  secondary: string;
  accent: string;
  paper: string;
  ink: string;
  barcodeSeed: number;
  index: number;
  layout: 'portrait' | 'landscape';
}

/** Default brand tokens derived from @printsync/brand-engine's canonical system. */
export const DEFAULT_BRAND_TOKENS: BrandTokens = {
  wordmark: 'PRINTSYNC',
  tagline: 'Your Vision. Our Precision.',
  primary: '#C8001C',
  secondary: '#373435',
  accent: '#00A8E0',
  paper: '#F5F1EA',
  ink: '#141414',
};

/** Deterministic FNV-1a hash — same input always yields the same hash. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const VARIANTS: readonly ArtworkVariant[] = ['editorial', 'banner', 'monogram', 'grid'];

/** Map a catalogue item's kind to the physical shape of its printed surface. */
export function resolveArtworkShape(kind: PrintItemSpec['kind']): ArtworkShape {
  switch (kind) {
    case 'revolve':
      return 'band';
    case 'disk':
      return 'circle';
    default:
      return 'rect';
  }
}

/** Map a catalogue item id to a stable artwork layout variant. */
export function resolveArtworkVariant(itemId: string): ArtworkVariant {
  return VARIANTS[hashId(itemId) % VARIANTS.length] ?? 'editorial';
}

/**
 * Build a deterministic artwork spec for a catalogue item. The design varies
 * per item (via the id hash) but is always reproducible — the renderer feeds
 * this straight into a canvas, so the same item always prints the same artwork.
 */
export function buildArtworkSpec(
  item: PrintItemSpec,
  brand: BrandTokens = DEFAULT_BRAND_TOKENS,
): ArtworkSpec {
  const h = hashId(item.id);
  return {
    variant: resolveArtworkVariant(item.id),
    shape: resolveArtworkShape(item.kind),
    wordmark: brand.wordmark,
    tagline: brand.tagline,
    primary: brand.primary,
    secondary: brand.secondary,
    accent: brand.accent,
    paper: brand.paper,
    ink: brand.ink,
    barcodeSeed: h,
    index: (h % 99) + 1,
    layout: item.dimensions.width >= item.dimensions.height ? 'landscape' : 'portrait',
  };
}
