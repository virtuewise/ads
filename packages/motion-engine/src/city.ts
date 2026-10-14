/**
 * Procedural living-city layout.
 *
 * A single deterministic generator produces the whole street: city blocks,
 * building masses with a lit-window ratio, out-of-home advertising slots, road
 * signage and street lighting — plus a route line that the film draws in
 * motion. Everything is a pure function of a seed, so a render is reproducible
 * and a backend can regenerate the exact same city on demand.
 *
 * Scene units are metres (millimetres x `SCENE_UNITS_PER_MM`), matching the
 * catalogue, so city geometry and print items share one scale and a 96-sheet
 * billboard really is 12.192 m wide.
 */

import { hashSeed } from './hash.js';
import {
  getOohFormat,
  OOH_FORMATS,
  type OohMedium,
  oohSceneHeight,
  oohSceneMountHeight,
} from './ooh.js';
import { ROAD_SIGN_IDS } from './signage.js';

export { hashSeed };

export type TimeOfDay = 'night' | 'dusk' | 'day';

/** Half-length of the boulevard, in metres. */
export const CITY_EXTENT_M = 120;

/** Half-width of the carriageway, in metres. */
export const CITY_BOULEVARD_HALF_WIDTH = 12;
/** Pavement width each side, in metres. */
export const CITY_SIDEWALK_WIDTH = 4;
/** Gap between adjacent buildings, in metres. */
export const CITY_BUILDING_GAP = 3;
/** Lot depth along the boulevard, in metres. */
export const CITY_LOT_DEPTH = 16;

export interface CityOptions {
  readonly seed: string;
  /** Item / street-furniture density. 0.4 (sparse) .. 2 (dense). */
  readonly density: number;
  readonly timeOfDay: TimeOfDay;
  /** Draw the animated route line. */
  readonly route: boolean;
  /** Print items available as paper-billboard content, cycled in order. */
  readonly itemIds: readonly string[];
}

export interface CityBuilding {
  readonly id: string;
  /** Base centre, on the ground. */
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly style: 'tower' | 'midrise' | 'block';
  /** Proportion of windows lit (0..1). */
  readonly litRatio: number;
  /** 0..1 material variation seed. */
  readonly tint: number;
  readonly side: -1 | 1;
}

export interface CityBillboard {
  readonly id: string;
  readonly formatId: string;
  readonly medium: OohMedium;
  /** Panel centre, in metres. */
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly mount: 'rooftop' | 'facade' | 'kerb';
  /** Item id for paper artwork; undefined for digital playlists. */
  readonly itemId?: string;
  /** Index into the digital playlist. */
  readonly playlistIndex: number;
  /**
   * The building a rooftop or facade panel is fixed to. Street furniture stands
   * on its own, so this is absent for kerb units. Resolution needs it: a wall
   * panel and a shopfront can want the same stretch of frontage.
   */
  readonly buildingId?: string;
}

