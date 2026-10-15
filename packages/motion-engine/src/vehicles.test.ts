import { describe, expect, it } from 'vitest';
import {
  CITY_BOULEVARD_HALF_WIDTH,
  CITY_EXTENT_M,
  type CityOptions,
  generateCityLayout,
} from './city.js';
import { PRINT_ITEMS_HERO_IDS } from './print-items.js';
import { required } from './test-support.js';
import {
  CITY_LANES,
  CITY_PARKING_OFFSET,
  CITY_VEHICLE_KINDS,
  cityVehicleLoopLength,
  generateCityVehicles,
  VEHICLE_SIZES,
  vehiclePoseAt,
} from './vehicles.js';

const baseOptions: CityOptions = {
  seed: 'test-city',
  density: 1,
  timeOfDay: 'night',
  route: true,
  itemIds: [...PRINT_ITEMS_HERO_IDS],
};

describe('VEHICLE_SIZES', () => {
  it('gives every kind real, positive dimensions', () => {
    for (const kind of CITY_VEHICLE_KINDS) {
      const size = VEHICLE_SIZES[kind];
      expect(size.length).toBeGreaterThan(3);
      expect(size.width).toBeGreaterThan(1.5);
      expect(size.height).toBeGreaterThan(1);
      expect(size.wheelBase).toBeLessThan(size.length);
      expect(size.wheelRadius).toBeGreaterThan(0.2);
    }
  });

  it('makes a bus longer and taller than a car', () => {
    expect(VEHICLE_SIZES.bus.length).toBeGreaterThan(VEHICLE_SIZES.car.length);
    expect(VEHICLE_SIZES.bus.height).toBeGreaterThan(VEHICLE_SIZES.car.height);
  });
});

describe('generateCityVehicles', () => {
  it('is deterministic for a given seed', () => {
    expect(generateCityVehicles(baseOptions)).toEqual(generateCityVehicles(baseOptions));
  });

  it('differs between seeds', () => {
    const a = generateCityVehicles(baseOptions);
    const b = generateCityVehicles({ ...baseOptions, seed: 'other-city' });
    expect(a).not.toEqual(b);
  });

  it('parks vehicles in the bays and moves them in lane', () => {
    const vehicles = generateCityVehicles(baseOptions);
    const parked = vehicles.filter((v) => v.parked);
    const moving = vehicles.filter((v) => !v.parked);
    expect(parked.length).toBeGreaterThan(0);
    expect(moving.length).toBeGreaterThan(0);

    for (const vehicle of parked) {
      expect(vehicle.speed).toBe(0);
      expect(Math.abs(vehicle.lane)).toBeCloseTo(CITY_PARKING_OFFSET, 12);
    }
    for (const vehicle of moving) {
      expect(vehicle.speed).toBeGreaterThan(0);
      expect(CITY_LANES.some((lane) => lane.offset === vehicle.lane)).toBe(true);
    }
  });

  it('keeps every vehicle inside the carriageway', () => {
    for (const vehicle of generateCityVehicles(baseOptions)) {
      expect(Math.abs(vehicle.lane)).toBeLessThan(CITY_BOULEVARD_HALF_WIDTH);
    }
  });

  it('drives on the left, so +Z traffic uses the +X lanes', () => {
    for (const vehicle of generateCityVehicles(baseOptions)) {
      if (vehicle.parked) continue;
      expect(Math.sign(vehicle.lane)).toBe(vehicle.direction);
    }
  });

  it('liveries exactly one PrintSync vehicle, and it is a moving van', () => {
    const branded = generateCityVehicles(baseOptions).filter((v) => v.brand);
    expect(branded).toHaveLength(1);
    expect(branded[0]?.kind).toBe('van');
    expect(branded[0]?.parked).toBe(false);
  });

  it('builds more traffic when density rises', () => {
    const sparse = generateCityVehicles({ ...baseOptions, density: 0.4 });
    const dense = generateCityVehicles({ ...baseOptions, density: 2 });
    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it('produces no duplicate ids', () => {
    const ids = generateCityVehicles(baseOptions).map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('vehiclePoseAt', () => {
  it('never moves a parked vehicle', () => {
    const parked = generateCityVehicles(baseOptions).find((v) => v.parked);
    expect(parked).toBeDefined();
    if (!parked) return;
    const a = vehiclePoseAt(parked, 0);
    const b = vehiclePoseAt(parked, 240);
    expect(b).toEqual(a);
  });

  it('advances a moving vehicle along its direction of travel', () => {
    const moving = generateCityVehicles(baseOptions).find((v) => !v.parked && v.direction === 1);
    expect(moving).toBeDefined();
    if (!moving) return;
    const a = vehiclePoseAt(moving, 0);
    const b = vehiclePoseAt(moving, 0.5);
    expect(b.z).toBeGreaterThan(a.z);
    expect(b.x).toBe(a.x);
  });

  it('wraps inside the loop instead of driving off into the distance', () => {
    const moving = generateCityVehicles(baseOptions).find((v) => !v.parked);
    expect(moving).toBeDefined();
    if (!moving) return;
    const span = cityVehicleLoopLength(CITY_EXTENT_M);
    const min = -CITY_EXTENT_M - 30;
    for (let seconds = 0; seconds < 400; seconds += 7) {
      const z = vehiclePoseAt(moving, seconds).z;
      expect(z).toBeGreaterThanOrEqual(min - 1e-9);
      expect(z).toBeLessThanOrEqual(min + span + 1e-9);
    }
  });

  it('faces the way it travels', () => {
    for (const vehicle of generateCityVehicles(baseOptions)) {
      const pose = vehiclePoseAt(vehicle, 10);
      expect(pose.heading).toBe(vehicle.direction > 0 ? 0 : Math.PI);
    }
  });

  it('matches the layout the city was built from', () => {
    // Traffic must fit the street the same seed generated.
    const layout = generateCityLayout(baseOptions);
    const vehicles = generateCityVehicles(baseOptions);
    for (const vehicle of vehicles) {
      expect(Math.abs(vehicle.lane)).toBeLessThan(
        required(layout.roads[0], 'city road 0').width / 2,
      );
    }
  });
});
