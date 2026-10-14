import { describe, expect, it } from 'vitest';
import { TypographyEngine } from './index.js';

describe('TypographyEngine', () => {
  it('can be instantiated', () => {
    const engine = new TypographyEngine();
    expect(engine).toBeDefined();
  });
});
