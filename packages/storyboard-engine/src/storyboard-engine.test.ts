import { describe, it, expect } from 'vitest';
import { StoryboardEngine } from './index.js';

describe('StoryboardEngine', () => {
  it('can be instantiated', () => {
    const engine = new StoryboardEngine();
    expect(engine).toBeDefined();
  });
});
