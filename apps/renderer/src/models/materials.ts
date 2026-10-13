import type { MaterialPreset } from '@printsync/motion-engine';

/** Shared brand accent, mirroring @printsync/motion-engine. */
export const BRAND = '#c8001c';

/**
 * A single, consistent material vocabulary for every catalogue item. Keeping
 * these values centralised is what makes the whole product line feel like one
 * coherent set rather than a collection of unrelated objects.
 *
 * Every preset describes a real print-finishing stock: uncoated and gloss
 * paper, kraft, soft-touch laminate, corrugated board, hot foil, lacquer,
 * brushed metal, polished chrome and moulded plastic.
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
  /** Scalar used to boost/soften image-based reflections. */
  readonly envMapIntensity: number;
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
    envMapIntensity: 0.5,
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
    envMapIntensity: 0.9,
  },
  // Natural kraft / recycled board: warm, very matte.
  kraft: {
    color: '#b08b57',
    metalness: 0,
    roughness: 0.88,
    clearcoat: 0,
    clearcoatRoughness: 1,
    sheen: 0.5,
    sheenColor: '#e8d6b0',
    ior: 1.5,
    envMapIntensity: 0.5,
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
    envMapIntensity: 1.2,
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
    envMapIntensity: 1,
  },
  // Brushed / anodised metal (cans, banner cassette).
  metal: {
    color: '#c9ccd1',
    metalness: 0.95,
    roughness: 0.3,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    sheen: 0,
    sheenColor: '#ffffff',
    ior: 1.5,
    envMapIntensity: 1.2,
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
    envMapIntensity: 1,
  },
  // Soft-touch matte laminate: velvety, barely reflective.
  softTouch: {
    color: '#f6f4f0',
    metalness: 0,
    roughness: 1,
    clearcoat: 0.12,
    clearcoatRoughness: 0.6,
    sheen: 0.55,
    sheenColor: '#ffffff',
    ior: 1.5,
    envMapIntensity: 0.35,
  },
  // Corrugated kraft board: warm, matte, with a visible board tone.
  corrugated: {
    color: '#c2a175',
    metalness: 0,
    roughness: 0.92,
    clearcoat: 0,
    clearcoatRoughness: 1,
    sheen: 0.4,
    sheenColor: '#e8d6b0',
    ior: 1.5,
    envMapIntensity: 0.45,
  },
  // Polished chrome (caps, lids): mirror-like, near-zero roughness.
  chrome: {
    color: '#e6e8eb',
    metalness: 1,
    roughness: 0.06,
    clearcoat: 0.3,
    clearcoatRoughness: 0.05,
    sheen: 0,
    sheenColor: '#ffffff',
    ior: 1.5,
    envMapIntensity: 1.5,
  },
  // Uncoated GC1 folding board: bright, smooth, faintly matte.
  board: {
    color: '#f2ede4',
    metalness: 0,
    roughness: 0.85,
    clearcoat: 0.06,
    clearcoatRoughness: 0.9,
    sheen: 0.35,
    sheenColor: '#ffffff',
    ior: 1.5,
    envMapIntensity: 0.5,
  },
};

/** Resolve a preset into concrete, shared material parameters. */
export function materialConfig(preset: MaterialPreset): MaterialConfig {
  return PRESETS[preset];
}

/** Every preset, in catalogue order — handy for tooling and tests. */
export const MATERIAL_PRESETS = Object.keys(PRESETS) as MaterialPreset[];
