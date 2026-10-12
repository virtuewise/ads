import { describe, it, expect } from 'vitest';
import {
  BrandTokensSchema,
  CameraPathSchema,
  CompositionIdSchema,
  RenderOutputSchema,
  RenderInputsSchema,
  RenderItemSchema,
  validateRenderInputs,
} from '../src/render-input.js';

describe('BrandTokensSchema', () => {
  it('accepts a valid token set', () => {
    const tokens = BrandTokensSchema.parse({
      wordmark: 'PRINTSYNC',
      tagline: 'Your Vision. Our Precision.',
      primary: '#C8001C',
      secondary: '#373435',
      accent: '#00A8E0',
      paper: '#F5F1EA',
      ink: '#141414',
    });
    expect(tokens.wordmark).toBe('PRINTSYNC');
  });

  it('rejects an empty wordmark', () => {
    expect(() =>
      BrandTokensSchema.parse({
        wordmark: '',
        tagline: 'x',
        primary: '#fff',
        secondary: '#000',
        accent: '#f00',
        paper: '#fff',
        ink: '#000',
      }),
    ).toThrow();
  });
});

describe('CompositionIdSchema', () => {
  it('accepts known compositions', () => {
    expect(CompositionIdSchema.parse('PrintSyncSignatureFilm')).toBe(
      'PrintSyncSignatureFilm',
    );
    expect(CompositionIdSchema.parse('PrintSyncProductLine')).toBe(
      'PrintSyncProductLine',
    );
    expect(CompositionIdSchema.parse('PrintSyncBrandFilm')).toBe(
      'PrintSyncBrandFilm',
    );
  });

  it('rejects unknown compositions', () => {
    expect(() => CompositionIdSchema.parse('Nope')).toThrow();
  });
});

describe('CameraPathSchema', () => {
  it('accepts known paths', () => {
    for (const p of ['turntable', 'orbit', 'dolly', 'hero', 'none']) {
      expect(CameraPathSchema.parse(p)).toBe(p);
    }
  });
  it('rejects unknown paths', () => {
    expect(() => CameraPathSchema.parse('zoom')).toThrow();
  });
});

describe('RenderOutputSchema', () => {
  it('accepts a valid output', () => {
    expect(
      RenderOutputSchema.parse({ format: 'mp4', width: 1920, height: 1080 }),
    ).toMatchObject({ format: 'mp4', width: 1920, height: 1080 });
  });
  it('rejects a bad format', () => {
    expect(() =>
      RenderOutputSchema.parse({ format: 'avi', width: 1920, height: 1080 }),
    ).toThrow();
  });
  it('rejects non-positive dimensions', () => {
    expect(() =>
      RenderOutputSchema.parse({ format: 'mp4', width: 0, height: 1080 }),
    ).toThrow();
  });
});

describe('RenderItemSchema', () => {
  it('accepts a minimal item with defaults', () => {
    expect(RenderItemSchema.parse({ id: 'business-card' })).toMatchObject({
      id: 'business-card',
      animation: 'float',
      phase: 0,
    });
  });
  it('rejects unknown animations', () => {
    expect(() =>
      RenderItemSchema.parse({ id: 'x', animation: 'explode' }),
    ).toThrow();
  });
});

describe('RenderInputsSchema / validateRenderInputs', () => {
  const valid = {
    composition: 'PrintSyncProductLine',
    brand: {
      wordmark: 'PRINTSYNC',
      tagline: 'Your Vision. Our Precision.',
      primary: '#C8001C',
      secondary: '#373435',
      accent: '#00A8E0',
      paper: '#F5F1EA',
      ink: '#141414',
    },
    items: ['business-card', 'bottle-500'],
    itemAnimations: [{ id: 'bottle-500', animation: 'spin', phase: 12 }],
    cameraPath: 'turntable',
    audioSrc: 'printsync-signature.wav',
    timeline: { fps: 30, durationInFrames: 450 },
    output: { format: 'mp4', width: 1920, height: 1080 },
  };

  it('accepts a fully-specified input', () => {
    const parsed = validateRenderInputs(valid);
    expect(parsed.composition).toBe('PrintSyncProductLine');
    expect(parsed.items).toHaveLength(2);
    expect(parsed.itemAnimations[0]?.animation).toBe('spin');
  });

  it('applies defaults for optional fields', () => {
    const minimal = {
      composition: 'PrintSyncBrandFilm',
      brand: valid.brand,
      items: ['business-card'],
      output: { format: 'mp4', width: 1920, height: 1080 },
    };
    const parsed = validateRenderInputs(minimal);
    expect(parsed.cameraPath).toBe('turntable');
    expect(parsed.itemAnimations).toEqual([]);
    expect(parsed.timeline.fps).toBe(30);
    expect(parsed.timeline.durationInFrames).toBe(450);
  });

  it('rejects an empty items list', () => {
    expect(() =>
      validateRenderInputs({ ...valid, items: [] }),
    ).toThrow();
  });

  it('rejects a missing brand', () => {
    const { brand: _omit, ...rest } = valid as Record<string, unknown>;
    expect(() => validateRenderInputs(rest)).toThrow();
  });

  it('rejects a bad composition', () => {
    expect(() =>
      validateRenderInputs({ ...valid, composition: 'Nope' }),
    ).toThrow();
  });
});
