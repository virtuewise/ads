import { describe, expect, it } from 'vitest';
import { AssetEngine } from './index.js';

describe('AssetEngine', () => {
  it('can be instantiated', () => {
    const engine = new AssetEngine();
    expect(engine).toBeDefined();
  });
});
