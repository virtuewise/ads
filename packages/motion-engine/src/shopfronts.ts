/**
 * Retail shopfronts and their interiors.
 *
 * This is the module that makes the city *show the work*. A billboard is one
 * print job; a shopfront is a dozen — fascia signage, illuminated letters, window
 * vinyl, awning valance, an A-board on the pavement, and then, behind the glass,
 * everything printed for the inside: a wall graphic, printed counter fronts,
 * shelf-edge strips, a hanging banner, a floor decal.
 *
 * Everything is pure and deterministic from the same seed as the layout, and
 * everything is derived from the building it occupies — a shopfront can never
 * float free of its mass, and the same brief always shops the same way.
 *
 * Dimensions are metres, matching the rest of the city, and are taken from real
 * signage practice: a 4.2 m shopfront head height, ~0.6 m piers either side of a
 * glazed bay, and a fascia depth that reads at driving speed.
 */

import {
  CITY_EXTENT_M,
  CITY_LOT_DEPTH,
  hashSeed,
  mulberry32,
  type CityBuilding,
  type CityOptions,
} from './city.js';

/** Head height of a shopfront opening, in metres. */
export const SHOPFRONT_HEIGHT_M = 4.2;

/** Depth of the retail interior behind the glazing, in metres. */
export const SHOPFRONT_DEPTH_M = 5.6;

/** Fascia board depth (its visible height), in metres. */
export const SHOPFRONT_FASCIA_M = 0.95;

/** Solid pier left either side of the glazed frontage, in metres. */
export const SHOPFRONT_PIER_M = 0.62;

/** Awning projection from the facade, in metres. */
export const SHOPFRONT_AWNING_M = 1.5;

/**
 * What a shop sells. Drives the interior dressing (a florist gets display
 * benches, a bookshop gets shelf bays) and the printed copy.
 */
export type ShopfrontTrade =
  | 'printcentre'
  | 'cafe'
  | 'bakery'
  | 'florist'
  | 'bookshop'
  | 'pharmacy'
  | 'barber'
  | 'optician'
  | 'grocer';

/** How the trading name is fabricated on the fascia. */
export type ShopfrontFasciaKind = 'panel' | 'letters' | 'lightbox';

/** How much of the glazing carries printed vinyl. */
export type ShopfrontWindowKind = 'clear' | 'band' | 'perforated' | 'vinyl';

export type ShopfrontAwning = 'none' | 'straight' | 'wedge';

/** The graphic treatment on the interior's street-facing back wall. */
export type ShopfrontBackWall = 'mural' | 'poster' | 'panelled';

/** The printed interior fit-out of a shop. */
export interface ShopfrontInterior {
  readonly backWall: ShopfrontBackWall;
  /** Printed counter across one side of the shop. */
  readonly counter: boolean;
  /** Number of shelf bays against the back wall, 0..3. */
  readonly shelfBays: number;
  /** Slogan printed on the hanging banner; undefined for no banner. */
  readonly banner: string | undefined;
  /** Printed floor decal in the doorway. */
  readonly floorDecal: boolean;
  /** Freestanding leaflet/poster stand. */
  readonly standee: boolean;
}

export interface CityShopfront {
  readonly id: string;
  readonly buildingId: string;
  /** Ground centre of the shopfront opening, in the plane of the facade. */
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  /** Glazed frontage width along the street, in metres. */
  readonly width: number;
  /**
   * Full elevation width along the street, in metres — the building's frontage.
   * The difference between this and `width` is the solid piers either side.
   */
  readonly span: number;
  /** Opening height, in metres. */
  readonly height: number;
  /** Interior depth, in metres. */
  readonly depth: number;
  /** The trading name, as printed. */
  readonly name: string;
  readonly trade: ShopfrontTrade;
  /** Trade accent colour, or the brand primary for the PrintSync shop. */
  readonly accent: string;
  readonly fasciaKind: ShopfrontFasciaKind;
  readonly windowKind: ShopfrontWindowKind;
  readonly awning: ShopfrontAwning;
  readonly interior: ShopfrontInterior;
  /** An A-board on the pavement outside. */
  readonly aBoard: boolean;
  /** This tenancy is PrintSync's own — it carries the real roundel. */
  readonly isPrintSync: boolean;
}

interface TradeSpec {
  readonly trade: ShopfrontTrade;
  readonly names: readonly string[];
  readonly copy: readonly string[];
  readonly banner: string;
  readonly accent: string;
  /** 0..1 appetite for shelving, which sets the bay count. */
  readonly shelf: number;
  readonly awning: ShopfrontAwning;
  readonly backWall: ShopfrontBackWall;
  /** Shopfront head height, in metres. */
  readonly headHeight: number;
}

/**
 * The high street. Curated rather than generated: a name pool with the right
 * register gets a convincing street far more cheaply than a grammar, and the
 * accents are chosen to sit beside the brand red without competing with it.
 */
