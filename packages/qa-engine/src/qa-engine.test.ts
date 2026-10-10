import { describe, it, expect } from 'vitest';
import { QAEngine } from './index.js';

describe('QAEngine', () => {
  it('can be instantiated', () => {
    const engine = new QAEngine();
    expect(engine).toBeDefined();
  });
});
