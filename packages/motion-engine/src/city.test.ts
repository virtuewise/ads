import { describe, expect, it } from 'vitest';
import {
  baseLitRatio,
  CITY_BOULEVARD_HALF_WIDTH,
  CITY_EXTENT_M,
  CITY_ROUTE_POINTS,
  CITY_SIDEWALK_WIDTH,
  CITY_TIMES_OF_DAY,
  type CityOptions,
  cityPalette,
  generateCityLayout,
  generateCityRoute,
  hashSeed,
  mulberry32,
  sampleCityRoute,
} from './city.js';
import { getOohFormat } from './ooh.js';
import { PRINT_ITEMS_HERO_IDS } from './print-items.js';
import { getRoadSign } from './signage.js';

const baseOptions: CityOptions = {
  seed: 'test-city',
  density: 1,
  timeOfDay: 'night',
  route: true,
  itemIds: [...PRINT_ITEMS_HERO_IDS],
};

describe('hashSeed', () => {
  it('is deterministic', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });

  it('separates similar inputs', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('is an unsigned 32-bit integer', () => {
    const h = hashSeed('printsync-city-01');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('baseLitRatio', () => {
  it('lights more windows at night than at dusk, and least by day', () => {
    expect(baseLitRatio('night')).toBeGreaterThan(baseLitRatio('dusk'));
    expect(baseLitRatio('dusk')).toBeGreaterThan(baseLitRatio('day'));
    expect(baseLitRatio('day')).toBeGreaterThanOrEqual(0);
  });
});

describe('generateCityLayout', () => {
  it('is deterministic for a given seed', () => {
    expect(generateCityLayout(baseOptions)).toEqual(generateCityLayout(baseOptions));
  });

  it('differs between seeds', () => {
    const a = generateCityLayout(baseOptions);
    const b = generateCityLayout({ ...baseOptions, seed: 'other-city' });
    expect(a.buildings).not.toEqual(b.buildings);
  });

  it('reports the extent and lit ratio it was generated with', () => {
    const layout = generateCityLayout(baseOptions);
    expect(layout.extent).toBe(CITY_EXTENT_M);
    expect(layout.litRatio).toBe(baseLitRatio('night'));
    expect(layout.timeOfDay).toBe('night');
    expect(layout.seed).toBe('test-city');
  });

  it('fills buildings on both sides of the boulevard', () => {
    const layout = generateCityLayout(baseOptions);
    expect(layout.buildings.some((b) => b.side === 1)).toBe(true);
    expect(layout.buildings.some((b) => b.side === -1)).toBe(true);
  });

  it('grounds every building at y = 0 with positive mass', () => {
    for (const building of generateCityLayout(baseOptions).buildings) {
      expect(building.position[1]).toBe(0);
      expect(building.width).toBeGreaterThan(0);
      expect(building.depth).toBeGreaterThan(0);
      expect(building.height).toBeGreaterThan(0);
    }
  });

  it('keeps every building clear of the carriageway and pavement', () => {
    const min = CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH;
    for (const building of generateCityLayout(baseOptions).buildings) {
      const innerEdge = Math.abs(building.position[0]) - building.width / 2;
      expect(innerEdge).toBeGreaterThanOrEqual(min - 1e-9);
    }
  });

  it('puts each building on the side its x position implies', () => {
    for (const building of generateCityLayout(baseOptions).buildings) {
      expect(Math.sign(building.position[0])).toBe(building.side);
    }
  });

  it('keeps the lit ratio inside [0, 1]', () => {
    for (const building of generateCityLayout(baseOptions).buildings) {
      expect(building.litRatio).toBeGreaterThanOrEqual(0);
      expect(building.litRatio).toBeLessThanOrEqual(1);
    }
  });

  it('clamps density so sparse and dense cities both resolve', () => {
    const sparse = generateCityLayout({ ...baseOptions, density: 0.4 });
    const dense = generateCityLayout({ ...baseOptions, density: 2 });
    expect(sparse.buildings.length).toBeGreaterThan(0);
    expect(dense.buildings.length).toBeGreaterThan(sparse.buildings.length);
  });

  it('treats a non-finite density as the sparse floor', () => {
    const nan = generateCityLayout({ ...baseOptions, density: Number.NaN });
    expect(nan.buildings.length).toBeGreaterThan(0);
  });

  it('builds one boulevard and two cross streets', () => {
    const layout = generateCityLayout(baseOptions);
    expect(layout.roads.map((r) => r.axis)).toEqual(['z', 'x', 'x']);
    expect(layout.roads[0]?.width).toBe(CITY_BOULEVARD_HALF_WIDTH * 2);
  });

  it('gives every billboard a real format and a plausible mount height', () => {
    const layout = generateCityLayout(baseOptions);
    expect(layout.billboards.length).toBeGreaterThan(0);
    for (const billboard of layout.billboards) {
      const format = getOohFormat(billboard.formatId);
      expect(format).toBeDefined();
      expect(billboard.position[1]).toBeGreaterThan(0);
      if (billboard.mount === 'kerb') {
        expect(billboard.position[1]).toBeLessThan(5);
      }
    }
  });

  it('only assigns paper items to paper billboards', () => {
    for (const billboard of generateCityLayout(baseOptions).billboards) {
      if (billboard.medium === 'digital') {
        expect(billboard.itemId).toBeUndefined();
      }
    }
  });

  it('cycles paper billboard content through the supplied items', () => {
    const layout = generateCityLayout(baseOptions);
    const used = layout.billboards.map((b) => b.itemId).filter((id) => id !== undefined);
    if (used.length > 0) {
      for (const id of used) {
        expect(PRINT_ITEMS_HERO_IDS).toContain(id);
      }
    }
  });

  it('places signage that references real signs', () => {
    const layout = generateCityLayout(baseOptions);
    expect(layout.signs.length).toBeGreaterThan(0);
    for (const sign of layout.signs) {
      expect(getRoadSign(sign.signId)).toBeDefined();
      expect(sign.position[1]).toBe(0);
    }
  });

  it('places street lighting on both sides, off the carriageway', () => {
    const layout = generateCityLayout(baseOptions);
    expect(layout.streetLights.some((l) => l.side === 1)).toBe(true);
    expect(layout.streetLights.some((l) => l.side === -1)).toBe(true);
    for (const light of layout.streetLights) {
      expect(Math.abs(light.position[0])).toBeGreaterThan(CITY_BOULEVARD_HALF_WIDTH);
    }
  });

  it('produces no duplicate ids', () => {
    const layout = generateCityLayout(baseOptions);
    const ids = [
      ...layout.buildings.map((b) => b.id),
      ...layout.billboards.map((b) => b.id),
      ...layout.signs.map((s) => s.id),
      ...layout.streetLights.map((l) => l.id),
      ...layout.roads.map((r) => r.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('generateCityRoute', () => {
  it('is deterministic for a given seed', () => {
    expect(generateCityRoute(baseOptions)).toEqual(generateCityRoute(baseOptions));
  });

  it('samples the configured number of points across the boulevard', () => {
    const route = generateCityRoute(baseOptions);
    expect(route.points).toHaveLength(CITY_ROUTE_POINTS);
    expect(route.points[0]?.t).toBe(0);
    expect(route.points[route.points.length - 1]?.t).toBeCloseTo(1, 12);
  });

  it('runs monotonically down the street', () => {
    const route = generateCityRoute(baseOptions);
    for (let i = 1; i < route.points.length; i++) {
      expect(route.points[i]!.z).toBeGreaterThan(route.points[i - 1]!.z);
    }
  });

  it('stays within the boulevard width', () => {
    for (const point of generateCityRoute(baseOptions).points) {
      expect(Math.abs(point.x)).toBeLessThan(CITY_BOULEVARD_HALF_WIDTH / 2);
    }
  });

  it('measures a positive length', () => {
    expect(generateCityRoute(baseOptions).length).toBeGreaterThan(0);
  });

  it('differs between seeds', () => {
    const a = generateCityRoute(baseOptions);
    const b = generateCityRoute({ ...baseOptions, seed: 'other-city' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('sampleCityRoute', () => {
  it('returns the first point at t = 0 and the last at t = 1', () => {
    const route = generateCityRoute(baseOptions);
    const start = sampleCityRoute(route, 0);
    const end = sampleCityRoute(route, 1);
    expect(start.z).toBeCloseTo(route.points[0]!.z, 12);
    expect(end.z).toBeCloseTo(route.points[route.points.length - 1]!.z, 12);
  });

  it('clamps outside [0, 1]', () => {
    const route = generateCityRoute(baseOptions);
    expect(sampleCityRoute(route, -3)).toEqual(sampleCityRoute(route, 0));
    expect(sampleCityRoute(route, 9)).toEqual(sampleCityRoute(route, 1));
  });

  it('returns a finite heading everywhere', () => {
    const route = generateCityRoute(baseOptions);
    for (let i = 0; i <= 20; i++) {
      const sample = sampleCityRoute(route, i / 20);
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.z)).toBe(true);
      expect(Number.isFinite(sample.heading)).toBe(true);
    }
  });

  it('handles a degenerate one-point route', () => {
    const route = { id: 'r', points: [{ x: 0, z: 0, t: 0 }], length: 0 };
    expect(sampleCityRoute(route, 0.5)).toEqual({ x: 0, z: 0, heading: 0 });
  });
});

describe('cityPalette', () => {
  it('returns a palette for every time of day', () => {
    for (const time of CITY_TIMES_OF_DAY) {
      const palette = cityPalette(time);
      for (const key of [
        'skyTop',
        'skyHorizon',
        'fog',
        'ground',
        'facade',
        'ambient',
        'sun',
        'windowColour',
      ] as const) {
        expect(palette[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(palette.ambientIntensity).toBeGreaterThanOrEqual(0);
      expect(palette.sunIntensity).toBeGreaterThanOrEqual(0);
      expect(palette.windowIntensity).toBeGreaterThanOrEqual(0);
      expect(palette.floodlitIntensity).toBeGreaterThanOrEqual(0);
      expect(palette.floodlitIntensity).toBeLessThanOrEqual(1);
      expect(palette.sunDirection).toHaveLength(3);
    }
  });

  it('lights windows brightest at night and dimmest by day', () => {
    expect(cityPalette('night').windowIntensity).toBeGreaterThan(
      cityPalette('dusk').windowIntensity,
    );
    expect(cityPalette('dusk').windowIntensity).toBeGreaterThan(cityPalette('day').windowIntensity);
  });

  it('shines the sun brightest by day', () => {
    expect(cityPalette('day').sunIntensity).toBeGreaterThan(cityPalette('dusk').sunIntensity);
    expect(cityPalette('dusk').sunIntensity).toBeGreaterThan(cityPalette('night').sunIntensity);
  });

  it('falls back to night for an unknown time of day', () => {
    expect(cityPalette('midday' as never)).toEqual(cityPalette('night'));
  });
});
