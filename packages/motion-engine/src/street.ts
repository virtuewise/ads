/**
 * Street furniture, junctions and skyline branding for the living city.
 *
 * All pure and deterministic from the same seed as the layout. Furniture is
 * what makes a street read as a *place* rather than a set: bollards and a
 * crossing at the junctions, bins and benches on the pavement, planters to break
 * the kerb line — and PrintSync fascia and roof signs on the buildings, so the
 * brand owns the skyline rather than only the billboards.
 */

import {
  CITY_BOULEVARD_HALF_WIDTH,
  CITY_EXTENT_M,
  CITY_SIDEWALK_WIDTH,
  type CityBuilding,
  type CityOptions,
  hashSeed,
  mulberry32,
} from './city.js';

/** Distance from the city centre to each cross-street junction, in metres. */
export const CITY_JUNCTION_Z = CITY_EXTENT_M - 20;

/** Centre of the pavement each side of the carriageway. */
export const CITY_PAVEMENT_CENTRE = CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH / 2;

export type CityPropKind =
  | 'bollard'
  | 'bin'
  | 'planter'
  | 'bench'
  | 'signal'
  | 'hydrant'
  | 'shelter';

export interface CityProp {
  readonly id: string;
  readonly kind: CityPropKind;
  /** Ground position, in metres. */
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

export interface CityCrossing {
  readonly id: string;
  /** Centre of the crossing, on the carriageway. */
  readonly position: readonly [number, number, number];
  /** Distance across the carriageway (X), in metres. */
  readonly width: number;
  /** Depth of the crossing along the road (Z), in metres. */
  readonly depth: number;
}

/**
 * Markings at a junction: the stop line and the give-way triangle bar. Kept as
 * data so the road painter never hard-codes junction positions.
 */
export interface CityJunction {
  readonly id: string;
  readonly position: readonly [number, number, number];
  /** Carriageway width along Z at the junction, in metres. */
  readonly width: number;
}

export interface CityBrandSign {
  readonly id: string;
  /** Centre of the sign face, in metres. */
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  /** Face size, in metres. */
  readonly width: number;
  readonly height: number;
  readonly mount: 'facade' | 'roof';
}

/**
 * Street furniture for a seed. Bins, benches and planters are spaced along the
 * pavements; bollards and traffic signals cluster around the two junctions,
 * where a real street actually needs them.
 */
export function generateCityProps(options: CityOptions): CityProp[] {
  const density = Math.min(2, Math.max(0.4, options.density));
  const rand = mulberry32(hashSeed(options.seed) ^ 0x27d4eb2f);
  const extent = CITY_EXTENT_M;
  const props: CityProp[] = [];

  const facing = (side: -1 | 1): number => (side > 0 ? -Math.PI / 2 : Math.PI / 2);

  // Bins, benches and hydrants along both pavements.
  for (const side of [-1, 1] as const) {
    const x = side * CITY_PAVEMENT_CENTRE;
    let index = 0;
    for (let z = -extent + 18; z <= extent - 18; z += 13 + rand() * 16) {
      index++;
      const roll = rand();
      const kind: CityPropKind =
        roll < 0.42 ? 'bin' : roll < 0.76 ? 'bench' : roll < 0.9 ? 'planter' : 'hydrant';
      props.push({
        id: `prop-${side > 0 ? 'r' : 'l'}-${index}`,
        kind,
        position: [x, 0, z],
        rotationY: facing(side),
      });
    }
  }

  // Street planters at a slower beat, to break up the kerb line.
  for (const side of [-1, 1] as const) {
    const x = side * (CITY_BOULEVARD_HALF_WIDTH + 0.9);
    for (let z = -extent + 34, i = 0; z <= extent - 34; z += 38, i++) {
      if (rand() > Math.min(1, 0.5 * density)) continue;
      props.push({
        id: `planter-${side > 0 ? 'r' : 'l'}-${i}`,
        kind: 'planter',
        position: [x, 0, z],
        rotationY: facing(side),
      });
    }
  }

  // Junction furniture: bollards guarding each pavement corner, a signal pole
  // on each corner, and a bus shelter mid-pavement on each side.
  for (const junctionSign of [-1, 1] as const) {
    const junctionZ = junctionSign * CITY_JUNCTION_Z;
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 5; i++) {
        props.push({
          id: `bollard-${junctionSign > 0 ? 'n' : 's'}-${side > 0 ? 'r' : 'l'}-${i}`,
          kind: 'bollard',
          position: [side * (CITY_BOULEVARD_HALF_WIDTH + 0.6), 0, junctionZ + 6 + i * 2.2],
          rotationY: 0,
        });
      }
      props.push({
        id: `signal-${junctionSign > 0 ? 'n' : 's'}-${side > 0 ? 'r' : 'l'}`,
        kind: 'signal',
        position: [side * (CITY_BOULEVARD_HALF_WIDTH + 1.1), 0, junctionZ - 2.4],
        rotationY: facing(side),
      });
    }
  }

  for (const side of [-1, 1] as const) {
    props.push({
      id: `shelter-${side > 0 ? 'r' : 'l'}`,
      kind: 'shelter',
      position: [
        side * (CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH - 1.2),
        0,
        -extent * 0.45 * side,
      ],
      rotationY: facing(side),
    });
  }

  return props;
}

