import { describe, it, expect } from 'vitest';
import { TypographyEngine } from './index.js';

describe('TypographyEngine', () => {
  it('can be instantiated', () => {
    const engine = new TypographyEngine();
    expect(engine).toBeDefined();
  });
});
