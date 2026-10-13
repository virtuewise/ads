/**
 * Road-signage catalogue.
 *
 * Regulatory, warning and wayfinding signs ARE printed products — large-format
 * rigid substrate with a retro-reflective face — so they belong in the same
 * millimetre-exact catalogue as the rest of the platform's offering. Dimensions
 * follow UK TSRGD / Vienna Convention conventions, so every sign the renderer
 * builds is proportionally correct inside the city scene.
 *
 * Conventions (enforced by the catalogue test-suite):
 * - Faces are measured in millimetres and describe the sign's **overall** face
 *   envelope, posts and frames excluded.
 * - Warning and give-way triangles are equilateral: their height is derived
 *   from their side so they can never be rendered squashed.
 * - `stop` faces are regular octagons measured across the flats.
 * - Mount heights are millimetres from the ground to the sign's bottom edge.
 */

import { toSceneUnits } from './print-items.js';

export type RoadSignKind =
  | 'warning'
  | 'regulation'
  | 'prohibition'
  | 'stop'
  | 'giveWay'
  | 'direction'
  | 'chevron'
  | 'information';

export type RoadSignCategory = 'safety' | 'regulation' | 'wayfinding' | 'information';

export interface RoadSignSpec {
  readonly id: string;
  readonly name: string;
  readonly kind: RoadSignKind;
  readonly category: RoadSignCategory;
  /** Overall face width in millimetres. */
  readonly width: number;
  /** Overall face height in millimetres. */
  readonly height: number;
  /** Face colour. */
  readonly field: string;
  /** Border, ring or legend colour drawn on top of the field. */
  readonly detail: string;
  /** Legend colour when it differs from `detail`. */
  readonly legendColor?: string;
  /** Legend text or glyph, e.g. "40", "STOP", "CITY CENTRE". */
  readonly legend?: string;
  /** Millimetres from the ground to the bottom edge of the face. */
  readonly mountHeight: number;
  /** Number of support posts (1 or 2). */
  readonly posts?: 1 | 2;
  /** Panel thickness in millimetres (default 3). */
  readonly thickness?: number;
  /** Optional production note. */
  readonly note?: string;
}

/** Default rigid-substrate panel thickness, in millimetres. */
export const SIGN_PANEL_MM = 3;

/** Equilateral-triangle height derived from its side length. */
function triangleHeight(side: number): number {
  return Math.round(side * (Math.sqrt(3) / 2));
}

/**
 * The catalogue. Urban and rural safety signage, regulation roundels, an
 * octagonal stop and wayfinding at realistic TSRGD sizes.
 */