const TRADES: readonly TradeSpec[] = [
  {
    trade: 'printcentre',
    names: ['PrintSync'],
    copy: ['Print · Sign · Install', 'Same-day print & signage'],
    banner: 'We print this whole city',
    accent: '#e02020',
    shelf: 0.7,
    awning: 'none',
    backWall: 'poster',
    headHeight: 4.4,
  },
  {
    trade: 'cafe',
    names: ['Marlow', 'The Copper Kettle', 'Nº 42 Coffee', 'Ferrous & Bean'],
    copy: ['Breakfast · Lunch', 'Roasted in house'],
    banner: 'Fresh roast daily',
    accent: '#1f6f5c',
    shelf: 0.2,
    awning: 'wedge',
    backWall: 'panelled',
    headHeight: 4.1,
  },
  {
    trade: 'bakery',
    names: ['St. Annes Bakehouse', 'The Flour Mill', 'Otto & Sons'],
    copy: ['Baked fresh each morning', 'Bread · Pastry · Cakes'],
    banner: 'Out of the oven at seven',
    accent: '#b06a1f',
    shelf: 0.5,
    awning: 'straight',
    backWall: 'panelled',
    headHeight: 4.0,
  },
  {
    trade: 'florist',
    names: ['Petal & Stem', 'Wilder Flowers', 'The Glasshouse'],
    copy: ['Seasonal · British grown', 'Bouquets made while you wait'],
    banner: 'Say it with flowers',
    accent: '#6b3fa0',
    shelf: 0.15,
    awning: 'wedge',
    backWall: 'mural',
    headHeight: 4.0,
  },
  {
    trade: 'bookshop',
    names: ['Folio & Sons', 'The Reading Room', 'Chapter Two'],
    copy: ['New · Second-hand · Rare', 'Open late Thursdays'],
    banner: 'Stories for every season',
    accent: '#2f4f7a',
    shelf: 1,
    awning: 'straight',
    backWall: 'poster',
    headHeight: 4.2,
  },
  {
    trade: 'pharmacy',
    names: ['Bell & Cross', 'Harbour Dispensary', 'Wellfield Chemist'],
    copy: ['Prescriptions · Advice', 'NHS & private'],
    banner: 'Open six days a week',
    accent: '#0f7a3d',
    shelf: 0.85,
    awning: 'none',
    backWall: 'panelled',
    headHeight: 4.2,
  },
  {
    trade: 'barber',
    names: ['Kings & Co.', 'The Cutting Room', 'Fade Factory'],
    copy: ['Cuts · Shaves · Beards', 'Walk-ins welcome'],
    banner: 'Est. 2011 — walk in',
    accent: '#7a1f35',
    shelf: 0.1,
    awning: 'straight',
    backWall: 'poster',
    headHeight: 4.0,
  },
  {
    trade: 'optician',
    names: ['Clearview', 'Lonsdale Opticians', 'Iris & Co.'],
    copy: ['Eye tests · Frames', 'Free adjustments, always'],
    banner: 'Look sharp',
    accent: '#1f5f8a',
    shelf: 0.6,
    awning: 'none',
    backWall: 'poster',
    headHeight: 4.2,
  },
  {
    trade: 'grocer',
    names: ['Fairfield Grocers', 'The Corner Store', 'Market Row'],
    copy: ['Fruit · Veg · Deli', 'Local suppliers since 1974'],
    banner: 'Fresh from the market',
    accent: '#4a6b1f',
    shelf: 0.9,
    awning: 'wedge',
    backWall: 'panelled',
    headHeight: 4.1,
  },
];

const TRADE_BY_ID = new Map(TRADES.map((spec) => [spec.trade, spec] as const));

/** The trade spec for an id, or the first trade — never undefined. */
function specFor(trade: ShopfrontTrade): TradeSpec {
  return TRADE_BY_ID.get(trade) ?? (TRADES[0] as TradeSpec);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Shortest block that can carry a shopfront, in metres. The opening is at most
 * `SHOPFRONT_MAX_HEIGHT_M`, so this guarantees a couple of storeys of building
 * above the fascia rather than a shop poking through the roof.
 */
export const SHOPFRONT_MIN_BLOCK_M = 8;

/** Tallest shopfront opening any trade specifies, in metres. */
export const SHOPFRONT_MAX_HEIGHT_M = 4.4;

/** Where a shop can go: a trading frontage, not a tower lobby or a sliver. */
function tradable(building: CityBuilding): boolean {
  return (
    building.style !== 'tower' &&
    building.depth >= 6 &&
    building.height >= SHOPFRONT_MIN_BLOCK_M
  );
}

/**
 * Where along the boulevard the PrintSync shop sits, in metres from the centre.
 *
 * The film's travelling shot starts at the +Z end and runs the length of the
 * boulevard, so the brand shop belongs about a third of the way in: far enough
 * ahead to be read at the start of the shot, and close enough that the camera
 * holds it as it passes.
 */
export const SHOPFRONT_HERO_Z = CITY_EXTENT_M * 0.3;

/**
 * Which building carries the PrintSync shop.
 *
 * Chosen geometrically rather than from the random stream, so picking it never
 * shifts the rest of the street: it is the trading frontage on the left-hand
 * pavement — the side the camera runs alongside — nearest `SHOPFRONT_HERO_Z`.
 */
function printSyncBuildingId(buildings: readonly CityBuilding[]): string | undefined {
  let best: CityBuilding | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const building of buildings) {
    if (!tradable(building)) continue;
    // Any left-hand frontage beats every right-hand one.
    const score =
      (building.side > 0 ? CITY_EXTENT_M : 0) + Math.abs(building.position[2] - SHOPFRONT_HERO_Z);
    if (score < bestScore) {
      bestScore = score;
      best = building;
    }
  }
  return best?.id;
}

