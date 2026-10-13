/**
 * Product-line render inputs.
 *
 * The render-input *contract* (`@printsync/common`) is the wire format the
 * orchestrator produces. This module is the renderer-side mirror of the subset
 * the product-line film needs, plus the pure resolution that turns loose
 * inputs into concrete catalogue specs and choreography.
 *
 * Keeping the resolver here means it is unit-testable and the renderer itself
 * stays free of validation concerns and of any extra runtime dependency.
 */

import { DEFAULT_BRAND_TOKENS, type BrandTokens } from './artwork.js';
import {
  CAMERA_PATHS,
  type CameraPath,
  type CityShotSubject,
} from './camera.js';
import {
  PRINT_ITEMS_HERO_ANIMATIONS,
  PRINT_ITEMS_HERO_IDS,
  getPrintItem,
  heroPrintItems,
  resolveChoreography,
  type PrintItemSpec,
  type ResolvedChoreography,
} from './print-items.js';
import {
  generateCityLayout,
  generateCityRoute,
  type CityBillboard,
  type CityLayout,
  type CityRoute,
  type CitySign,
  type TimeOfDay,
} from './city.js';
import {
  generateCityVehicles,
  VEHICLE_SIZES,
  type CityVehicle,
} from './vehicles.js';
import {
  generateCityBrandSigns,
  generateCityCrossings,
  generateCityJunctions,
  generateCityProps,
  type CityBrandSign,
  type CityCrossing,
  type CityJunction,
  type CityProp,
} from './street.js';
import { generateCityShopfronts, type CityShopfront } from './shopfronts.js';
import {
  OOH_PLAYLIST,
  getOohFormat,
  oohSceneHeight,
  oohSceneWidth,
  type OohHeadline,
  type OohSpec,
} from './ooh.js';
import {
  getRoadSign,
  roadSignSceneHeight,
  roadSignSceneMountHeight,
  roadSignSceneWidth,
  type RoadSignSpec,
} from './signage.js';

/** Per-item choreography override from a render input. */
export interface ItemChoreographyOverride {
  readonly id: string;
  readonly animation?: string;
  readonly phase?: number;
}

/** The render inputs that drive the product-line film. */
export interface ProductLineInputs {
  readonly title: string;
  readonly tagline: string;
  readonly brand: BrandTokens;
  readonly items: readonly string[];
  readonly itemAnimations: readonly ItemChoreographyOverride[];
  readonly cameraPath: CameraPath;
}

/** Inputs fully resolved against the catalogue, ready to render. */
export interface ResolvedProductLineInputs {
  readonly title: string;
  readonly tagline: string;
  readonly brand: BrandTokens;
  readonly specs: readonly PrintItemSpec[];
  readonly choreography: readonly ResolvedChoreography[];
  readonly cameraPath: CameraPath;
}

/** Defaults for the product-line film, shared with the Remotion root. */
export const DEFAULT_PRODUCT_LINE_INPUTS: ProductLineInputs = {
  title: 'Product Line',
  tagline: 'Modelled to spec — every millimetre exact.',
  brand: DEFAULT_BRAND_TOKENS,
  items: PRINT_ITEMS_HERO_IDS,
  itemAnimations: [],
  cameraPath: 'turntable',
};

/** Narrow an arbitrary string to a known camera path, defaulting to turntable. */
export function coerceCameraPath(value: string | undefined): CameraPath {
  return CAMERA_PATHS.find((path) => path === value) ?? 'turntable';
}

/**
 * Resolve loose, backend-supplied inputs into concrete specs and choreography.
 *
 * Unknown item ids are dropped and, if that leaves nothing renderable, the
 * curated hero set is used so the film always has content. Unknown camera paths
 * fall back to the turntable, and empty titles fall back to the defaults.
 */
