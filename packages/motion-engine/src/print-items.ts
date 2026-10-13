/**
 * PrintSync Print-Item Catalogue
 *
 * A single, canonical source of truth for the physical products the platform
 * models in 3D. Every entry is expressed in **millimetres** using real-world
 * print & packaging standards, so geometry derived from these specs is
 * proportionally exact and visually consistent across the whole catalogue.
 *
 * Conventions (enforced by the catalogue test-suite):
 * - Dimensions are width (X) x height (Y) x depth (Z) in millimetres and
 *   describe the item's **overall** envelope, closures (caps, lids) included.
 * - Corner radii are millimetres and never exceed half the smallest face.
 * - Revolve profiles use a normalised height `t` in [0, 1] and a radius `r`
 *   in millimetres, starting and ending on the axis (r = 0). The profile is
 *   mapped onto the item's *body* height (overall height minus any closure).
 * - Scene geometry is produced by multiplying millimetres by
 *   `SCENE_UNITS_PER_MM`, giving a single, shared unit scale for the renderer.
 *
 * Shape helpers (`printItemBodyHeight`, `printItemDecalRect`,
 * `printItemWrapBand`, `revolveRadiusAt`, ...) are pure and unit-tested so the
 * geometry builders and the artwork/decal system can never drift apart.
 */

export type PrintItemCategory = 'flat' | 'label' | 'box' | 'container' | 'banner';

export type PrintItemKind =
  | 'slab'
  | 'disk'
  | 'roundedBox'
  | 'revolve'
  | 'pouch'
  | 'rollup'
  | 'carton';

export type MaterialPreset =
  | 'paperMatte'
  | 'paperGloss'
  | 'kraft'
  | 'foil'
  | 'paint'
  | 'metal'
  | 'plastic'
  | 'softTouch'
  | 'corrugated'
  | 'chrome'
  | 'board';

