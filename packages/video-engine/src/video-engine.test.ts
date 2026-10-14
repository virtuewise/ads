import { describe, expect, it } from 'vitest';
import { VideoEngine } from './index.js';

describe('VideoEngine', () => {
  it('can be instantiated', () => {
    const engine = new VideoEngine();
    expect(engine).toBeDefined();
  });
});
