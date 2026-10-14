import { describe, expect, it } from 'vitest';
import { StoryboardEngine } from './index.js';

describe('StoryboardEngine', () => {
  it('can be instantiated', () => {
    const engine = new StoryboardEngine();
    expect(engine).toBeDefined();
  });
});