export interface Dimensions3 {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface ProfilePoint {
  /** Normalised position along the body height, 0 (base) -> 1 (top). */
  readonly t: number;
  /** Profile radius in millimetres. */
  readonly r: number;
}

/** A closure (screw cap / twist lid / flip top) that sits above the body. */
export interface CapSpec {
  /** Outer diameter in millimetres. */
  readonly diameter: number;
  /** Height in millimetres — included in the item's overall height. */
  readonly height: number;
  readonly material: MaterialPreset;
  /** Visual style of the closure. */
  readonly style?: 'screw' | 'lid' | 'flip';
}

/** Fold-over tuck flaps for a folding carton. */
export interface FlapSpec {
  readonly top?: boolean;
  readonly bottom?: boolean;
  /** Board thickness in millimetres (default 1.2). */
  readonly thickness?: number;
}

/** A crimped top seal for a stand-up pouch. */
export interface SealSpec {
  /** Seal band height in millimetres. */
  readonly height: number;
  /** Draw a euro-slot hang hole in the seal. */
  readonly hangHole?: boolean;
  /** Hang-hole diameter in millimetres. */
  readonly holeDiameter?: number;
  /** Film/board thickness in millimetres. */
  readonly thickness?: number;
}

export interface PrintItemSpec {
  readonly id: string;
  readonly name: string;
  readonly category: PrintItemCategory;
  readonly kind: PrintItemKind;
  /** Real-world **overall** bounding dimensions in millimetres. */
  readonly dimensions: Dimensions3;
  /** Human-readable size, e.g. "85 x 55 mm". */
  readonly label: string;
  readonly material: MaterialPreset;
  /** Corner radius in millimetres (slab / roundedBox / pouch / carton). */
  readonly cornerRadius?: number;
  /** Revolve profile (revolve), mapped onto the body height. */
  readonly profile?: readonly ProfilePoint[];
  /** Radial tessellation for revolve / disk geometry. */
  readonly radialSegments?: number;
  /** Closure that adds height above the body (revolve). */
  readonly cap?: CapSpec;
  /** Tuck flaps (carton). */
  readonly flaps?: FlapSpec;
  /** Crimped top seal (pouch). */
  readonly seal?: SealSpec;
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

/** Default board thickness for folding cartons, in millimetres. */
export const CARTON_FLAP_MM = 1.2;
/** Default top-seal height for a stand-up pouch, in millimetres. */
export const POUCH_SEAL_MM = 14;
/** Height of the roll-up banner cassette base, in millimetres. */
export const ROLLUP_BASE_MM = 90;
/** Height of a roll-up banner's support pole (relative to its base). */
export const ROLLUP_POLE_OFFSET_MM = 0;

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
  {
    id: 'greeting-card-a5',
    name: 'Greeting Card (A5)',
    category: 'flat',
    kind: 'slab',
    dimensions: { width: 148, height: 210, depth: 0.6 },
    label: 'A5 folded',
    material: 'softTouch',
    cornerRadius: 2,
    note: 'A5 folded greeting card with soft-touch laminate.',
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
    kind: 'carton',
    dimensions: { width: 120, height: 180, depth: 60 },
    label: '120 x 180 x 60 mm',
    material: 'paperGloss',
    cornerRadius: 3,
    flaps: { top: true, bottom: true, thickness: CARTON_FLAP_MM },
    note: 'Reverse-tuck folding carton, 350 gsm GC1 board.',
  },
  {
    id: 'cereal-carton',
    name: 'Cereal Carton',
    category: 'box',
    kind: 'carton',
    dimensions: { width: 190, height: 275, depth: 65 },
    label: '190 x 275 x 65 mm',
    material: 'board',
    cornerRadius: 3,
    flaps: { top: true, bottom: true, thickness: CARTON_FLAP_MM },
    note: 'Folding carton with tuck flaps, 400 gsm GC1 board.',
  },
  {
    id: 'perfume-carton',
    name: 'Perfume Carton',
    category: 'box',
    kind: 'carton',
    dimensions: { width: 55, height: 165, depth: 55 },
    label: '55 x 165 x 55 mm',
    material: 'softTouch',
    cornerRadius: 2,
    flaps: { top: true, bottom: true, thickness: 1 },
    note: 'Rigid-look folding carton with soft-touch laminate.',
  },
  {
    id: 'mailer-box',
    name: 'Mailer Box',
    category: 'box',
    kind: 'roundedBox',
    dimensions: { width: 220, height: 160, depth: 80 },
    label: '220 x 160 x 80 mm',
    material: 'corrugated',
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
    cornerRadius: 5,
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
    seal: { height: POUCH_SEAL_MM, hangHole: true, holeDiameter: 6, thickness: 1.2 },
    note: 'Quad-seal stand-up pouch with crimped top seal and hang hole.',
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
    id: 'wine-bottle-750',
    name: 'Wine Bottle 750 ml',
    category: 'container',
    kind: 'revolve',
    dimensions: { width: 76, height: 300, depth: 76 },
    label: 'Diameter 76 x 300 mm (750 ml)',
    material: 'paint',
    radialSegments: 72,
    cap: { diameter: 30, height: 18, material: 'chrome', style: 'screw' },
    profile: [
      { t: 0.0, r: 0 },
      { t: 0.0, r: 36 },
      { t: 0.015, r: 38 },
      { t: 0.04, r: 38 },
      { t: 0.52, r: 38 },
      { t: 0.6, r: 36 },
      { t: 0.7, r: 22 },
      { t: 0.76, r: 14 },
      { t: 0.8, r: 12 },
      { t: 0.97, r: 12 },
      { t: 0.985, r: 15 },
      { t: 1.0, r: 15 },
      { t: 1.0, r: 0 },
    ],
    note: 'Bordeaux wine bottle with 30 mm screw cap.',
  },
  {
    id: 'jam-jar-250',
    name: 'Jam Jar 250 ml',
    category: 'container',
    kind: 'revolve',
    dimensions: { width: 70, height: 96, depth: 70 },
    label: 'Diameter 70 x 96 mm (250 ml)',
    material: 'paint',
    radialSegments: 64,
    cap: { diameter: 72, height: 14, material: 'chrome', style: 'lid' },
    profile: [
      { t: 0.0, r: 0 },
      { t: 0.0, r: 32 },
      { t: 0.03, r: 35 },
      { t: 0.78, r: 35 },
      { t: 0.84, r: 34 },
      { t: 0.9, r: 32 },
      { t: 1.0, r: 32 },
      { t: 1.0, r: 0 },
    ],
    note: 'Glass-look jar with 72 mm twist-off lid.',
  },
  {
    id: 'tumbler-350',
    name: 'Tumbler 350 ml',
    category: 'container',
    kind: 'revolve',
    dimensions: { width: 82, height: 110, depth: 82 },
    label: 'Diameter 82 x 110 mm (350 ml)',
    material: 'softTouch',
    radialSegments: 64,
    profile: [
      { t: 0.0, r: 0 },
      { t: 0.0, r: 30 },
      { t: 0.04, r: 32 },
      { t: 0.5, r: 36 },
      { t: 0.9, r: 40 },
      { t: 1.0, r: 41 },
      { t: 1.0, r: 0 },
    ],
    note: 'Tapered drinkware tumbler.',
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

/** Height of the closure above the body, in millimetres. */
export function printItemCapHeight(spec: PrintItemSpec): number {
  return spec.cap?.height ?? 0;
}

/** Body height (overall height minus any closure), in millimetres. */
export function printItemBodyHeight(spec: PrintItemSpec): number {
  return spec.dimensions.height - printItemCapHeight(spec);
}

/** Fold-over flap (board) thickness in millimetres; 0 for non-cartons. */
export function printItemFlapThickness(spec: PrintItemSpec): number {
  if (spec.kind !== 'carton') return 0;
  return spec.flaps?.thickness ?? CARTON_FLAP_MM;
}

/** Top-seal height in millimetres; 0 for non-pouches. */
export function printItemSealHeight(spec: PrintItemSpec): number {
  if (spec.kind !== 'pouch') return 0;
  return spec.seal?.height ?? POUCH_SEAL_MM;
}

/**
 * The edge bevel applied when extruding boards, in millimetres. Used both by
 * the geometry builders (which compensate so outward dimensions stay exact)
 * and by the decal system (so artwork sits on the flat face, not the bevel).
 */
export function printItemBevelMm(spec: PrintItemSpec): number {
  switch (spec.kind) {
    case 'roundedBox':
      return Math.min(spec.cornerRadius ?? 3, spec.dimensions.depth / 4);
    case 'carton':
      return 0.8;
    default:
      return 0.4;
  }
}

/** Linear-interpolate a revolve profile's radius at normalised height `t`. */
export function revolveRadiusAt(profile: readonly ProfilePoint[], t: number): number {
  if (profile.length === 0) return 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!;
    const b = profile[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return b.r;
      const f = (t - a.t) / span;
      return a.r + (b.r - a.r) * f;
    }
  }
  return profile[profile.length - 1]?.r ?? 0;
}

/** Front-face rect for a flat/box item's printed decal, in millimetres. */
export interface DecalRect {
  /** Decal width in millimetres. */
  readonly width: number;
  /** Decal height in millimetres. */
  readonly height: number;
  /** Vertical centre of the decal, measured from the item's base. */
  readonly centerY: number;
  /** Distance from the item's centre to the front face, in millimetres. */
  readonly z: number;
}

/**
 * Where a front-face decal belongs on a flat item, or `null` for items that use
 * a wrap band or a circular label instead. Keeps the artwork locked to the
 * modelled surface even as the shapes gain flaps, seals and bases.
 */
export function printItemDecalRect(spec: PrintItemSpec): DecalRect | null {
  const { width, height, depth } = spec.dimensions;
  const bevel = printItemBevelMm(spec);

  switch (spec.kind) {
    case 'slab':
    case 'roundedBox':
      return { width: width - 2 * bevel, height: height - 2 * bevel, centerY: height / 2, z: depth / 2 };

    case 'carton': {
      const flap = printItemFlapThickness(spec);
      const bodyHeight = height - 2 * flap;
      return {
        width: width - 2 * bevel,
        height: bodyHeight - 2 * bevel,
        centerY: flap + bodyHeight / 2,
        z: depth / 2,
      };
    }

    case 'pouch': {
      const seal = printItemSealHeight(spec);
      const bodyHeight = height - seal;
      return {
        width: width - 2 * bevel,
        height: bodyHeight - 2 * bevel,
        centerY: bodyHeight / 2,
        z: depth / 2,
      };
    }

    case 'rollup': {
      const bannerHeight = height - ROLLUP_BASE_MM;
      return {
        width: width - 2,
        height: bannerHeight - 2,
        centerY: ROLLUP_BASE_MM + bannerHeight / 2,
        z: depth / 4 + 3,
      };
    }

    default:
      return null;
  }
}

/** Curved wrap-label band for a revolved container, in millimetres/radians. */
export interface WrapBand {
  readonly radius: number;
  readonly height: number;
  readonly centerY: number;
  readonly thetaLength: number;
}

/** Where a curved wrap label belongs on a revolved container, or `null`. */
export function printItemWrapBand(spec: PrintItemSpec): WrapBand | null {
  if (spec.kind !== 'revolve' || !spec.profile) return null;
  const t = 0.4;
  const bodyHeight = printItemBodyHeight(spec);
  const bodyRadius = revolveRadiusAt(spec.profile, t);
  const radius = bodyRadius + 0.3;
  return {
    radius,
    height: bodyHeight * 0.42,
    centerY: bodyHeight * t,
    thetaLength: Math.min(Math.PI * 0.55, (spec.dimensions.width * 1.1) / radius),
  };
}

/** Brand accent colour shared by all catalogue items. */
export const PRINT_ITEM_ACCENT = BRAND_ACCENT;
