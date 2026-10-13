import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRODUCT_LINE_INPUTS,
  coerceCameraPath,
  resolveProductLineInputs,
} from './render-inputs.js';
import {
  PRINT_ITEMS,
  PRINT_ITEMS_HERO_ANIMATIONS,
  PRINT_ITEMS_HERO_IDS,
  getPrintItem,
} from './print-items.js';
import { CAMERA_PATHS } from './camera.js';
import { DEFAULT_BRAND_TOKENS } from './artwork.js';

describe('DEFAULT_PRODUCT_LINE_INPUTS', () => {
  it('defaults to the curated hero set and the turntable path', () => {
    expect([...DEFAULT_PRODUCT_LINE_INPUTS.items]).toEqual([...PRINT_ITEMS_HERO_IDS]);
    expect(DEFAULT_PRODUCT_LINE_INPUTS.itemAnimations).toEqual([]);
    expect(DEFAULT_PRODUCT_LINE_INPUTS.cameraPath).toBe('turntable');
    expect(DEFAULT_PRODUCT_LINE_INPUTS.title.length).toBeGreaterThan(0);
    expect(DEFAULT_PRODUCT_LINE_INPUTS.tagline.length).toBeGreaterThan(0);
  });

  it('ships every editable brand token', () => {
    expect(DEFAULT_PRODUCT_LINE_INPUTS.brand).toEqual(DEFAULT_BRAND_TOKENS);
  });
});

describe('coerceCameraPath', () => {
  it('returns the path when it is valid', () => {
    for (const path of CAMERA_PATHS) {
      expect(coerceCameraPath(path)).toBe(path);
    }
  });

  it('falls back to turntable for unknown or undefined paths', () => {
    expect(coerceCameraPath(undefined)).toBe('turntable');
    expect(coerceCameraPath('not-a-camera-path')).toBe('turntable');
    expect(coerceCameraPath('')).toBe('turntable');
  });
});

describe('resolveProductLineInputs', () => {
  it('uses defaults when given no inputs', () => {
    const resolved = resolveProductLineInputs();
    expect(resolved.title).toBe(DEFAULT_PRODUCT_LINE_INPUTS.title);
    expect(resolved.tagline).toBe(DEFAULT_PRODUCT_LINE_INPUTS.tagline);
    expect(resolved.brand).toEqual(DEFAULT_BRAND_TOKENS);
    expect(resolved.specs).toHaveLength(PRINT_ITEMS_HERO_IDS.length);
    expect(resolved.cameraPath).toBe('turntable');
  });

  it('uses defaults when given null-ish inputs', () => {
    const resolved = resolveProductLineInputs(undefined);
    expect(resolved.specs).toHaveLength(PRINT_ITEMS_HERO_IDS.length);
    expect(resolved.cameraPath).toBe('turntable');
  });

  it('honours an explicit title, tagline and camera path', () => {
    const resolved = resolveProductLineInputs({
      title: 'Spring Campaign',
      tagline: 'Fresh print, fresh ideas.',
      cameraPath: 'dolly',
    });
    expect(resolved.title).toBe('Spring Campaign');
    expect(resolved.tagline).toBe('Fresh print, fresh ideas.');
    expect(resolved.cameraPath).toBe('dolly');
  });

  it('resolves requested item ids to specs, in order', () => {
    const resolved = resolveProductLineInputs({ items: ['can-330', 'bottle-500'] });
    expect(resolved.specs.map((s) => s.id)).toEqual(['can-330', 'bottle-500']);
  });

  it('assigns choreography aligned to the resolved specs', () => {
    const resolved = resolveProductLineInputs({ items: ['can-330', 'bottle-500'] });
    expect(resolved.choreography).toHaveLength(2);
    expect(resolved.choreography[0]?.id).toBe('can-330');
    expect(resolved.specs[0]?.id).toBe(resolved.choreography[0]?.id);
    expect(resolved.specs[1]?.id).toBe(resolved.choreography[1]?.id);
  });

  it('honours choreography overrides by item id', () => {
    const resolved = resolveProductLineInputs({
      items: ['can-330', 'bottle-500'],
      itemAnimations: [{ id: 'bottle-500', animation: 'spin', phase: 99 }],
    });
    const bottle = resolved.choreography.find((c) => c.id === 'bottle-500');
    expect(bottle?.animation).toBe('spin');
    expect(bottle?.phase).toBe(99);
  });

  it('falls back to the hero set when every requested id is unknown', () => {
    const resolved = resolveProductLineInputs({ items: ['nope', 'also-nope'] });
    expect(resolved.specs).toHaveLength(PRINT_ITEMS_HERO_IDS.length);
    expect(resolved.specs.map((s) => s.id)).toEqual([...PRINT_ITEMS_HERO_IDS]);
  });

  it('keeps hero choreography for the default hero set', () => {
    const resolved = resolveProductLineInputs();
    resolved.choreography.forEach((entry, index) => {
      expect(entry.animation).toBe(PRINT_ITEMS_HERO_ANIMATIONS[index]);
      expect(entry.id).toBe(PRINT_ITEMS_HERO_IDS[index]);
    });
  });

  it('falls back to defaults for blank strings', () => {
    const resolved = resolveProductLineInputs({ title: '', tagline: '' });
    expect(resolved.title).toBe(DEFAULT_PRODUCT_LINE_INPUTS.title);
    expect(resolved.tagline).toBe(DEFAULT_PRODUCT_LINE_INPUTS.tagline);
  });

  it('never resolves a spec that is not in the catalogue', () => {
    const resolved = resolveProductLineInputs({ items: [...PRINT_ITEMS.map((i) => i.id)] });
    const ids = new Set(PRINT_ITEMS.map((i) => i.id));
    for (const spec of resolved.specs) {
      expect(ids.has(spec.id)).toBe(true);
    }
  });

  it('resolves every catalogue item when the whole catalogue is requested', () => {
    const resolved = resolveProductLineInputs({ items: PRINT_ITEMS.map((i) => i.id) });
    expect(resolved.specs).toHaveLength(PRINT_ITEMS.length);
    expect(resolved.specs.every((spec) => getPrintItem(spec.id) === spec)).toBe(true);
  });
});
