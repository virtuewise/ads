import type { MaterialPreset } from '@printsync/motion-engine';

/** Shared brand accent, mirroring @printsync/motion-engine. */
export const BRAND = '#c8001c';

/**
 * A single, consistent material vocabulary for every catalogue item. Keeping
 * these values centralised is what makes the whole product line feel like one
 * coherent set rather than a collection of unrelated objects.
 */
export interface MaterialConfig {
  readonly color: string;
  readonly metalness: number;
  readonly roughness: number;
  readonly clearcoat: number;
  readonly clearcoatRoughness: number;
  readonly sheen: number;
  readonly sheenColor: string;
  readonly ior: number;
}

const PRESETS: Record<MaterialPreset, MaterialConfig> = {
  // Uncoated paper stock: soft, matte, slightly fibrous.
  paperMatte: {
    color: '#f4f1ea',
    metalness: 0,
    roughness: 0.94,
    clearcoat: 0,
    clearcoatRoughness: 1,
    sheen: 0.45,
    sheenColor: '#ffffff',
    ior: 1.5,
  },
  // Gloss-laminated board: crisp highlight, low roughness.
  paperGloss: {
    color: '#fbfbfb',
    metalness: 0.02,
    roughness: 0.3,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
    sheen: 0.2,
    sheenColor: '#ffffff',
    ior: 1.5,
  },
  // Natural kraft / corrugated: warm, very matte.
  kraft: {
    color: '#b08b57',
    metalness: 0,
    roughness: 0.88,
    clearcoat: 0,
    clearcoatRoughness: 1,
    sheen: 0.5,
    sheenColor: '#e8d6b0',
    ior: 1.5,
  },
  // Hot-foil stamp: fully metallic with a tight highlight.
  foil: {
    color: '#d9c8a0',
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
    sheen: 0,
    sheenColor: '#ffffff',
    ior: 1.5,
  },
  // Brand-coloured lacquer: rich, glossy red.
  paint: {
    color: BRAND,
    metalness: 0.12,
    roughness: 0.38,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    sheen: 0,
    sheenColor: '#ffffff',
    ior: 1.5,
  },
  // Brushed / polished metal (cans, banner cassette).
  metal: {
    color: '#c9ccd1',
    metalness: 0.95,
    roughness: 0.3,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    sheen: 0,
    sheenColor: '#ffffff',
    ior: 1.5,
  },
  // Moulded / laminate plastic (bottles, tubes).
  plastic: {
    color: '#2a2a2e',
    metalness: 0.05,
    roughness: 0.32,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    sheen: 0,
    sheenColor: '#ffffff',
    ior: 1.5,
  },
};

/** Resolve a preset into concrete, shared material parameters. */
export function materialConfig(preset: MaterialPreset): MaterialConfig {
  return PRESETS[preset];
}
