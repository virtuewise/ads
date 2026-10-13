import { describe, it, expect } from 'vitest';
import { RenderInputsSchema, type CreativeBrief } from '@printsync/common';
import { PRINT_ITEMS_HERO_IDS } from '@printsync/motion-engine';
import { buildCityRenderInputs, buildRenderInputs } from './index.js';

const brief: CreativeBrief = {
  id: 'brief-001',
  title: 'PrintSync Living City',
  duration: 40,
  mode: 'cinematic',
  service: 'large-format',
  objective: 'Show every surface PrintSync prints.',
  voice: 'confident',
  scenes: ['city'],
};

describe('buildRenderInputs', () => {
  it('produces inputs that satisfy the shared contract', () => {
    expect(() => RenderInputsSchema.parse(buildRenderInputs(brief))).not.toThrow();
  });

  it('targets the product line and the shared hero set', () => {
    const inputs = buildRenderInputs(brief);
    expect(inputs.composition).toBe('PrintSyncProductLine');
    expect(inputs.items).toEqual([...PRINT_ITEMS_HERO_IDS]);
    expect(inputs.cameraPath).toBe('turntable');
  });

  it('carries the brief objective through as the tagline', () => {
    expect(buildRenderInputs(brief).brand.tagline).toBe(brief.objective);
  });
});

describe('buildCityRenderInputs', () => {
  it('produces inputs that satisfy the shared contract', () => {
    expect(() => RenderInputsSchema.parse(buildCityRenderInputs(brief))).not.toThrow();
  });

  it('targets the living city with a travelling camera', () => {
    const inputs = buildCityRenderInputs(brief);
    expect(inputs.composition).toBe('PrintSyncLivingCity');
    expect(inputs.cameraPath).toBe('dolly');
    expect(inputs.city?.timeOfDay).toBe('night');
    expect(inputs.city?.route).toBe(true);
  });

  it('derives a deterministic seed from the brief', () => {
    expect(buildCityRenderInputs(brief).city?.seed).toBe('brief-001');
  });

  it('lets a caller override the seed and time of day', () => {
    const inputs = buildCityRenderInputs(brief, { seed: 'cli-seed', timeOfDay: 'dusk' });
    expect(inputs.city?.seed).toBe('cli-seed');
    expect(inputs.city?.timeOfDay).toBe('dusk');
  });

  it('advertises the shared hero set', () => {
    expect(buildCityRenderInputs(brief).items).toEqual([...PRINT_ITEMS_HERO_IDS]);
  });
});