export function resolveProductLineInputs(
  inputs?: Partial<ProductLineInputs>,
): ResolvedProductLineInputs {
  const merged: Partial<ProductLineInputs> = inputs ?? {};
  const requested = (merged.items ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  const specsFromRequest = requested
    .map((id) => getPrintItem(id))
    .filter((spec): spec is PrintItemSpec => spec !== undefined);
  const specs = specsFromRequest.length > 0 ? specsFromRequest : heroPrintItems();

  const overrides = merged.itemAnimations ?? [];
  const choreography = resolveChoreography(
    specs.map((spec) => spec.id),
    overrides,
    PRINT_ITEMS_HERO_ANIMATIONS,
  );

  return {
    title:
      typeof merged.title === 'string' && merged.title.length > 0
        ? merged.title
        : DEFAULT_PRODUCT_LINE_INPUTS.title,
    tagline:
      typeof merged.tagline === 'string' && merged.tagline.length > 0
        ? merged.tagline
        : DEFAULT_PRODUCT_LINE_INPUTS.tagline,
    brand: merged.brand ?? DEFAULT_PRODUCT_LINE_INPUTS.brand,
    specs,
    choreography,
    cameraPath: coerceCameraPath(
      merged.cameraPath ?? DEFAULT_PRODUCT_LINE_INPUTS.cameraPath,
    ),
  };
}

// --- Living city -----------------------------------------------------------

/** Default seed for the procedural city. */
export const DEFAULT_CITY_SEED = 'printsync-city-01';

/** The render inputs that drive the living-city film. */
export interface CityInputs {
  readonly title: string;
  readonly tagline: string;
  readonly brand: BrandTokens;
  readonly seed: string;
  readonly timeOfDay: TimeOfDay;
  /** Building / furniture density. 0.4 (sparse) .. 2 (dense). */
  readonly density: number;
  /** Draw the animated route line down the boulevard. */
  readonly route: boolean;
  readonly cameraPath: CameraPath;
  /** Print items used as large-format advertising content. */
  readonly items: readonly string[];
}

/** A billboard slot resolved against its format and (for paper) its item. */
export interface ResolvedCityBillboard {
  readonly slot: CityBillboard;
  readonly format: OohSpec;
  readonly item?: PrintItemSpec;
}

/** A sign slot resolved against its signage spec. */
export interface ResolvedCitySign {
  readonly slot: CitySign;
  readonly sign: RoadSignSpec;
}

/** Inputs fully resolved against the catalogues, ready to render. */
export interface ResolvedCityInputs {
  readonly title: string;
  readonly tagline: string;
  readonly brand: BrandTokens;
  readonly layout: CityLayout;
  readonly route: CityRoute | undefined;
  readonly billboards: readonly ResolvedCityBillboard[];
  readonly signs: readonly ResolvedCitySign[];
  /** Traffic: parked along both kerbs and cruising in lane. */
  readonly vehicles: readonly CityVehicle[];
  /** Pavement furniture, junction bollards and signal poles. */
  readonly props: readonly CityProp[];
  /** Zebra crossings on the boulevard approaches. */
  readonly crossings: readonly CityCrossing[];
  /** The two cross-street junctions. */
  readonly junctions: readonly CityJunction[];
  /** PrintSync fascia and roof signage on the buildings. */
  readonly brandSigns: readonly CityBrandSign[];
  /** Retail shopfronts with their printed interiors, at street level. */
  readonly shopfronts: readonly CityShopfront[];
  /** Printed faces the `showcase` camera path cuts to, in edit order. */
  readonly shotSubjects: readonly CityShotSubject[];
  readonly specs: readonly PrintItemSpec[];
  readonly playlist: readonly OohHeadline[];
  readonly cameraPath: CameraPath;
}

/** Defaults for the living-city film, shared with the Remotion root. */
export const DEFAULT_CITY_INPUTS: CityInputs = {
  title: 'PrintSync City',
  tagline: 'Every surface, printed to spec.',
  brand: DEFAULT_BRAND_TOKENS,
  seed: DEFAULT_CITY_SEED,
  timeOfDay: 'night',
  density: 1,
  route: true,
  cameraPath: 'showcase',
  items: PRINT_ITEMS_HERO_IDS,
};

const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ['night', 'dusk', 'day'];

/** Narrow an arbitrary string to a known time of day, defaulting to night. */
export function coerceTimeOfDay(value: string | undefined): TimeOfDay {
  return TIME_OF_DAY_VALUES.find((v) => v === value) ?? 'night';
}

/** Gap left between a shopfront's fascia and a wall panel riding above it. */
const PANEL_GAP_M = 0.25;

/**
 * Move a wall panel up so it clears a shopfront's fascia.
 *
 * A panel and a shopfront both want the street-facing frontage of the same
 * block. The shop wins the ground floor, so the panel rides up above the fascia
 * the way real poster sites sit over a shop. Returns undefined when the panel
 * already clears the shop, or when there is nothing to change.
 */
function liftAboveShop(
  slot: CityBillboard,
  panelHeight: number,
  shop: CityShopfront,
): CityBillboard | undefined {
  const bottom = slot.position[1] - panelHeight / 2;
  if (bottom >= shop.height) return undefined;
  const y = shop.height + PANEL_GAP_M + panelHeight / 2;
  return { ...slot, position: [slot.position[0], y, slot.position[2]] };
}

/**
 * Clear kerbside length a close-up needs alongside its subject, in metres.
 *
 * A face-on close-up puts the lens between the parking bays and the sign line,
 * so a subject with a parked vehicle alongside it cannot be shot square. This is
 * edge clearance, not centre distance — the shot also drifts a metre or so along
 * the face, and a bus is 11.5 m long.
 */
const SHOT_PARKING_CLEARANCE_M = 1.5;

/** How far the nearest kerbside parked vehicle's body is from a station, in metres. */
function kerbsideClearance(
  vehicles: readonly CityVehicle[],
  side: -1 | 1,
  z: number,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const vehicle of vehicles) {
    if (!vehicle.parked) continue;
    if (vehicle.lane * side <= 0) continue;
    const edge = Math.abs(vehicle.z - z) - VEHICLE_SIZES[vehicle.kind].length / 2;
    if (edge < nearest) nearest = edge;
  }
  return nearest;
}