export interface CitySign {
  readonly id: string;
  readonly signId: string;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

export interface CityStreetLight {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly side: -1 | 1;
}

export interface CityRoad {
  readonly id: string;
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly length: number;
  readonly axis: 'x' | 'z';
}

export interface CityLayout {
  readonly seed: string;
  readonly timeOfDay: TimeOfDay;
  readonly extent: number;
  readonly litRatio: number;
  readonly roads: readonly CityRoad[];
  readonly buildings: readonly CityBuilding[];
  readonly billboards: readonly CityBillboard[];
  readonly signs: readonly CitySign[];
  readonly streetLights: readonly CityStreetLight[];
}

export interface CityRoutePoint {
  readonly x: number;
  readonly z: number;
  readonly t: number;
}

export interface CityRoute {
  readonly id: string;
  readonly points: readonly CityRoutePoint[];
  readonly length: number;
}

export interface CityRouteSample {
  readonly x: number;
  readonly z: number;
  /** Heading in radians, measured from +Z towards +X. */
  readonly heading: number;
}

// --- Deterministic randomness ---------------------------------------------

/** Mulberry32 — small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// --- Layout ----------------------------------------------------------------

const DIGITAL_FORMATS = OOH_FORMATS.filter((format) => format.medium === 'digital');
const PAPER_FORMATS = OOH_FORMATS.filter((format) => format.medium === 'paper');

/** Base proportion of windows lit for a time of day. */
export function baseLitRatio(timeOfDay: TimeOfDay): number {
  switch (timeOfDay) {
    case 'night':
      return 0.62;
    case 'dusk':
      return 0.4;
    default:
      return 0.1;
  }
}

/** Roof height for a billboard of the given format, sitting on a roof. */
function roofMountY(roofY: number, formatId: string): number {
  const format = getOohFormat(formatId);
  const height = format ? oohSceneHeight(format) : 3;
  return roofY + height / 2;
}

/** Kerb-mounted panel centre height above the ground. */
function kerbMountY(formatId: string): number {
  const format = getOohFormat(formatId);
  if (!format) return 2;
  return oohSceneMountHeight(format) + oohSceneHeight(format) / 2;
}

/**
 * Generate the full street layout for a seed. Deterministic: the same options
 * always produce byte-identical geometry.
 */
export function generateCityLayout(options: CityOptions): CityLayout {
  const density = clamp(options.density, 0.4, 2);
  const rand = mulberry32(hashSeed(options.seed));
  const litRatio = baseLitRatio(options.timeOfDay);
  const extent = CITY_EXTENT_M;

  const buildings: CityBuilding[] = [];
  const billboards: CityBillboard[] = [];
  const signs: CitySign[] = [];
  const streetLights: CityStreetLight[] = [];

  const itemIds = options.itemIds.length > 0 ? options.itemIds : [];

  // Building slots down both sides of the boulevard.
  const slots: number[] = [];
  for (
    let z = -extent + CITY_LOT_DEPTH / 2;
    z <= extent - CITY_LOT_DEPTH / 2;
    z += CITY_LOT_DEPTH
  ) {
    slots.push(z);
  }

  let billboardIndex = 0;
  let itemCursor = 0;

  for (const side of [-1, 1] as const) {
    for (let s = 0; s < slots.length; s++) {
      const z = slots[s] ?? 0;
      // Occasional vacant lot keeps the street from feeling like a grid.
      if (rand() > Math.min(1, 0.62 * density)) continue;

      const widthX = 12 + rand() * 8;
      const depthZ = CITY_LOT_DEPTH - CITY_BUILDING_GAP;
      const styleRoll = rand();
      const style: CityBuilding['style'] =
        styleRoll < 0.24 ? 'tower' : styleRoll < 0.62 ? 'midrise' : 'block';
      const baseHeight =
        style === 'tower'
          ? 42 + rand() * 58
          : style === 'midrise'
            ? 17 + rand() * 22
            : 9 + rand() * 9;
      const height = Math.round(baseHeight * (0.78 + 0.22 * density));
      const x = side * (CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH + widthX / 2);
      const id = `bldg-${side > 0 ? 'r' : 'l'}-${s}`;

      buildings.push({
        id,
        position: [x, 0, z],
        width: widthX,
        depth: depthZ,
        height,
        style,
        litRatio: clamp(litRatio * (0.8 + rand() * 0.4), 0, 1),
        tint: rand(),
        side,
      });

      // Street-facing normal is towards the centreline.
      const facingY = side > 0 ? -Math.PI / 2 : Math.PI / 2;

      // Rooftop spectacular on the taller buildings.
      if (style === 'tower' && rand() < 0.72) {
        const digital = rand() < 0.55;
        const pool = digital ? DIGITAL_FORMATS : PAPER_FORMATS;
        const format = pool[Math.floor(rand() * pool.length)] ?? pool[0];
        if (format) {
          const itemId = digital
            ? undefined
            : itemIds.length > 0
              ? itemIds[itemCursor++ % itemIds.length]
              : undefined;
          billboards.push({
            id: `bb-roof-${billboardIndex}`,
            formatId: format.id,
            medium: format.medium,
            position: [x, roofMountY(height, format.id), z],
            rotationY: facingY,
            mount: 'rooftop',
            playlistIndex: billboardIndex % 5,
            buildingId: id,
            ...(itemId !== undefined ? { itemId } : {}),
          });
          billboardIndex++;
        }
      }

      // A large-format panel on the wall facing the street.
      if (style !== 'tower' && rand() < 0.4 * density) {
        const format = PAPER_FORMATS[Math.floor(rand() * 2)] ?? PAPER_FORMATS[0];
        if (format) {
          const panelH = oohSceneHeight(format);
          const itemId = itemIds.length > 0 ? itemIds[itemCursor++ % itemIds.length] : undefined;
          billboards.push({
            id: `bb-wall-${billboardIndex}`,
            formatId: format.id,
            medium: format.medium,
            position: [
              side * (CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH - 0.12),
              Math.min(height - panelH / 2 - 0.6, 3 + panelH / 2),
              z,
            ],
            rotationY: facingY,
            mount: 'facade',
            playlistIndex: billboardIndex % 5,
            buildingId: id,
            ...(itemId !== undefined ? { itemId } : {}),
          });
          billboardIndex++;
        }
      }
    }
  }

  // Kerb digital units at a regular beat, alternating sides.
  const kerbFormat = getOohFormat('ooh-digital-poster');
  if (kerbFormat) {
    for (let z = -extent + 40, i = 0; z <= extent - 40; z += 56, i++) {
      const side: -1 | 1 = i % 2 === 0 ? 1 : -1;
      billboards.push({
        id: `bb-kerb-${i}`,
        formatId: kerbFormat.id,
        medium: kerbFormat.medium,
        position: [
          side * (CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH - 1.4),
          kerbMountY(kerbFormat.id),
          z,
        ],
        rotationY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        mount: 'kerb',
        playlistIndex: i % 5,
      });
    }
  }

  // Signage along both kerbs.
  for (let z = -extent + 24, i = 0; z <= extent - 24; z += 26, i++) {
    const side: -1 | 1 = i % 2 === 0 ? 1 : -1;
    signs.push({
      id: `sign-${i}`,
      signId: ROAD_SIGN_IDS[i % ROAD_SIGN_IDS.length] ?? 'sign-warning',
      position: [side * (CITY_BOULEVARD_HALF_WIDTH + 0.9), 0, z],
      rotationY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
    });
  }

  // Street lighting, alternating sides.
  for (let z = -extent + 12, i = 0; z <= extent - 12; z += 22, i++) {
    const side: -1 | 1 = i % 2 === 0 ? 1 : -1;
    streetLights.push({
      id: `light-${i}`,
      position: [side * (CITY_BOULEVARD_HALF_WIDTH + 1.6), 0, z],
      rotationY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
      side,
    });
  }

  const roads: CityRoad[] = [
    {
      id: 'road-boulevard',
      position: [0, 0, 0],
      width: CITY_BOULEVARD_HALF_WIDTH * 2,
      length: extent * 2 + 60,
      axis: 'z',
    },
    {
      id: 'road-cross-north',
      position: [0, 0, extent - 20],
      width: 16,
      length: 90,
      axis: 'x',
    },
    {
      id: 'road-cross-south',
      position: [0, 0, -extent + 20],
      width: 16,
      length: 90,
      axis: 'x',
    },
  ];

  return {
    seed: options.seed,
    timeOfDay: options.timeOfDay,
    extent,
    litRatio,
    roads,
    buildings,
    billboards,
    signs,
    streetLights,
  };
}

// --- Route ("roadmap in motion") -------------------------------------------

/** Number of points sampled along the route. */
export const CITY_ROUTE_POINTS = 96;

/**
 * Generate the animated route: a gentle S-curve down the boulevard, expressed
 * as a polyline in metres. Deterministic from the same seed as the layout.
 */
export function generateCityRoute(options: CityOptions): CityRoute {
  const rand = mulberry32(hashSeed(options.seed) ^ 0x9e3779b9);
  // Keep the route inside a realistic lane envelope, well within the carriageway.
  const amplitude = 3.5 + rand() * 2;
  const frequency = 0.9 + rand() * 0.8;
  const phase = rand() * Math.PI * 2;

  const points: CityRoutePoint[] = [];
  for (let i = 0; i < CITY_ROUTE_POINTS; i++) {
    const t = i / (CITY_ROUTE_POINTS - 1);
    const z = -CITY_EXTENT_M + 8 + t * (CITY_EXTENT_M * 2 - 16);
    const x = Math.sin((z / CITY_EXTENT_M) * Math.PI * frequency + phase) * amplitude;
    points.push({ x, z, t });
  }

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }

