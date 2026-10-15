/**
 * Traffic for the living city.
 *
 * Deterministic and pure, like the rest of the city generators: a seed fixes
 * which vehicles exist, where they start and how fast they move. The renderer
 * only ever asks "where is this vehicle *right now*" via `vehiclePoseAt`, so
 * frames can be rendered independently and out of order.
 *
 * Vehicles are modelled at real dimensions (a bus really is 11.5 m long) so they
 * provide an honest sense of scale against the 12.192 m 96-sheet billboards and
 * the 3.2 m storey heights behind them.
 */

import {
  CITY_BOULEVARD_HALF_WIDTH,
  CITY_EXTENT_M,
  type CityOptions,
  hashSeed,
  mulberry32,
} from './city.js';

export type CityVehicleKind = 'car' | 'taxi' | 'van' | 'bus' | 'truck';

/** Real-world envelope of a vehicle kind, in metres. */
export interface CityVehicleSize {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  /** Distance between axle centres. */
  readonly wheelBase: number;
  readonly wheelRadius: number;
}

/** Dimensions taken from typical production vehicles. */
export const VEHICLE_SIZES: Record<CityVehicleKind, CityVehicleSize> = {
  car: { length: 4.4, width: 1.82, height: 1.46, wheelBase: 2.7, wheelRadius: 0.33 },
  taxi: { length: 4.62, width: 1.85, height: 1.51, wheelBase: 2.79, wheelRadius: 0.33 },
  van: { length: 5.4, width: 2.0, height: 2.24, wheelBase: 3.2, wheelRadius: 0.36 },
  bus: { length: 11.5, width: 2.55, height: 3.2, wheelBase: 6.0, wheelRadius: 0.5 },
  truck: { length: 8.6, width: 2.5, height: 3.35, wheelBase: 4.6, wheelRadius: 0.5 },
};

/**
 * Lane centre offsets from the boulevard centreline, in metres. The city drives
 * on the left, so traffic heading towards +Z uses the +X lanes.
 */
export const CITY_LANES = [
  { offset: 3.4, direction: 1 },
  { offset: 7.8, direction: 1 },
  { offset: -3.4, direction: -1 },
  { offset: -7.8, direction: -1 },
] as const satisfies readonly { readonly offset: number; readonly direction: 1 | -1 }[];

/** Where a kerbside parked vehicle sits, measured from the centreline. */
export const CITY_PARKING_OFFSET = CITY_BOULEVARD_HALF_WIDTH - 1.15;

export interface CityVehicle {
  readonly id: string;
  readonly kind: CityVehicleKind;
  /** Lane centre offset from the boulevard centreline, in metres. */
  readonly lane: number;
  /** Along-boulevard starting position, in metres. */
  readonly z: number;
  /** Direction of travel: +1 towards +Z, -1 towards -Z. */
  readonly direction: 1 | -1;
  /** Cruising speed in metres per second; 0 when parked. */
  readonly speed: number;
  /** Body colour (hex). */
  readonly colour: string;
  readonly parked: boolean;
  /**
   * Marks the one PrintSync liveried vehicle in the city, so the renderer can
   * finish it in the brand colours with the mark on the flank.
   */
  readonly brand: boolean;
}

/** Neutral body colours; a real street is mostly greys, whites and darks. */
const BODY_COLOURS = [
  '#1b1d21',
  '#2a2d33',
  '#3c4658',
  '#54595f',
  '#8f949c',
  '#c9ccd1',
  '#e8e9ea',
  '#26303d',
  '#4a2f2f',
  '#1f3a2e',
] as const;

const PARKED_KINDS: readonly CityVehicleKind[] = ['car', 'van', 'truck'];
const MOVING_KINDS: readonly CityVehicleKind[] = ['car', 'taxi', 'van', 'bus', 'truck'];

function pick<T>(list: readonly T[], roll: number): T {
  return list[Math.min(list.length - 1, Math.floor(roll * list.length))] as T;
}

