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
import { CAMERA_PATHS, type CameraPath } from './camera.js';
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
import { OOH_PLAYLIST, getOohFormat, type OohHeadline, type OohSpec } from './ooh.js';
import { getRoadSign, type RoadSignSpec } from './signage.js';

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
    cameraPath: coerceCameraPath(merged.cameraPath),
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
  cameraPath: 'dolly',
  items: PRINT_ITEMS_HERO_IDS,
};

const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ['night', 'dusk', 'day'];

/** Narrow an arbitrary string to a known time of day, defaulting to night. */
export function coerceTimeOfDay(value: string | undefined): TimeOfDay {
  return TIME_OF_DAY_VALUES.find((v) => v === value) ?? 'night';
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

  const billboards: ResolvedCityBillboard[] = [];
  for (const slot of layout.billboards) {
    const format = getOohFormat(slot.formatId);
    if (!format) continue;
    const item = slot.itemId ? getPrintItem(slot.itemId) : undefined;
    billboards.push({ slot, format, ...(item ? { item } : {}) });
  }

  const signs: ResolvedCitySign[] = [];
  for (const slot of layout.signs) {
    const sign = getRoadSign(slot.signId);
    if (sign) signs.push({ slot, sign });
  }

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
    specs,
    playlist: OOH_PLAYLIST,
    cameraPath: coerceCameraPath(merged.cameraPath),
  };
}
