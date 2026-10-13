import { describe, it, expect } from 'vitest';
import {
  generateCityLayout,
  cityPalette,
  type CityBuilding,
  type CityOptions,
} from './city.js';
import {
  SHOPFRONT_HEIGHT_M,
  SHOPFRONT_HERO_Z,
  SHOPFRONT_MAX_HEIGHT_M,
  SHOPFRONT_PIER_M,
  generateCityShopfronts,
  shopfrontCopy,
  type ShopfrontTrade,
} from './shopfronts.js';

const options = (overrides: Partial<CityOptions> = {}): CityOptions => ({
  seed: 'shopfront-test',
  density: 1.2,
  timeOfDay: 'night',
  route: true,
  itemIds: [],
  ...overrides,
});

describe('generateCityShopfronts', () => {
  const opts = options();
  const { buildings } = generateCityLayout(opts);

  it('is deterministic for a seed', () => {
    const a = generateCityShopfronts(opts, buildings);
    const b = generateCityShopfronts(opts, buildings);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('never puts a shopfront on a tower, which is a lobby rather than a shop', () => {
    const towers = new Set(buildings.filter((b) => b.style === 'tower').map((b) => b.id));
    const shopfronts = generateCityShopfronts(opts, buildings);
    for (const shop of shopfronts) {
      expect(towers.has(shop.buildingId)).toBe(false);
    }
  });

  it('anchors every shopfront to a real building, in that building’s street wall', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    const byId = new Map(buildings.map((b) => [b.id, b] as const));
    for (const shop of shopfronts) {
      const building = byId.get(shop.buildingId);
      expect(building).toBeDefined();
      if (!building) continue;
      // The storefront lives in the plane of the wall that faces the street,
      // half a building depth in from the mass's centre — never inside it.
      expect(shop.position[0]).toBeCloseTo(
        building.position[0] - building.side * (building.width / 2),
        10,
      );
      expect(Math.abs(shop.position[0])).toBeCloseTo(
        Math.abs(building.position[0]) - building.width / 2,
        10,
      );
      expect(shop.position[2]).toBe(building.position[2]);
      // Facing the centreline: +X side faces -X, and vice versa.
      const expected = building.side > 0 ? -Math.PI / 2 : Math.PI / 2;
      expect(shop.rotationY).toBe(expected);
    }
  });

  it('leaves room for glazing between the piers', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    for (const shop of shopfronts) {
      expect(shop.width).toBeGreaterThan(SHOPFRONT_PIER_M * 2 + 2);
      expect(shop.span).toBeGreaterThanOrEqual(shop.width);
      // The piers are what is left of the span outside the glazing.
      expect(shop.span - shop.width).toBeLessThanOrEqual(SHOPFRONT_PIER_M * 2 + 0.4);
      expect(shop.height).toBeGreaterThanOrEqual(3.9);
      expect(shop.height).toBeLessThanOrEqual(4.5);
      expect(shop.awning === 'none' || shop.awning === 'straight' || shop.awning === 'wedge').toBe(true);
    }
  });

  it('places the single PrintSync shop where the film passes it, on the near pavement', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    const heroes = shopfronts.filter((shop) => shop.isPrintSync);
    expect(heroes).toHaveLength(1);
    const hero = heroes[0];
    expect(hero?.trade).toBe('printcentre');
    expect(hero?.name).toBe('PrintSync');
    // The camera runs the left-hand pavement, so the brand shop is on it.
    expect(hero?.position[0]).toBeLessThan(0);

    // And it is the left-hand trading frontage nearest the hero point, which is
    // what puts it on the shot's route rather than at the far end of the city.
    let nearest: CityBuilding | undefined;
    for (const building of buildings) {
      if (building.style === 'tower' || building.depth < 6 || building.side > 0) continue;
      if (
        !nearest ||
        Math.abs(building.position[2] - SHOPFRONT_HERO_Z) <
          Math.abs(nearest.position[2] - SHOPFRONT_HERO_Z)
      ) {
        nearest = building;
      }
    }
    expect(nearest).toBeDefined();
    expect(hero?.buildingId).toBe(nearest?.id);
  });

  it('matches the real shopfront head height within a trade’s tolerance', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    for (const shop of shopfronts) {
      expect(Math.abs(shop.height - SHOPFRONT_HEIGHT_M)).toBeLessThanOrEqual(0.25);
    }
  });

  it('only shops in blocks tall enough to leave mass above the fascia', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    const byId = new Map(buildings.map((b) => [b.id, b] as const));
    for (const shop of shopfronts) {
      const building = byId.get(shop.buildingId);
      expect(building).toBeDefined();
      expect(shop.height).toBeLessThanOrEqual(SHOPFRONT_MAX_HEIGHT_M);
      // Storeys remain above the opening: no shop poking through the roof.
      expect((building?.height ?? 0) - shop.height).toBeGreaterThanOrEqual(2.5);
    }
  });

  it('keeps the interior fit-out in range', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    for (const shop of shopfronts) {
      expect(shop.interior.shelfBays).toBeGreaterThanOrEqual(0);
      expect(shop.interior.shelfBays).toBeLessThanOrEqual(3);
      expect(shop.interior.banner === undefined || shop.interior.banner.length > 0).toBe(true);
    }
  });

  it('spreads trades rather than repeating one shop all the way down the street', () => {
    const shopfronts = generateCityShopfronts(opts, buildings);
    const trades = new Set(shopfronts.map((shop) => shop.trade));
    expect(trades.size).toBeGreaterThan(1);
  });

  it('has copy for every trade', () => {
    for (const trade of [
      'printcentre',
      'cafe',
      'bakery',
      'florist',
      'bookshop',
      'pharmacy',
      'barber',
      'optician',
      'grocer',
    ] satisfies ShopfrontTrade[]) {
      expect(shopfrontCopy(trade).length).toBeGreaterThan(0);
    }
  });
});

describe('shopfront colour and palette', () => {
  it('uses a trade accent that is a real hex colour', () => {
    const opts = options();
    const shopfronts = generateCityShopfronts(opts, generateCityLayout(opts).buildings);
    for (const shop of shopfronts) {
      expect(shop.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has a palette for every time of day, so a shop is lit at any hour', () => {
    for (const timeOfDay of ['night', 'dusk', 'day'] as const) {
      expect(cityPalette(timeOfDay).windowIntensity).toBeGreaterThan(0);
    }
  });
});
