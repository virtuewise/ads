/**
 * PrintSync Print-Item Catalogue
 *
 * A single, canonical source of truth for the physical products the platform
 * models in 3D. Every entry is expressed in **millimetres** using real-world
 * print & packaging standards, so geometry derived from these specs is
 * proportionally exact and visually consistent across the whole catalogue.
 *
 * Conventions (enforced by the catalogue test-suite):
 * - Dimensions are width (X) x height (Y) x depth (Z) in millimetres.
 * - Corner radii are millimetres and never exceed half the smallest face.
 * - Revolve profiles use a normalised height `t` in [0, 1] and a radius `r`
 *   in millimetres, starting and ending on the axis (r = 0).
 * - Scene geometry is produced by multiplying millimetres by
 *   `SCENE_UNITS_PER_MM`, giving a single, shared unit scale for the renderer.
 */

export type PrintItemCategory = 'flat' | 'label' | 'box' | 'container' | 'banner';

export type PrintItemKind =
  | 'slab'
  | 'disk'
  | 'roundedBox'
  | 'revolve'
  | 'pouch'
  | 'rollup';

export type MaterialPreset =
  | 'paperMatte'
  | 'paperGloss'
  | 'kraft'
  | 'foil'
  | 'paint'
  | 'metal'
  | 'plastic';