  return { id: `route-${hashSeed(options.seed) % 100000}`, points, length };
}

/**
 * Sample the route at a normalised position, returning ground position and
 * heading. Clamps outside [0, 1].
 */
export function sampleCityRoute(route: CityRoute, t: number): CityRouteSample {
  const points = route.points;
  const last = points.length - 1;
  if (last <= 0) return { x: 0, z: 0, heading: 0 };

  const clamped = clamp(t, 0, 1);
  const scaled = clamped * last;
  const index = Math.min(last - 1, Math.floor(scaled));
  const local = scaled - index;
  const a = points[index]!;
  const b = points[index + 1]!;

  return {
    x: a.x + (b.x - a.x) * local,
    z: a.z + (b.z - a.z) * local,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
  };
}

// --- Presentation palette --------------------------------------------------

/**
 * A time-of-day lighting and colour palette. Kept here (pure data) so the
 * renderer's lighting rig, the sky and the window emissive share one source of
 * truth and the whole city shifts mood together.
 */
export interface CityPalette {
  readonly skyTop: string;
  readonly skyHorizon: string;
  readonly fog: string;
  readonly ground: string;
  readonly facade: string;
  readonly ambient: string;
  readonly ambientIntensity: number;
  readonly sun: string;
  readonly sunIntensity: number;
  /** Direction towards the sun / moon; the renderer scales it out. */
  readonly sunDirection: readonly [number, number, number];
  readonly windowColour: string;
  readonly windowIntensity: number;
  /** How strongly unlit paper billboards read as floodlit, 0..1. */
  readonly floodlitIntensity: number;
}

