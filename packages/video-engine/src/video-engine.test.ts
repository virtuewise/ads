import { describe, it, expect } from 'vitest';
import { VideoEngine } from './index.js';

describe('VideoEngine', () => {
  it('can be instantiated', () => {
    const engine = new VideoEngine();
    expect(engine).toBeDefined();
  });
});