/**
 * The printed faces the showcase edit cuts to.
 *
 * The PrintSync shopfront, then the digital screen with the largest face the
 * lens can get square to, then the biggest road sign on a clear stretch of
 * kerb. Chosen geometrically and deterministically — never from a random
 * stream — so the same city always yields the same edit.
 */
function resolveShotSubjects(
  billboards: readonly ResolvedCityBillboard[],
  signs: readonly ResolvedCitySign[],
  shopfronts: readonly CityShopfront[],
  vehicles: readonly CityVehicle[],
): CityShotSubject[] {
  const subjects: CityShotSubject[] = [];

  const heroShop = shopfronts.find((shop) => shop.isPrintSync) ?? shopfronts[0];
  if (heroShop) {
    subjects.push({
      kind: 'shopfront',
      position: [heroShop.position[0], heroShop.height / 2, heroShop.position[2]],
      size: [heroShop.span, heroShop.height],
      facing: heroShop.rotationY,
    });
  }
  const anchorZ = heroShop?.position[2] ?? 0;

  // Rooftop spectaculars are excluded: a close-up wants the lens at the panel's
  // own height, and the towers already carry them in the skyline shots.
  const boards = billboards.filter(
    (entry) =>
      entry.slot.medium === 'digital' &&
      entry.slot.mount === 'kerb' &&
      kerbsideClearance(
        vehicles,
        entry.slot.position[0] > 0 ? 1 : -1,
        entry.slot.position[2],
      ) >= SHOT_PARKING_CLEARANCE_M,
  );
  boards.sort((a, b) => {
    const byArea =
      oohSceneWidth(b.format) * oohSceneHeight(b.format) -
      oohSceneWidth(a.format) * oohSceneHeight(a.format);
    if (Math.abs(byArea) > 1e-9) return byArea;
    return (
      Math.abs(a.slot.position[2] - anchorZ) - Math.abs(b.slot.position[2] - anchorZ)
    );
  });
  const board = boards[0];
  if (board) {
    subjects.push({
      kind: 'billboard',
      position: [
        board.slot.position[0],
        board.slot.position[1],
        board.slot.position[2],
      ],
      size: [oohSceneWidth(board.format), oohSceneHeight(board.format)],
      facing: board.slot.rotationY,
    });
  }

  const clearSigns = signs.filter(
    (entry) =>
      kerbsideClearance(
        vehicles,
        entry.slot.position[0] > 0 ? 1 : -1,
        entry.slot.position[2],
      ) >= SHOT_PARKING_CLEARANCE_M,
  );
  clearSigns.sort((a, b) => {
    const byArea =
      roadSignSceneWidth(b.sign) * roadSignSceneHeight(b.sign) -
      roadSignSceneWidth(a.sign) * roadSignSceneHeight(a.sign);
    if (Math.abs(byArea) > 1e-9) return byArea;
    return (
      Math.abs(a.slot.position[2] - anchorZ) - Math.abs(b.slot.position[2] - anchorZ)
    );
  });
  const sign = clearSigns[0];
  if (sign) {
    subjects.push({
      kind: 'sign',
      position: [
        sign.slot.position[0],
        roadSignSceneMountHeight(sign.sign) + roadSignSceneHeight(sign.sign) / 2,
        sign.slot.position[2],
      ],
      size: [roadSignSceneWidth(sign.sign), roadSignSceneHeight(sign.sign)],
      facing: sign.slot.rotationY,
    });
  }

  return subjects;
}