/** Zebra crossings on the boulevard, one approach per junction. */
export function generateCityCrossings(options: CityOptions): CityCrossing[] {
  void options;
  const crossings: CityCrossing[] = [];
  for (const sign of [-1, 1] as const) {
    crossings.push({
      id: `crossing-${sign > 0 ? 'north' : 'south'}`,
      position: [0, 0.012, sign * CITY_JUNCTION_Z - sign * 7.5],
      width: CITY_BOULEVARD_HALF_WIDTH * 2,
      depth: 4.2,
    });
  }
  return crossings;
}

/** The two cross-street junctions, as data for the road painter. */
export function generateCityJunctions(): CityJunction[] {
  return [
    {
      id: 'junction-north',
      position: [0, 0, CITY_JUNCTION_Z],
      width: 16,
    },
    {
      id: 'junction-south',
      position: [0, 0, -CITY_JUNCTION_Z],
      width: 16,
    },
  ];
}

/** Roof sign width as a fraction of the building width it sits on. */
const ROOF_SIGN_WIDTH_RATIO = 0.86;
const ROOF_SIGN_MAX_WIDTH = 15;
/** Roof signs use the 3:1 lockup of the mark and wordmark. */
const ROOF_SIGN_ASPECT = 3;

/**
 * PrintSync fascia and roof signage on the buildings. Towers get a roof sign
 * that reads on the skyline; mid-rises get a fascia sign above the entrance.
 * Deterministic, and derived from the buildings it is mounted on, so it can
 * never float free of the mass it belongs to.
 */
export function generateCityBrandSigns(
  options: CityOptions,
  buildings: readonly CityBuilding[],
): CityBrandSign[] {
  const density = Math.min(2, Math.max(0.4, options.density));
  const rand = mulberry32(hashSeed(options.seed) ^ 0x165667b1);
  const signs: CityBrandSign[] = [];

  for (const building of buildings) {
    const facingY = building.side > 0 ? -Math.PI / 2 : Math.PI / 2;

    if (building.style === 'tower') {
      const width = Math.min(ROOF_SIGN_MAX_WIDTH, building.width * ROOF_SIGN_WIDTH_RATIO);
      const height = width / ROOF_SIGN_ASPECT;
      // Lifted clear of the parapet; the renderer stands it on legs from the roof.
      signs.push({
        id: `brand-roof-${building.id}`,
        position: [building.position[0], building.height + height / 2 + 0.9, building.position[2]],
        rotationY: facingY,
        width,
        height,
        mount: 'roof',
      });
      continue;
    }

    if (building.style === 'midrise' && rand() < 0.45 * density) {
      const width = Math.min(9, building.width * 0.7);
      const height = width / ROOF_SIGN_ASPECT;
      signs.push({
        id: `brand-fascia-${building.id}`,
        position: [
          building.side * (CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH + 0.2),
          4.4,
          building.position[2],
        ],
        rotationY: facingY,
        width,
        height,
        mount: 'facade',
      });
    }
  }

  return signs;
}