/**
 * Generate the city's traffic: vehicles parked along both kerbs and vehicles
 * cruising in lane. Deterministic from the seed; density scales both.
 */
export function generateCityVehicles(options: CityOptions): CityVehicle[] {
  const density = Math.min(2, Math.max(0.4, options.density));
  const rand = mulberry32(hashSeed(options.seed) ^ 0x2545f491);
  const extent = CITY_EXTENT_M;
  const vehicles: CityVehicle[] = [];

  // Parked bays along both kerbs, facing the way the adjacent lane travels.
  for (const side of [-1, 1] as const) {
    const lane = side * CITY_PARKING_OFFSET;
    const direction: 1 | -1 = side > 0 ? 1 : -1;
    let index = 0;
    for (let z = -extent + 8; z <= extent - 8; z += 6.5 + rand() * 9) {
      index++;
      if (rand() > Math.min(1, 0.6 * density)) continue;
      const kind = pick(PARKED_KINDS, rand());
      vehicles.push({
        id: `veh-parked-${side > 0 ? 'r' : 'l'}-${index}`,
        kind,
        lane,
        z,
        direction,
        speed: 0,
        colour: pick(BODY_COLOURS, rand()),
        parked: true,
        brand: false,
      });
    }
  }

  // Moving traffic, spaced along each lane.
  let movingIndex = 0;
  for (const entry of CITY_LANES) {
    const spacing = 36 + rand() * 26;
    for (let z = -extent; z <= extent; z += spacing) {
      if (rand() > Math.min(1, 0.6 * density)) continue;
      const kind = pick(MOVING_KINDS, rand());
      const slow = kind === 'bus' || kind === 'truck';
      vehicles.push({
        id: `veh-move-${movingIndex}`,
        kind,
        lane: entry.offset,
        z: z + (rand() - 0.5) * 7,
        direction: entry.direction,
        speed: (slow ? 6.5 : 9) + rand() * 4.5,
        colour: pick(BODY_COLOURS, rand()),
        parked: false,
        brand: false,
      });
      movingIndex++;
    }
  }

  // Exactly one PrintSync-liveried van, the first one to appear in the city, so
  // the brand takes part in the street rather than sitting only on billboards.
  const liveriedIndex = vehicles.findIndex((vehicle) => !vehicle.parked && vehicle.kind === 'van');
  if (liveriedIndex >= 0) {
    const van = vehicles[liveriedIndex];
    if (van) vehicles[liveriedIndex] = { ...van, brand: true, colour: '#f4f5f7' };
  }

  return vehicles;
}

/** A vehicle's pose at a moment in time. */
export interface CityVehiclePose {
  readonly x: number;
  readonly z: number;
  /** Heading in radians, measured from +Z towards +X. */
  readonly heading: number;
}

/** Total length of carriageway a moving vehicle loops around. */
export function cityVehicleLoopLength(extent: number = CITY_EXTENT_M): number {
  return extent * 2 + 60;
}

/**
 * Where a vehicle is after `seconds`. Parked vehicles never move; moving ones
 * cross the city and wrap back to the far end, so traffic never empties or
 * piles up regardless of how long the film runs.
 */
export function vehiclePoseAt(
  vehicle: CityVehicle,
  seconds: number,
  extent: number = CITY_EXTENT_M,
): CityVehiclePose {
  const heading = vehicle.direction > 0 ? 0 : Math.PI;
  if (vehicle.parked || vehicle.speed <= 0) {
    return { x: vehicle.lane, z: vehicle.z, heading };
  }
  const min = -extent - 30;
  const span = cityVehicleLoopLength(extent);
  const raw = vehicle.z + vehicle.direction * vehicle.speed * seconds;
  const z = min + ((((raw - min) % span) + span) % span);
  return { x: vehicle.lane, z, heading };
}

/** Every vehicle kind, in catalogue order — handy for tooling and tests. */
export const CITY_VEHICLE_KINDS: readonly CityVehicleKind[] = [
  'car',
  'taxi',
  'van',
  'bus',
  'truck',
];