/**
 * Shopfronts for a seed.
 *
 * Only buildings with a genuine trading frontage to the boulevard get one:
 * towers are entrance lobbies rather than shops, and the very smallest blocks
 * are too narrow for a glazed frontage. Exactly one is the PrintSync shop, and
 * it is placed where the film is guaranteed to pass it.
 */
export function generateCityShopfronts(
  options: CityOptions,
  buildings: readonly CityBuilding[],
): CityShopfront[] {
  const density = clamp(options.density, 0.4, 2);
  const rand = mulberry32(hashSeed(options.seed) ^ 0x5bf03635);
  const shopfronts: CityShopfront[] = [];
  const heroId = printSyncBuildingId(buildings);

  // Trades in a fixed rotation with a rotating start offset, so the street has
  // variety without ever repeating a neighbour.
  const order = TRADES.filter((spec) => spec.trade !== 'printcentre');
  const offset = Math.floor(rand() * order.length);
  let tradeCursor = offset;
  let index = 0;

  for (const building of buildings) {
    if (building.style === 'tower') continue;
    const isHero = building.id === heroId;
    // Not every unit is a shop: some ground floors are offices, some are shut.
    // The brand shop always trades.
    const occupied = rand() <= clamp(0.72 * density, 0, 1);
    if (!occupied && !isHero) continue;
    // A frontage needs a trading block: room for glazing between its piers, and
    // enough mass above the fascia.
    if (!tradable(building)) continue;

    index++;
    const isPrintSync = isHero;
    const spec = isPrintSync ? specFor('printcentre') : (order[tradeCursor++ % order.length] as TradeSpec);

    const span = building.depth;
    const width = Math.max(3.6, span - SHOPFRONT_PIER_M * 2);
    const height = spec.headHeight;
    const facingY = building.side > 0 ? -Math.PI / 2 : Math.PI / 2;

    const name = isPrintSync
      ? spec.names[0] ?? 'PrintSync'
      : spec.names[Math.floor(rand() * spec.names.length)] ?? (spec.names[0] as string);

    const shelfBays = Math.round(spec.shelf * 3);
    const banner = rand() < 0.62 ? spec.banner : undefined;

    shopfronts.push({
      id: `shop-${building.side > 0 ? 'r' : 'l'}-${index}`,
      buildingId: building.id,
      position: [
        // The storefront sits in the plane of the building's street-facing wall,
        // which is half a building depth in from its centre. Everything behind
        // the glass is the retail unit itself, cut out of the ground floor.
        building.position[0] - building.side * (building.width / 2),
        0,
        building.position[2],
      ],
      rotationY: facingY,
      width,
      span,
      height,
      depth: SHOPFRONT_DEPTH_M,
      name,
      trade: spec.trade,
      accent: spec.accent,
      fasciaKind: isPrintSync ? 'lightbox' : rand() < 0.34 ? 'letters' : rand() < 0.7 ? 'panel' : 'lightbox',
      windowKind: rand() < 0.28 ? 'clear' : rand() < 0.6 ? 'band' : rand() < 0.85 ? 'perforated' : 'vinyl',
      awning: spec.awning,
      interior: {
        backWall: spec.backWall,
        counter: isPrintSync || rand() < 0.6,
        shelfBays,
        banner,
        floorDecal: rand() < 0.5,
        standee: rand() < 0.45,
      },
      aBoard: rand() < 0.55,
      isPrintSync,
    });
  }

  return shopfronts;
}

/** Copy lines a trade prints on its A-board, for the renderer to pick from. */
export function shopfrontCopy(trade: ShopfrontTrade): readonly string[] {
  return specFor(trade).copy;
}

/** The lot depth the city uses, re-exported so the renderer never hard-codes it. */
export const SHOPFRONT_LOT_DEPTH = CITY_LOT_DEPTH;
