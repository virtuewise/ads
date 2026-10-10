import { describe, it, expect } from 'vitest';
import { AudioEngine } from './index.js';

describe('AudioEngine', () => {
  it('can be instantiated', () => {
    const engine = new AudioEngine();
    expect(engine).toBeDefined();
  });
});