export const ROAD_SIGNS: readonly RoadSignSpec[] = [
  {
    id: 'sign-warning',
    name: 'Warning',
    kind: 'warning',
    category: 'safety',
    width: 900,
    height: triangleHeight(900),
    field: '#ffffff',
    detail: '#c8001c',
    legend: '!',
    mountHeight: 1800,
    note: '900 mm equilateral warning triangle (TSRGD).',
  },
  {
    id: 'sign-give-way',
    name: 'Give Way',
    kind: 'giveWay',
    category: 'safety',
    width: 900,
    height: triangleHeight(900),
    field: '#ffffff',
    detail: '#c8001c',
    mountHeight: 1500,
    note: '900 mm inverted triangle.',
  },
  {
    id: 'sign-speed-30',
    name: 'Speed Limit 30',
    kind: 'regulation',
    category: 'regulation',
    width: 600,
    height: 600,
    field: '#ffffff',
    detail: '#c8001c',
    legend: '30',
    mountHeight: 2100,
    note: '600 mm speed-limit roundel.',
  },
  {
    id: 'sign-speed-40',
    name: 'Speed Limit 40',
    kind: 'regulation',
    category: 'regulation',
    width: 600,
    height: 600,
    field: '#ffffff',
    detail: '#c8001c',
    legend: '40',
    mountHeight: 2100,
    note: '600 mm speed-limit roundel.',
  },
  {
    id: 'sign-no-entry',
    name: 'No Entry',
    kind: 'prohibition',
    category: 'regulation',
    width: 600,
    height: 600,
    field: '#c8001c',
    detail: '#ffffff',
    mountHeight: 2100,
    note: '600 mm prohibition roundel with white bar.',
  },
  {
    id: 'sign-no-parking',
    name: 'No Parking',
    kind: 'prohibition',
    category: 'regulation',
    width: 600,
    height: 600,
    field: '#0058a0',
    detail: '#c8001c',
    legendColor: '#ffffff',
    legend: 'P',
    mountHeight: 2100,
    note: 'Blue roundel with red ring and diagonal.',
  },
  {
    id: 'sign-stop',
    name: 'Stop',
    kind: 'stop',
    category: 'regulation',
    width: 750,
    height: 750,
    field: '#c8001c',
    detail: '#ffffff',
    legendColor: '#ffffff',
    legend: 'STOP',
    mountHeight: 1500,
    note: '750 mm octagon measured across the flats.',
  },
  {
    id: 'sign-direction',
    name: 'Directional',
    kind: 'direction',
    category: 'wayfinding',
    width: 1200,
    height: 300,
    field: '#00703c',
    detail: '#ffffff',
    legendColor: '#ffffff',
    legend: 'CITY CENTRE',
    mountHeight: 2400,
    posts: 1,
    note: '1200 x 300 mm green primary-route flag.',
  },
  {
    id: 'sign-chevron',
    name: 'Chevron',
    kind: 'chevron',
    category: 'safety',
    width: 600,
    height: 750,
    field: '#f5c400',
    detail: '#101010',
    mountHeight: 1500,
    note: '600 x 750 mm hazard chevron module.',
  },
  {
    id: 'sign-info',
    name: 'Information',
    kind: 'information',
    category: 'information',
    width: 1000,
    height: 700,
    field: '#0058a0',
    detail: '#ffffff',
    legendColor: '#ffffff',
    legend: 'i',
    mountHeight: 2000,
    note: '1000 x 700 mm information panel.',
  },
];

/** Every sign id, in catalogue order. */
export const ROAD_SIGN_IDS: readonly string[] = ROAD_SIGNS.map((sign) => sign.id);

/** Look up a sign by id. */
export function getRoadSign(id: string): RoadSignSpec | undefined {
  return ROAD_SIGNS.find((sign) => sign.id === id);
}

/** The sign's face aspect ratio (width / height). */
export function roadSignAspect(sign: RoadSignSpec): number {
  return sign.width / sign.height;
}

/** Face width in shared scene units. */
export function roadSignSceneWidth(sign: RoadSignSpec): number {
  return toSceneUnits(sign.width);
}

/** Face height in shared scene units. */
export function roadSignSceneHeight(sign: RoadSignSpec): number {
  return toSceneUnits(sign.height);
}

/** Millimetres from the ground to the sign's bottom edge, in scene units. */
export function roadSignSceneMountHeight(sign: RoadSignSpec): number {
  return toSceneUnits(sign.mountHeight);
}

/**
 * Outline of a sign's face as a polygon in a normalised [-0.5, 0.5] box.
 *
 * Pure and shared by the renderer's geometry builder and its face artwork, so
 * the panel and its printed legend can never disagree about the shape. Y points
 * up in the returned space; the renderer flips it into scene space itself.
 */
export function roadSignOutlinePoints(
  kind: RoadSignKind,
): readonly (readonly [number, number])[] {
  switch (kind) {
    case 'warning':
      return [
        [0, 0.5],
        [0.5, -0.5],
        [-0.5, -0.5],
      ];
    case 'giveWay':
      return [
        [-0.5, 0.5],
        [0.5, 0.5],
        [0, -0.5],
      ];
    case 'stop': {
      const points: [number, number][] = [];
      const k = 0.5 / Math.cos(Math.PI / 8);
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI / 8 + (i * Math.PI) / 4;
        points.push([Math.cos(angle) * k, Math.sin(angle) * k]);
      }
      return points;
    }
    default:
      return [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
  }
}

/** Number of distinct outline shapes the renderer has to build. */
export const ROAD_SIGN_SHAPE_COUNT = new Set(
  ROAD_SIGNS.map((sign) => roadSignOutlinePoints(sign.kind).length),
).size;
