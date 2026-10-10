import { describe, it, expect } from 'vitest';
import { InfographicEngine } from './index.js';

describe('InfographicEngine', () => {
  it('can be instantiated', () => {
    const engine = new InfographicEngine();
    expect(engine).toBeDefined();
  });
});
