import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRODUCT_LINE_INPUTS,
  DEFAULT_CITY_INPUTS,
  DEFAULT_CITY_SEED,
  coerceCameraPath,
  coerceTimeOfDay,
  resolveCityInputs,
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

describe('DEFAULT_CITY_INPUTS', () => {
  it('defaults to a night drive down the boulevard', () => {
    expect(DEFAULT_CITY_INPUTS.timeOfDay).toBe('night');
    expect(DEFAULT_CITY_INPUTS.cameraPath).toBe('dolly');
    expect(DEFAULT_CITY_INPUTS.seed).toBe(DEFAULT_CITY_SEED);
    expect(DEFAULT_CITY_INPUTS.route).toBe(true);
    expect(DEFAULT_CITY_INPUTS.density).toBeGreaterThan(0);
  });

  it('advertises the curated hero set by default', () => {
    expect([...DEFAULT_CITY_INPUTS.items]).toEqual([...PRINT_ITEMS_HERO_IDS]);
    expect(DEFAULT_CITY_INPUTS.brand).toEqual(DEFAULT_BRAND_TOKENS);
  });
});

describe('coerceTimeOfDay', () => {
  it('returns the value when valid', () => {
    for (const value of ['night', 'dusk', 'day'] as const) {
      expect(coerceTimeOfDay(value)).toBe(value);
    }
  });

  it('falls back to night', () => {
    expect(coerceTimeOfDay(undefined)).toBe('night');
    expect(coerceTimeOfDay('midday')).toBe('night');
  });
});

describe('resolveCityInputs', () => {
  it('builds a full, deterministic city from defaults', () => {
    const resolved = resolveCityInputs();
    expect(resolved.layout.buildings.length).toBeGreaterThan(0);
    expect(resolved.layout.billboards.length).toBeGreaterThan(0);
    expect(resolved.layout.signs.length).toBeGreaterThan(0);
    expect(resolved.layout.streetLights.length).toBeGreaterThan(0);
    expect(resolved.route).toBeDefined();
    expect(resolved.playlist.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same inputs', () => {
    expect(resolveCityInputs()).toEqual(resolveCityInputs());
  });

  it('produces different cities for different seeds', () => {
    const a = resolveCityInputs({ seed: 'alpha' });
    const b = resolveCityInputs({ seed: 'beta' });
    expect(a.layout).not.toEqual(b.layout);
  });

  it('omits the route when it is switched off', () => {
    expect(resolveCityInputs({ route: false }).route).toBeUndefined();
  });

  it('resolves every billboard against a real format', () => {
    const resolved = resolveCityInputs();
    expect(resolved.billboards.length).toBeGreaterThan(0);
    for (const entry of resolved.billboards) {
      expect(entry.format.id).toBe(entry.slot.formatId);
      if (entry.slot.medium === 'paper' && entry.slot.itemId) {
        expect(entry.item?.id).toBe(entry.slot.itemId);
      }
    }
  });

  it('resolves every sign against the signage catalogue', () => {
    const resolved = resolveCityInputs();
    expect(resolved.signs.length).toBeGreaterThan(0);
    for (const entry of resolved.signs) {
      expect(entry.sign.id).toBe(entry.slot.signId);
    }
  });

  it('honours title, tagline, time of day and camera overrides', () => {
    const resolved = resolveCityInputs({
      title: 'Night Run',
      tagline: 'Print, everywhere.',
      timeOfDay: 'dusk',
      cameraPath: 'hero',
    });
    expect(resolved.title).toBe('Night Run');
    expect(resolved.tagline).toBe('Print, everywhere.');
    expect(resolved.layout.timeOfDay).toBe('dusk');
    expect(resolved.cameraPath).toBe('hero');
  });

  it('drops unknown item ids and keeps the catalogue content real', () => {
    const resolved = resolveCityInputs({ items: ['nope', 'can-330'] });
    expect(resolved.specs.map((s) => s.id)).toEqual(['can-330']);
    for (const entry of resolved.billboards) {
      if (entry.item) expect(entry.item.id).toBe('can-330');
    }
  });

  it('falls back to the hero set when every requested item is unknown', () => {
    const resolved = resolveCityInputs({ items: ['nope'] });
    expect(resolved.specs.map((s) => s.id)).toEqual([...PRINT_ITEMS_HERO_IDS]);
  });

  it('falls back for a non-positive density and blank strings', () => {
    const resolved = resolveCityInputs({
      density: 0,
      seed: '',
      title: '',
      tagline: '',
      timeOfDay: 'whenever' as never,
    });
    expect(resolved.layout.seed).toBe(DEFAULT_CITY_SEED);
    expect(resolved.title).toBe(DEFAULT_CITY_INPUTS.title);
    expect(resolved.tagline).toBe(DEFAULT_CITY_INPUTS.tagline);
    expect(resolved.layout.timeOfDay).toBe('night');
  });
});
