import { describe, expect, it } from 'vitest';
import { ImageEngine } from './index.js';

describe('ImageEngine', () => {
  it('can be instantiated', () => {
    const engine = new ImageEngine();
    expect(engine).toBeDefined();
  });
});