/**
 * Resolve loose city inputs into a concrete, deterministic layout.
 *
 * Unknown item ids are dropped and, if that leaves nothing, the curated hero
 * set is used; a non-positive density falls back to the default; unknown time
 * of day and camera values fall back to defaults.
 */
export function resolveCityInputs(inputs?: Partial<CityInputs>): ResolvedCityInputs {
  const merged: Partial<CityInputs> = inputs ?? {};
  const requested = (merged.items ?? []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  const specsFromRequest = requested
    .map((id) => getPrintItem(id))
    .filter((spec): spec is PrintItemSpec => spec !== undefined);
  const specs = specsFromRequest.length > 0 ? specsFromRequest : heroPrintItems();

  const seed =
    typeof merged.seed === 'string' && merged.seed.length > 0
      ? merged.seed
      : DEFAULT_CITY_INPUTS.seed;
  const density =
    typeof merged.density === 'number' && Number.isFinite(merged.density) && merged.density > 0
      ? merged.density
      : DEFAULT_CITY_INPUTS.density;
  const timeOfDay = coerceTimeOfDay(merged.timeOfDay);
  const route = merged.route ?? DEFAULT_CITY_INPUTS.route;

  const options = {
    seed,
    density,
    timeOfDay,
    route,
    itemIds: specs.map((spec) => spec.id),
  };
  const layout = generateCityLayout(options);
  const vehicles = generateCityVehicles(options);
  const props = generateCityProps(options);
  const crossings = generateCityCrossings(options);
  const junctions = generateCityJunctions();
  const brandSigns = generateCityBrandSigns(options, layout.buildings);
  const shopfronts = generateCityShopfronts(options, layout.buildings);
  const shopByBuilding = new Map(
    shopfronts.map((shop) => [shop.buildingId, shop] as const),
  );

  const billboards: ResolvedCityBillboard[] = [];
  for (const slot of layout.billboards) {
    const format = getOohFormat(slot.formatId);
    if (!format) continue;
    const item = slot.itemId ? getPrintItem(slot.itemId) : undefined;
    // A wall panel and a shopfront both want the street frontage of the same
    // block. The shop takes the ground floor, so the panel rides up over it.
    const shop =
      slot.mount === 'facade' && slot.buildingId
        ? shopByBuilding.get(slot.buildingId)
        : undefined;
    const lifted = shop
      ? liftAboveShop(slot, oohSceneHeight(format), shop)
      : undefined;
    billboards.push({
      slot: lifted ?? slot,
      format,
      ...(item ? { item } : {}),
    });
  }

  const signs: ResolvedCitySign[] = [];
  for (const slot of layout.signs) {
    const sign = getRoadSign(slot.signId);
    if (sign) signs.push({ slot, sign });
  }

  const shotSubjects = resolveShotSubjects(billboards, signs, shopfronts, vehicles);

  return {
    title:
      typeof merged.title === 'string' && merged.title.length > 0
        ? merged.title
        : DEFAULT_CITY_INPUTS.title,
    tagline:
      typeof merged.tagline === 'string' && merged.tagline.length > 0
        ? merged.tagline
        : DEFAULT_CITY_INPUTS.tagline,
    brand: merged.brand ?? DEFAULT_CITY_INPUTS.brand,
    layout,
    route: route ? generateCityRoute(options) : undefined,
    billboards,
    signs,
    vehicles,
    props,
    crossings,
    junctions,
    brandSigns,
    shopfronts,
    shotSubjects,
    specs,
    playlist: OOH_PLAYLIST,
    cameraPath: coerceCameraPath(merged.cameraPath ?? DEFAULT_CITY_INPUTS.cameraPath),
  };
}
