/**
 * Out-of-home (OOH) advertising format catalogue.
 *
 * The city scene advertises on real-world poster and digital-display formats,
 * so every panel is measured in the same millimetres as the rest of the
 * platform. Paper formats carry their industry sheet count, and every format
 * declares how high its bottom edge sits above the pavement.
 */

import { toSceneUnits } from './print-items.js';
import type { BrandTokens } from './artwork.js';
import { hashSeedOf } from './hash.js';

export type OohMedium = 'paper' | 'digital';

export interface OohSpec {
  readonly id: string;
  readonly name: string;
  /** Panel width in millimetres. */
  readonly width: number;
  /** Panel height in millimetres. */
  readonly height: number;
  readonly medium: OohMedium;
  /** Millimetres from the ground to the bottom edge of the panel. */
  readonly mountHeight: number;
  /** Human-readable size, e.g. "6096 x 3048 mm". */
  readonly label: string;
  /** Industry sheet count for paper formats. */
  readonly sheets?: number;
  /** Optional production note. */
  readonly note?: string;
}

/**
 * The catalogue. Street furniture through to large-format roadside and
 * digital spectaculars.
 */
export const OOH_FORMATS: readonly OohSpec[] = [
  {
    id: 'ooh-citylight',
    name: 'Citylight',
    width: 1185,
    height: 1750,
    medium: 'paper',
    mountHeight: 900,
    label: '1185 x 1750 mm',
    sheets: 1,
    note: 'Bus-shelter / citylight poster.',
  },
  {
    id: 'ooh-6sheet',
    name: '6-Sheet',
    width: 1200,
    height: 1800,
    medium: 'paper',
    mountHeight: 600,
    label: '1200 x 1800 mm',
    sheets: 1,
    note: 'Standard 6-sheet (1200 x 1800 mm).',
  },
  {
    id: 'ooh-48sheet',
    name: '48-Sheet',
    width: 6096,
    height: 3048,
    medium: 'paper',
    mountHeight: 2500,
    label: '6096 x 3048 mm',
    sheets: 48,
    note: 'Standard 48-sheet billboard.',
  },
  {
    id: 'ooh-96sheet',
    name: '96-Sheet',
    width: 12192,
    height: 3048,
    medium: 'paper',
    mountHeight: 3000,
    label: '12192 x 3048 mm',
    sheets: 96,
    note: 'Standard 96-sheet billboard.',
  },
  {
    id: 'ooh-digital-96',
    name: 'Digital 96-Sheet',
    width: 12192,
    height: 3048,
    medium: 'digital',
    mountHeight: 3000,
    label: '12192 x 3048 mm',
    note: 'Digital 96-sheet spectacular (4:1).',
  },
  {
    id: 'ooh-digital-poster',
    name: 'Digital Portrait',
    width: 1620,
    height: 2880,
    medium: 'digital',
    mountHeight: 800,
    label: '1620 x 2880 mm',
    note: 'Portrait digital street furniture (9:16).',
  },
  {
    id: 'ooh-lamp-banner',
    name: 'Lamp-Post Banner',
    width: 500,
    height: 1500,
    medium: 'paper',
    mountHeight: 3000,
    label: '500 x 1500 mm',
    sheets: 1,
    note: 'Lamp-post banner, double-sided.',
  },
];

/** Every format id, in catalogue order. */
export const OOH_FORMAT_IDS: readonly string[] = OOH_FORMATS.map((format) => format.id);

/** Look up a format by id. */
export function getOohFormat(id: string): OohSpec | undefined {
  return OOH_FORMATS.find((format) => format.id === id);
}

/** Panel aspect ratio (width / height). */
export function oohAspect(format: OohSpec): number {
  return format.width / format.height;
}

/** Panel width in shared scene units. */
export function oohSceneWidth(format: OohSpec): number {
  return toSceneUnits(format.width);
}

/** Panel height in shared scene units. */
export function oohSceneHeight(format: OohSpec): number {
  return toSceneUnits(format.height);
}

/** Bottom-edge height above the ground, in shared scene units. */
export function oohSceneMountHeight(format: OohSpec): number {
  return toSceneUnits(format.mountHeight);
}

/** Copy that a digital billboard rotates through, per format. */
export interface OohHeadline {
  readonly kicker: string;
  readonly headline: string;
  readonly body: string;
}

/**
 * Default digital playlist. This is the story the city tells: what PrintSync
 * actually offers, cycling across the spectaculars.
 */
export const OOH_PLAYLIST: readonly OohHeadline[] = [
  {
    kicker: 'Large Format',
    headline: 'BUILT TO BE SEEN',
    body: '48-sheet to 96-sheet, printed and installed.',
  },
  {
    kicker: 'Road Safety',
    headline: 'SIGNAGE THAT COMPLIES',
    body: 'TSRGD-spec signs, reflective and built to last.',
  },
  {
    kicker: 'Packaging',
    headline: 'SHELF-READY PACKS',
    body: 'Cartons, pouches and labels, modelled to spec.',
  },
  {
    kicker: 'Digital',
    headline: 'SCREENS THAT SELL',
    body: 'Programmable digital out-of-home, on brand.',
  },
  {
    kicker: 'Wayfinding',
    headline: 'EVERY ROUTE CLEAR',
    body: 'Directional and information systems, end to end.',
  },
];

/** A resolved, renderable out-of-home design. */
export interface OohArtworkSpec {
  readonly formatId: string;
  readonly medium: OohMedium;
  /** Panel aspect ratio (width / height). */
  readonly aspect: number;
  readonly kicker: string;
  readonly headline: string;
  readonly body: string;
  readonly wordmark: string;
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly paper: string;
  readonly ink: string;
  /** Stable seed for the decorative production marks. */
  readonly seed: number;
  /** Catalogue item depicted on the panel, when the format is paper. */
  readonly itemId?: string;
}

/**
 * Derive a deterministic out-of-home design for a format, brand and headline.
 * Pure: the same inputs always produce the same panel.
 */
export function buildOohArtworkSpec(
  format: OohSpec,
  brand: BrandTokens,
  headline: OohHeadline,
  itemId?: string,
): OohArtworkSpec {
  return {
    formatId: format.id,
    medium: format.medium,
    aspect: oohAspect(format),
    kicker: headline.kicker,
    headline: headline.headline,
    body: headline.body,
    wordmark: brand.wordmark,
    primary: brand.primary,
    secondary: brand.secondary,
    accent: brand.accent,
    paper: brand.paper,
    ink: brand.ink,
    seed: hashSeedOf(format.id, itemId ?? '', headline.headline),
    ...(itemId !== undefined ? { itemId } : {}),
  };
}
