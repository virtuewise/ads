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