export interface Dimensions3 {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface ProfilePoint {
  /** Normalised position along the height, 0 (base) -> 1 (top). */
  readonly t: number;
  /** Profile radius in millimetres. */
  readonly r: number;
}

export interface PrintItemSpec {
  readonly id: string;
  readonly name: string;
  readonly category: PrintItemCategory;
  readonly kind: PrintItemKind;
  /** Real-world bounding dimensions in millimetres. */
  readonly dimensions: Dimensions3;
  /** Human-readable size, e.g. "85 x 55 mm". */
  readonly label: string;
  readonly material: MaterialPreset;
  /** Corner radius in millimetres (slab / roundedBox / pouch). */
  readonly cornerRadius?: number;
  /** Revolve profile (revolve). */
  readonly profile?: readonly ProfilePoint[];
  /** Radial tessellation for revolve / disk geometry. */
  readonly radialSegments?: number;
  /** Optional production note. */
  readonly note?: string;
}

/** Scene units per millimetre. 1 mm = 0.001 scene units (metres). */
export const SCENE_UNITS_PER_MM = 0.001;

/** Convert a millimetre measurement into shared scene units. */
export function toSceneUnits(millimetres: number): number {
  return millimetres * SCENE_UNITS_PER_MM;
}

const BRAND_ACCENT = '#c8001c';

/**
 * The catalogue. Flat print, labels, folding/rigid packaging and containers,
 * all using standard industry dimensions.
 */
export const PRINT_ITEMS: readonly PrintItemSpec[] = [
  // ---- Flat print -------------------------------------------------------
  {
    id: 'business-card',
    name: 'Business Card',
    category: 'flat',
    kind: 'slab',
    dimensions: { width: 85, height: 55, depth: 0.4 },
    label: '85 x 55 mm',
    material: 'paperMatte',
    cornerRadius: 2,
    note: 'European standard business card (85 x 55 mm).',
  },
  {
    id: 'postcard-a6',
    name: 'Postcard (A6)',
    category: 'flat',
    kind: 'slab',
    dimensions: { width: 105, height: 148, depth: 0.45 },
    label: '105 x 148 mm (A6)',
    material: 'paperGloss',
    cornerRadius: 2.5,
    note: 'A6 postcard, ISO 216.',
  },
  {
    id: 'flyer-a5',
    name: 'Flyer (A5)',
    category: 'flat',
    kind: 'slab',
    dimensions: { width: 148, height: 210, depth: 0.15 },
    label: '148 x 210 mm (A5)',
    material: 'paperMatte',
    cornerRadius: 1,
    note: 'A5 flyer, ISO 216.',
  },
  {
    id: 'brochure-a4',
    name: 'Folded Brochure',
    category: 'flat',
    kind: 'slab',
    dimensions: { width: 148, height: 210, depth: 3 },
    label: 'A5 folded (from A4)',
    material: 'paperGloss',
    cornerRadius: 1.5,
    note: 'A4 sheet folded once to A5; 3 mm spine.',
  },

  // ---- Labels & stickers ------------------------------------------------
  {
    id: 'sticker-round-60',
    name: 'Round Sticker',
    category: 'label',
    kind: 'disk',
    dimensions: { width: 60, height: 60, depth: 0.2 },
    label: 'Diameter 60 mm',
    material: 'paperGloss',
    radialSegments: 96,
    note: 'Die-cut circular sticker.',
  },
  {
    id: 'label-rect-100x50',
    name: 'Rectangular Label',
    category: 'label',
    kind: 'slab',
    dimensions: { width: 100, height: 50, depth: 0.12 },
    label: '100 x 50 mm',
    material: 'paperGloss',
    cornerRadius: 4,
    note: 'Rounded-corner roll label.',
  },

  // ---- Packaging --------------------------------------------------------
  {
    id: 'folding-carton',
    name: 'Folding Carton',
    category: 'box',
    kind: 'roundedBox',
    dimensions: { width: 120, height: 180, depth: 60 },
    label: '120 x 180 x 60 mm',
    material: 'paperGloss',
    cornerRadius: 3,
    note: 'Reverse-tuck folding carton, 350 gsm GC1 board.',
  },
  {
    id: 'mailer-box',
    name: 'Mailer Box',
    category: 'box',
    kind: 'roundedBox',
    dimensions: { width: 220, height: 160, depth: 80 },
    label: '220 x 160 x 80 mm',
    material: 'kraft',
    cornerRadius: 6,
    note: 'Corrugated e-commerce mailer with roll-over lid.',
  },
  {
    id: 'rigid-box',
    name: 'Rigid Gift Box',
    category: 'box',
    kind: 'roundedBox',
    dimensions: { width: 220, height: 70, depth: 160 },
    label: '220 x 160 x 70 mm',
    material: 'paint',
    cornerRadius: 4,
    note: 'Rigid two-piece box with wrap and lift-off lid.',
  },
  {
    id: 'coffee-pouch',
    name: 'Coffee Pouch',
    category: 'box',
    kind: 'pouch',
    dimensions: { width: 100, height: 230, depth: 60 },
    label: '100 x 230 x 60 mm (250 g)',
    material: 'kraft',
    cornerRadius: 8,
    note: 'Quad-seal stand-up pouch with top seal.',
  },

  // ---- Containers -------------------------------------------------------
  {
    id: 'bottle-500',
    name: 'Bottle 500 ml',
    category: 'container',
    kind: 'revolve',
    dimensions: { width: 65, height: 220, depth: 65 },
    label: 'Diameter 65 x 220 mm (500 ml)',
    material: 'plastic',
    radialSegments: 72,
    profile: [
      { t: 0.0, r: 0 },
      { t: 0.0, r: 30 },
      { t: 0.01, r: 32.5 },
      { t: 0.04, r: 32.5 },
      { t: 0.6, r: 32.5 },
      { t: 0.7, r: 30 },
      { t: 0.78, r: 20 },
      { t: 0.83, r: 14 },
      { t: 0.92, r: 14 },
      { t: 0.93, r: 16 },
      { t: 1.0, r: 16 },
      { t: 1.0, r: 0 },
    ],
    note: 'PET bottle with shoulder and 28 mm neck finish.',
  },
  {
    id: 'can-330',
    name: 'Beverage Can 330 ml',
    category: 'container',
    kind: 'revolve',
    dimensions: { width: 66, height: 115, depth: 66 },
    label: 'Diameter 66 x 115 mm (330 ml)',
    material: 'metal',
    radialSegments: 72,
    profile: [
      { t: 0.0, r: 0 },
      { t: 0.0, r: 24 },
      { t: 0.02, r: 33 },
      { t: 0.06, r: 33 },
      { t: 0.94, r: 33 },
      { t: 0.97, r: 30 },
      { t: 0.99, r: 26 },
      { t: 1.0, r: 26 },
      { t: 1.0, r: 0 },
    ],
    note: 'Standard 330 ml aluminium can with tapered neck.',
  },
  {
    id: 'tube-50',
    name: 'Cosmetic Tube 50 ml',
    category: 'container',
    kind: 'revolve',
    dimensions: { width: 35, height: 130, depth: 35 },
    label: 'Diameter 35 x 130 mm (50 ml)',
    material: 'plastic',
    radialSegments: 64,
    profile: [
      { t: 0.0, r: 0 },
      { t: 0.0, r: 15 },
      { t: 0.02, r: 17.5 },
      { t: 0.74, r: 17.5 },
      { t: 0.78, r: 16 },
      { t: 0.79, r: 10 },
      { t: 0.8, r: 17.5 },
      { t: 0.97, r: 17.5 },
      { t: 0.98, r: 16 },
      { t: 1.0, r: 16 },
      { t: 1.0, r: 0 },
    ],
    note: 'Laminate cosmetic tube with crimp and screw cap.',
  },

  // ---- Large format -----------------------------------------------------
  {
    id: 'rollup-850',
    name: 'Roll-up Banner',
    category: 'banner',
    kind: 'rollup',
    dimensions: { width: 850, height: 2000, depth: 120 },
    label: '850 x 2000 mm',
    material: 'paperGloss',
    note: '850 x 2000 mm roll-up banner on cassette base.',
  },
];

/** Look up a catalogue item by id. */
export function getPrintItem(id: string): PrintItemSpec | undefined {
  return PRINT_ITEMS.find((item) => item.id === id);
}

/** Front-face aspect ratio (width / height). */
export function printItemFrontAspect(spec: PrintItemSpec): number {
  return spec.dimensions.width / spec.dimensions.height;
}

/** Radius of the item's bounding sphere, in scene units. */
export function printItemBoundingRadius(spec: PrintItemSpec): number {
  const { width, height, depth } = spec.dimensions;
  return (Math.hypot(width, height, depth) / 2) * SCENE_UNITS_PER_MM;
}

/** Brand accent colour shared by all catalogue items. */
export const PRINT_ITEM_ACCENT = BRAND_ACCENT;
