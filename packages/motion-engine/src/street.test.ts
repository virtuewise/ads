import { describe, expect, it } from 'vitest';
import {
  CITY_BOULEVARD_HALF_WIDTH,
  CITY_SIDEWALK_WIDTH,
  type CityOptions,
  generateCityLayout,
} from './city.js';
import { PRINT_ITEMS_HERO_IDS } from './print-items.js';
import {
  CITY_JUNCTION_Z,
  CITY_PAVEMENT_CENTRE,
  generateCityBrandSigns,
  generateCityCrossings,
  generateCityJunctions,
  generateCityProps,
} from './street.js';

const baseOptions: CityOptions = {
  seed: 'test-city',
  density: 1,
  timeOfDay: 'night',
  route: true,
  itemIds: [...PRINT_ITEMS_HERO_IDS],
};

describe('generateCityProps', () => {
  it('is deterministic for a given seed', () => {
    expect(generateCityProps(baseOptions)).toEqual(generateCityProps(baseOptions));
  });

  it('grounds every prop and keeps it off the carriageway', () => {
    for (const prop of generateCityProps(baseOptions)) {
      expect(prop.position[1]).toBe(0);
      expect(Math.abs(prop.position[0])).toBeGreaterThan(CITY_BOULEVARD_HALF_WIDTH);
      expect(Number.isFinite(prop.rotationY)).toBe(true);
    }
  });

  it('keeps pavement furniture on the pavement', () => {
    const min = CITY_BOULEVARD_HALF_WIDTH;
    const max = CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH;
    for (const prop of generateCityProps(baseOptions)) {
      if (prop.kind === 'bin' || prop.kind === 'bench' || prop.kind === 'hydrant') {
        expect(Math.abs(prop.position[0])).toBeCloseTo(CITY_PAVEMENT_CENTRE, 6);
        expect(Math.abs(prop.position[0])).toBeGreaterThanOrEqual(min);
        expect(Math.abs(prop.position[0])).toBeLessThanOrEqual(max);
      }
    }
  });

  it('clusters bollards and signals around both junctions', () => {
    const props = generateCityProps(baseOptions);
    const bollards = props.filter((p) => p.kind === 'bollard');
    const signals = props.filter((p) => p.kind === 'signal');
    expect(bollards.length).toBeGreaterThanOrEqual(12);
    expect(signals).toHaveLength(4);
    for (const prop of [...bollards, ...signals]) {
      expect(Math.abs(Math.abs(prop.position[2]) - CITY_JUNCTION_Z)).toBeLessThan(16);
    }
  });

  it('covers both sides of the street', () => {
    const props = generateCityProps(baseOptions);
    expect(props.some((p) => p.position[0] > 0)).toBe(true);
    expect(props.some((p) => p.position[0] < 0)).toBe(true);
  });

  it('produces no duplicate ids', () => {
    const ids = generateCityProps(baseOptions).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('generateCityCrossings', () => {
  it('puts one crossing on each junction approach', () => {
    const crossings = generateCityCrossings(baseOptions);
    expect(crossings).toHaveLength(2);
    for (const crossing of crossings) {
      expect(crossing.position[0]).toBe(0);
      expect(crossing.width).toBe(CITY_BOULEVARD_HALF_WIDTH * 2);
      expect(crossing.depth).toBeGreaterThan(2);
      expect(Math.abs(crossing.position[2])).toBeLessThan(CITY_JUNCTION_Z);
    }
  });
});

describe('generateCityJunctions', () => {
  it('matches the cross streets in the layout', () => {
    const junctions = generateCityJunctions();
    const layout = generateCityLayout(baseOptions);
    const crossStreets = layout.roads.filter((road) => road.axis === 'x');
    expect(junctions).toHaveLength(crossStreets.length);
    for (const junction of junctions) {
      expect(crossStreets.some((road) => road.position[2] === junction.position[2])).toBe(true);
    }
  });
});

describe('generateCityBrandSigns', () => {
  it('is deterministic for a given seed', () => {
    const layout = generateCityLayout(baseOptions);
    expect(generateCityBrandSigns(baseOptions, layout.buildings)).toEqual(
      generateCityBrandSigns(baseOptions, layout.buildings),
    );
  });

  it('roof-signs every tower and never floats a sign free of its building', () => {
    const layout = generateCityLayout(baseOptions);
    const signs = generateCityBrandSigns(baseOptions, layout.buildings);
    const towers = layout.buildings.filter((building) => building.style === 'tower');
    const roofSigns = signs.filter((sign) => sign.mount === 'roof');
    expect(roofSigns).toHaveLength(towers.length);

    for (const sign of signs) {
      const owner = layout.buildings.find((building) => building.position[2] === sign.position[2]);
      expect(owner).toBeDefined();
      expect(sign.width).toBeGreaterThan(2);
      expect(sign.height).toBeGreaterThan(0);
      expect(sign.width / sign.height).toBeCloseTo(3, 6);
      if (sign.mount === 'roof' && owner) {
        expect(sign.position[1]).toBeGreaterThan(owner.height);
      }
    }
  });

  it('hangs fascia signs over the pavement, above head height', () => {
    const layout = generateCityLayout(baseOptions);
    const fascia = generateCityBrandSigns(baseOptions, layout.buildings).filter(
      (sign) => sign.mount === 'facade',
    );
    expect(fascia.length).toBeGreaterThan(0);
    for (const sign of fascia) {
      expect(Math.abs(sign.position[0])).toBeGreaterThanOrEqual(
        CITY_BOULEVARD_HALF_WIDTH + CITY_SIDEWALK_WIDTH,
      );
      expect(sign.position[1]).toBeGreaterThan(2.4);
    }
  });

  it('produces no duplicate ids', () => {
    const layout = generateCityLayout(baseOptions);
    const ids = generateCityBrandSigns(baseOptions, layout.buildings).map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
