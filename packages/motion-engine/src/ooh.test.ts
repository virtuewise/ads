import { describe, expect, it } from 'vitest';
import {
  buildOohArtworkSpec,
  getOohFormat,
  OOH_FORMAT_IDS,
  OOH_FORMATS,
  OOH_PLAYLIST,
  oohAspect,
  oohSceneHeight,
  oohSceneMountHeight,
  oohSceneWidth,
} from './ooh.js';
import { toSceneUnits } from './print-items.js';
import { required } from './test-support.js';

describe('OOH_FORMATS', () => {
  it('has unique ids', () => {
    expect(new Set(OOH_FORMAT_IDS).size).toBe(OOH_FORMATS.length);
  });

  it('uses positive millimetre panels', () => {
    for (const format of OOH_FORMATS) {
      expect(format.width).toBeGreaterThan(0);
      expect(format.height).toBeGreaterThan(0);
      expect(format.mountHeight).toBeGreaterThan(0);
    }
  });

  it('covers both paper and digital media', () => {
    const media = new Set(OOH_FORMATS.map((format) => format.medium));
    expect([...media].sort()).toEqual(['digital', 'paper']);
  });

  it('records sheet counts for paper formats', () => {
    for (const format of OOH_FORMATS) {
      if (format.medium === 'paper' && format.sheets !== undefined) {
        expect(format.sheets).toBeGreaterThan(0);
      }
    }
  });

  it('uses the standard large-format sheet sizes', () => {
    expect(getOohFormat('ooh-48sheet')).toMatchObject({ width: 6096, height: 3048, sheets: 48 });
    expect(getOohFormat('ooh-96sheet')).toMatchObject({ width: 12192, height: 3048, sheets: 96 });
    expect(getOohFormat('ooh-6sheet')).toMatchObject({ width: 1200, height: 1800, sheets: 1 });
  });

  it('sticks to 1 sheet for single-poster formats', () => {
    for (const id of ['ooh-citylight', 'ooh-6sheet', 'ooh-lamp-banner']) {
      expect(getOohFormat(id)?.sheets).toBe(1);
    }
  });
});

describe('getOohFormat', () => {
  it('finds every format by id', () => {
    for (const id of OOH_FORMAT_IDS) {
      expect(getOohFormat(id)?.id).toBe(id);
    }
  });

  it('returns undefined for unknown ids', () => {
    expect(getOohFormat('nope')).toBeUndefined();
  });
});

describe('ooh scene helpers', () => {
  it('converts format dimensions into shared scene units', () => {
    const format = required(getOohFormat('ooh-96sheet'), 'ooh-96sheet is a known format');
    expect(oohSceneWidth(format)).toBeCloseTo(toSceneUnits(12192), 12);
    expect(oohSceneHeight(format)).toBeCloseTo(toSceneUnits(3048), 12);
    expect(oohSceneMountHeight(format)).toBeCloseTo(toSceneUnits(3000), 12);
  });

  it('reports the panel aspect ratio', () => {
    const format = required(getOohFormat('ooh-96sheet'), 'ooh-96sheet is a known format');
    expect(oohAspect(format)).toBeCloseTo(4, 12);
  });
});

describe('OOH_PLAYLIST', () => {
  it('is non-empty and fully populated', () => {
    expect(OOH_PLAYLIST.length).toBeGreaterThan(0);
    for (const entry of OOH_PLAYLIST) {
      expect(entry.kicker.length).toBeGreaterThan(0);
      expect(entry.headline.length).toBeGreaterThan(0);
      expect(entry.body.length).toBeGreaterThan(0);
    }
  });

  it('advertises the platform offering', () => {
    const text = OOH_PLAYLIST.map((e) => `${e.kicker} ${e.headline} ${e.body}`).join(' ');
    for (const term of ['Large Format', 'Road Safety', 'Packaging', 'Digital', 'Wayfinding']) {
      expect(text).toContain(term);
    }
  });
});

describe('buildOohArtworkSpec', () => {
  const brand = {
    wordmark: 'PRINTSYNC',
    tagline: 'Your Vision. Our Precision.',
    primary: '#C8001C',
    secondary: '#373435',
    accent: '#00A8E0',
    paper: '#F5F1EA',
    ink: '#141414',
  };
  const headline = required(OOH_PLAYLIST[0], 'OOH playlist has a first entry');

  it('carries the format, brand and headline through', () => {
    const spec = buildOohArtworkSpec(
      required(getOohFormat('ooh-48sheet'), 'ooh-48sheet is a known format'),
      brand,
      headline,
      'can-330',
    );
    expect(spec.formatId).toBe('ooh-48sheet');
    expect(spec.medium).toBe('paper');
    expect(spec.aspect).toBeCloseTo(2, 12);
    expect(spec.wordmark).toBe('PRINTSYNC');
    expect(spec.headline).toBe(headline.headline);
    expect(spec.itemId).toBe('can-330');
  });

  it('omits the item for digital formats without one', () => {
    const spec = buildOohArtworkSpec(
      required(getOohFormat('ooh-digital-96'), 'ooh-digital-96 is a known format'),
      brand,
      headline,
    );
    expect(spec.itemId).toBeUndefined();
    expect(spec.medium).toBe('digital');
  });

  it('is deterministic', () => {
    const format = required(getOohFormat('ooh-6sheet'), 'ooh-6sheet is a known format');
    const a = buildOohArtworkSpec(format, brand, headline, 'rigid-box');
    const b = buildOohArtworkSpec(format, brand, headline, 'rigid-box');
    expect(a).toEqual(b);
  });

  it('changes the seed when the content changes', () => {
    const format = required(getOohFormat('ooh-6sheet'), 'ooh-6sheet is a known format');
    const a = buildOohArtworkSpec(format, brand, headline, 'rigid-box');
    const b = buildOohArtworkSpec(format, brand, headline, 'can-330');
    expect(a.seed).not.toBe(b.seed);
  });
});