const PALETTES: Record<TimeOfDay, CityPalette> = {
  night: {
    skyTop: '#05070f',
    skyHorizon: '#1a2136',
    fog: '#141a2b',
    ground: '#0b0c10',
    facade: '#14161c',
    ambient: '#4a5a7a',
    ambientIntensity: 0.35,
    sun: '#9fb6e0',
    sunIntensity: 0.5,
    sunDirection: [-0.4, 1, 0.5],
    windowColour: '#ffd9a0',
    windowIntensity: 2.2,
    floodlitIntensity: 0.6,
  },
  dusk: {
    skyTop: '#1b2445',
    skyHorizon: '#e0793a',
    fog: '#5a3f42',
    ground: '#171319',
    facade: '#20202a',
    ambient: '#8a7a86',
    ambientIntensity: 0.55,
    sun: '#ffb066',
    sunIntensity: 1.15,
    sunDirection: [-0.85, 0.35, 0.6],
    windowColour: '#ffcf8a',
    windowIntensity: 1.4,
    floodlitIntensity: 0.3,
  },
  day: {
    skyTop: '#5f9fe0',
    skyHorizon: '#cfe4f7',
    fog: '#bcd4ec',
    ground: '#3a3a3e',
    facade: '#c9c6c0',
    ambient: '#ffffff',
    ambientIntensity: 0.9,
    sun: '#fff4e0',
    sunIntensity: 2,
    sunDirection: [0.5, 1.2, 0.4],
    windowColour: '#ffffff',
    windowIntensity: 0.15,
    floodlitIntensity: 0.05,
  },
};

/** Resolve the lighting and colour palette for a time of day. */
export function cityPalette(timeOfDay: TimeOfDay): CityPalette {
  return PALETTES[timeOfDay] ?? PALETTES.night;
}

/** Every time of day, in catalogue order — handy for tooling and tests. */
export const CITY_TIMES_OF_DAY: readonly TimeOfDay[] = ['night', 'dusk', 'day'];
