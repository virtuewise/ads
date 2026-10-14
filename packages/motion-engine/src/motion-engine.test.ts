import { describe, expect, it } from 'vitest';
import { MotionEngine } from './index.js';

describe('MotionEngine', () => {
  it('can be instantiated', () => {
    const engine = new MotionEngine();
    expect(engine).toBeDefined();
  });
});
